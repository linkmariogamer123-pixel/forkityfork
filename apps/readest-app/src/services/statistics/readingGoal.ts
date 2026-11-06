import type { Book } from '@/types/book';

/** What a reading goal counts: minutes or pages each day, or books each year. */
export type ReadingGoalType = 'minutes' | 'pages' | 'books';

export interface ReadingGoal {
  type: ReadingGoalType;
  target: number;
}

export interface ReadingGoalInput {
  todaySeconds: number;
  todayPages: number;
  booksThisYear: number;
}

/** Progress toward the goal; `ratio` is clamped to [0, 1]. */
export const getGoalProgress = (goal: ReadingGoal, input: ReadingGoalInput) => {
  const current =
    goal.type === 'minutes'
      ? Math.floor(input.todaySeconds / 60)
      : goal.type === 'pages'
        ? input.todayPages
        : input.booksThisYear;
  const ratio = goal.target > 0 ? Math.min(1, current / goal.target) : 0;
  return { current, target: goal.target, ratio, done: goal.target > 0 && current >= goal.target };
};

/** Books marked Finished during the given local calendar year. */
export const countBooksFinishedInYear = (library: Book[], year: number): number =>
  library.filter(
    (book) =>
      !book.deletedAt &&
      book.readingStatus === 'finished' &&
      book.readingStatusUpdatedAt !== undefined &&
      new Date(book.readingStatusUpdatedAt).getFullYear() === year,
  ).length;

/** Unix seconds at the start of the local day containing `date`. */
export const startOfLocalDay = (date: Date): number =>
  Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000);
