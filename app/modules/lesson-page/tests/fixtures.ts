import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createLessonPage } from "../index.server";

// The module only reads courses, lessons, comments and quizzes, so their rows
// go in directly. Kept in one place so a schema change touches only this file.

export function setUp() {
  const db = createTestDb();
  const base = seedBaseData(db);
  return { db, ...base, page: createLessonPage(db) };
}

export function addModule(
  db: TestDb,
  module: { courseId: number; title: string; position: number }
) {
  return db.insert(schema.modules).values(module).returning().get();
}

export function addLesson(
  db: TestDb,
  lesson: { moduleId: number; title: string; position: number }
) {
  return db.insert(schema.lessons).values(lesson).returning().get();
}

export function addCourse(db: TestDb, instructorId: number, slug: string) {
  const categoryId = db.select().from(schema.categories).get()?.id ?? 0;
  return db
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: slug,
      salesCopy: markdown(slug),
      instructorId,
      categoryId,
      status: schema.CourseStatus.Published,
    })
    .returning()
    .get();
}

export function addUser(db: TestDb, name: string, role = UserRole.Student) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.replace(/\s/g, ".")}@example.com`, role })
    .returning()
    .get();
}

export function addWatchEvent(
  db: TestDb,
  event: {
    userId: number;
    lessonId: number;
    positionSeconds: number;
    createdAt: string;
  }
) {
  db.insert(schema.videoWatchEvents)
    .values({ ...event, eventType: "progress" })
    .run();
}

export function addComment(
  db: TestDb,
  comment: {
    lessonId: number;
    userId: number;
    body: string;
    parentId?: number;
    createdAt: string;
    deletedAt?: string;
    editedAt?: string;
  }
) {
  return db
    .insert(schema.comments)
    .values({ ...comment, body: markdown(comment.body) })
    .returning()
    .get();
}

/** A quiz with one question per entry; each question's second option is correct. */
export function addQuiz(
  db: TestDb,
  lessonId: number,
  questionTypes: QuestionType[]
) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const questions = questionTypes.map((questionType, index) => {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Q${index + 1}`,
        questionType,
        position: questionTypes.length - index,
      })
      .returning()
      .get();
    const [wrong, right] = ["wrong", "right"].map((optionText) =>
      db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText,
          isCorrect: optionText === "right",
        })
        .returning()
        .get()
    );
    return { id: question.id, right: right.id, wrong: wrong.id };
  });
  return { quiz, questions };
}

/** A one-question quiz whose question has no options yet, as mid-edit. */
export function addQuizWithoutOptions(db: TestDb, lessonId: number) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Draft", passingScore: 0.7 })
    .returning()
    .get();
  const question = db
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "Q1",
      questionType: QuestionType.TrueFalse,
      position: 1,
    })
    .returning()
    .get();
  return { quiz, question };
}

export function answersFor(
  questions: Array<{ id: number; right: number; wrong: number }>,
  pick: Array<"right" | "wrong" | "skip">
) {
  const answers: Record<number, number> = {};
  questions.forEach((question, index) => {
    const choice = pick[index];
    if (choice !== "skip") answers[question.id] = question[choice];
  });
  return answers;
}
