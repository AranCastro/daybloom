/** 3.0 data layer: coalesced saving, restore that cannot break the app, backups, patterns, weather, widgets. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  const ctl = { writes: 0, failWrite: false, failRead: false };
  return {
    ctl,
    mem,
    readItem: (k: string) => {
      if (ctl.failRead) throw new Error('database unavailable');
      return mem.get(k) ?? null;
    },
    writeItem: (k: string, v: string) => {
      if (ctl.failWrite) throw new Error('disk full');
      ctl.writes++;
      mem.set(k, v);
    },
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('@/lib/places', () => {
  const actual = jest.requireActual<typeof import('@/lib/places')>('@/lib/places');
  return { ...actual, currentCoords: jest.fn(async () => ({ lat: 9.93, lon: 76.27 })) };
});
jest.mock('expo-location', () => ({}));
const fsLog: string[] = [];
jest.mock('expo-file-system', () => {
  class Directory {
    name: string;
    constructor(...parts: unknown[]) {
      this.name = parts.map((p) => (typeof p === 'string' ? p : ((p as { name?: string }).name ?? ''))).join('/');
    }
    get exists() {
      return true;
    }
    delete() {
      fsLog.push(`delete dir ${this.name}`);
    }
    list() {
      return [new File('cache', 'daybloom-backup-2026-09-20.json'), new File('cache', 'other.png')];
    }
    create() {}
  }
  class File {
    name: string;
    uri: string;
    constructor(...parts: unknown[]) {
      this.name = String(parts[parts.length - 1]);
      this.uri = this.name;
    }
    get size() {
      return 200 * 1024 * 1024;
    }
    delete() {
      fsLog.push(`delete file ${this.name}`);
    }
    async text() {
      fsLog.push(`read ${this.name}`);
      return '';
    }
  }
  return { Directory, File, Paths: { document: { name: 'doc' }, cache: { name: 'cache' } } };
});
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: false, assets: [{ uri: 'movie.mp4', name: 'movie.mp4', size: 300 * 1024 * 1024 }] })),
}));
jest.mock('expo-sharing', () => ({}));

import * as DocumentPicker from 'expo-document-picker';

import { BACKUP_TYPES, checkBackupSize, makeBackup, parseBackup } from '@/lib/backup-core';
import { pickBackup } from '@/lib/backup';
import { addDays, dayKey, fromKey } from '@/lib/dates';
import { GOLDEN_EVERY } from '@/lib/flowers';
import { findPatterns } from '@/lib/patterns';
import { currentCoords } from '@/lib/places';
import { isDayKey, sanitise } from '@/lib/sanitise';
import * as store from '@/lib/store';
import { refreshWeather } from '@/lib/weather';
import { fitTaskRows } from '@/widgets/widgets';

const kv = jest.requireMock('@/lib/kv') as { ctl: { writes: number; failWrite: boolean; failRead: boolean }; mem: Map<string, string> };
const KEY = 'nudge.state.v1';
const saved = () => JSON.parse(kv.mem.get(KEY) ?? '{}') as Partial<store.AppState>;

beforeEach(() => {
  kv.ctl.failWrite = false;
  kv.ctl.failRead = false;
  store.replaceState({ onboarded: true });
  store.flushState();
});

describe('saving (D1)', () => {
  it('applies changes at once but writes once per burst, after the current task', async () => {
    const before = kv.ctl.writes;
    store.addTask('One', 1);
    store.addTask('Two', 1);
    store.addTask('Three', 1);
    expect(store.getState().tasks).toHaveLength(3);
    expect(kv.ctl.writes).toBe(before);
    await Promise.resolve();
    expect(kv.ctl.writes).toBe(before + 1);
    expect(saved().tasks).toHaveLength(3);
  });

  it('flushState writes straight away, and only when something changed', () => {
    store.addTask('Now', 2);
    store.flushState();
    expect(saved().tasks?.map((t) => t.title)).toEqual(['Now']);
    const n = kv.ctl.writes;
    store.flushState();
    expect(kv.ctl.writes).toBe(n);
  });

  it('a failed write still updates the screen, reports it, and retries later', () => {
    const seen = jest.fn();
    const stop = store.subscribe(seen);
    kv.ctl.failWrite = true;
    expect(() => {
      store.addTask('Kept in memory', 1);
      store.flushState();
    }).not.toThrow();
    expect(seen).toHaveBeenCalled();
    expect(store.getState().tasks.map((t) => t.title)).toEqual(['Kept in memory']);
    kv.ctl.failWrite = false;
    store.flushState();
    expect(saved().tasks?.map((t) => t.title)).toEqual(['Kept in memory']);
    stop();
  });

  it('reloading first writes what is pending, so nothing is lost', () => {
    store.addTask('Pending', 1);
    store.reloadState();
    expect(store.getState().tasks.map((t) => t.title)).toEqual(['Pending']);
  });

  it('a silent reload does not notify subscribers', () => {
    const seen = jest.fn();
    const stop = store.subscribe(seen);
    store.reloadState({ silent: true });
    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it('an unreadable database gives defaults instead of a crash', () => {
    kv.ctl.failRead = true;
    expect(() => store.reloadState()).not.toThrow();
    expect(store.getState().onboarded).toBe(false);
  });
});

describe('restore cannot break the app (D2)', () => {
  it('drops null blooms', () => {
    store.replaceState({ garden: [null, { id: 'a', at: 1, flower: 'lotus', source: 'task' }] as never });
    expect(store.getState().garden.map((b) => b.id)).toEqual(['a']);
  });

  it('repairs focus with sessions that are not a list', () => {
    store.replaceState({ focus: { sessions: 'x' } as never });
    expect(store.getState().focus).toEqual({ sessions: [], active: null });
  });

  it('turns null widget locks back into an empty map', () => {
    store.replaceState({ widgetLocks: null as never });
    expect(store.getState().widgetLocks).toEqual({});
    expect(store.widgetTickTask('Tasks', 'missing', 'done')).toBeNull();
  });

  it('clamps check-in values and drops bad day keys', () => {
    store.replaceState({ checkins: { '2026-09-01': 9, '2026-09-02': 0, '2026-09-03': 'x', yesterday: 3, '2026-13-01': 3 } as never });
    expect(store.getState().checkins).toEqual({ '2026-09-01': 5, '2026-09-02': 1 });
  });

  it('keeps the good parts of tasks and drops the rest', () => {
    store.replaceState({
      tasks: [
        null,
        { title: 'no id' },
        { id: 't1', title: 'Fine', quadrant: 7, done: 'yes', createdAt: 5, effort: 'huge', due: 'soon', steps: [null, { id: 's', title: 'Step', done: true }], workedOn: ['2026-09-01', 4] },
      ] as never,
    });
    expect(store.getState().tasks).toEqual([
      { id: 't1', title: 'Fine', quadrant: 1, done: false, createdAt: 5, steps: [{ id: 's', title: 'Step', done: true }], workedOn: ['2026-09-01'] },
    ]);
  });

  it('checks people, moods, notes, places, pookalams, energy and nudges', () => {
    store.replaceState({
      people: [{ id: 'p', name: 'Anu', quadrant: 2, createdAt: 1, phone: 42 }, { id: 'q' }] as never,
      moodTags: { '2026-09-01': ['calm', 3], bad: ['x'] } as never,
      goodNotes: { '2026-09-01': 'x'.repeat(500), '2026-09-02': 7 } as never,
      places: [{ id: 'h', name: 'Home', emoji: '🏠', lat: 'x', lon: 76, createdAt: 1 }, 'x'] as never,
      pookalams: [{ id: 'k', name: 'One', center: 'lotus', rings: [{ flower: 'lotus', pattern: 'zigzag' }], festival: 'x', createdAt: 1 }] as never,
      energy: { '2026-09-01': 7 } as never,
      nudges: [{ at: 1, kind: 'auto', status: 'ready' }, { at: 'x', kind: 'auto', status: 'ready' }] as never,
    });
    const s = store.getState();
    expect(s.people).toEqual([{ id: 'p', name: 'Anu', quadrant: 2, createdAt: 1 }]);
    expect(s.moodTags).toEqual({ '2026-09-01': ['calm'] });
    expect(s.goodNotes['2026-09-01']).toHaveLength(160);
    expect(s.goodNotes['2026-09-02']).toBeUndefined();
    expect(s.places).toEqual([{ id: 'h', name: 'Home', emoji: '🏠', createdAt: 1 }]);
    expect(s.pookalams[0]).toMatchObject({ rings: [], festival: 'onam' });
    expect(s.energy).toEqual({ '2026-09-01': 3 });
    expect(s.nudges).toHaveLength(1);
  });

  it('puts settings, reminder, widget prefs, undo, labels, games and avatar back in range', () => {
    store.replaceState({
      settings: { appearance: 'neon', weekStart: 3, focusVolume: 4, haptics: false } as never,
      reminder: { enabled: 'no', hour: 30, minute: -5 } as never,
      widgetPrefs: { Matrix: { opacity: 5, theme: 'pink' }, Nope: {} } as never,
      widgetUndo: { taskId: 3 } as never,
      labels: { matrix: { 1: 'Now', 2: 5 }, circle: null } as never,
      games: { best: { breathe: 'x', memory: 12 }, plays: null } as never,
      avatar: { kind: 'emoji' } as never,
      streak: 9 as never,
      bloomCount: -4,
    });
    const s = store.getState();
    expect(s.settings).toEqual({ ...store.DEFAULT_SETTINGS, focusVolume: 1, haptics: false });
    expect(s.reminder).toEqual({ enabled: true, hour: 23, minute: 0 });
    expect(s.widgetPrefs.Matrix).toEqual({ ...store.DEFAULT_WIDGET_PREFS, opacity: 40 });
    expect(s.widgetUndo).toBeNull();
    expect(s.labels).toEqual({ matrix: { 1: 'Now' }, circle: {} });
    expect(s.games).toEqual({ best: { memory: 12 }, plays: {} });
    expect(s.avatar).toBeNull();
    expect(s.streak).toBe(3);
    expect(s.bloomCount).toBe(0);
  });

  it('drops a broken running timer', () => {
    store.replaceState({ focus: { sessions: [], active: { kind: 'focus', preset: 'classic', total: 1, endAt: null, pausedLeft: null } } as never });
    expect(store.getState().focus.active).toBeNull();
  });

  it('cleans a damaged save at launch too', () => {
    kv.mem.set(KEY, JSON.stringify({ onboarded: true, garden: [null], widgetLocks: null, focus: { sessions: 'x' }, checkins: { '2026-09-01': 42 } }));
    store.reloadState();
    const s = store.getState();
    expect(s.garden).toEqual([]);
    expect(s.widgetLocks).toEqual({});
    expect(s.focus.sessions).toEqual([]);
    expect(s.checkins).toEqual({ '2026-09-01': 5 });
  });

  it('a backup file with damaged entries restores without them', () => {
    const text = JSON.stringify({ app: 'daybloom', format: 1, exportedAt: 1, state: { onboarded: true, garden: [null], widgetLocks: null } });
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) store.replaceState(parsed.backup.state);
    expect(store.getState().garden).toEqual([]);
    expect(store.getState().widgetLocks).toEqual({});
  });

  it('keeps a round trip of a real backup intact', () => {
    store.addTask('Keep me', 2, '2026-10-01', 'deep');
    store.bloom('checkin');
    const before = store.getState();
    const parsed = parseBackup(makeBackup(before));
    if (!parsed.ok) throw new Error(parsed.reason);
    store.replaceState(parsed.backup.state);
    expect(store.getState().tasks).toEqual(before.tasks);
    expect(store.getState().garden).toEqual(before.garden);
  });

  it('passes unknown fields through and handles non-objects', () => {
    expect(sanitise({ laterField: { a: 1 } })).toEqual({ laterField: { a: 1 } });
    expect(sanitise(null)).toEqual({});
    expect(isDayKey('2026-02-30')).toBe(true);
    expect(isDayKey('2026-2-3')).toBe(false);
  });
});

describe('backup files (D3, L5)', () => {
  it('refuses a huge file before reading it, and offers only text types', async () => {
    fsLog.length = 0;
    const r = await pickBackup();
    expect(r).toMatchObject({ ok: false });
    expect(fsLog.some((x) => x.startsWith('read'))).toBe(false);
    expect((DocumentPicker.getDocumentAsync as jest.Mock).mock.calls[0][0]).toMatchObject({ type: BACKUP_TYPES });
    expect(BACKUP_TYPES).not.toContain('*/*');
    expect(checkBackupSize(1024)).toBeNull();
  });

  it('erasing everything deletes the backup files kept on the phone', () => {
    fsLog.length = 0;
    store.resetAll();
    expect(fsLog).toContain('delete dir doc/backups');
    expect(fsLog).toContain('delete file daybloom-backup-2026-09-20.json');
    expect(fsLog).not.toContain('delete file other.png');
  });
});

describe('bloom counts (L1, L2)', () => {
  it('old saves count the flowers carried over from focus sessions', () => {
    kv.mem.set(KEY, JSON.stringify({ onboarded: true, focus: { sessions: [1, 2, 3].map((i) => ({ at: i, minutes: 25, flower: 'daisy' })), active: null } }));
    store.reloadState();
    expect(store.getState().garden).toHaveLength(3);
    expect(store.getState().bloomCount).toBe(3);
    expect(store.getState().bloomsEver).toBe(3);
  });

  it('tick, untick, tick cannot earn the Golden Lotus twice', () => {
    store.update({ bloomCount: GOLDEN_EVERY - 1, bloomsEver: GOLDEN_EVERY - 1 });
    const t = store.addTask('Lotus hunt', 1);
    store.toggleTask(t.id);
    expect(store.getState().garden[0].flower).toBe('golden-lotus');
    store.toggleTask(t.id);
    expect(store.getState().bloomCount).toBe(GOLDEN_EVERY - 1);
    expect(store.getState().bloomsEver).toBe(GOLDEN_EVERY);
    store.toggleTask(t.id);
    expect(store.getState().garden[0].flower).not.toBe('golden-lotus');
    expect(store.getState().bloomsEver).toBe(GOLDEN_EVERY + 1);
  });

  it('a big task still grows its progress flower and its finishing flower', () => {
    const t = store.addTask('Thesis', 2);
    store.addStep(t.id, 'Outline');
    store.addStep(t.id, 'Draft');
    const ever = store.getState().bloomsEver;
    store.widgetTickTask('Tasks', t.id, 'done');
    expect(store.getState().bloomsEver).toBe(ever + 1);
    store.widgetTickTask('Tasks', t.id, 'done');
    expect(store.getState().tasks[0].done).toBe(true);
    expect(store.getState().bloomsEver).toBe(ever + 2);
  });
});

describe('patterns count cleared tasks (L3)', () => {
  it('two finished tasks on a day still count after the quadrant is cleared', () => {
    const today = '2026-09-27';
    const checkins: Record<string, 1 | 2 | 3 | 4 | 5> = {};
    const clearedWork: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = dayKey(addDays(fromKey(today), -i));
      const busy = i % 3 === 0;
      checkins[d] = busy ? 5 : 3;
      if (busy) clearedWork[d] = 2;
    }
    const s = { ...store.getState(), checkins, clearedWork };
    expect(findPatterns(s, today).map((p) => p.id)).toContain('tasks');
  });
});

describe('weather cache first (L8)', () => {
  it('a fresh reading only uses a position the phone already has', async () => {
    (globalThis as { fetch: unknown }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ current: { temperature_2m: 30, weather_code: 0, is_day: 1 } }) }));
    await refreshWeather(false);
    (currentCoords as jest.Mock).mockClear();
    await refreshWeather(false);
    expect((currentCoords as jest.Mock).mock.calls[0]).toEqual([false, true]);
  });
});

describe('Tasks widget rows (L10)', () => {
  it('fits rows by their real height and keeps room for "+n more"', () => {
    const plain = Array.from({ length: 5 }, () => ({ next: null }));
    expect(fitTaskRows(plain, 0, 176)).toEqual({ show: 2, more: 3, moreInHeader: false });
    expect(fitTaskRows(plain.slice(0, 3), 0, 176)).toEqual({ show: 3, more: 0, moreInHeader: false });
    const steps = [{ next: 'a' }, { next: 'b' }, { next: 'c' }];
    expect(fitTaskRows(steps, 0, 176)).toEqual({ show: 2, more: 1, moreInHeader: false });
    // The smallest 4 × 2 size: one row, and the count moves to the header.
    expect(fitTaskRows(plain, 0, 110)).toEqual({ show: 1, more: 4, moreInHeader: true });
    expect(fitTaskRows([{ next: null }], 2, 176)).toEqual({ show: 1, more: 2, moreInHeader: false });
  });
});
