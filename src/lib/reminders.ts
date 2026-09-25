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
  }
  const current = await Notifications.getPermissionsAsync();
  return current.granted || (await Notifications.requestPermissionsAsync()).granted;
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  if (!(await ensureReady())) return false;
  await Notifications.cancelScheduledNotificationAsync(DAILY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_ID,
    content: { title: 'Daybloom', body: LINES[new Date().getDate() % LINES.length] },
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
