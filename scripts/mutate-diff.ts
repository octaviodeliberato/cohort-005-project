/**
 * Diff-based mutation testing.
 *
 * This script limits Stryker to the lines that a change touches. A full run
 * against the whole repository is too slow to use in a normal verification
 * loop, and a mutant on a line you did not write grades code that is not
 * yours.
 *
 * A line is "touched" if one of these is true:
 * - A commit added or changed it after your diff base. See `findDiffBase`
 *   in scripts/diff-base.ts; set `DIFF_BASE=origin/main` to pick it yourself.
 * - It is staged or unstaged in the work tree now.
 * - It is in an untracked file. A new file is yours, so every line counts.
 *
 * You can also name the files or directories yourself. That skips the diff
 * and grades every line of them:
 *
 *     npm run test:mutation -- app/lib/analytics.ts
 *     npm run test:mutation -- app/lib
 *
 * The mutation-testing skill (.agents/skills/mutation-testing) says how to
 * read the result.
 */
import { execFileSync } from "node:child_process";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { findDiffBase, git, isEmptyDiff, repoRoot } from "./diff-base";

/**
 * The directories that hold code a test reaches.
 *
 * A mutant only says something about the suite if a test runs the line it
 * changes. Everywhere else, every mutant comes back `NoCoverage`, which you
 * already knew, and the run costs minutes to tell you.
 *
 * Today that is `app/lib/`, `app/modules/` and `request-logger/`. The route
 * modules still hold most of the queries and the rules, and no test imports
 * one of them — a loader needs a `Request` and a database. That is a real
 * gap, and mutation testing is not the tool that closes it: write the test
 * first, then grade it here.
 */
const TESTED_ROOTS = ["app/lib/", "app/modules/", "request-logger/"];

function isSource(file: string): boolean {
  return /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file);
}

function isTested(file: string): boolean {
  return TESTED_ROOTS.some((root) => file.startsWith(root));
}

/** Every source file below a directory, as a path from the repository root. */
function walk(dir: string): string[] {
  const absolute = resolve(repoRoot, dir);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) return walk(child);
    return isSource(child) ? [child] : [];
  });
}

/** The files the arguments name, with a directory expanded to its contents. */
function namedFiles(args: string[]): string[] {
  return args.flatMap((arg) => {
    const absolute = resolve(repoRoot, arg);
    if (!existsSync(absolute)) {
      console.error(`No such file or directory: ${arg}`);
      process.exit(1);
    }
    return statSync(absolute).isDirectory() ? walk(arg) : [arg];
  });
}

/**
 * A file to mutate, and the line ranges in it ("70-73") to limit Stryker to.
 * No ranges means every line of the file.
 */
type Target = { file: string; lines: string[] | null };

/**
 * The lines your diff added or changed, file by file.
 *
 * `git diff -U0 <base>` compares the base with the work tree, so one diff
 * holds the committed, the staged and the unstaged changes. Each hunk header
 * (`@@ -a,b +start,count @@`) gives the new lines. A hunk with a count of 0
 * only deletes lines, so it leaves nothing to mutate.
 */
function changedTargets(): Target[] {
  const base = findDiffBase();
  console.log(`Diffing against ${base ? base.slice(0, 7) : "nothing"}.\n`);
  if (isEmptyDiff(base)) {
    // Not a pass: no line was graded. This is what a reviewer sees when its
    // diff base lands on the pull request's own head.
    console.error(
      "The diff base is HEAD and the work tree is clean, so there is no " +
        "diff to grade.\nPick the base yourself:\n\n" +
        "  DIFF_BASE=origin/main npm run test:mutation\n"
    );
    process.exit(1);
  }
  const lines = new Map<string, string[]>();
  let file: string | null = null;
  for (const line of git(["diff", "-U0", "--no-color", base ?? "HEAD"])) {
    if (line.startsWith("+++ ")) {
      file = line === "+++ /dev/null" ? null : line.slice("+++ b/".length);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !file) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    if (count === 0) continue;
    lines.set(file, [
      ...(lines.get(file) ?? []),
      `${start}-${start + count - 1}`,
    ]);
  }

  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  return [
    ...[...lines].map(([file, ranges]) => ({ file, lines: ranges })),
    ...untracked.map((file) => ({ file, lines: null })),
  ].filter(({ file }) => existsSync(resolve(repoRoot, file))); // drop deletions
}

const args = process.argv.slice(2);
const fromDiff = args.length === 0;
const candidates: Target[] = fromDiff
  ? changedTargets()
  : namedFiles(args).map((file) => ({ file, lines: null }));

const targets = candidates
  .filter(({ file }) => isSource(file) && isTested(file))
  .sort((a, b) => a.file.localeCompare(b.file));

if (targets.length === 0) {
  console.log(
    fromDiff
      ? "No changed files below " +
          TESTED_ROOTS.join(" or ") +
          ". There is nothing worth mutating.\n" +
          "Change a file in one of those directories, or name what to " +
          "mutate yourself:\n\n" +
          "  npm run test:mutation -- app/lib\n"
      : "Nothing to mutate. " +
          `Mutation testing here covers ${TESTED_ROOTS.join(" and ")} only — ` +
          "see the comment on TESTED_ROOTS in this file.\n"
  );
  process.exit(0);
}

console.log(`Mutation testing against ${targets.length} file(s):`);
for (const { file, lines } of targets) {
  console.log(`  - ${file}${lines ? ` (lines ${lines.join(", ")})` : ""}`);
}
console.log();

// Stryker reads `file:70-73` as lines 70 to 73 of that file.
const mutate = targets.flatMap(({ file, lines }) =>
  lines ? lines.map((range) => `${file}:${range}`) : [file]
);

// Pass the list as one argument, not through a shell. A path that contains a
// space or a shell character must not change the command.
try {
  execFileSync("npx", ["stryker", "run", "--mutate", mutate.join(",")], {
    cwd: repoRoot,
    stdio: "inherit",
  });
} catch (error) {
  const status = (error as { status?: number }).status;
  process.exit(typeof status === "number" ? status : 1);
}
