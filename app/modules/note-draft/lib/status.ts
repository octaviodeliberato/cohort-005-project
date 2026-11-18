export type NoteDraftStatus =
  | { kind: "error"; message: string }
  | { kind: "too-long" }
  | { kind: "empty" }
  | { kind: "unsaved" }
  | { kind: "saved"; updatedAt: string }
  | { kind: "blank" };

export type NoteDraft = {
  length: number;
  maxLength: number;
  tooLong: boolean;
  canSave: boolean;
  status: NoteDraftStatus;
};

export type SavedNote = { body: string; updatedAt: string };

export type DescribeNoteDraftInput = {
  draft: string;
  saved: SavedNote | null;
  maxLength: number;
  error?: string;
};

/**
 * What the lesson note editor should show for the text in it: the character
 * count, whether Save is enabled, and one status line.
 */
export function describeNoteDraft({
  draft,
  saved,
  maxLength,
  error,
}: DescribeNoteDraftInput): NoteDraft {
  const tooLong = draft.length > maxLength;
  const empty = draft.trim().length === 0;
  const unsaved = draft !== (saved?.body ?? "");
  const canSave = unsaved && !empty && !tooLong;

  return {
    length: draft.length,
    maxLength,
    tooLong,
    canSave,
    status: statusOf({ error, tooLong, empty, unsaved, saved }),
  };
}

function statusOf({
  error,
  tooLong,
  empty,
  unsaved,
  saved,
}: {
  error?: string;
  tooLong: boolean;
  empty: boolean;
  unsaved: boolean;
  saved: SavedNote | null;
}): NoteDraftStatus {
  if (error) return { kind: "error", message: error };
  if (tooLong) return { kind: "too-long" };
  // The save action rejects an empty note, so clearing a saved one cannot be saved.
  if (empty && saved) return { kind: "empty" };
  if (unsaved) return { kind: "unsaved" };
  if (saved) return { kind: "saved", updatedAt: saved.updatedAt };
  return { kind: "blank" };
}
