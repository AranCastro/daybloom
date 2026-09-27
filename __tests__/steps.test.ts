/** Big tasks over several days: steps, one progress flower a day, energy and the final reward. */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('@/lib/kv', () => {
  const mem = new Map<string, string>();
  return {
    readItem: (k: string) => mem.get(k) ?? null,
    writeItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
});

import { fitEnergy, stepProgress } from '@/lib/effort';
import * as store from '@/lib/store';

function thesis() {
  const t = store.addTask('Write thesis chapter 3', 2, undefined, 'deep');
  store.addStep(t.id, 'Outline');
  store.addStep(t.id, 'Draft methods');
  store.addStep(t.id, 'Draft results');
  return store.getState().tasks.find((x) => x.id === t.id)!;
}

describe('steps and progress', () => {
  beforeEach(() => store.replaceState({ onboarded: true }));

  it('shows progress and the next step', () => {
    const t = thesis();
    store.toggleStep(t.id, t.steps![0].id);
    const p = stepProgress(store.getState().tasks.find((x) => x.id === t.id)!);
    expect(p).toEqual({ done: 1, total: 3, next: 'Draft methods' });
  });

  it('grows one progress flower a day, however many steps are ticked', () => {
    const t = thesis();
    const before = store.getState().bloomCount;
    store.toggleStep(t.id, t.steps![0].id);
    store.toggleStep(t.id, t.steps![1].id);
    expect(store.logProgress(t.id)).toBe(false);
    expect(store.getState().bloomCount).toBe(before + 1);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.workedOn).toHaveLength(1);
  });

  it('finishing still pays the full effort reward, and unticking keeps progress flowers', () => {
    const t = thesis();
    const before = store.getState().bloomCount;
    store.logProgress(t.id);
    store.toggleTask(t.id); // Deep work: two flowers
    expect(store.getState().bloomCount).toBe(before + 3);
    store.toggleTask(t.id); // takes back the two, keeps the day's progress flower
    expect(store.getState().bloomCount).toBe(before + 1);
  });

  it('a big task with open steps stays visible on a low-energy day', () => {
    const t = thesis();
    const plain = store.addTask('Plan the conference', 2, undefined, 'deep');
    const shown = fitEnergy(store.getState().tasks, 1).map((x) => x.id);
    expect(shown).toContain(t.id);
    expect(shown).not.toContain(plain.id);
  });

  it('removing a step keeps the others', () => {
    const t = thesis();
    store.deleteStep(t.id, t.steps![1].id);
    expect(store.getState().tasks.find((x) => x.id === t.id)?.steps?.map((s) => s.title)).toEqual(['Outline', 'Draft results']);
  });
});
