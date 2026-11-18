/**
 * `npm run lint:exemptions`: the size-limit exemptions in .oxlintrc.json only
 * ever shrink.
 *
 * Every override that turns `max-lines` or `max-lines-per-function` off is a
 * list of known debt: "Remove each entry once the file is split." Splitting
 * an exempt file and listing the new files there instead keeps every
 * oversized function and only changes its file name. This fails when a path
 * appears in one of those lists that the same rule did not exempt at your
 * diff base (see scripts/diff-base.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { findDiffBase, git, repoRoot } from "./diff-base";

const CONFIG = ".oxlintrc.json";
const SIZE_RULES = ["max-lines", "max-lines-per-function"];

type Override = { files?: string[]; rules?: Record<string, unknown> };

/** Strips comments and trailing commas outside strings, then parses. */
function parseJsonc(text: string): { overrides?: Override[] } {
  const json = text.replace(
    /("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\/|,(\s*[}\]])/g,
    (_match, string?: string, closer?: string) => string ?? closer ?? ""
  );
  return JSON.parse(json);
}

/** For each size rule, the paths an override switches it off for. */
function exemptions(text: string): Map<string, Set<string>> {
  const byRule = new Map(SIZE_RULES.map((rule) => [rule, new Set<string>()]));
  for (const { files = [], rules = {} } of parseJsonc(text).overrides ?? []) {
    for (const rule of SIZE_RULES) {
      if (rules[rule] !== "off") continue;
      for (const file of files) byRule.get(rule)?.add(file);
    }
  }
  return byRule;
}

const base = findDiffBase();
const before = base
  ? git(["show", `${base}:${CONFIG}`], { optional: true }).join("\n")
  : "";
if (!before) process.exit(0); // nothing to compare against

const was = exemptions(before);
const now = exemptions(readFileSync(resolve(repoRoot, CONFIG), "utf8"));

const added = SIZE_RULES.flatMap((rule) =>
  [...(now.get(rule) ?? [])]
    .filter((file) => !was.get(rule)?.has(file))
    .map((file) => `  ${rule}: ${file}`)
);

if (added.length > 0) {
  console.error(`${CONFIG} exempts paths from a size limit that it did not exempt before:

${added.join("\n")}

These lists are debt to pay down, not a place to park new files. Bring each
file or function under the limit instead: split long functions into smaller
ones, and long files along their seams.

When the code was moved out of a file that was already exempt, the move is
the moment to split it. If that is too big for this change, keep the code
where it was and exempt nothing new.`);
  process.exit(1);
}
