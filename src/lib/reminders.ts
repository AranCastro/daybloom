/**
 * Local notifications (no server): the daily check-in reminder and the focus-timer alarm.
 * Each has its own identifier so rescheduling one never cancels the other.
 */
import * as Notifications from 'expo-notifications';
import { AppState as RNAppState, Platform } from 'react-native';

import { expectReturn } from '@/lib/app-lock';

const CHANNEL = 'daily-checkin';
const FOCUS_CHANNEL = 'focus-timer';
const DAILY_ID = 'daily-checkin';
const FOCUS_ID = 'focus-timer';
/** A new id: the old channel showed the nudge text on the lock screen. */
const NUDGE_CHANNEL = 'buddy-nudge-private';
const NOTED_CHANNEL = 'checkin-noted';
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

/** Channels made before 2.4 were public on the lock screen; Android cannot change that afterwards. */
const OLD_CHANNELS = ['buddy-nudge'];

let setup: Promise<void> | null = null;

/**
 * Channels and the reminder's mood buttons. Done once per process (at start-up, or on first use
 * from a widget), so scheduling an alarm does not wait on several native calls each time.
 * Android needs a channel before the permission prompt can appear.
 */
export function prepareNotifications(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  setup ??= (async () => {
    if (Platform.OS === 'android') {
      // Nothing shown on the lock screen but the app name: check-ins and buddy nudges are private.
      const PRIVATE = Notifications.AndroidNotificationVisibility.PRIVATE;
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Daily check-in',
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: PRIVATE,
      });
      await Notifications.setNotificationChannelAsync(NOTED_CHANNEL, {
        name: 'Check-in noted',
        importance: Notifications.AndroidImportance.LOW,
        lockscreenVisibility: PRIVATE,
      });
      await Notifications.setNotificationChannelAsync(FOCUS_CHANNEL, {
        name: 'Focus timer',
        importance: Notifications.AndroidImportance.HIGH,
        lockscreenVisibility: PRIVATE,
      });
      await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL, {
        name: 'Reach your buddy',
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: PRIVATE,
      });
      for (const id of OLD_CHANNELS) await Notifications.deleteNotificationChannelAsync(id).catch(() => undefined);
    }
    // Buttons on the reminder check in without opening the app (handled in lib/notification-checkin).
    await Notifications.setNotificationCategoryAsync(
      CHECKIN_CATEGORY,
      CHECKIN_ACTIONS.map((a) => ({ identifier: a.id, buttonTitle: a.title, options: { opensAppToForeground: false } })),
    ).catch(() => undefined);
  })().catch(() => {
    setup = null;
  });
  return setup;
}

async function ensureReady(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await prepareNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // No prompt from a widget tap or other background work: there is no screen to show it on.
  if (RNAppState.currentState !== 'active') return false;
  expectReturn();
  return (await Notifications.requestPermissionsAsync()).granted;
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

/*
 * Focus alarm calls run one after another, and each schedule carries a sequence number that a
 * later schedule or cancel makes stale. Start then Stop within a moment used to leave an alarm
 * behind: the schedule was still waiting on set-up when Stop's cancel ran.
 */
let focusSeq = 0;
let focusChain: Promise<void> = Promise.resolve();
function queueFocus(job: () => Promise<void>): Promise<void> {
  focusChain = focusChain.then(job, job).catch(() => undefined);
  return focusChain;
}

/**
 * Alarm for the end of a focus session or break, delivered even if the app is closed.
 * Exact on Android thanks to USE_EXACT_ALARM (app.json): expo-notifications falls back to an
 * inexact alarm, late by minutes in Doze, unless the app may schedule exact alarms.
 */
export function scheduleFocusAlarm(at: number, title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  const seq = ++focusSeq;
  return queueFocus(async () => {
    try {
      if (seq !== focusSeq || !(await ensureReady()) || seq !== focusSeq) return;
      await Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: FOCUS_ID,
        content: { title, body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: FOCUS_CHANNEL },
      });
    } catch {
      // The in-app timer still works without the alarm.
    }
  });
}

export function cancelFocusAlarm(): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();
  focusSeq += 1;
  return queueFocus(() => Notifications.cancelScheduledNotificationAsync(FOCUS_ID).catch(() => {}));
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
      trigger: Platform.OS === 'android' ? { channelId: NOTED_CHANNEL } : null,
    });
  } catch {
    // The check-in is saved either way.
  }
}
