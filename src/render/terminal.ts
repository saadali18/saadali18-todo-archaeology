import pc from "picocolors";
import type { Report } from "../types.js";
import { humanizeAgeLong, humanizeAgeShort } from "../age.js";

const MAX_BAR_WIDTH = 20;

function visualLength(str: string): number {
  return [...str].length;
}

function padEndVisual(str: string, width: number): string {
  const pad = width - visualLength(str);
  return pad > 0 ? str + " ".repeat(pad) : str;
}

export interface TerminalOptions {
  top?: number;
}

export function renderTerminal(report: Report, opts: TerminalOptions = {}): string {
  const top = opts.top ?? 10;
  const lines: string[] = [];

  lines.push(pc.bold(`🏺 todo-archaeology — dig report for ${report.repo}`));
  lines.push("");

  if (report.items.length === 0) {
    lines.push(pc.green("No artifacts found — remarkably clean dig site 🧹"));
    return lines.join("\n");
  }

  lines.push(pc.bold(pc.yellow("⛏️  EXCAVATION SUMMARY")));
  const tagBreakdown = report.summary.byTag.map((t) => `${t.tag}: ${t.count}`).join(" · ");
  lines.push(`   Artifacts found: ${pc.bold(String(report.summary.total))}   (${tagBreakdown})`);
  lines.push(
    `   Oldest artifact: ${report.summary.oldestAgeDays !== null ? humanizeAgeLong(report.summary.oldestAgeDays) : "unknown"}`,
  );
  lines.push(
    `   Average age: ${report.summary.averageAgeDays !== null ? humanizeAgeLong(report.summary.averageAgeDays) : "unknown"}`,
  );
  if (report.summary.topAuthor) {
    lines.push(`   Most prolific archaeologist: ${report.summary.topAuthor.author} (${report.summary.topAuthor.count} artifacts)`);
  }
  if (report.summary.shallowClone) {
    lines.push(pc.dim("   ⚠ shallow clone detected — ages may be inaccurate"));
  }
  lines.push("");

  const sorted = [...report.items].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
  const leaders = sorted.slice(0, top);
  lines.push(pc.bold(pc.yellow(`🏆 HALL OF ANCIENT ARTIFACTS (top ${leaders.length} by age)`)));
  leaders.forEach((item, i) => {
    const age = item.ageDays !== null ? humanizeAgeShort(item.ageDays) : "unknown";
    lines.push(
      `   ${i + 1}. ${pc.cyan(padEndVisual(age, 7))} ${pc.magenta(padEndVisual(item.author, 10))} ${item.file}:${item.line}`,
    );
    lines.push(`      "${item.tag}: ${item.text}"`);
  });
  lines.push("");

  lines.push(pc.bold(pc.yellow("👤 BY ARCHAEOLOGIST")));
  const maxCount = Math.max(...report.summary.byAuthor.map((a) => a.count), 1);
  for (const author of report.summary.byAuthor) {
    const barLen = Math.max(1, Math.round((author.count / maxCount) * MAX_BAR_WIDTH));
    lines.push(`   ${padEndVisual(author.author, 10)} ${String(author.count).padStart(3)} ${pc.green("█".repeat(barLen))}`);
  }

  return lines.join("\n");
}
