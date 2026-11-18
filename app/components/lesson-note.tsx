import { NotebookPen } from "lucide-react";
import { useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  describeNoteDraft,
  MAX_NOTE_LENGTH,
  type NoteDraft,
} from "~/modules/lesson-notes";

type SavedNote = { body: string; updatedAt: string };

export function LessonNote({ note }: { note: SavedNote | null }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = isSaving ? undefined : fetcher.data?.error;
  const draft = describeNoteDraft(body, note?.body);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <NoteHeader note={note} draft={draft} />
        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Jot down what you want to remember from this lesson. Only you can read this."
            aria-label="Your notes"
            aria-invalid={draft.tooLong || undefined}
            className="min-h-28 resize-y"
          />
          <NoteFooter draft={draft} isSaving={isSaving} error={error} />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteHeader({
  note,
  draft,
}: {
  note: SavedNote | null;
  draft: NoteDraft;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <NotebookPen className="size-5 text-primary" />
      <h2 className="text-xl font-semibold">Your notes</h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Private
      </span>
      {draft.unsaved ? (
        <span className="ml-auto text-xs text-muted-foreground">
          Unsaved changes
        </span>
      ) : (
        note && (
          <span
            suppressHydrationWarning
            className="ml-auto text-xs text-muted-foreground"
          >
            Saved {formatRelativeTime(note.updatedAt)}
          </span>
        )
      )}
    </div>
  );
}

function NoteFooter({
  draft,
  isSaving,
  error,
}: {
  draft: NoteDraft;
  isSaving: boolean;
  error: string | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      <Button type="submit" size="sm" disabled={isSaving || !draft.canSave}>
        {isSaving ? "Saving..." : "Save note"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-destructive">
          {error}
        </span>
      )}
      <span
        className={cn(
          "ml-auto text-xs",
          draft.tooLong ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {draft.length} / {MAX_NOTE_LENGTH}
      </span>
    </div>
  );
}
