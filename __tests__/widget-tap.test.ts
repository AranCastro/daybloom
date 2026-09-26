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
