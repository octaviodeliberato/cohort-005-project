import { count, countDistinct, desc, eq, inArray } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import {
  categories,
  courses,
  CourseStatus,
  lessons,
  modules,
  users,
} from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

const FEATURED_COURSE_COUNT = 3;

export type FeaturedCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  instructorName: string;
  categoryName: string;
  lessonCount: number;
};

export type LandingStats = {
  courses: number;
  lessons: number;
  instructors: number;
  categories: number;
};

export type LandingPage = {
  featuredCourses: FeaturedCourse[];
  stats: LandingStats;
};

const isPublished = eq(courses.status, CourseStatus.Published);

function getFeaturedCourses(db: Db): FeaturedCourse[] {
  const newest = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(isPublished)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(FEATURED_COURSE_COUNT)
    .all();

  const lessonCounts = db
    .select({ courseId: modules.courseId, lessonCount: count(lessons.id) })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(
      inArray(
        modules.courseId,
        newest.map((course) => course.id)
      )
    )
    .groupBy(modules.courseId)
    .all();
  const lessonCountByCourse = new Map(
    lessonCounts.map((row) => [row.courseId, row.lessonCount])
  );

  return newest.map((course) => ({
    ...course,
    lessonCount: lessonCountByCourse.get(course.id) ?? 0,
  }));
}

function getStats(db: Db): LandingStats {
  const courseStats = db
    .select({
      courses: countDistinct(courses.id),
      instructors: countDistinct(courses.instructorId),
      categories: countDistinct(courses.categoryId),
    })
    .from(courses)
    .where(isPublished)
    .get();

  const lessonStats = db
    .select({ lessons: count(lessons.id) })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(isPublished)
    .get();

  return {
    courses: courseStats?.courses ?? 0,
    instructors: courseStats?.instructors ?? 0,
    categories: courseStats?.categories ?? 0,
    lessons: lessonStats?.lessons ?? 0,
  };
}

export function getLandingPage(db: Db): LandingPage {
  return { featuredCourses: getFeaturedCourses(db), stats: getStats(db) };
}
