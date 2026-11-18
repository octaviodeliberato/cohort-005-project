import { MAX_NOTE_LENGTH } from "~/lib/notes";

/**
 * What the notes editor shows for a draft: the character count against the
 * limit, whether it differs from the saved note, and whether Save is allowed.
 * The save action still validates; this only keeps the button honest.
 */
export { describeNoteDraft, type NoteDraft } from "./lib/draft";

export { MAX_NOTE_LENGTH };
