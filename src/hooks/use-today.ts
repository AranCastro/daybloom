/**
 * The current day (and hour), kept in state so screens move on at midnight.
 * Tabs stay mounted and the React Compiler caches values that have no inputs, so a bare
 * dayKey() or new Date() in render would keep showing the day the screen first appeared.
 * This refreshes at every hour boundary and whenever the app returns to the foreground.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dayKey } from '@/lib/dates';

type Clock = { today: string; hour: number };

function read(): Clock {
  const now = new Date();
  return { today: dayKey(now), hour: now.getHours() };
}

export function useClock(): Clock {
  const [clock, setClock] = useState(read);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const next = read();
      setClock((c) => (c.today === next.today && c.hour === next.hour ? c : next));
      const now = new Date();
      const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, nextHour.getTime() - now.getTime() + 500);
    };
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return clock;
}

/** Today's key (YYYY-MM-DD), updated at midnight and on returning to the app. */
export function useToday(): string {
  return useClock().today;
}
