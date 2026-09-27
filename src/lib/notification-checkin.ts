/**
 * Checking in from the daily reminder's buttons. On Android the button runs this in the
 * background (expo-task-manager), so the app does not open; when the app is already open,
 * the notification response listener in the root layout calls the same function.
 */
import * as Notifications from 'expo-notifications';

import { flowerOf } from '@/lib/flowers';
import { moodOf } from '@/lib/moods';
import { CHECKIN_ACTIONS, notifyCheckinNoted } from '@/lib/reminders';
import { awardBadges, getState, recordMood, reloadState } from '@/lib/store';

export const NOTIFICATION_TASK = 'daybloom-notification-action';

/** Returns true when the action was a mood button and the check-in was saved. */
export async function handleCheckinAction(actionId: string, notificationId?: string): Promise<boolean> {
  const action = CHECKIN_ACTIONS.find((a) => a.id === actionId);
  if (!action) return false;
  reloadState();
  const before = getState().garden.length;
  await recordMood(action.mood);
  awardBadges();
  const grew = getState().garden.length > before ? flowerOf(getState().garden[0].flower).name : undefined;
  if (notificationId) await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
  await notifyCheckinNoted(moodOf(action.mood)?.label ?? 'Checked in', grew);
  return true;
}
