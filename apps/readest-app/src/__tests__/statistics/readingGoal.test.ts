import { describe, it, expect } from 'vitest';
import { NodeDatabaseService } from '@/services/database/nodeDatabaseService';
import { migrate } from '@/services/database/migrate';
import { getMigrations } from '@/services/database/migrations';
import { StatisticsDb } from '@/services/statistics/statisticsDb';
import {
  countBooksFinishedInYear,
  getGoalProgress,
  startOfLocalDay,
} from '@/services/statistics/readingGoal';
import type { Book } from '@/types/book';

const unix = (local: string) => Math.floor(new Date(local).getTime() / 1000);
const input = { todaySeconds: 25 * 60 + 59, todayPages: 12, booksThisYear: 3 };

describe('getGoalProgress', () => {
  it('counts whole minutes read today for a minutes goal', () => {
    expect(getGoalProgress({ type: 'minutes', target: 50 }, input)).toEqual({
      current: 25,
      target: 50,
      ratio: 0.5,
      done: false,
    });
  });

  it('counts pages read today for a pages goal', () => {
    const progress = getGoalProgress({ type: 'pages', target: 12 }, input);
    expect(progress.current).toBe(12);
    expect(progress.done).toBe(true);
  });

  it('counts books finished this year for a books goal, capping the ratio at 1', () => {
    const progress = getGoalProgress({ type: 'books', target: 2 }, input);
    expect(progress.current).toBe(3);
    expect(progress.ratio).toBe(1);
  });
});

describe('countBooksFinishedInYear', () => {
  const book = (overrides: Partial<Book>) => ({ hash: 'h', ...overrides }) as Book;

  it('counts only books marked finished during that year and not deleted', () => {
    const library = [
      book({ readingStatus: 'finished', readingStatusUpdatedAt: new Date(2026, 2, 1).getTime() }),
      book({ readingStatus: 'finished', readingStatusUpdatedAt: new Date(2025, 11, 31).getTime() }),
      book({ readingStatus: 'reading', readingStatusUpdatedAt: new Date(2026, 4, 1).getTime() }),
      book({
        readingStatus: 'finished',
        readingStatusUpdatedAt: new Date(2026, 5, 1).getTime(),
        deletedAt: Date.now(),
      }),
      book({ readingStatus: 'finished' }),
    ];
    expect(countBooksFinishedInYear(library, 2026)).toBe(1);
  });
});

describe('StatisticsDb.getPagesReadSince', () => {
  it('counts distinct pages per book read since local midnight', async () => {
    const db = await NodeDatabaseService.open(':memory:');
    await migrate(db, getMigrations('statistics'));
    const stats = StatisticsDb.from(db);
    const a = await stats.upsertBook({ bookMd5: 'a', title: 'A', authors: '' });
    const b = await stats.upsertBook({ bookMd5: 'b', title: 'B', authors: '' });
    const event = (page: number, local: string) => ({
      page,
      startTime: unix(local),
      duration: 60,
      totalPages: 100,
    });
    await stats.insertPageEvent(a, event(1, '2026-10-20T23:50:00')); // yesterday
    await stats.insertPageEvent(a, event(2, '2026-10-21T08:00:00'));
    await stats.insertPageEvent(a, event(2, '2026-10-21T09:00:00')); // same page again
    await stats.insertPageEvent(a, event(3, '2026-10-21T09:05:00'));
    await stats.insertPageEvent(b, event(2, '2026-10-21T10:00:00')); // same number, other book

    const since = startOfLocalDay(new Date('2026-10-21T15:00:00'));
    expect(await stats.getPagesReadSince(since)).toBe(3);
  });
});
