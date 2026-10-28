/** 4.0: widget taps after a session or a routine time has passed unseen, and redraws after a new day. */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ReactElement } from 'react';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('@/widgets/sync', () => ({ refreshWidgets: jest.fn(async () => undefined) }));
jest.mock('@/lib/reminders', () => ({
  scheduleFocusAlarm: jest.fn(async () => undefined),
  cancelFocusAlarm: jest.fn(async () => undefined),
  syncRoutineReminders: jest.fn(async () => undefined),
}));

import { addDays, dayKey } from '@/lib/dates';
import { startBreak, startFocus } from '@/lib/focus';
import { instanceId } from '@/lib/routines';
import * as store from '@/lib/store';
import { renderFor } from '@/widgets/catalogue';
import { refreshWidgets } from '@/widgets/sync';
import { widgetTaskHandler } from '@/widgets/task-handler';

const { nextRedrawAt } = jest.requireActual<typeof import('@/widgets/sync')>('@/widgets/sync');

function run(widgetName: string, widgetAction: string, clickAction?: string, clickActionData: Record<string, string> = {}) {
  const renderWidget = jest.fn();
  return widgetTaskHandler({
    widgetInfo: { widgetName, widgetId: 7, width: 320, height: 320, screenInfo: {} as never },
    widgetAction,
    clickAction,
    clickActionData,
    renderWidget,
  } as never).then(() => renderWidget);
}
const tap = (widgetName: string, clickAction: string, data: Record<string, string> = {}) => run(widgetName, 'WIDGET_CLICK', clickAction, data);

/** Moves the clock (Date only: timers and promises run as usual). */
function setClock(d: Date) {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  jest.setSystemTime(d);
}
const at = (day: Date, h: number, m = 0) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);

/** The finished timer as a widget would find it: its end time has passed, unseen. */
function runOut() {
  store.update((s) => ({ focus: { ...s.focus, active: { ...s.focus.active!, endAt: Date.now() - 60_000 } } }));
}

/** Every clickAction in a widget tree (the widget's own elements, without drawing it). */
function actions(el: unknown): string[] {
  if (!el || typeof el !== 'object') return [];
  if (Array.isArray(el)) return el.flatMap(actions);
  const props = (el as ReactElement<{ clickAction?: string; children?: unknown }>).props ?? {};
  return [...(props.clickAction ? [props.clickAction] : []), ...actions(props.children)];
}
function focusActions(): string[] {
  const tree = renderFor('Focus', store.getState(), 164, 164)!;
  const el = tree.light as ReactElement<object>;
  return actions((el.type as (p: object) => unknown)(el.props));
}

beforeEach(() => {
  store.resetAll();
  store.replaceState({ onboarded: true });
  jest.mocked(refreshWidgets).mockClear();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Focus widget: a session that ended while nobody looked', () => {
  it('Stop after the time is up completes the session and grows its flower', async () => {
    await startFocus('classic');
    runOut();
    const blooms = store.getState().bloomCount;
    await tap('Focus', 'FOCUS_STOP');
    const s = store.getState();
    expect(s.focus.active).toBeNull();
    expect(s.focus.sessions).toHaveLength(1);
    expect(s.focus.sessions[0].minutes).toBe(25);
    expect(s.bloomCount).toBe(blooms + 1);
  });

  it('Pause after the time is up completes it too, rather than pausing a finished session', async () => {
    await startFocus('gentle');
    runOut();
    await tap('Focus', 'FOCUS_PAUSE');
    expect(store.getState().focus.active).toBeNull();
    expect(store.getState().focus.sessions).toHaveLength(1);
  });

  it('a finished break simply ends', async () => {
    await startBreak('classic');
    runOut();
    const blooms = store.getState().bloomCount;
    await tap('Focus', 'FOCUS_STOP');
    expect(store.getState().focus.active).toBeNull();
    expect(store.getState().focus.sessions).toHaveLength(0);
    expect(store.getState().bloomCount).toBe(blooms);
  });

  it('with time left, Pause pauses and Stop throws the session away as before', async () => {
    await startFocus('classic');
    await tap('Focus', 'FOCUS_PAUSE');
    expect(store.getState().focus.active?.endAt).toBeNull();
    expect(store.getState().focus.active?.pausedLeft).toBeGreaterThan(0);
    await tap('Focus', 'FOCUS_STOP');
    expect(store.getState().focus.active).toBeNull();
    expect(store.getState().focus.sessions).toHaveLength(0);
  });

  it('the "Time is up" view offers no Pause or Stop', async () => {
    await startFocus('classic');
    expect(focusActions()).toEqual(expect.arrayContaining(['FOCUS_PAUSE', 'FOCUS_STOP']));
    runOut();
    expect(focusActions()).not.toContain('FOCUS_PAUSE');
    expect(focusActions()).not.toContain('FOCUS_STOP');
  });
});

describe('routine rows tapped after their time has moved on', () => {
  const day = new Date(2026, 9, 28);
  const add = () => store.addRoutine({ title: 'Medicine', quadrant: 1, kind: 'daily', times: ['08:00', '13:00'], remind: false, start: '2026-10-01' });

  it('a row the widget still shows is ticked before the next time replaces it', async () => {
    setClock(at(day, 9));
    const r = add();
    const morning = instanceId(r.id, dayKey(day), 0);
    expect(store.getState().tasks.some((t) => t.id === morning)).toBe(true);
    const blooms = store.getState().bloomCount;
    setClock(at(day, 13, 5));
    await tap('Tasks', 'TASK_DONE', { id: morning });
    expect(store.slotMark(store.getState(), r.id, dayKey(day), 0)).toBe('done');
    expect(store.getState().bloomCount).toBe(blooms + 1);
    // The afternoon's task has taken over, still to do.
    const left = store.getState().tasks.filter((t) => t.routineId === r.id);
    expect(left.map((t) => [t.slot, t.done])).toEqual([[1, false]]);
  });

  it('a row already replaced (by the app or another widget) is still recorded as done', async () => {
    setClock(at(day, 9));
    const r = add();
    const morning = instanceId(r.id, dayKey(day), 0);
    setClock(at(day, 13, 5));
    store.ensureRoutines();
    expect(store.getState().tasks.some((t) => t.id === morning)).toBe(false);
    await tap('Matrix', 'TASK_TOGGLE', { id: morning });
    expect(store.slotMark(store.getState(), r.id, dayKey(day), 0)).toBe('done');
    expect(store.slotMark(store.getState(), r.id, dayKey(day), 1)).toBeNull();
  });

  it("yesterday's row tapped after midnight counts for yesterday", async () => {
    setClock(at(day, 21));
    const r = add();
    const evening = instanceId(r.id, dayKey(day), 1);
    setClock(at(addDays(day, 1), 9));
    await tap('Tasks', 'TASK_DONE', { id: evening });
    expect(store.slotMark(store.getState(), r.id, dayKey(day), 1)).toBe('done');
    expect(store.getState().tasks.filter((t) => t.routineId === r.id).map((t) => t.due)).toEqual([dayKey(addDays(day, 1))]);
  });

  it('a locked widget records nothing', async () => {
    setClock(at(day, 9));
    const r = add();
    const morning = instanceId(r.id, dayKey(day), 0);
    setClock(at(day, 13, 5));
    store.ensureRoutines();
    store.toggleWidgetLock('Tasks');
    await tap('Tasks', 'TASK_DONE', { id: morning });
    expect(store.slotMark(store.getState(), r.id, dayKey(day), 0)).toBeNull();
  });
});

describe('redraws', () => {
  it('a tap redraws the other widgets, and other copies of the tapped one (by id)', async () => {
    const render = await tap('CheckIn', 'MOOD', { value: '4' });
    expect(render).toHaveBeenCalled();
    expect(refreshWidgets).toHaveBeenCalledWith(expect.objectContaining({ widgetName: 'CheckIn', widgetId: 7 }));
  });

  it("Android's update after midnight redraws every widget, once a day", async () => {
    // A day no other test draws on.
    const day = new Date(2030, 2, 10);
    setClock(at(day, 10));
    await run('Streak', 'WIDGET_UPDATE');
    expect(refreshWidgets).toHaveBeenCalledTimes(1);
    await run('Garden', 'WIDGET_UPDATE');
    expect(refreshWidgets).toHaveBeenCalledTimes(1);
    setClock(at(addDays(day, 1), 0, 20));
    await run('Garden', 'WIDGET_UPDATE');
    expect(refreshWidgets).toHaveBeenCalledTimes(2);
  });

  it("while the app runs, the next redraw is due at a routine's next time, or else at midnight", () => {
    const day = new Date(2026, 9, 28);
    const r = { id: 'r1', title: 'Water', quadrant: 1 as const, kind: 'daily' as const, times: ['08:00', '13:00'], remind: false, start: '2026-01-01', createdAt: 0 };
    expect(nextRedrawAt([r], at(day, 9))).toBe(at(day, 13).getTime());
    expect(nextRedrawAt([r], at(day, 14))).toBe(at(addDays(day, 1), 0).getTime());
    expect(nextRedrawAt([], at(day, 7))).toBe(at(addDays(day, 1), 0).getTime());
  });
});
