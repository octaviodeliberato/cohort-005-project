import { beforeEach, describe, expect, it } from "vitest";
import { QuestionType, quizAnswers } from "~/db/schema";
import {
  addLesson,
  addModule,
  addQuiz,
  addQuizWithoutOptions,
  answersFor,
  setUp,
} from "./fixtures";

const { MultipleChoice, TrueFalse } = QuestionType;

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

function score(quizId: number, answers: Record<number, number>) {
  return world.page.computeResult(world.user.id, quizId, answers);
}

describe("finding the quiz", () => {
  it("finds the lesson's quiz with its questions in order", () => {
    const { quiz, questions } = addQuiz(world.db, lessonId, [
      MultipleChoice,
      TrueFalse,
    ]);

    expect(world.page.getQuizByLessonId(lessonId)?.id).toBe(quiz.id);
    expect(world.page.getQuizById(quiz.id)?.lessonId).toBe(lessonId);

    const full = world.page.getQuizWithQuestions(quiz.id);
    expect(full?.questions.map((q) => q.id)).toEqual(
      [...questions].reverse().map((q) => q.id)
    );
    expect(full?.questions[0].options).toEqual([
      expect.objectContaining({ optionText: "wrong", isCorrect: false }),
      expect.objectContaining({ optionText: "right", isCorrect: true }),
    ]);
  });

  it("lists a question without options with none", () => {
    const { quiz } = addQuizWithoutOptions(world.db, lessonId);
    expect(world.page.getQuizWithQuestions(quiz.id)?.questions).toEqual([
      expect.objectContaining({ options: [] }),
    ]);
  });

  it("finds nothing for a lesson or id without a quiz", () => {
    expect(world.page.getQuizByLessonId(lessonId)).toBeUndefined();
    expect(world.page.getQuizWithQuestions(9999)).toBeNull();
  });
});

describe("scoring a quiz", () => {
  it("scores each question against its correct option", () => {
    const { quiz, questions } = addQuiz(world.db, lessonId, [
      MultipleChoice,
      TrueFalse,
      MultipleChoice,
      TrueFalse,
    ]);

    const result = score(
      quiz.id,
      answersFor(questions, ["right", "right", "wrong", "skip"])
    );

    expect(result).toMatchObject({
      score: 0.5,
      passed: false,
      grade: "F",
      totalCorrect: 2,
      totalQuestions: 4,
    });
    const byId = new Map(result?.questionResults.map((r) => [r.questionId, r]));
    expect(byId.get(questions[0].id)).toEqual({
      questionId: questions[0].id,
      correct: true,
      selectedOptionId: questions[0].right,
      correctOptionId: questions[0].right,
    });
    expect(byId.get(questions[2].id)).toMatchObject({
      correct: false,
      selectedOptionId: questions[2].wrong,
      correctOptionId: questions[2].right,
    });
    expect(byId.get(questions[3].id)).toEqual({
      questionId: questions[3].id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    });
  });

  it("records the attempt and only the answered questions", () => {
    const { quiz, questions } = addQuiz(world.db, lessonId, [
      TrueFalse,
      TrueFalse,
    ]);

    const result = score(quiz.id, answersFor(questions, ["right", "skip"]));

    expect(world.page.getBestAttempt(world.user.id, quiz.id)?.id).toBe(
      result?.attemptId
    );
    const stored = world.db.select().from(quizAnswers).all();
    expect(stored).toEqual([
      expect.objectContaining({
        attemptId: result?.attemptId,
        questionId: questions[0].id,
        selectedOptionId: questions[0].right,
      }),
    ]);
  });

  it.each([
    { right: 10, total: 10, grade: "A", passed: true },
    { right: 9, total: 10, grade: "A", passed: true },
    { right: 8, total: 10, grade: "B", passed: true },
    { right: 7, total: 10, grade: "C", passed: false },
    { right: 6, total: 10, grade: "D", passed: false },
    { right: 5, total: 10, grade: "F", passed: false },
  ])(
    "$right of $total right grades $grade (passed: $passed)",
    ({ right, total, grade, passed }) => {
      const types = Array.from({ length: total }, () => MultipleChoice);
      const { quiz, questions } = addQuiz(world.db, lessonId, types);
      const picks = questions.map((_, i) => (i < right ? "right" : "wrong"));

      expect(score(quiz.id, answersFor(questions, picks))).toMatchObject({
        score: right / total,
        grade,
        passed,
      });
    }
  );

  it("scores a quiz with no questions as zero", () => {
    const { quiz } = addQuiz(world.db, lessonId, []);
    expect(score(quiz.id, {})).toMatchObject({
      score: 0,
      passed: false,
      grade: "F",
      totalQuestions: 0,
    });
  });

  it("scores an answer to a question without options as wrong", () => {
    const elsewhere = addQuiz(world.db, lessonId, [TrueFalse]).questions[0];
    const { quiz, question } = addQuizWithoutOptions(world.db, lessonId);
    const result = score(quiz.id, { [question.id]: elsewhere.right });
    expect(result).toMatchObject({ totalCorrect: 0, totalQuestions: 1 });
    expect(result?.questionResults).toEqual([
      expect.objectContaining({
        selectedOptionId: elsewhere.right,
        correctOptionId: null,
      }),
    ]);
  });

  it("returns null for an unknown quiz", () => {
    expect(score(9999, {})).toBeNull();
  });

  it("keeps the best attempt", () => {
    const { quiz, questions } = addQuiz(world.db, lessonId, [
      TrueFalse,
      TrueFalse,
    ]);
    score(quiz.id, answersFor(questions, ["right", "right"]));
    score(quiz.id, answersFor(questions, ["wrong", "wrong"]));

    expect(world.page.getBestAttempt(world.user.id, quiz.id)).toMatchObject({
      score: 1,
      passed: true,
    });
    expect(
      world.page.getBestAttempt(world.instructor.id, quiz.id)
    ).toBeUndefined();
  });
});
