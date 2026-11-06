import React, { useEffect, useState } from 'react';
import Dialog from '@/components/Dialog';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { StatisticsDb } from '@/services/statistics/statisticsDb';
import { isSyncCategoryEnabled } from '@/services/sync/syncCategories';
import { getDailySeconds, getStreaks, toDateKey } from '@/services/statistics/readingStats';
import { BoxedList, SettingsRow } from '@/components/settings/primitives';
import { formatDuration } from '@/utils/duration';
import { getLocale } from '@/utils/misc';
import ReadingTimeChart from './ReadingTimeChart';
import ReadingHeatmap from './ReadingHeatmap';
import ReadingGoalCard from './ReadingGoalCard';
import { useLibraryStore } from '@/store/libraryStore';
import { countBooksFinishedInYear, startOfLocalDay } from '@/services/statistics/readingGoal';

export const setReadingStatsDialogVisible = (visible: boolean) => {
  const dialog = document.getElementById('reading_stats_window');
  if (dialog) {
    const event = new CustomEvent('setDialogVisibility', {
      detail: { visible },
    });
    dialog.dispatchEvent(event);
  }
};

interface ReadingStats {
  daily: Map<string, number>;
  totals: { seconds: number; books: number; pages: number };
  todayPages: number;
}

const ReadingStatsContent: React.FC = () => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { user } = useAuth();
  const { library } = useLibraryStore();
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!appService) return;
    let cancelled = false;
    const load = async (db: StatisticsDb) => {
      const [quarters, totals, todayPages] = await Promise.all([
        db.getQuarterHourDurations(),
        db.getReadingTotals(),
        db.getPagesReadSince(startOfLocalDay(new Date())),
      ]);
      if (!cancelled) setStats({ daily: getDailySeconds(quarters), totals, todayPages });
    };
    StatisticsDb.open(appService)
      .then(async (db) => {
        await load(db);
        // Only an open book pulls stats, so from the library this device may
        // not have the account's other devices yet: show what's here, then pull.
        if (user && isSyncCategoryEnabled('stats')) {
          // Loaded here so the menus that import this dialog don't pull the
          // sync client (and its API base URL) into their module graph.
          const [{ SyncClient }, { pullStats }] = await Promise.all([
            import('@/libs/sync'),
            import('@/services/statistics/statsSync'),
          ]);
          await pullStats(db, new SyncClient()).catch((err) =>
            console.warn('Failed to pull reading stats:', err),
          );
          await load(db);
        }
      })
      .catch((err) => {
        console.error('Failed to load reading stats:', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [appService, user]);

  if (failed) {
    return (
      <p className='text-base-content/70 py-10 text-center'>
        {_('Failed to load reading statistics')}
      </p>
    );
  }
  if (!stats) return null;

  const { daily, totals, todayPages } = stats;
  const now = new Date();
  const goalInput = {
    todaySeconds: daily.get(toDateKey(now)) ?? 0,
    todayPages,
    booksThisYear: countBooksFinishedInYear(library, now.getFullYear()),
  };
  const streaks = getStreaks(daily);
  const time = (seconds: number) => formatDuration(Math.floor(seconds / 60), _);
  const days = (count: number) => _('{{count}} days', { count });

  return (
    <div className='flex flex-col gap-6 pb-6'>
      <ReadingGoalCard input={goalInput} />
      <BoxedList title={_('Reading Time')} innerClassName='pe-4 py-4'>
        <ReadingTimeChart daily={daily} />
      </BoxedList>
      <BoxedList title={_('Activity')} innerClassName='pe-4 py-4'>
        <ReadingHeatmap daily={daily} />
      </BoxedList>
      <BoxedList title={_('Overview')}>
        <SettingsRow label={_('Today')}>
          <span className='tabular-nums'>{time(daily.get(toDateKey(new Date())) ?? 0)}</span>
        </SettingsRow>
        <SettingsRow label={_('Current Streak')}>
          <span className='tabular-nums'>{days(streaks.current)}</span>
        </SettingsRow>
        <SettingsRow label={_('Longest Streak')}>
          <span className='tabular-nums'>{days(streaks.longest)}</span>
        </SettingsRow>
      </BoxedList>
      <BoxedList title={_('All Time')}>
        <SettingsRow label={_('Reading Time')}>
          <span className='tabular-nums'>{time(totals.seconds)}</span>
        </SettingsRow>
        <SettingsRow label={_('Books')}>
          <span className='tabular-nums'>{totals.books.toLocaleString(getLocale())}</span>
        </SettingsRow>
        <SettingsRow label={_('Pages')}>
          <span className='tabular-nums'>{totals.pages.toLocaleString(getLocale())}</span>
        </SettingsRow>
      </BoxedList>
    </div>
  );
};

export const ReadingStatsDialog: React.FC = () => {
  const _ = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleCustomEvent = (event: CustomEvent) => {
      setIsOpen(event.detail.visible);
    };

    const el = document.getElementById('reading_stats_window');
    if (el) {
      el.addEventListener('setDialogVisibility', handleCustomEvent as EventListener);
    }

    return () => {
      if (el) {
        el.removeEventListener('setDialogVisibility', handleCustomEvent as EventListener);
      }
    };
  }, []);

  return (
    <Dialog
      id='reading_stats_window'
      isOpen={isOpen}
      title={_('Reading Statistics')}
      onClose={() => setIsOpen(false)}
      useOverlayScroll
      boxClassName='sm:h-[85%]! sm:w-[560px]! sm:max-w-(--breakpoint-sm)!'
      contentClassName='px-4! sm:px-6!'
    >
      {isOpen && <ReadingStatsContent />}
    </Dialog>
  );
};

export default ReadingStatsDialog;
