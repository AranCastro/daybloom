/**
 * Opens when a widget is touched and held on the home screen and "Configure" (the pencil) is chosen.
 * Theme and transparency change the widget straight away; Done keeps them, Cancel puts them back,
 * and so does leaving any other way (Back, or closing the window).
 * Runs in its own small window, outside the app's navigation and outside the app lock's screen, so
 * while Daybloom is locked it shows no widget data, only a way into the app.
 */
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { useCallback, useEffect, useRef } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';

import { Text } from '@/components/text';
import { Backdrop } from '@/components/ui';
import { WidgetMock } from '@/components/widget-mock';
import { WidgetStyleControls } from '@/components/widget-style';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { useLock } from '@/lib/app-lock';
import { getState, reloadState, setWidgetPrefs, useAppState, WIDGET_KEYS, WidgetKey, WidgetPrefs } from '@/lib/store';
import { lookFor, renderFor, specOf } from '@/widgets/catalogue';
import { snapshot } from '@/widgets/data';
import { LINK } from '@/widgets/widgets';
import { refreshWidgets } from '@/widgets/sync';

export function WidgetConfigurationScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  useFonts({ Fraunces_600SemiBold, Manrope_500Medium, Manrope_700Bold });
  const { locked } = useLock();
  const name = widgetInfo?.widgetName as WidgetKey;
  // A widget this version of the app does not know (say, one removed in an update): nothing to set.
  if (!WIDGET_KEYS.includes(name) || !specOf(name)) {
    return <Notice title="Nothing to set here" body="This widget is not part of this version of Daybloom." action="Close" onPress={() => setResult('cancel')} />;
  }
  if (locked) {
    return (
      <Notice
        title="Unlock Daybloom first"
        body="Your widget settings are behind the app lock."
        action="Open Daybloom"
        onPress={() => {
          Linking.openURL(LINK.today).catch(() => undefined);
          // Nothing was changed: the widget stays as it is.
          setResult('ok');
        }}
      />
    );
  }
  return <Configure name={name} widgetInfo={widgetInfo} renderWidget={renderWidget} setResult={setResult} />;
}

function Notice({ title, body, action, onPress }: { title: string; body: string; action: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <View style={[styles.body, { flex: 1, justifyContent: 'center' }]}>
        <Text variant="title">{title}</Text>
        <Text variant="body">{body}</Text>
        <Pressable onPress={onPress} style={[styles.btn, { flex: 0, backgroundColor: t.brand, borderColor: t.brand }]} accessibilityRole="button">
          <Text variant="bodyStrong" style={{ color: t.brandText }}>
            {action}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Configure({ name, widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps & { name: WidgetKey }) {
  const t = useTheme();
  const dark = useIsDark();
  const { width: screen } = useWindowDimensions();
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

  const finished = useRef(false);
  const revert = useCallback(() => {
    const was = original.current;
    if (was && JSON.stringify(getState().widgetPrefs[name]) !== JSON.stringify(was)) setWidgetPrefs(name, was);
  }, [name]);

  // Leaving without Done (system Back, or the window closed) puts the settings back too.
  useEffect(
    () => () => {
      if (finished.current) return;
      revert();
      void refreshWidgets().catch(() => undefined);
    },
    [revert],
  );

  const width = Math.min(spec.width, screen - 64);
  const Widget = spec.render;

  async function finish(ok: boolean) {
    finished.current = true;
    if (!ok) revert();
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
