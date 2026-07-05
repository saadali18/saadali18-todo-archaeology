import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanFile, DEFAULT_TAGS } from "../src/scan.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "..", "fixtures", "comments");

function tagRegex(): RegExp {
  const escaped = DEFAULT_TAGS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b\\s*:?\\s*(.*)`, "i");
}

describe("scanFile — table-driven comment syntax coverage", () => {
  it("detects // and /* */ comments in JS, including a multi-line block", async () => {
    const items = await scanFile(path.join(FIXTURES, "sample.js"), "sample.js", tagRegex());
    expect(items).toContainEqual({ tag: "TODO", text: "refactor this function to reduce complexity", file: "sample.js", line: 1 });
    expect(items).toContainEqual({ tag: "FIXME", text: "handle the empty-array edge case", file: "sample.js", line: 3 });
    expect(items).toContainEqual({ tag: "HACK", text: "this whole block is a workaround", file: "sample.js", line: 10 });
  });

  it("does not crash on TODO inside a string literal / URL (false positive accepted per spec)", async () => {
    // "https://example.com/TODO" contains a "//" that the naive scanner treats as a comment
    // marker, so this is detected as a (spec-accepted) false positive rather than skipped.
    await expect(scanFile(path.join(FIXTURES, "sample.js"), "sample.js", tagRegex())).resolves.not.toThrow();
    const items = await scanFile(path.join(FIXTURES, "sample.js"), "sample.js", tagRegex());
    expect(items.find((i) => i.line === 7)?.tag).toBe("TODO");
  });

  it("detects # comments and triple-quote docstring blocks in Python", async () => {
    const items = await scanFile(path.join(FIXTURES, "sample.py"), "sample.py", tagRegex());
    expect(items).toContainEqual({ tag: "FIXME", text: "this needs a proper fix", file: "sample.py", line: 1 });
    expect(items).toContainEqual({ tag: "TODO", text: "not implemented yet", file: "sample.py", line: 3 });
    expect(items).toContainEqual({ tag: "TODO", text: "document this module properly", file: "sample.py", line: 7 });
  });

  it("detects <!-- --> comments in HTML, including multi-line", async () => {
    const items = await scanFile(path.join(FIXTURES, "sample.html"), "sample.html", tagRegex());
    expect(items).toContainEqual({ tag: "HACK", text: "workaround for old browsers", file: "sample.html", line: 1 });
    expect(items).toContainEqual({ tag: "XXX", text: "this markup needs a full rewrite", file: "sample.html", line: 4 });
  });

  it("detects -- comments in SQL", async () => {
    const items = await scanFile(path.join(FIXTURES, "sample.sql"), "sample.sql", tagRegex());
    expect(items).toContainEqual({ tag: "XXX", text: "this query is slow on large tables", file: "sample.sql", line: 1 });
  });

  it("detects ; comments in Lisp", async () => {
    const items = await scanFile(path.join(FIXTURES, "sample.lisp"), "sample.lisp", tagRegex());
    expect(items).toContainEqual({ tag: "TODO", text: "improve performance of this function", file: "sample.lisp", line: 1 });
  });

  it("is case-insensitive on the tag but normalizes it to uppercase", async () => {
    const items = await scanFile(path.join(FIXTURES, "sample.py"), "sample.py", tagRegex());
    expect(items.every((i) => i.tag === i.tag.toUpperCase())).toBe(true);
  });

  it("respects a custom, restricted tag list", async () => {
    const onlyHack = new RegExp(`\\b(HACK)\\b\\s*:?\\s*(.*)`, "i");
    const items = await scanFile(path.join(FIXTURES, "sample.js"), "sample.js", onlyHack);
    expect(items.every((i) => i.tag === "HACK")).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });

  it("truncates very long comment text to 120 chars with an ellipsis", async () => {
    const longLine = `// TODO: ${"x".repeat(200)}`;
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const tmp = path.join(os.tmpdir(), `todo-archaeology-long-${Date.now()}.txt`);
    await fs.writeFile(tmp, longLine, "utf8");
    try {
      const items = await scanFile(tmp, "long.txt", tagRegex());
      expect(items).toHaveLength(1);
      expect(items[0]?.text.length).toBe(120);
      expect(items[0]?.text.endsWith("…")).toBe(true);
    } finally {
      await fs.unlink(tmp);
    }
  });
});
