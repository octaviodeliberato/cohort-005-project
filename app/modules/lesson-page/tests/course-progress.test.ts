import { beforeEach, describe, expect, it } from "vitest";
import { LessonProgressStatus, lessonProgress } from "~/db/schema";
import {
  addCourse,
  addLesson,
  addModule,
  addWatchEvent,
  setUp,
} from "./fixtures";

let world: ReturnType<typeof setUp>;

beforeEach(() => {
  world = setUp();
});

function twoModuleCourse() {
  const { db, course } = world;
  const second = addModule(db, {
    courseId: course.id,
    title: "Second",
    position: 2,
  });
  const first = addModule(db, {
    courseId: course.id,
    title: "First",
    position: 1,
  });
  const b = addLesson(db, { moduleId: first.id, title: "B", position: 2 });
  const a = addLesson(db, { moduleId: first.id, title: "A", position: 1 });
  const c = addLesson(db, { moduleId: second.id, title: "C", position: 1 });
  return { first, second, a, b, c };
}

describe("course outline", () => {
  it("returns the course with its instructor, category and ordered modules", () => {
    const { first, second, a, b, c } = twoModuleCourse();
    const details = world.page.getCourseWithDetails(world.course.id);

    expect(details?.instructorName).toBe("Test Instructor");
    expect(details?.categoryName).toBe("Programming");
    expect(details?.modules.map((m) => m.id)).toEqual([first.id, second.id]);
    expect(details?.modules[0].lessons.map((l) => l.id)).toEqual([a.id, b.id]);
    expect(details?.modules[1].lessons.map((l) => l.id)).toEqual([c.id]);
  });

  it("returns a course with no modules", () => {
    expect(world.page.getCourseWithDetails(world.course.id)?.modules).toEqual(
      []
    );
  });

  it("returns null for an unknown course", () => {
    expect(world.page.getCourseWithDetails(9999)).toBeNull();
  });

  it("flattens the outline into reading order with module titles", () => {
    const { first, second, a, b, c } = twoModuleCourse();
    const details = world.page.getCourseWithDetails(world.course.id);
    if (!details) throw new Error("course missing");

    expect(world.page.flattenCourseLessons(details)).toEqual([
      { id: a.id, title: "A", moduleId: first.id, moduleTitle: "First" },
      { id: b.id, title: "B", moduleId: first.id, moduleTitle: "First" },
      { id: c.id, title: "C", moduleId: second.id, moduleTitle: "Second" },
    ]);
  });

  it("looks up lessons, modules and users by id", () => {
    const { first, a } = twoModuleCourse();
    expect(world.page.getLessonById(a.id)?.title).toBe("A");
    expect(world.page.getModuleById(first.id)?.title).toBe("First");
    expect(world.page.getUserById(world.instructor.id)?.name).toBe(
      "Test Instructor"
    );
  });
});

describe("lesson progress", () => {
  it("marks a viewed lesson in progress", () => {
    const { a } = twoModuleCourse();
    world.page.markLessonInProgress(world.user.id, a.id);
    expect(world.page.getLessonProgress(world.user.id, a.id)?.status).toBe(
      LessonProgressStatus.InProgress
    );
  });

  it("completes a lesson with a completion time", () => {
    const { a } = twoModuleCourse();
    world.page.markLessonComplete(world.user.id, a.id);
    const progress = world.page.getLessonProgress(world.user.id, a.id);
    expect(progress?.status).toBe(LessonProgressStatus.Completed);
    expect(progress?.completedAt).toEqual(expect.any(String));
  });

  it("completes a lesson already in progress", () => {
    const { a } = twoModuleCourse();
    world.page.markLessonInProgress(world.user.id, a.id);
    world.page.markLessonComplete(world.user.id, a.id);
    expect(
      world.page.getLessonProgressForCourse(world.user.id, world.course.id)
    ).toHaveLength(1);
    expect(world.page.getLessonProgress(world.user.id, a.id)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });

  it("does not move a completed lesson back to in progress", () => {
    const { a } = twoModuleCourse();
    world.page.markLessonComplete(world.user.id, a.id);
    world.page.markLessonInProgress(world.user.id, a.id);
    expect(world.page.getLessonProgress(world.user.id, a.id)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });

  it("moves a not-started record to in progress", () => {
    const { a } = twoModuleCourse();
    world.page.markLessonComplete(world.user.id, a.id);
    world.db
      .update(lessonProgress)
      .set({ status: LessonProgressStatus.NotStarted })
      .run();
    world.page.markLessonInProgress(world.user.id, a.id);
    expect(world.page.getLessonProgress(world.user.id, a.id)?.status).toBe(
      LessonProgressStatus.InProgress
    );
  });

  it("lists only this Student's progress in this course", () => {
    const { a, c } = twoModuleCourse();
    const other = addCourse(world.db, world.instructor.id, "other");
    const otherLesson = addLesson(world.db, {
      moduleId: addModule(world.db, {
        courseId: other.id,
        title: "Elsewhere",
        position: 1,
      }).id,
      title: "X",
      position: 1,
    });
    world.page.markLessonComplete(world.user.id, a.id);
    world.page.markLessonInProgress(world.user.id, c.id);
    world.page.markLessonComplete(world.user.id, otherLesson.id);
    world.page.markLessonComplete(world.instructor.id, a.id);

    const records = world.page.getLessonProgressForCourse(
      world.user.id,
      world.course.id
    );
    expect(records.map((r) => [r.lessonId, r.status]).sort()).toEqual(
      [
        [a.id, LessonProgressStatus.Completed],
        [c.id, LessonProgressStatus.InProgress],
      ].sort()
    );
  });

  it("has no progress for a course without modules or lessons", () => {
    const other = addCourse(world.db, world.instructor.id, "other");
    const otherModule = addModule(world.db, {
      courseId: other.id,
      title: "Elsewhere",
      position: 1,
    });
    const otherLesson = addLesson(world.db, {
      moduleId: otherModule.id,
      title: "X",
      position: 1,
    });
    world.page.markLessonComplete(world.user.id, otherLesson.id);

    expect(
      world.page.getLessonProgressForCourse(world.user.id, world.course.id)
    ).toEqual([]);
    addModule(world.db, {
      courseId: world.course.id,
      title: "Empty",
      position: 1,
    });
    expect(
      world.page.getLessonProgressForCourse(world.user.id, world.course.id)
    ).toEqual([]);
  });
});

describe("video watch state", () => {
  function watch(lessonId: number, positionSeconds: number, minute: number) {
    addWatchEvent(world.db, {
      userId: world.user.id,
      lessonId,
      positionSeconds,
      createdAt: `2026-11-17T10:${String(minute).padStart(2, "0")}:00.000Z`,
    });
  }

  it("resumes from the most recent position, not the furthest", () => {
    const { a } = twoModuleCourse();
    watch(a.id, 300, 1);
    watch(a.id, 120, 2);
    expect(world.page.getLastWatchPosition(world.user.id, a.id)).toBe(120);
  });

  it("resumes from the start with no events", () => {
    const { a } = twoModuleCourse();
    expect(world.page.getLastWatchPosition(world.user.id, a.id)).toBe(0);
  });

  it("reports the furthest position as a rounded percentage", () => {
    const { a } = twoModuleCourse();
    watch(a.id, 200, 1);
    watch(a.id, 50, 2);
    expect(world.page.calculateWatchProgress(world.user.id, a.id, 600)).toBe(
      33
    );
  });

  it("caps progress at 100 and is 0 for a video with no length", () => {
    const { a } = twoModuleCourse();
    watch(a.id, 700, 1);
    expect(world.page.calculateWatchProgress(world.user.id, a.id, 600)).toBe(
      100
    );
    expect(world.page.calculateWatchProgress(world.user.id, a.id, 0)).toBe(0);
  });

  it("is 0 when the Student has not watched", () => {
    const { a } = twoModuleCourse();
    expect(world.page.calculateWatchProgress(world.user.id, a.id, 600)).toBe(0);
  });
});
