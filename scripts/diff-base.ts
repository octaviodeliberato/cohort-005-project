/**
 * "Your diff": the commit your work starts from, and the files changed since.
 *
 * Shared by `npm run test:mutation` (scripts/mutate-diff.ts) and
 * `npm run lint:tokens` (scripts/check-changed-file-tokens.ts), so both
 * measure the same change.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The top of the repository.
 *
 * Git reports each path from this directory, but `existsSync` resolves a
 * relative path from the current directory. Resolve every path against this
 * value. If you do not, a run from a subdirectory finds no files and reports
 * "nothing to check", which is a false pass.
 */
export const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

/**
 * Run git and return its output, one line per entry.
 *
 * A failure throws. A diff that git could not produce must stop the run, not
 * read as "nothing changed" and pass. Pass `optional` only where a failure is
 * an answer: a ref that does not exist, or a detached HEAD.
 *
 * A diff against `main` can run past the 1 MB that `execFileSync` holds by
 * default, so the buffer is far larger than that.
 */
export function git(args: string[], { optional = false } = {}): string[] {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    })
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    if (optional) return [];
    throw error;
  }
}

/**
 * The commit that "your diff" is measured from, first match wins:
 *
 * 1. `DIFF_BASE`, any ref git can resolve (`DIFF_BASE=origin/main`).
 * 2. Locally, the last `npm run reset <slug>` (or branch creation) in the
 *    current branch's reflog, if HEAD still contains it. After a reset your
 *    branch holds `main` plus every lesson commit up to that slug, so a diff
 *    against `main` would hold all of those lessons.
 * 3. The merge base with `origin/main`, then with `main`.
 *
 * Under CI (`CI` is set) step 2 is skipped. A workflow creates its branch
 * from whatever it checked out, often the pull request's own head, and that
 * reflog entry would make the change under review "not yours".
 *
 * A clone with none of these gets null: callers then examine only the
 * uncommitted changes.
 */
export function findDiffBase(): string | null {
  const explicit = process.env.DIFF_BASE;
  if (explicit) {
    const [sha] = git(["rev-parse", "--verify", `${explicit}^{commit}`], {
      optional: true,
    });
    if (!sha) {
      console.error(`DIFF_BASE=${explicit} is not a commit git knows.`);
      process.exit(1);
    }
    return sha;
  }

  if (!process.env.CI) {
    const fromReflog = lastResetInReflog();
    if (fromReflog) return fromReflog;
  }

  for (const ref of ["origin/main", "main"]) {
    const [sha] = git(["merge-base", "HEAD", ref], { optional: true });
    if (sha) return sha;
  }
  return null;
}

function lastResetInReflog(): string | null {
  const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"], {
    optional: true,
  })[0];
  const reflog = git(
    [
      "reflog",
      "show",
      "--format=%H%x09%gs",
      branch ? `refs/heads/${branch}` : "HEAD",
    ],
    { optional: true }
  );
  for (const line of reflog) {
    const [sha, subject = ""] = line.split("\t");
    const isStart =
      subject.startsWith("reset: moving to") ||
      subject.startsWith("branch: Created from");
    if (!sha || !isStart) continue;
    // A reset that HEAD has since moved away from (a rebase, say) is no
    // longer the start of your work. Stop looking, and use the merge base.
    return isAncestorOfHead(sha) ? sha : null;
  }
  return null;
}

function isAncestorOfHead(sha: string): boolean {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, "HEAD"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

/** True when HEAD is the base and nothing is staged, unstaged or untracked. */
export function isEmptyDiff(base: string | null): boolean {
  const [head] = git(["rev-parse", "HEAD"]);
  return (
    (base === null || base === head) &&
    git(["status", "--porcelain"]).length === 0
  );
}

/**
 * Every file your diff adds or changes that still exists: committed since
 * the base, staged, unstaged, or untracked.
 */
export function changedFiles(base: string | null): string[] {
  const tracked = git([
    "diff",
    "--name-only",
    "--diff-filter=d",
    base ?? "HEAD",
  ]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]);
  return [...new Set([...tracked, ...untracked])].filter((file) =>
    existsSync(resolve(repoRoot, file))
  );
}
