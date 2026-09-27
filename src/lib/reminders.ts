/**
 * Local notifications (no server): the daily check-in reminder and the focus-timer alarm.
 * Each has its own identifier so rescheduling one never cancels the other.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL = 'daily-checkin';
const FOCUS_CHANNEL = 'focus-timer';
const DAILY_ID = 'daily-checkin';
const FOCUS_ID = 'focus-timer';
const NUDGE_CHANNEL = 'buddy-nudge';
const NUDGE_ID = 'buddy-nudge';
/** The daily reminder carries mood buttons (Android shows at most three). */
export const CHECKIN_CATEGORY = 'daybloom-checkin';
export const CHECKIN_ACTIONS: { id: string; mood: 2 | 3 | 4; title: string }[] = [
  { id: 'mood-4', mood: 4, title: '🙂 Good' },
  { id: 'mood-3', mood: 3, title: '😐 Okay' },
  { id: 'mood-2', mood: 2, title: '🙁 Low' },
];
const NOTED_ID = 'checkin-noted';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const LINES = [
  'How was today? One tap is enough.',
  'A quick check-in before you rest.',
  'Tap how today felt. That is all.',
];

/** Android needs a channel before the permission prompt can appear. */
async function ensureReady(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Daily check-in',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(FOCUS_CHANNEL, {
      name: 'Focus timer',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL, {
      name: 'Reach your buddy',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  // Buttons on the reminder check in without opening the app (handled in lib/notification-checkin).
  await Notifications.setNotificationCategoryAsync(
    CHECKIN_CATEGORY,
    CHECKIN_ACTIONS.map((a) => ({ identifier: a.id, buttonTitle: a.title, options: { opensAppToForeground: false } })),
  ).catch(() => undefined);
  const current = await Notifications.getPermissionsAsync();
  return current.granted || (await Notifications.requestPermissionsAsync()).granted;
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  if (!(await ensureReady())) return false;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: {
      title: 'Daybloom',
      body: `${LINES[new Date().getDate() % LINES.length]} Tap a mood below, or open Daybloom for all five.`,
      categoryIdentifier: CHECKIN_CATEGORY,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL },
  });
  return true;
}

export async function cancelReminders() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
}

/** Alarm for the end of a focus session or break, delivered even if the app is closed. */
export async function scheduleFocusAlarm(at: number, title: string, body: string): Promise<void> {
  try {
    if (!(await ensureReady())) return;
    await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier: FOCUS_ID,
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: FOCUS_CHANNEL },
    });
  } catch {
    // The in-app timer still works without the alarm.
  }
}

export async function cancelFocusAlarm(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
}

/**
 * After a few low days: a gentle local notification offering to message the buddy.
 * Tapping it opens Today, where one tap opens SMS or WhatsApp with the message written.
 */
export async function notifyNudgeReady(buddyName: string): Promise<void> {
  try {
    if (!(await ensureReady())) return;
    await Notifications.scheduleNotificationAsync({
      identifier: NUDGE_ID,
      content: {
        title: 'A few hard days',
        body: `Would you like to ask ${buddyName} to call you today? One tap and the message is ready.`,
      },
      // Shown now, on its own Android channel.
      trigger: Platform.OS === 'android' ? { channelId: NUDGE_CHANNEL } : null,
    });
  } catch {
    // Notifications off: the card on Today still offers it.
  }
}

/** A quiet confirmation after checking in from the reminder's buttons. */
export async function notifyCheckinNoted(label: string, bloomed?: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTED_ID,
      content: { title: `Noted: ${label}`, body: bloomed ? `A ${bloomed} bloomed in your garden.` : 'Thank you for checking in.' },
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL } : null,
    });
  } catch {
    // The check-in is saved either way.
  }
}
