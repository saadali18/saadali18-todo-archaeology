#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import pc from "picocolors";
import { scan, isGitRepo, isGitAvailable } from "./scan.js";
import { blameAll } from "./blame.js";
import { buildSummary } from "./summary.js";
import { parseDurationToDays } from "./age.js";
import { renderTerminal } from "./render/terminal.js";
import { renderJson } from "./render/json.js";
import { renderMarkdown } from "./render/markdown.js";
function collect(value, previous) {
    return [...previous, value];
}
function sortItems(items, key) {
    items.sort((a, b) => {
        if (key === "file")
            return a.file.localeCompare(b.file) || a.line - b.line;
        if (key === "author")
            return a.author.localeCompare(b.author);
        return (b.ageDays ?? -1) - (a.ageDays ?? -1);
    });
}
async function run(targetPath, options) {
    const cwd = path.resolve(process.cwd(), targetPath);
    if (!(await isGitAvailable())) {
        console.error(pc.red("Error: git is not installed or not on PATH."));
        process.exit(2);
    }
    if (!(await isGitRepo(cwd))) {
        console.error(pc.red(`Error: "${cwd}" is not a git repository.`));
        process.exit(2);
    }
    const formats = ["terminal", "json", "markdown"];
    const format = options.format;
    if (!formats.includes(format)) {
        console.error(pc.red(`Error: invalid --format "${options.format}". Use terminal, json, or markdown.`));
        process.exit(1);
    }
    const sortKeys = ["age", "file", "author"];
    const sortKey = options.sort;
    if (!sortKeys.includes(sortKey)) {
        console.error(pc.red(`Error: invalid --sort "${options.sort}". Use age, file, or author.`));
        process.exit(1);
    }
    const top = parseInt(options.top, 10);
    if (Number.isNaN(top) || top < 0) {
        console.error(pc.red(`Error: invalid --top "${options.top}". Must be a non-negative integer.`));
        process.exit(1);
    }
    let maxAgeDays = null;
    if (options.maxAge) {
        try {
            maxAgeDays = parseDurationToDays(options.maxAge);
        }
        catch (err) {
            console.error(pc.red(`Error: ${err.message}`));
            process.exit(1);
        }
    }
    const tags = options.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    const { items: scannedItems, shallowClone } = await scan({
        cwd,
        tags,
        pathGlobs: options.path,
        excludeGlobs: options.exclude,
    });
    const blameInfos = await blameAll(scannedItems, { cwd, concurrency: 8 });
    const items = scannedItems.map((item, i) => ({ ...item, ...blameInfos[i] }));
    sortItems(items, sortKey);
    const repo = path.basename(cwd);
    const summary = buildSummary(items, shallowClone);
    const report = { repo, summary, items };
    if (shallowClone && format === "terminal") {
        console.error(pc.yellow("Warning: shallow clone detected — artifact ages may be inaccurate."));
    }
    const violations = maxAgeDays !== null ? items.filter((item) => item.ageDays !== null && item.ageDays > maxAgeDays) : [];
    const violationsOnly = maxAgeDays !== null && format !== "terminal";
    const outputReport = violationsOnly
        ? { repo, items: violations, summary: buildSummary(violations, shallowClone) }
        : report;
    switch (format) {
        case "json":
            console.log(renderJson(outputReport));
            break;
        case "markdown":
            console.log(renderMarkdown(outputReport, { top }));
            break;
        default:
            console.log(renderTerminal(outputReport, { top }));
    }
    if (maxAgeDays !== null && violations.length > 0) {
        if (format === "terminal") {
            console.log("");
            console.log(pc.red(pc.bold(`✗ ${violations.length} artifact(s) exceed max age of ${options.maxAge}:`)));
            for (const item of violations) {
                console.log(`   ${item.file}:${item.line}  "${item.tag}: ${item.text}"  (${item.author})`);
            }
        }
        process.exit(1);
    }
}
const program = new Command();
program
    .name("todo-archaeology")
    .description("Excavates every TODO/FIXME/HACK in a git repo and shows age & authorship via git blame.")
    .version("0.1.0")
    .argument("[path]", "path to the git repo to scan", ".")
    .option("--top <n>", "leaderboard size", "10")
    .option("--tags <list>", "comma-separated tags to scan", "TODO,FIXME,HACK,XXX")
    .option("--format <fmt>", "terminal | json | markdown", "terminal")
    .option("--path <glob>", "only scan matching paths (repeatable)", collect, [])
    .option("--exclude <glob>", "exclude matching paths (repeatable)", collect, [])
    .option("--max-age <dur>", "exit 1 if any item older than e.g. 2y, 18m, 90d")
    .option("--sort <key>", "age | file | author", "age")
    .action(async (targetPath, options) => {
    await run(targetPath, options);
});
process.on("SIGINT", () => {
    process.exit(130);
});
program.parseAsync(process.argv).catch((err) => {
    console.error(pc.red(`Unexpected error: ${err.message}`));
    process.exit(2);
});
