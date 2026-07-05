import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import * as readline from "node:readline";
import path from "node:path";
import type { ScannedItem } from "./types.js";

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB
export const DEFAULT_TAGS = ["TODO", "FIXME", "HACK", "XXX"];

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp",
  ".pdf", ".zip", ".gz", ".tar", ".7z", ".rar",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp3", ".mp4", ".mov", ".avi", ".mkv", ".wav",
  ".exe", ".dll", ".so", ".dylib", ".bin", ".class", ".jar",
  ".pyc", ".o", ".a", ".lock",
]);

/** Block-style comment markers, mapped opener -> closer. Comments may span multiple lines. */
const BLOCK_MARKERS: Record<string, string> = {
  "/*": "*/",
  "<!--": "-->",
  '"""': '"""',
  "'''": "'''",
};
/** Single-line comment markers that run to end of line. */
const LINE_MARKERS = ["//", "#", "--", ";"];
const ALL_MARKERS = [...Object.keys(BLOCK_MARKERS), ...LINE_MARKERS];

export interface ScanOptions {
  cwd: string;
  tags?: string[];
  pathGlobs?: string[];
  excludeGlobs?: string[];
}

export interface ScanResult {
  items: ScannedItem[];
  shallowClone: boolean;
}

function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `git ${args.join(" ")} exited with ${code}`));
    });
  });
}

export async function listTrackedFiles(cwd: string): Promise<string[]> {
  const output = await runGit(["ls-files"], cwd);
  return output.split("\n").filter(Boolean);
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
    return true;
  } catch {
    return false;
  }
}

export async function isShallowClone(cwd: string): Promise<boolean> {
  try {
    const out = await runGit(["rev-parse", "--is-shallow-repository"], cwd);
    return out.trim() === "true";
  } catch {
    return false;
  }
}

export async function isGitAvailable(): Promise<boolean> {
  try {
    await runGit(["--version"], process.cwd());
    return true;
  } catch {
    return false;
  }
}

function simpleGlobToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i] as string;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

function matchesGlobs(file: string, globs: string[] | undefined): boolean {
  if (!globs || globs.length === 0) return false;
  return globs.some((g) => simpleGlobToRegExp(g).test(file));
}

function isBinaryPath(file: string): boolean {
  const dot = file.lastIndexOf(".");
  if (dot === -1) return false;
  return BINARY_EXTENSIONS.has(file.slice(dot).toLowerCase());
}

async function looksBinary(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const stream = createReadStream(filePath, { start: 0, end: 511 });
    let found = false;
    stream.on("data", (chunk) => {
      if ((chunk as Buffer).includes(0)) found = true;
    });
    stream.on("error", () => resolve(true));
    stream.on("close", () => resolve(found));
  });
}

function buildTagRegex(tags: string[]): RegExp {
  const escaped = tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b\\s*:?\\s*(.*)`, "i");
}

function findEarliestMarker(line: string): { marker: string; index: number } | null {
  let best: { marker: string; index: number } | null = null;
  for (const marker of ALL_MARKERS) {
    const idx = line.indexOf(marker);
    if (idx !== -1 && (!best || idx < best.index)) {
      best = { marker, index: idx };
    }
  }
  return best;
}

function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

function stripTrailingMarkers(text: string): string {
  return text
    .replace(/-->\s*$/, "")
    .replace(/\*\/\s*$/, "")
    .replace(/"""\s*$/, "")
    .replace(/'''\s*$/, "")
    .trim();
}

function extractMatch(text: string, tagRegex: RegExp): { tag: string; text: string } | null {
  const match = tagRegex.exec(text);
  if (!match) return null;
  const tag = (match[1] as string).toUpperCase();
  const body = truncate(stripTrailingMarkers((match[2] || "").trim()));
  return { tag, text: body };
}

export async function scanFile(filePath: string, relPath: string, tagRegex: RegExp): Promise<ScannedItem[]> {
  const items: ScannedItem[] = [];
  const rl = readline.createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  let blockCloser: string | null = null;

  for await (const rawLine of rl) {
    lineNumber++;

    if (blockCloser) {
      const closeIdx = rawLine.indexOf(blockCloser);
      const searchText = closeIdx === -1 ? rawLine : rawLine.slice(0, closeIdx);
      const found = extractMatch(searchText, tagRegex);
      if (found) items.push({ ...found, file: relPath, line: lineNumber });
      if (closeIdx !== -1) blockCloser = null;
      continue;
    }

    const marker = findEarliestMarker(rawLine);
    if (!marker) continue;

    const closer = BLOCK_MARKERS[marker.marker];
    const afterMarker = rawLine.slice(marker.index + marker.marker.length);

    if (closer) {
      const closeIdx = afterMarker.indexOf(closer);
      const searchText = closeIdx === -1 ? afterMarker : afterMarker.slice(0, closeIdx);
      const found = extractMatch(searchText, tagRegex);
      if (found) items.push({ ...found, file: relPath, line: lineNumber });
      if (closeIdx === -1) blockCloser = closer;
      continue;
    }

    const found = extractMatch(afterMarker, tagRegex);
    if (found) items.push({ ...found, file: relPath, line: lineNumber });
  }

  return items;
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const tags = options.tags && options.tags.length > 0 ? options.tags : DEFAULT_TAGS;
  const tagRegex = buildTagRegex(tags);
  const files = await listTrackedFiles(options.cwd);
  const shallowClone = await isShallowClone(options.cwd);

  const items: ScannedItem[] = [];
  for (const relPath of files) {
    if (isBinaryPath(relPath)) continue;
    if (matchesGlobs(relPath, options.excludeGlobs)) continue;
    if (options.pathGlobs && options.pathGlobs.length > 0 && !matchesGlobs(relPath, options.pathGlobs)) continue;

    const absPath = path.join(options.cwd, relPath);
    let fileStat;
    try {
      fileStat = await stat(absPath);
    } catch {
      continue; // deleted between ls-files and read
    }
    if (!fileStat.isFile() || fileStat.size > MAX_FILE_SIZE) continue;
    if (await looksBinary(absPath)) continue;

    try {
      items.push(...(await scanFile(absPath, relPath, tagRegex)));
    } catch {
      continue; // unreadable file, skip silently
    }
  }

  return { items, shallowClone };
}
