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
import { snapshot } from '@/widgets/data';
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

  it('Undo expires after fifteen seconds', async () => {
    store.addTask('Print maps', 1);
    const t = store.getState().tasks.find((x) => x.title === 'Print maps')!;
    await tap('Tasks', 'TASK_DONE', t.id);
    const later = Date.now() + store.WIDGET_UNDO_MS + 1000;
    expect(store.widgetUndoFor(store.getState(), 'Tasks', later)).toBeNull();
  });
});

describe('big tasks with steps on the widgets', () => {
  it('a tap ticks the next step, not the whole task; the last step finishes it', async () => {
    const t = store.addTask('Write chapter 3', 1, undefined, 'deep');
    store.addStep(t.id, 'Outline');
    store.addStep(t.id, 'Draft');
    const get = () => store.getState().tasks.find((x) => x.id === t.id)!;
    const blooms = store.getState().bloomCount;
    await tap('Tasks', 'TASK_DONE', t.id);
    expect(get().done).toBe(false);
    expect(get().steps?.map((x) => x.done)).toEqual([true, false]);
    expect(store.getState().bloomCount).toBe(blooms + 1); // today's progress flower
    // A second tap the same day ticks the last step and finishes the task (two flowers for Deep work).
    await tap('Tasks', 'TASK_DONE', t.id);
    expect(get().done).toBe(true);
    expect(store.getState().bloomCount).toBe(blooms + 3);
  });

  it('Undo unticks the step that was ticked, and the finish with it', async () => {
    const t = store.addTask('Field report', 2, undefined, 'moderate');
    store.addStep(t.id, 'Collect photos');
    store.addStep(t.id, 'Write summary');
    const get = () => store.getState().tasks.find((x) => x.id === t.id)!;
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    expect(store.widgetUndoFor(store.getState(), 'Matrix')?.undoStep?.title).toBe('Collect photos');
    await widgetClick('Matrix', 'WIDGET_UNDO', { widget: 'Matrix' });
    expect(get().steps?.every((x) => !x.done)).toBe(true);
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    await tap('Matrix', 'TASK_TOGGLE', t.id);
    expect(get().done).toBe(true);
    await widgetClick('Matrix', 'WIDGET_UNDO', { widget: 'Matrix' });
    expect(get().done).toBe(false);
    expect(get().steps?.map((x) => x.done)).toEqual([true, false]);
  });

  it('the widget shows the next step', async () => {
    const t = store.addTask('Map the watershed', 1);
    store.addStep(t.id, 'Download DEM');
    const item = snapshot(store.getState()).tasks.items.find((x) => x.id === t.id);
    expect(item?.next).toBe('Download DEM');
    expect(item?.steps).toBe('0/1');
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
