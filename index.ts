/**
 * App entry. Starts Expo Router as usual and registers the background handler
 * that draws the Android home-screen widgets and handles taps on them.
 */
import 'expo-router/entry';

import { Platform } from 'react-native';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import { notifyNudgeReady } from '@/lib/reminders';
import { onNudgeReady } from '@/lib/store';
import { WidgetConfigurationScreen } from '@/widgets/configure';
import { widgetTaskHandler } from '@/widgets/task-handler';

// A nudge can become ready from the app or from a home-screen widget check-in.
onNudgeReady((name) => void notifyNudgeReady(name));

if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
  // Touch and hold a widget → Configure: theme and transparency.
  registerWidgetConfigurationScreen(WidgetConfigurationScreen);
}
