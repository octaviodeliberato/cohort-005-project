export type NoteDraft = {
  length: number;
  tooLong: boolean;
  empty: boolean;
  unsaved: boolean;
  canSave: boolean;
};

export function describeDraft(
  draft: string,
  savedBody: string,
  maxLength: number
): NoteDraft {
  const length = draft.length;
  const tooLong = length > maxLength;
  const empty = draft.trim().length === 0;
  const unsaved = draft !== savedBody;
  return {
    length,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
