import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";

const saved = {
  body: "Generics are type parameters",
  updatedAt: "2026-11-01T10:00:00.000Z",
};

describe("describeNoteDraft", () => {
  it("is blank with nothing written and nothing saved", () => {
    const draft = describeNoteDraft({ draft: "", saved: null, maxLength: 10 });
    expect(draft).toEqual({
      length: 0,
      maxLength: 10,
      tooLong: false,
      canSave: false,
      status: { kind: "blank" },
    });
  });

  it("is unsaved and savable once something is written", () => {
    const draft = describeNoteDraft({
      draft: "hi",
      saved: null,
      maxLength: 10,
    });
    expect(draft.status).toEqual({ kind: "unsaved" });
    expect(draft.canSave).toBe(true);
    expect(draft.length).toBe(2);
  });

  it("does not let whitespace alone be saved", () => {
    const draft = describeNoteDraft({
      draft: "   ",
      saved: null,
      maxLength: 10,
    });
    expect(draft.canSave).toBe(false);
    expect(draft.status).toEqual({ kind: "unsaved" });
  });

  it("is saved, with the edit time, when the draft matches the saved note", () => {
    const draft = describeNoteDraft({
      draft: saved.body,
      saved,
      maxLength: 100,
    });
    expect(draft.status).toEqual({ kind: "saved", updatedAt: saved.updatedAt });
    expect(draft.canSave).toBe(false);
  });

  it("is unsaved when the draft differs from the saved note", () => {
    const draft = describeNoteDraft({
      draft: `${saved.body}!`,
      saved,
      maxLength: 100,
    });
    expect(draft.status).toEqual({ kind: "unsaved" });
    expect(draft.canSave).toBe(true);
  });

  it("says a saved note cannot be emptied", () => {
    const draft = describeNoteDraft({ draft: " ", saved, maxLength: 100 });
    expect(draft.status).toEqual({ kind: "empty" });
    expect(draft.canSave).toBe(false);
  });

  it("allows exactly the maximum length", () => {
    const draft = describeNoteDraft({
      draft: "a".repeat(10),
      saved: null,
      maxLength: 10,
    });
    expect(draft.tooLong).toBe(false);
    expect(draft.canSave).toBe(true);
  });

  it("blocks saving one character over the maximum", () => {
    const draft = describeNoteDraft({
      draft: "a".repeat(11),
      saved: null,
      maxLength: 10,
    });
    expect(draft.tooLong).toBe(true);
    expect(draft.canSave).toBe(false);
    expect(draft.status).toEqual({ kind: "too-long" });
  });

  it("puts a save error ahead of every other status", () => {
    const draft = describeNoteDraft({
      draft: "a".repeat(11),
      saved,
      maxLength: 10,
      error: "Could not save",
    });
    expect(draft.status).toEqual({ kind: "error", message: "Could not save" });
  });
});
