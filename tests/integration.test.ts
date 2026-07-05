import { describe, expect, it } from "vitest";
import { parseBlamePorcelain } from "../src/blame.js";

const SAMPLE_PORCELAIN = [
  "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 12 12 1",
  "author Alice Example",
  "author-mail <alice@example.com>",
  "author-time 1609459200",
  "author-tz +0000",
  "committer Alice Example",
  "committer-mail <alice@example.com>",
  "committer-time 1609459200",
  "committer-tz +0000",
  "summary Initial commit",
  "filename src/foo.ts",
  "\t// TODO: fix this",
].join("\n");

describe("parseBlamePorcelain", () => {
  it("extracts author, email, commit hash, and author timestamp", () => {
    const result = parseBlamePorcelain(SAMPLE_PORCELAIN);
    expect(result).toEqual({
      commit: "a1b2c3d4e5",
      author: "Alice Example",
      email: "alice@example.com",
      timestamp: 1609459200,
    });
  });

  it("returns null for empty output", () => {
    expect(parseBlamePorcelain("")).toBeNull();
  });

  it("returns null for an all-zero (not-committed) hash", () => {
    const output = ["0000000000000000000000000000000000000000 1 1 1", "author Not Committed Yet"].join("\n");
    expect(parseBlamePorcelain(output)).toBeNull();
  });

  it("returns null when author-time is missing", () => {
    const output = ["a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 1 1 1", "author Bob"].join("\n");
    expect(parseBlamePorcelain(output)).toBeNull();
  });

  it("handles unicode author names", () => {
    const output = [
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 1 1 1",
      "author Sœur Émoji 🎉",
      "author-mail <sœur@example.com>",
      "author-time 1609459200",
    ].join("\n");
    const result = parseBlamePorcelain(output);
    expect(result?.author).toBe("Sœur Émoji 🎉");
  });
});
