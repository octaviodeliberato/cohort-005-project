import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraft = {
  length: number;
  tooLong: boolean;
  empty: boolean;
  unsaved: boolean;
  canSave: boolean;
};

// The save action trims before it validates and stores, so the draft is
// measured and compared trimmed too; otherwise trailing whitespace leaves a
// saved note looking unsaved.
export function describeNoteDraft(
  draft: string,
  savedBody: string | undefined
): NoteDraft {
  const trimmed = draft.trim();
  const length = trimmed.length;
  const tooLong = length > MAX_NOTE_LENGTH;
  const empty = length === 0;
  const unsaved = trimmed !== (savedBody ?? "");
  return {
    length,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
