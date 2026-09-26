/** Taps on the home-screen widgets: ticking a task off must mark it done and redraw. */
import { describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});
jest.mock('@/widgets/sync', () => ({ refreshWidgets: jest.fn(async () => undefined) }));

import * as store from '@/lib/store';
import { widgetTaskHandler } from '@/widgets/task-handler';

function tap(widgetName: string, clickAction: string, id: string) {
  const renderWidget = jest.fn();
  const run = widgetTaskHandler({
    widgetInfo: { widgetName, widgetId: 1, width: 320, height: 320, screenInfo: {} as never },
    widgetAction: 'WIDGET_CLICK',
    clickAction,
    clickActionData: { id },
    renderWidget,
  } as never);
  return run.then(() => renderWidget);
}

describe('widget taps', () => {
  it('Focus today: TASK_DONE finishes the task', async () => {
    store.update({ onboarded: true });
    store.addTask('Submit report', 1);
    const t = store.getState().tasks.find((x) => x.title === 'Submit report')!;
    const render = await tap('Tasks', 'TASK_DONE', t.id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(true);
    expect(render).toHaveBeenCalled();
  });

  it('Matrix: TASK_TOGGLE ticks and unticks', async () => {
    store.addTask('Plan week', 2);
    const t = store.getState().tasks.find((x) => x.title === 'Plan week')!;
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(true);
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(false);
  });
});

describe('widget lock and undo', () => {
  it('a locked widget does not tick tasks off; unlocking allows it again', async () => {
    store.addTask('Call the lab', 1);
    const t = store.getState().tasks.find((x) => x.title === 'Call the lab')!;
    await tap('Tasks', 'WIDGET_LOCK', '');
    expect(store.getState().widgetLocks.Tasks).toBe(true);
    await tap('Tasks', 'TASK_DONE', t.id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(false);
    await tap('Tasks', 'WIDGET_LOCK', '');
    await tap('Tasks', 'TASK_DONE', t.id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(true);
  });

  it('the Matrix lock is separate from the Focus today lock', async () => {
    store.addTask('Sort samples', 3);
    const t = store.getState().tasks.find((x) => x.title === 'Sort samples')!;
    await widgetClick('Matrix', 'WIDGET_LOCK', { widget: 'Matrix' });
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(false);
    expect(store.getState().widgetLocks.Tasks).toBeFalsy();
    await widgetClick('Matrix', 'WIDGET_LOCK', { widget: 'Matrix' });
  });

  it('Undo puts the task back and takes its flower back', async () => {
    store.addTask('Email editor', 2);
    const t = store.getState().tasks.find((x) => x.title === 'Email editor')!;
    const blooms = store.getState().bloomCount;
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    expect(store.getState().bloomCount).toBe(blooms + 1);
    expect(store.widgetUndoFor(store.getState(), 'Matrix')?.id).toBe(t.id);
    expect(store.widgetUndoFor(store.getState(), 'Tasks')).toBeNull();
    await widgetClick('Matrix', 'WIDGET_UNDO', { widget: 'Matrix' });
    expect(store.getState().tasks.find((x) => x.id === t.id)?.done).toBe(false);
    expect(store.getState().bloomCount).toBe(blooms);
    expect(store.widgetUndoFor(store.getState(), 'Matrix')).toBeNull();
  });

  it('Undo expires after ten minutes', async () => {
    store.addTask('Print maps', 1);
    const t = store.getState().tasks.find((x) => x.title === 'Print maps')!;
    await tap('Tasks', 'TASK_DONE', t.id);
    const later = Date.now() + store.WIDGET_UNDO_MS + 1000;
    expect(store.widgetUndoFor(store.getState(), 'Tasks', later)).toBeNull();
  });
});

function widgetClick(widgetName: string, clickAction: string, clickActionData: Record<string, string>) {
  return widgetTaskHandler({
    widgetInfo: { widgetName, widgetId: 1, width: 320, height: 320, screenInfo: {} as never },
    widgetAction: 'WIDGET_CLICK',
    clickAction,
    clickActionData,
    renderWidget: jest.fn(),
  } as never);
}
