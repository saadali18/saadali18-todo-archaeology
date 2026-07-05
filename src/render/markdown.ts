import type { Report } from "../types.js";
import { humanizeAgeLong } from "../age.js";

function stripControlChars(text: string): string {
  return Array.from(text)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 32 || code === 10; // drop control chars, keep printable text + newline
    })
    .join("");
}

function escapeMd(text: string): string {
  return stripControlChars(text)
    .replace(/\|/g, "\\|")
    .replace(/`/g, "\\`");
}

export interface MarkdownOptions {
  top?: number;
}

export function renderMarkdown(report: Report, opts: MarkdownOptions = {}): string {
  const top = opts.top ?? 10;
  const lines: string[] = [];

  lines.push(`# 🏺 todo-archaeology — dig report for ${report.repo}`);
  lines.push("");

  if (report.items.length === 0) {
    lines.push("No artifacts found — remarkably clean dig site 🧹");
    return lines.join("\n");
  }

  lines.push("## ⛏️ Excavation Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Artifacts found | ${report.summary.total} |`);
  for (const t of report.summary.byTag) {
    lines.push(`| ${escapeMd(t.tag)} | ${t.count} |`);
  }
  lines.push(
    `| Oldest artifact | ${report.summary.oldestAgeDays !== null ? humanizeAgeLong(report.summary.oldestAgeDays) : "unknown"} |`,
  );
  lines.push(
    `| Average age | ${report.summary.averageAgeDays !== null ? humanizeAgeLong(report.summary.averageAgeDays) : "unknown"} |`,
  );
  if (report.summary.topAuthor) {
    lines.push(`| Most prolific archaeologist | ${escapeMd(report.summary.topAuthor.author)} (${report.summary.topAuthor.count} artifacts) |`);
  }
  lines.push("");
  if (report.summary.shallowClone) {
    lines.push("> ⚠ Shallow clone detected — ages may be inaccurate.");
    lines.push("");
  }

  const sorted = [...report.items].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
  const leaders = sorted.slice(0, top);
  lines.push(`## 🏆 Hall of Ancient Artifacts (top ${leaders.length} by age)`);
  lines.push("");
  lines.push("| # | Age | Author | Location | Comment |");
  lines.push("| --- | --- | --- | --- | --- |");
  leaders.forEach((item, i) => {
    const age = item.ageDays !== null ? humanizeAgeLong(item.ageDays) : "unknown";
    lines.push(
      `| ${i + 1} | ${age} | ${escapeMd(item.author)} | \`${item.file}:${item.line}\` | ${escapeMd(`${item.tag}: ${item.text}`)} |`,
    );
  });
  lines.push("");

  lines.push("## 👤 By Archaeologist");
  lines.push("");
  lines.push("| Author | Count |");
  lines.push("| --- | --- |");
  for (const author of report.summary.byAuthor) {
    lines.push(`| ${escapeMd(author.author)} | ${author.count} |`);
  }

  return lines.join("\n");
}
