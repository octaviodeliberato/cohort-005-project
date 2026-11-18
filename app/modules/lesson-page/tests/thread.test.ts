import { beforeEach, describe, expect, it } from "vitest";
import { UserRole } from "~/db/schema";
import { addComment, addLesson, addModule, addUser, setUp } from "./fixtures";

let world: ReturnType<typeof setUp>;
let lessonId: number;

beforeEach(() => {
  world = setUp();
  const mod = addModule(world.db, {
    courseId: world.course.id,
    title: "Module",
    position: 1,
  });
  lessonId = addLesson(world.db, {
    moduleId: mod.id,
    title: "Lesson",
    position: 1,
  }).id;
});

type Post = {
  minute: number;
  parentId?: number;
  deletedAt?: string;
  editedAt?: string;
};

function post(userId: number, body: string, { minute, ...extra }: Post) {
  return addComment(world.db, {
    lessonId,
    userId,
    body,
    createdAt: `2026-11-17T10:${String(minute).padStart(2, "0")}:00.000Z`,
    ...extra,
  });
}

describe("lesson thread", () => {
  it("nests replies under their question, oldest first", () => {
    const later = post(world.user.id, "Second question", { minute: 3 });
    const question = post(world.user.id, "First question", { minute: 1 });
    post(world.instructor.id, "Answer", { minute: 2, parentId: question.id });

    const thread = world.page.getLessonThread(lessonId);

    expect(thread.map((c) => c.id)).toEqual([question.id, later.id]);
    expect(thread[0].replies.map((r) => r.body)).toEqual(["Answer"]);
    expect(thread[1].replies).toEqual([]);
  });

  it("flags the course instructor and platform admins", () => {
    const admin = addUser(world.db, "Pat Admin", UserRole.Admin);
    post(world.instructor.id, "From the instructor", { minute: 1 });
    post(admin.id, "From an admin", { minute: 2 });
    post(world.user.id, "From a student", { minute: 3 });

    const authors = world.page.getLessonThread(lessonId).map((c) => c.author);

    expect(
      authors.map((a) => [a.name, a.isInstructor, a.isPlatformAdmin])
    ).toEqual([
      ["Test Instructor", true, false],
      ["Pat Admin", false, true],
      ["Test User", false, false],
    ]);
  });

  it("keeps the edit time on a live comment", () => {
    post(world.user.id, "Edited", {
      minute: 1,
      editedAt: "2026-11-17T11:00:00.000Z",
    });
    expect(world.page.getLessonThread(lessonId)[0]).toMatchObject({
      body: "Edited",
      editedAt: "2026-11-17T11:00:00.000Z",
      deleted: false,
    });
  });

  it("blanks a deleted question that still has replies", () => {
    const question = post(world.user.id, "Secret", {
      minute: 1,
      deletedAt: "2026-11-17T12:00:00.000Z",
      editedAt: "2026-11-17T11:00:00.000Z",
    });
    post(world.instructor.id, "Answer", { minute: 2, parentId: question.id });

    const [shown] = world.page.getLessonThread(lessonId);

    expect(shown).toMatchObject({ body: "", editedAt: null, deleted: true });
    expect(shown.replies).toHaveLength(1);
  });

  it("drops a deleted question with no replies, and deleted replies", () => {
    post(world.user.id, "Gone", {
      minute: 1,
      deletedAt: "2026-11-17T12:00:00.000Z",
    });
    const question = post(world.user.id, "Kept", { minute: 2 });
    post(world.instructor.id, "Retracted", {
      minute: 3,
      parentId: question.id,
      deletedAt: "2026-11-17T12:00:00.000Z",
    });

    const thread = world.page.getLessonThread(lessonId);

    expect(thread.map((c) => c.body)).toEqual(["Kept"]);
    expect(thread[0].replies).toEqual([]);
  });

  it("is empty for a lesson that does not exist", () => {
    expect(world.page.getLessonThread(9999)).toEqual([]);
  });

  it("renders bodies to HTML and leaves deleted bodies empty", async () => {
    const question = post(world.user.id, "**bold**", { minute: 1 });
    post(world.instructor.id, "<script>x</script>reply", {
      minute: 2,
      parentId: question.id,
    });
    const deleted = post(world.user.id, "gone", {
      minute: 3,
      deletedAt: "2026-11-17T12:00:00.000Z",
    });
    post(world.user.id, "kept alive", { minute: 4, parentId: deleted.id });

    const [first, second] = await world.page.renderThread(
      world.page.getLessonThread(lessonId)
    );

    expect(first.bodyHtml).toContain("<strong>bold</strong>");
    expect(first.replies[0].bodyHtml).not.toContain("<script>");
    expect(second.bodyHtml).toBe("");
    expect(second.replies[0].bodyHtml).toContain("kept alive");
  });

  it("finds a comment by id", () => {
    const comment = post(world.user.id, "Hello", { minute: 1 });
    expect(world.page.getCommentById(comment.id)?.lessonId).toBe(lessonId);
    expect(world.page.getCommentById(9999)).toBeUndefined();
  });
});
