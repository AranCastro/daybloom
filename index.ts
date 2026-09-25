/**
 * App entry. Starts Expo Router as usual and registers the background handler
 * that draws the Android home-screen widgets and handles taps on them.
 */
import 'expo-router/entry';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from '@/widgets/task-handler';

if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
