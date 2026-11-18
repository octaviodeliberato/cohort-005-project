import { describe, expect, it } from "vitest";
import { describeNoteDraft, MAX_NOTE_LENGTH } from "~/modules/lesson-notes";

describe("describeNoteDraft", () => {
  it("cannot save an empty draft when there is no saved note", () => {
    expect(describeNoteDraft("", undefined)).toEqual({
      length: 0,
      tooLong: false,
      empty: true,
      unsaved: false,
      canSave: false,
    });
  });

  it("treats a whitespace-only draft as empty", () => {
    const draft = describeNoteDraft("   \n", undefined);
    expect(draft.empty).toBe(true);
    expect(draft.unsaved).toBe(true);
    expect(draft.canSave).toBe(false);
  });

  it("can save a new draft that differs from the saved note", () => {
    expect(describeNoteDraft("Generics are neat", "Generics")).toEqual({
      length: 17,
      tooLong: false,
      empty: false,
      unsaved: true,
      canSave: true,
    });
  });

  it("cannot save a draft identical to the saved note", () => {
    const draft = describeNoteDraft("Generics", "Generics");
    expect(draft.unsaved).toBe(false);
    expect(draft.canSave).toBe(false);
  });

  it("allows a draft exactly at the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH), undefined);
    expect(draft.length).toBe(MAX_NOTE_LENGTH);
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("refuses a draft one character over the limit", () => {
    const draft = describeNoteDraft("a".repeat(MAX_NOTE_LENGTH + 1), undefined);
    expect(draft.tooLong).toBe(true);
    expect(draft.canSave).toBe(false);
  });
});
