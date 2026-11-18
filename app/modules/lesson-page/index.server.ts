import { db } from "~/db";
import { courseQueries, flattenCourseLessons } from "./lib/course";
import type { Db } from "./lib/db";
import { progressQueries } from "./lib/progress";
import { quizQueries } from "./lib/quiz";
import { renderThread, threadQueries } from "./lib/thread";

/**
 * The reads and writes behind a lesson page — course outline, progress,
 * discussion thread and quiz — bound to a database. The route uses
 * `lessonPage`; tests build their own against a test database.
 */
export function createLessonPage(database: Db) {
  return {
    ...courseQueries(database),
    ...progressQueries(database),
    ...threadQueries(database),
    ...quizQueries(database),
    flattenCourseLessons,
    renderThread,
  };
}

export const lessonPage = /* @__PURE__ */ createLessonPage(db);
