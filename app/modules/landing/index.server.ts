import { db } from "~/db";
import { getLandingPage, type Db } from "./lib/landing";

export type {
  FeaturedCourse,
  LandingPage,
  LandingStats,
} from "./lib/landing";

/**
 * The landing page (`/`) bound to a database. The app uses `landing`, which
 * reads the app database; tests build their own against a test database.
 */
export function createLanding(database: Db) {
  return {
    /**
     * The newest published courses, with instructor, category and lesson
     * count, and the catalogue totals shown on the page. Only published
     * courses count: drafts and archived courses, and their lessons,
     * instructors and categories, are left out.
     */
    get() {
      return getLandingPage(database);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const landing = /* @__PURE__ */ createLanding(db);
