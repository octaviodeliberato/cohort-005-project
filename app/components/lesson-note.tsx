import { useState } from "react";
import { useFetcher } from "react-router";
import { NotebookPen, Lock } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { MAX_NOTE_LENGTH } from "~/lib/notes";
import {
  describeNoteDraft,
  type NoteDraft,
  type NoteDraftStatus,
  type SavedNote,
} from "~/modules/note-draft";

export function LessonNote({ note }: { note: SavedNote | null }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const [submittedBody, setSubmittedBody] = useState<string | null>(null);
  const isSaving = fetcher.state !== "idle";
  // An error belongs to the text that was submitted; editing it clears the error.
  const error = body === submittedBody ? fetcher.data?.error : undefined;

  const draft = describeNoteDraft({
    draft: body,
    saved: note,
    maxLength: MAX_NOTE_LENGTH,
    error,
  });

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <LessonNoteHeader />

        <fetcher.Form
          method="post"
          className="space-y-2"
          onSubmit={() => setSubmittedBody(body)}
        >
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Jot down what you want to remember from this lesson..."
            aria-label="Your notes"
            rows={4}
            className="resize-y"
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !draft.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus status={draft.status} />
            <NoteLength draft={draft} />
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteStatus({ status }: { status: NoteDraftStatus }) {
  switch (status.kind) {
    case "error":
      return <span className="text-xs text-destructive">{status.message}</span>;
    case "too-long":
      return (
        <span className="text-xs text-destructive">
          Too long to save — shorten it a little.
        </span>
      );
    case "empty":
      return (
        <span className="text-xs text-muted-foreground">
          A note cannot be saved empty.
        </span>
      );
    case "unsaved":
      return (
        <span className="text-xs text-muted-foreground">Unsaved changes</span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className="text-xs text-muted-foreground"
        >
          Saved · last edited {formatRelativeTime(status.updatedAt)}
        </span>
      );
    case "blank":
      return null;
  }
}

function LessonNoteHeader() {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}

function NoteLength({ draft }: { draft: NoteDraft }) {
  return (
    <span
      className={cn(
        "ml-auto text-xs",
        draft.tooLong ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {draft.length} / {draft.maxLength}
    </span>
  );
}
