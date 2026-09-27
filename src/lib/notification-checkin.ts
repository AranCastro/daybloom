/**
 * Checking in from the daily reminder's buttons. On Android the button runs this in the
 * background (expo-task-manager), so the app does not open; when the app is already open,
 * the notification response listener in the root layout calls the same function.
 */
import * as Notifications from 'expo-notifications';

import { flowerOf } from '@/lib/flowers';
import { readItem, writeItem } from '@/lib/kv';
import { moodOf } from '@/lib/moods';
import { CHECKIN_ACTIONS, notifyCheckinNoted } from '@/lib/reminders';
import { awardBadges, getState, recordMood, reloadState } from '@/lib/store';

export const NOTIFICATION_TASK = 'daybloom-notification-action';

const HANDLED_KEY = 'daybloom.checkin-actions.v1';
/** Enough to cover a few days of reminders; older keys can never come back. */
const HANDLED_MAX = 20;

/**
 * Marks one button press on one delivered reminder as handled; false if it already was.
 * On Android a button pressed while the app is in the background but alive runs the background
 * task and the in-app listener, so both call handleCheckinAction for the same press. The daily
 * reminder reuses its identifier every day, so the delivery time is part of the key.
 * Synchronous (the kv store is), so the second caller always sees the first one's mark.
 */
export function claimAction(actionId: string, notificationId?: string, date?: number): boolean {
  const key = `${notificationId ?? ''}:${date ?? ''}:${actionId}`;
  let handled: string[] = [];
  try {
    const raw = readItem(HANDLED_KEY);
    handled = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    handled = [];
  }
  if (handled.includes(key)) return false;
  writeItem(HANDLED_KEY, JSON.stringify([key, ...handled].slice(0, HANDLED_MAX)));
  return true;
}

/** Returns true when the action was a mood button and the check-in was saved. */
export async function handleCheckinAction(actionId: string, notificationId?: string, date?: number): Promise<boolean> {
  const action = CHECKIN_ACTIONS.find((a) => a.id === actionId);
  if (!action) return false;
  if (!claimAction(actionId, notificationId, date)) return false;
  reloadState();
  const before = getState().garden.length;
  await recordMood(action.mood);
  awardBadges();
  const grew = getState().garden.length > before ? flowerOf(getState().garden[0].flower).name : undefined;
  if (notificationId) await Notifications.dismissNotificationAsync(notificationId).catch(() => undefined);
  await notifyCheckinNoted(moodOf(action.mood)?.label ?? 'Checked in', grew);
  return true;
}
