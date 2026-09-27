/**
 * App entry. Starts Expo Router as usual and registers the background handler
 * that draws the Android home-screen widgets and handles taps on them.
 */
import 'expo-router/entry';

import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { handleCheckinAction, NOTIFICATION_TASK } from '@/lib/notification-checkin';
import { notifyNudgeReady } from '@/lib/reminders';
import { onNudgeReady } from '@/lib/store';
import { WidgetConfigurationScreen } from '@/widgets/configure';
import { refreshWidgets } from '@/widgets/sync';
import { widgetTaskHandler } from '@/widgets/task-handler';

// A nudge can become ready from the app or from a home-screen widget check-in.
onNudgeReady((name) => void notifyNudgeReady(name));

if (Platform.OS === 'android') {
  // Mood buttons on the daily reminder: check in without opening the app.
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(NOTIFICATION_TASK, async ({ data }) => {
    if (data && 'actionIdentifier' in data) {
      const r = data as unknown as { actionIdentifier: string; notification?: { request?: { identifier?: string } } };
      if (await handleCheckinAction(r.actionIdentifier, r.notification?.request?.identifier)) await refreshWidgets().catch(() => undefined);
    }
  });
  void Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => undefined);

  registerWidgetTaskHandler(widgetTaskHandler);
  // Touch and hold a widget → Configure: theme and transparency.
  registerWidgetConfigurationScreen(WidgetConfigurationScreen);
}
