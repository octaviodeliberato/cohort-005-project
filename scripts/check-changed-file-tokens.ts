/**
 * `npm run lint:tokens`: the pre-commit token check, run early.
 *
 * The hook runs scripts/check-file-tokens.js on the files you stage, so an
 * oversized file used to surface only at commit time, after the work was
 * done. This runs the same check on every file your diff touches (see
 * scripts/diff-base.ts), so `npm run check` fails first.
 */
import { execFileSync } from "node:child_process";
import { changedFiles, findDiffBase, repoRoot } from "./diff-base";

const files = changedFiles(findDiffBase());
if (files.length > 0) {
  try {
    execFileSync("node", ["scripts/check-file-tokens.js", ...files], {
      cwd: repoRoot,
      stdio: "inherit",
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    process.exit(typeof status === "number" ? status : 1);
  }
}
