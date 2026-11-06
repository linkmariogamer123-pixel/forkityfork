import React, { useState } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import {
  BoxedList,
  SettingsInput,
  SettingsRow,
  SettingsSelect,
} from '@/components/settings/primitives';
import {
  getGoalProgress,
  type ReadingGoal,
  type ReadingGoalInput,
  type ReadingGoalType,
} from '@/services/statistics/readingGoal';
import { getLocale } from '@/utils/misc';

const DEFAULT_TARGETS: Record<ReadingGoalType, number> = { minutes: 30, pages: 20, books: 12 };

interface ReadingGoalCardProps {
  input: ReadingGoalInput;
}

const ReadingGoalCard: React.FC<ReadingGoalCardProps> = ({ input }) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const goal = settings.readingGoal;

  const saveGoal = (readingGoal: ReadingGoal | undefined) => {
    const next = { ...settings, readingGoal };
    setSettings(next);
    saveSettings(envConfig, next);
  };

  const [draft, setDraft] = useState(goal ? String(goal.target) : '');

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as ReadingGoalType | 'off';
    if (type === 'off') {
      setDraft('');
      saveGoal(undefined);
      return;
    }
    const target = DEFAULT_TARGETS[type];
    setDraft(String(target));
    saveGoal({ type, target });
  };

  const commitTarget = () => {
    if (!goal) return;
    const target = Math.floor(Number(draft));
    if (!Number.isFinite(target) || target < 1) {
      setDraft(String(goal.target));
      return;
    }
    if (target !== goal.target) saveGoal({ ...goal, target });
  };

  const progress = goal ? getGoalProgress(goal, input) : null;
  const progressLabel = (() => {
    if (!goal || !progress) return '';
    const counts = {
      current: progress.current.toLocaleString(getLocale()),
      target: goal.target.toLocaleString(getLocale()),
    };
    if (goal.type === 'minutes') return _('{{current}} / {{target}} min today', counts);
    if (goal.type === 'pages') return _('{{current}} / {{target}} pages today', counts);
    return _('{{current}} / {{target}} books this year', counts);
  })();

  return (
    <BoxedList title={_('Reading Goal')}>
      <SettingsRow label={_('Goal')}>
        <SettingsSelect
          value={goal?.type ?? 'off'}
          onChange={handleTypeChange}
          ariaLabel={_('Goal')}
          options={[
            { value: 'off', label: _('Off') },
            { value: 'minutes', label: _('Minutes per day') },
            { value: 'pages', label: _('Pages per day') },
            { value: 'books', label: _('Books per year') },
          ]}
        />
      </SettingsRow>
      {goal && progress && (
        <>
          <SettingsRow label={_('Target')}>
            <SettingsInput
              type='number'
              inputMode='numeric'
              min={1}
              value={draft}
              aria-label={_('Target')}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitTarget}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </SettingsRow>
          <div className='flex flex-col gap-2 py-3 pe-4'>
            <div className='flex items-center justify-between text-sm'>
              <span className='tabular-nums'>{progressLabel}</span>
              {progress.done && <span className='font-semibold'>{_('Goal reached')}</span>}
            </div>
            <progress
              className='progress eink-bordered h-2 w-full'
              value={Math.round(progress.ratio * 100)}
              max={100}
              aria-label={progressLabel}
            />
          </div>
        </>
      )}
    </BoxedList>
  );
};

export default ReadingGoalCard;
