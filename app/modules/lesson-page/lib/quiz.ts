import { and, desc, eq, inArray } from "drizzle-orm";
import {
  quizAnswers,
  quizAttempts,
  quizOptions,
  quizQuestions,
  quizzes,
} from "~/db/schema";
import type { Db } from "./db";

function calculateGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

export function quizQueries(db: Db) {
  function getQuizById(quizId: number) {
    return db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
  }

  function getQuizByLessonId(lessonId: number) {
    return db
      .select()
      .from(quizzes)
      .where(eq(quizzes.lessonId, lessonId))
      .get();
  }

  function getQuestions(quizId: number) {
    return db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.position)
      .all();
  }

  function getOptionsByQuestion(questionIds: number[]) {
    const options =
      questionIds.length === 0
        ? []
        : db
            .select()
            .from(quizOptions)
            .where(inArray(quizOptions.questionId, questionIds))
            .orderBy(quizOptions.id)
            .all();
    const byQuestion = new Map<number, typeof options>();
    for (const option of options) {
      byQuestion.set(option.questionId, [
        ...(byQuestion.get(option.questionId) ?? []),
        option,
      ]);
    }
    return byQuestion;
  }

  function getQuizWithQuestions(quizId: number) {
    const quiz = getQuizById(quizId);
    if (!quiz) return null;

    const questions = getQuestions(quizId);
    const optionsByQuestion = getOptionsByQuestion(
      questions.map((question) => question.id)
    );
    const questionsWithOptions = questions.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) ?? [],
    }));

    return { ...quiz, questions: questionsWithOptions };
  }

  function getBestAttempt(userId: number, quizId: number) {
    return db
      .select()
      .from(quizAttempts)
      .where(
        and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
      )
      .orderBy(desc(quizAttempts.score))
      .limit(1)
      .get();
  }

  function computeResult(
    userId: number,
    quizId: number,
    selectedAnswers: Record<number, number>
  ) {
    const quiz = getQuizById(quizId);
    if (!quiz) return null;

    const questions = getQuestions(quizId);
    const optionsByQuestion = getOptionsByQuestion(
      questions.map((question) => question.id)
    );

    const questionResults: QuestionResult[] = questions.map((question) => {
      const selected = selectedAnswers[question.id];
      if (!selected) {
        return {
          questionId: question.id,
          correct: false,
          selectedOptionId: null,
          correctOptionId: null,
        };
      }
      const correctOptionId =
        optionsByQuestion.get(question.id)?.find((option) => option.isCorrect)
          ?.id ?? null;
      return {
        questionId: question.id,
        correct: selected === correctOptionId,
        selectedOptionId: selected,
        correctOptionId,
      };
    });

    const correct = questionResults.filter((result) => result.correct).length;
    const total = questions.length;
    const scoreValue = total > 0 ? correct / total : 0;
    const passed = scoreValue > 0.7;
    const grade = calculateGrade(scoreValue);

    const attempt = db.transaction((tx) => {
      const inserted = tx
        .insert(quizAttempts)
        .values({ userId, quizId, score: scoreValue, passed })
        .returning()
        .get();
      const answers = questionResults.flatMap((result) =>
        result.selectedOptionId === null
          ? []
          : [
              {
                attemptId: inserted.id,
                questionId: result.questionId,
                selectedOptionId: result.selectedOptionId,
              },
            ]
      );
      if (answers.length > 0) tx.insert(quizAnswers).values(answers).run();
      return inserted;
    });

    return {
      attemptId: attempt.id,
      score: scoreValue,
      passed,
      grade,
      totalCorrect: correct,
      totalQuestions: total,
      questionResults,
    };
  }

  return {
    getQuizById,
    getQuizByLessonId,
    getQuizWithQuestions,
    getBestAttempt,
    computeResult,
  };
}
