import { MAX_NOTE_LENGTH } from "~/lib/notes";
import { describeDraft, type NoteDraft } from "./lib/draft";

export type { NoteDraft };

/**
 * What the notes editor shows for a draft: the character count against the
 * limit, whether it differs from the saved note, and whether Save is allowed.
 * The save action still validates; this only keeps the button honest.
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | undefined
): NoteDraft {
  return describeDraft(draft, savedBody ?? "", MAX_NOTE_LENGTH);
}

export { MAX_NOTE_LENGTH };
