import type { ComponentProps } from "react";
import type { DenialReason } from "~/modules/permissions/course-permissions.server";
import type { CommentThread } from "~/components/comment-thread";
import type { CurriculumSidebar } from "~/components/curriculum-sidebar";
import type { LessonNote } from "~/components/lesson-note";
import type { QuizSection } from "~/components/lesson-quiz";

/**
 * What the lesson page renders, in the two shapes the route's loader returns.
 * Components take these rather than the route's generated `./+types`, so a
 * route stays a leaf (dependency-cruiser's only-routes-import-routes). The
 * route hands its `loaderData` straight to them, so the typechecker holds the
 * two in step.
 */

type Sidebar = ComponentProps<typeof CurriculumSidebar>;
type Quiz = ComponentProps<typeof QuizSection>;

type LessonFrame = {
  course: Sidebar["course"];
  curriculum: Sidebar["curriculum"];
  module: { id: number; title: string };
  enrolled: boolean;
};

type LessonLink = { id: number; title: string };

export type LockedLessonView = LessonFrame & {
  view: "locked";
  lesson: LessonLink;
  lockedReason: DenialReason;
};

export type FullLessonView = LessonFrame & {
  view: "full";
  lesson: LessonLink & {
    durationMinutes: number | null;
    githubRepoUrl: string | null;
    videoUrl: string | null;
  };
  contentHtml: string | null;
  lessonStatus: string | null;
  currentUserId: number | null;
  prevLesson: LessonLink | null;
  nextLesson: LessonLink | null;
  quiz: Quiz["quiz"] | null;
  bestAttempt: Quiz["bestAttempt"];
  lastWatchPosition: number;
  watchProgress: number;
  lessonProgressMap: Sidebar["lessonProgressMap"];
  comments: ComponentProps<typeof CommentThread>["comments"];
  canModerate: boolean;
  instructorName: string;
  bookmarked: boolean;
  note: ComponentProps<typeof LessonNote>["note"];
};
