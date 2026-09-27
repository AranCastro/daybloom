/**
 * Look settings for one home-screen widget: theme, transparency and (for the matrix-style
 * widgets) text size and toggles. Used in the in-app gallery and in the Configure screen that
 * opens when a widget is touched and held on the home screen.
 */
import { StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Choice, Divider } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_WIDGET_PREFS, setWidgetPrefs, useAppState, WidgetKey } from '@/lib/store';

/** Transparency shown to the user; stored as background opacity (100 = solid). */
export const TRANSPARENCY = [
  { label: 'Solid', value: 100 },
  { label: '15%', value: 85 },
  { label: '30%', value: 70 },
  { label: '45%', value: 55 },
  { label: '60%', value: 40 },
];

export function WidgetStyleControls({ name }: { name: WidgetKey }) {
  const t = useTheme();
  const saved = useAppState((s) => s.widgetPrefs?.[name]);
  const prefs = { ...DEFAULT_WIDGET_PREFS, ...saved };
  const set = (patch: Parameters<typeof setWidgetPrefs>[1]) => setWidgetPrefs(name, patch);
  const matrixLike = name === 'Matrix' || name === 'Circle';
  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <View style={styles.toggle}>
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.brand, false: t.line }} thumbColor="#fff" accessibilityLabel={label} />
    </View>
  );
  // Nearest step, so older saved values (for example 90%) still show a selection.
  const opacity = TRANSPARENCY.reduce((a, b) => (Math.abs(b.value - prefs.opacity) < Math.abs(a.value - prefs.opacity) ? b : a)).value;

  return (
    <View style={{ gap: 10 }}>
      <Text variant="label">Theme</Text>
      <Choice
        options={[
          { label: 'Same as all', value: 'auto' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
        ]}
        value={prefs.theme}
        onChange={(theme) => set({ theme })}
      />
      <Text variant="label">Transparency</Text>
      <Choice options={TRANSPARENCY} value={opacity} onChange={(v) => set({ opacity: v })} />
      <Text variant="caption">
        More transparent lets your wallpaper show through the widget.
      </Text>
      {matrixLike && (
        <>
          <Text variant="label">Text size</Text>
          <Choice
            options={[
              { label: 'Small', value: 'small' },
              { label: 'Default', value: 'default' },
              { label: 'Large', value: 'large' },
            ]}
            value={prefs.font}
            onChange={(font) => set({ font })}
          />
          <Divider />
          {toggle(name === 'Matrix' ? 'Show checkboxes' : 'Show call and WhatsApp buttons', prefs.checkbox, (checkbox) => set({ checkbox }))}
          {name === 'Matrix' && toggle('Show completed tasks', prefs.completed, (completed) => set({ completed }))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 },
});
