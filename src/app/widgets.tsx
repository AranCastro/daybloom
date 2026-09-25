/** Home-screen widgets: live previews of each widget, with a button to place it (Android). */
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { requestPinWidget } from 'react-native-android-widget';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Card, Screen, tap } from '@/components/ui';
import { WidgetMock } from '@/components/widget-mock';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { MoodValue } from '@/lib/moods';
import { awardBadges, getState, recordMood, toggleTask, useAppState } from '@/lib/store';
import { WIDGETS, WidgetSpec } from '@/widgets/catalogue';
import { snapshot } from '@/widgets/data';
import { DARK, LIGHT } from '@/widgets/widgets';

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

  // Fit wide widgets to the card; small ones keep their real size.
  const room = Math.min(screen, 520) - 32 - 2 * 20 - 2 * 14;
  const width = Math.min(spec.width, room);
  const Widget = spec.render;
  const tree = <Widget s={snapshot(state)} p={dark ? DARK : LIGHT} width={width} height={spec.height} />;

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
          <Text variant="small" style={{ fontSize: 11.5 }}>
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

/** Taps in a preview do what the real widget does. */
async function onWidgetClick(action: string, data: Record<string, unknown>) {
  tap();
  if (action === 'MOOD') {
    await recordMood(Number(data.value) as MoodValue);
    awardBadges();
  } else if (action === 'TASK_DONE') {
    const id = String(data.id ?? '');
    if (getState().tasks.some((x) => x.id === id && !x.done)) toggleTask(id);
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
  cells: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  wall: { borderRadius: 22, padding: 14, alignItems: 'center', justifyContent: 'center' },
  shadow: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
