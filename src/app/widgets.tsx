/** Home-screen widgets: live previews of each widget, with a button to place it (Android). */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Choice, Screen, tap } from '@/components/ui';
import { WidgetMock } from '@/components/widget-mock';
import { WidgetStyleControls } from '@/components/widget-style';
import { Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { FocusPreset, pauseTimer, PRESETS, resumeTimer, startFocus, stopTimer } from '@/lib/focus';
import { getState, setSettings, toggleWidgetLock, useAppState, widgetTickTask, widgetUndo } from '@/lib/store';
import { lookFor, WIDGETS, WidgetSpec } from '@/widgets/catalogue';
import { snapshot } from '@/widgets/data';

const ANDROID = Platform.OS === 'android';

export default function WidgetsScreen() {
  const t = useTheme();

  return (
    <Screen>
      <Pressable hitSlop={12} onPress={() => (tap(), router.back())} accessibilityLabel="Back" style={{ height: 32, justifyContent: 'center' }}>
        <Icon name="back" color={t.textSecondary} />
      </Pressable>
      <Animated.View entering={FadeInDown.duration(450)} style={{ gap: 4 }}>
        <Text variant="label">Home screen widgets</Text>
        <Text variant="title">Your day, one glance away.</Text>
        <Text variant="small">
          Check in, tick off a task or start a focus session without opening the app. Everything you do from a widget grows
          your garden too.
        </Text>
      </Animated.View>

      <WidgetThemeCard />

      {WIDGETS.map((w, i) => (
        <Animated.View key={w.name} entering={FadeInDown.delay(60 * i).duration(400)}>
          <WidgetCard spec={w} />
        </Animated.View>
      ))}

      <Card>
        <Text variant="bodyStrong">Adding a widget by hand</Text>
        <Text variant="small">
          Touch and hold an empty spot on your home screen, choose Widgets, then scroll to Daybloom. Most widgets can be
          resized: touch and hold the widget, then drag its edges.
        </Text>
      </Card>
    </Screen>
  );
}

function WidgetCard({ spec }: { spec: WidgetSpec }) {
  const t = useTheme();
  const dark = useIsDark();
  const { width: screen } = useWindowDimensions();
  const state = useAppState((s) => s);
  const [busy, setBusy] = useState(false);
  const [styling, setStyling] = useState(false);

  // Fit wide widgets to the card; small ones keep their real size.
  const room = Math.min(screen, 520) - 32 - 2 * 20 - 2 * 14;
  const width = Math.min(spec.width, room);
  const Widget = spec.render;
  const tree = <Widget s={snapshot(state)} width={width} height={spec.height} {...lookFor(spec, state, dark)} />;

  async function add() {
    setBusy(true);
    const ok = await requestPinWidget({ widgetName: spec.name }).catch(() => false);
    setBusy(false);
    if (!ok) {
      Alert.alert('Add it from your home screen', 'Touch and hold an empty spot on your home screen, choose Widgets, then find Daybloom.');
    }
  }

  return (
    <Card>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{spec.title}</Text>
          <Text variant="small">{spec.blurb}</Text>
        </View>
        <View style={[styles.cells, { backgroundColor: t.surfaceAlt }]}>
          <Text variant="caption">
            {spec.cells}
          </Text>
        </View>
      </View>

      <LinearGradient
        colors={dark ? ['#2A3A33', '#3A2A22'] : ['#DCE8DF', '#F3D9C4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.wall}
      >
        <View style={styles.shadow} testID={`widget-${spec.name}`}>
          <WidgetMock tree={tree} width={width} height={spec.height} onClick={onWidgetClick} />
        </View>
      </LinearGradient>

      <Pressable onPress={() => (tap(), setStyling(!styling))} style={styles.styleBtn} accessibilityRole="button" accessibilityState={{ expanded: styling }}>
        <Icon name="settings" color={t.textSecondary} size={18} />
        <Text variant="bodySm" strong style={{ flex: 1 }}>
          Style: theme and transparency
        </Text>
        <Icon name={styling ? 'close' : 'arrow'} color={t.textMuted} size={16} />
      </Pressable>
      {styling && <WidgetStyleControls name={spec.name} />}

      {ANDROID ? (
        <Button title="Add to home screen" icon="plus" kind="secondary" loading={busy} onPress={add} />
      ) : (
        <Text variant="small" color="textMuted" center>
          Try it above. Home screen widgets come with the Android app.
        </Text>
      )}
    </Card>
  );
}

/** One theme for every widget: follow the phone, or always light or dark. */
function WidgetThemeCard() {
  const theme = useAppState((s) => s.settings.widgetTheme);
  return (
    <Card>
      <Text variant="label">Widget theme</Text>
      <Choice
        options={[
          { label: 'System', value: 'system' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ]}
        value={theme}
        onChange={(widgetTheme) => setSettings({ widgetTheme })}
      />
      <Text variant="small">
        {theme === 'system' ? 'Widgets follow your phone’s light or dark mode.' : `All widgets stay ${theme}.`} Each widget can also have
        its own theme and transparency: tap Style below, or touch and hold the widget on your home screen and choose Configure (the pencil).
      </Text>
    </Card>
  );
}

/**
 * Taps in a preview mostly do what the real widget does. A mood tap opens Today instead of checking in,
 * so trying the preview cannot record a mood (or nudge a buddy) by accident.
 */
async function onWidgetClick(action: string, data: Record<string, unknown>) {
  tap();
  if (action === 'MOOD') {
    router.navigate('/today');
  } else if (action === 'TASK_DONE') {
    widgetTickTask('Tasks', String(data.id ?? ''), 'done');
  } else if (action === 'TASK_TOGGLE') {
    widgetTickTask('Matrix', String(data.id ?? ''), 'toggle');
  } else if (action === 'WIDGET_UNDO') {
    widgetUndo(data.widget === 'Matrix' ? 'Matrix' : 'Tasks');
  } else if (action === 'WIDGET_LOCK') {
    toggleWidgetLock(data.widget === 'Matrix' ? 'Matrix' : 'Tasks');
  } else if (action === 'FOCUS_START') {
    const preset = String(data.preset ?? 'classic') as FocusPreset;
    if (preset in PRESETS && !getState().focus.active) startFocus(preset);
  } else if (action === 'FOCUS_PAUSE') {
    pauseTimer();
  } else if (action === 'FOCUS_RESUME') {
    resumeTimer();
  } else if (action === 'FOCUS_STOP') {
    stopTimer();
  } else if (action === 'OPEN_APP') {
    router.navigate('/');
  } else if (action === 'OPEN_URI' && typeof data.uri === 'string') {
    const uri = data.uri;
    if (uri.startsWith('daybloom://')) {
      const [path, query] = uri.slice('daybloom://'.length).split('?');
      const params = Object.fromEntries(new URLSearchParams(query ?? ''));
      router.navigate({ pathname: `/${path}` as never, params });
    } else {
      Linking.openURL(uri).catch(() => undefined);
    }
  }
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cells: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill },
  styleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  wall: { borderRadius: Radius.md, padding: 14, alignItems: 'center', justifyContent: 'center' },
  shadow: {
    borderRadius: Radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
