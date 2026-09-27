/**
 * Opens when a widget is touched and held on the home screen and "Configure" (the pencil) is chosen.
 * Theme and transparency change the widget straight away; Done keeps them, Cancel puts them back.
 * Runs in its own small window, outside the app's navigation.
 */
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { Text } from '@/components/text';
import { Backdrop } from '@/components/ui';
import { WidgetMock } from '@/components/widget-mock';
import { WidgetStyleControls } from '@/components/widget-style';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { getState, reloadState, setWidgetPrefs, useAppState, WIDGET_KEYS, WidgetKey, WidgetPrefs } from '@/lib/store';
import { lookFor, renderFor, specOf } from '@/widgets/catalogue';
import { snapshot } from '@/widgets/data';
import { refreshWidgets } from '@/widgets/sync';

export function WidgetConfigurationScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  useFonts({ Fraunces_600SemiBold, Manrope_500Medium, Manrope_700Bold });
  const t = useTheme();
  const dark = useIsDark();
  const { width: screen } = useWindowDimensions();
  const name = (WIDGET_KEYS.includes(widgetInfo.widgetName as WidgetKey) ? widgetInfo.widgetName : 'Tasks') as WidgetKey;
  const spec = specOf(name)!;
  const state = useAppState((s) => s);
  // The app may have changed things since this window's copy of the state was read. Reloading in an
  // effect (not during render) lets every subscriber update normally; Cancel puts back what was read.
  const original = useRef<WidgetPrefs | null>(null);
  useEffect(() => {
    reloadState();
    original.current = getState().widgetPrefs[name];
  }, [name]);

  // Redraw the real widget as the settings change.
  useEffect(() => {
    const tree = renderFor(name, state, widgetInfo.width, widgetInfo.height);
    if (tree) renderWidget(tree);
  }, [state, name, widgetInfo.width, widgetInfo.height, renderWidget]);

  const width = Math.min(spec.width, screen - 64);
  const Widget = spec.render;

  async function finish(ok: boolean) {
    if (!ok && original.current) setWidgetPrefs(name, original.current);
    // Other widgets of the same kind share these settings.
    await refreshWidgets().catch(() => undefined);
    setResult(ok ? 'ok' : 'cancel');
  }

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView contentContainerStyle={styles.body}>
        <Text variant="label">Configure widget</Text>
        <Text variant="title">{spec.title}</Text>
        <View style={[styles.wall, { backgroundColor: dark ? '#2A3A33' : '#DCE8DF' }]}>
          <WidgetMock tree={<Widget s={snapshot(state)} width={width} height={spec.height} {...lookFor(spec, state, dark)} />} width={width} height={spec.height} />
        </View>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.line }]}>
          <WidgetStyleControls name={name} />
        </View>
        <Text variant="small" center>
          These settings apply to every {spec.title} widget. Change them any time in Daybloom → Settings → Home screen widgets.
        </Text>
        <View style={styles.buttons}>
          <Pressable onPress={() => finish(false)} style={[styles.btn, { borderColor: t.line }]} accessibilityRole="button">
            <Text variant="bodyStrong">Cancel</Text>
          </Pressable>
          <Pressable onPress={() => finish(true)} style={[styles.btn, { backgroundColor: t.brand, borderColor: t.brand }]} accessibilityRole="button">
            <Text variant="bodyStrong" style={{ color: t.brandText }}>
              Done
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 24, paddingTop: 48, gap: 14 },
  wall: { borderRadius: 22, padding: 16, alignItems: 'center' },
  card: { borderRadius: 24, borderWidth: 1, padding: 18 },
  buttons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
