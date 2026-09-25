/**
 * Runs in the background when Android asks for a widget update or a widget is tapped.
 * Taps that open a screen are handled natively (OPEN_URI); this handles the rest:
 *   MOOD       check in from the home screen
 *   TASK_DONE    tick off a task (grows a flower, as in the app)
 *   TASK_TOGGLE  tick or untick a task from the matrix widget (unticking takes its flower back)
 */
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { flowerOf } from '@/lib/flowers';
import { moodOf, MoodValue } from '@/lib/moods';
import { awardBadges, getState, recordMood, reloadState, toggleTask } from '@/lib/store';
import { renderFor, setFlash } from '@/widgets/catalogue';
import { refreshWidgets } from '@/widgets/sync';

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, clickActionData, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const name = widgetInfo.widgetName;

  if (widgetAction === 'WIDGET_CLICK') {
    reloadState();
    const before = getState().garden.length;

    if (clickAction === 'MOOD') {
      const value = Number(clickActionData?.value) as MoodValue;
      if (moodOf(value)) {
        await recordMood(value);
        awardBadges();
        const grew = getState().garden.length > before ? ` · ${flowerOf(getState().garden[0].flower).name} bloomed` : '';
        setFlash(name, `Noted: ${moodOf(value)?.label}${grew}`);
      }
    }

    if (clickAction === 'TASK_DONE') {
      const id = String(clickActionData?.id ?? '');
      const task = getState().tasks.find((t) => t.id === id);
      if (task && !task.done) {
        toggleTask(id);
        const b = getState().garden[0];
        setFlash(name, b && b.ref === id ? `Done · ${flowerOf(b.flower).name} bloomed` : 'Done');
      }
    }

    if (clickAction === 'TASK_TOGGLE') {
      const id = String(clickActionData?.id ?? '');
      const task = getState().tasks.find((t) => t.id === id);
      if (task) toggleTask(id);
    }
  }

  const tree = renderFor(name, getState(), widgetInfo.width, widgetInfo.height);
  if (tree) renderWidget(tree);

  // A tap on one widget changes what the others show (streak, garden, tasks).
  if (widgetAction === 'WIDGET_CLICK') await refreshWidgets(name);
}
