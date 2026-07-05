# 🏺 todo-archaeology

> Your codebase is a dig site. Every TODO is an artifact.

`todo-archaeology` excavates every `TODO`, `FIXME`, `HACK`, and `XXX` left in a git repository and uses `git blame` to reveal how old each one is and who wrote it — presented as a shareable "dig report" leaderboard.

Existing tools like `grep` or `leasot` only *list* TODOs. This one connects them to git history to show **age and authorship** — the part that's actually funny, shameful, and motivating.

**Contributions welcome** — new comment-syntax fixtures, renderer ideas, and P1/P2 roadmap items (see below) are all fair game. Jump to [Contributing](#contributing).

## Hero output

```
🏺 todo-archaeology — dig report for my-repo

⛏️  EXCAVATION SUMMARY
   Artifacts found: 143   (TODO: 97 · FIXME: 31 · HACK: 12 · XXX: 3)
   Oldest artifact: 6 years, 3 months
   Average age: 1 year, 8 months
   Most prolific archaeologist: Ahmed (41 artifacts)

🏆 HALL OF ANCIENT ARTIFACTS (top 10 by age)
   1. 6y 3m   Ahmed      src/billing/tax.js:88
      "TODO: temporary fix, will refactor next sprint"
   2. 5y 1m   Priya      lib/auth.py:12
      "HACK: don't ask"
   ...

👤 BY ARCHAEOLOGIST
   Ahmed        41 ████████████
   Priya        27 ████████
   ...
```

*(Drop a real terminal screenshot or GIF here once you've run it against your own repo — it screenshots well.)*

## Install & usage

No install needed — run it directly in any git repo:

```bash
npx todo-archaeology
```

Or install it as a dev dependency:

```bash
npm install --save-dev todo-archaeology
npx todo-archaeology
```

From source (this repo):

```bash
npm install
npm run build
node dist/cli.js [path]
```

## Flag reference

```
todo-archaeology [path]           # default: current directory
  --top <n>            leaderboard size (default 10)
  --tags <list>        comma-separated tags to scan (default: TODO,FIXME,HACK,XXX)
  --format <fmt>       terminal | json | markdown (default: terminal)
  --path <glob>        only scan matching paths (repeatable)
  --exclude <glob>     exclude matching paths (repeatable)
  --max-age <dur>      exit 1 if any item older than e.g. "2y", "18m", "90d"
  --sort <key>         age | file | author (default: age)
  --version, --help
```

### Examples

```bash
# Default terminal report for the current repo
npx todo-archaeology

# Only scan TODOs, top 5 leaderboard
npx todo-archaeology --tags TODO --top 5

# Fail CI if any artifact is older than 2 years
npx todo-archaeology --format json --max-age 2y

# Scan only the src/ directory, skipping generated code
npx todo-archaeology --path "src/**" --exclude "src/generated/**"

# Paste-ready markdown for a PR description
npx todo-archaeology --format markdown > dig-report.md
```

Exit codes:

- `0` — success (including "no artifacts found").
- `1` — `--max-age` threshold exceeded.
- `2` — environment error (not a git repository, or `git` not installed).

## JSON schema

`--format json` prints a single object to stdout:

```ts
{
  repo: string;
  summary: {
    total: number;
    byTag: { tag: string; count: number }[];
    byAuthor: { author: string; count: number }[];
    oldestAgeDays: number | null;
    averageAgeDays: number | null;
    topAuthor: { author: string; count: number } | null;
    shallowClone: boolean;
  };
  items: {
    tag: string;
    text: string;
    file: string;
    line: number;
    author: string;
    email: string;
    date: string | null;   // ISO 8601, or null if blame failed
    commit: string | null; // short commit hash, or null if blame failed
    ageDays: number | null;
  }[];
}
```

When `--max-age` is combined with `--format json` or `--format markdown`, only the violating items are included (so the output is CI-ready without extra filtering). With the default `terminal` format, the full report is always printed, with violations called out separately.

## How it works

1. **Scan** (`src/scan.ts`) — walks `git ls-files` (so `.gitignore` and untracked files are automatically respected), skips binaries and files over 1 MB, and regex-matches tagged comments across common comment syntaxes (`//`, `#`, `/* */`, `<!-- -->`, `--`, `;`, `"""`/`'''`), including simple multi-line block comments.
2. **Blame** (`src/blame.ts`) — runs `git blame -L <line>,<line> --porcelain` per artifact through a concurrency-8 worker pool, parsing author, email, commit, and age. Blame failures degrade to `"unknown"` rather than crashing.
3. **Render** (`src/render/*.ts`) — turns the shared `{ summary, items }` JSON shape into terminal, JSON, or Markdown output. Because scanning, blaming, and rendering are separate modules connected only by this JSON schema, new renderers (HTML, image cards, etc.) can be added without touching the scan/blame logic.

Comment detection is regex-based, not AST-aware, so false positives (e.g. "TODO" inside a URL or string literal) are possible — this is an accepted trade-off for v1 to keep the tool dependency-light and fast.

## Contributing

This is a young project and contributions of all sizes are welcome — bug reports, new comment-syntax fixtures, documentation fixes, or a full P1 feature from the roadmap below.

**Getting started:**

```bash
git clone <this-repo>
cd todo-archaeology
npm install
npm run dev -- --top 5     # runs src/cli.ts directly via tsx, no build needed
```

**Workflow:**

1. Open an issue first for anything beyond a small fix, so the approach can be agreed on before you invest time.
2. Create a branch off `main` for your change.
3. If you're touching comment detection, add a fixture under `fixtures/comments/` and a table-driven case in `tests/scan.test.ts` — this is the easiest way to contribute and the most valuable (new languages/comment styles directly reduce false negatives for everyone).
4. Keep the module boundaries: scan/blame/render stay decoupled through the `Report` JSON schema in `src/types.ts` (see [How it works](#how-it-works)) — new renderers should not need to touch scanning or blaming logic.
5. Before opening a PR, run:
   ```bash
   npm run lint && npm test && npm run build
   ```
6. Open a PR with a short description of the "why," not just the "what" — link the issue if there is one.

**Good first contributions:** a new fixture/tag for a comment syntax we don't cover yet, a fix for a false-positive/negative you hit on a real repo, or one of the P1 items in the roadmap (`--group-by dir` and the "epochs" histogram are self-contained and don't touch the core scan/blame path).

Not sure where to start? Open an issue describing what you'd like to work on and it can be scoped together.

## Roadmap (not yet built)

- `--group-by dir`, "epochs" histogram by year, `.todoarchrc.json` config, `--anonymize`, custom tag/emoji config.
- GitHub Action wrapper, HTML/image report generation, issue-tracker linking, tree-sitter-based parsing — see `project-req.md` for the full spec and non-goals.
