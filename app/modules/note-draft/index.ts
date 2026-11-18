import {
  describe,
  type DescribeNoteDraftInput,
  type NoteDraft,
} from "./lib/status";

export type { NoteDraft, NoteDraftStatus } from "./lib/status";

/**
 * What the lesson note editor should show for the text in it: the character
 * count, whether Save is enabled, and one status line.
 */
export function describeNoteDraft(input: DescribeNoteDraftInput): NoteDraft {
  return describe(input);
}
