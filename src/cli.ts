import { spawn } from "node:child_process";
import type { BlameInfo, ScannedItem } from "./types.js";
import { computeAgeDays } from "./age.js";
import { mapWithConcurrency } from "./concurrency.js";

const UNKNOWN: BlameInfo = { author: "unknown", email: "unknown", date: null, commit: null, ageDays: null };

export interface BlameOptions {
  cwd: string;
  concurrency?: number;
  now?: Date;
}

interface ParsedBlame {
  commit: string;
  author: string;
  email: string;
  timestamp: number;
}

function runGitBlame(cwd: string, file: string, line: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["blame", "-L", `${line},${line}`, "--porcelain", "--", file], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf8")));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `git blame exited with ${code}`));
    });
  });
}

export function parseBlamePorcelain(output: string): ParsedBlame | null {
  const lines = output.split("\n");
  const header = lines[0];
  if (!header) return null;

  const commit = header.split(" ")[0] as string;
  if (!commit || /^0{40}$/.test(commit)) return null; // uncommitted / not found

  let author = "unknown";
  let email = "unknown";
  let timestamp: number | null = null;

  for (const line of lines) {
    if (line.startsWith("author-mail ")) {
      email = line.slice("author-mail ".length).trim().replace(/^<|>$/g, "");
    } else if (line.startsWith("author-time ")) {
      timestamp = parseInt(line.slice("author-time ".length).trim(), 10);
    } else if (line.startsWith("author ")) {
      author = line.slice("author ".length).trim();
    }
  }

  if (timestamp === null || Number.isNaN(timestamp)) return null;
  return { commit: commit.slice(0, 10), author, email, timestamp };
}

export async function blameItem(cwd: string, item: ScannedItem, now: Date): Promise<BlameInfo> {
  try {
    const output = await runGitBlame(cwd, item.file, item.line);
    const parsed = parseBlamePorcelain(output);
    if (!parsed) return { ...UNKNOWN };
    const date = new Date(parsed.timestamp * 1000);
    return {
      author: parsed.author,
      email: parsed.email,
      date: date.toISOString(),
      commit: parsed.commit,
      ageDays: computeAgeDays(date, now),
    };
  } catch {
    return { ...UNKNOWN };
  }
}

export async function blameAll(items: ScannedItem[], options: BlameOptions): Promise<BlameInfo[]> {
  const concurrency = options.concurrency ?? 8;
  const now = options.now ?? new Date();
  return mapWithConcurrency(items, concurrency, (item) => blameItem(options.cwd, item, now));
}
