import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLanding } from "../index.server";

let db: TestDb;
let instructorId: number;
let categoryId: number;
let baseCourseId: number;

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  instructorId = base.instructor.id;
  categoryId = base.category.id;
  baseCourseId = base.course.id;
});

// ─── Fixtures ───
// No module owns writing courses, modules or lessons yet, so rows go in
// directly. Kept in one place so a schema change touches only this block.

let slugCounter = 0;

function addCourse(
  title: string,
  {
    status = CourseStatus.Published,
    createdAt = "2026-01-01T00:00:00.000Z",
    instructor = instructorId,
    category = categoryId,
  } = {}
) {
  slugCounter += 1;
  return db
    .insert(schema.courses)
    .values({
      title,
      slug: `landing-course-${slugCounter}`,
      description: `About ${title}`,
      salesCopy: markdown(title),
      instructorId: instructor,
      categoryId: category,
      status,
      createdAt,
    })
    .returning()
    .get();
}

function addLessons(courseId: number, lessonCount: number) {
  const mod = db
    .insert(schema.modules)
    .values({ courseId, title: "Module", position: 1 })
    .returning()
    .get();
  for (let position = 1; position <= lessonCount; position += 1) {
    db.insert(schema.lessons)
      .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
      .run();
  }
}

function addInstructor(name: string) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      role: UserRole.Instructor,
    })
    .returning()
    .get();
}

function addCategory(name: string) {
  return db
    .insert(schema.categories)
    .values({ name, slug: name.toLowerCase() })
    .returning()
    .get();
}

function getPage() {
  return createLanding(db).get();
}

describe("featured courses", () => {
  it("lists the three newest published courses, newest first", () => {
    addCourse("Oldest", { createdAt: "2030-02-01T00:00:00.000Z" });
    addCourse("Newest", { createdAt: "2030-05-01T00:00:00.000Z" });
    addCourse("Middle", { createdAt: "2030-03-01T00:00:00.000Z" });
    addCourse("Second", { createdAt: "2030-04-01T00:00:00.000Z" });

    expect(getPage().featuredCourses.map((c) => c.title)).toEqual([
      "Newest",
      "Second",
      "Middle",
    ]);
  });

  it("leaves out draft and archived courses", () => {
    addCourse("Draft", {
      status: CourseStatus.Draft,
      createdAt: "2030-01-01T00:00:00.000Z",
    });
    addCourse("Archived", {
      status: CourseStatus.Archived,
      createdAt: "2030-01-01T00:00:00.000Z",
    });

    expect(getPage().featuredCourses.map((c) => c.title)).toEqual([
      "Test Course",
    ]);
  });

  it("is empty when nothing is published", () => {
    db.update(schema.courses).set({ status: CourseStatus.Draft }).run();

    expect(getPage().featuredCourses).toEqual([]);
  });

  it("carries the instructor, category and lesson count of each course", () => {
    const course = addCourse("Counted", {
      createdAt: "2030-01-01T00:00:00.000Z",
    });
    addLessons(course.id, 3);
    addLessons(course.id, 2);

    const [featured] = getPage().featuredCourses;
    expect(featured).toEqual({
      id: course.id,
      title: "Counted",
      slug: course.slug,
      description: "About Counted",
      coverImageUrl: null,
      instructorName: "Test Instructor",
      categoryName: "Programming",
      lessonCount: 5,
    });
  });

  it("counts zero lessons for a course with no modules", () => {
    const [featured] = getPage().featuredCourses;
    expect(featured.id).toBe(baseCourseId);
    expect(featured.lessonCount).toBe(0);
  });

  it("does not count another course's lessons", () => {
    const first = addCourse("First", { createdAt: "2030-01-01T00:00:00.000Z" });
    const second = addCourse("Second", {
      createdAt: "2030-02-01T00:00:00.000Z",
    });
    addLessons(first.id, 4);
    addLessons(second.id, 1);

    const counts = Object.fromEntries(
      getPage().featuredCourses.map((c) => [c.title, c.lessonCount])
    );
    expect(counts).toEqual({ First: 4, Second: 1, "Test Course": 0 });
  });
});

describe("stats", () => {
  it("counts published courses, their lessons, instructors and categories", () => {
    const otherInstructor = addInstructor("Olive Other");
    const otherCategory = addCategory("Design");
    const design = addCourse("Design", {
      instructor: otherInstructor.id,
      category: otherCategory.id,
    });
    addLessons(design.id, 2);
    addLessons(baseCourseId, 3);

    expect(getPage().stats).toEqual({
      courses: 2,
      lessons: 5,
      instructors: 2,
      categories: 2,
    });
  });

  it("counts every published course, not only the featured ones", () => {
    for (let i = 0; i < 60; i += 1) addCourse(`Course ${i}`);

    expect(getPage().stats.courses).toBe(61);
  });

  it("ignores unpublished courses and everything only they bring", () => {
    const hiddenInstructor = addInstructor("Hidden Instructor");
    const hiddenCategory = addCategory("Hidden");
    const draft = addCourse("Draft", {
      status: CourseStatus.Draft,
      instructor: hiddenInstructor.id,
      category: hiddenCategory.id,
    });
    addLessons(draft.id, 7);

    expect(getPage().stats).toEqual({
      courses: 1,
      lessons: 0,
      instructors: 1,
      categories: 1,
    });
  });

  it("counts an instructor or category once however many courses share it", () => {
    addCourse("Another");
    addCourse("And another");

    expect(getPage().stats).toMatchObject({
      courses: 3,
      instructors: 1,
      categories: 1,
    });
  });
});
