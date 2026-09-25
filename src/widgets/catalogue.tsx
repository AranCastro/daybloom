'use no memo';
/**
 * The widget list. Names, sizes and labels must match the
 * "react-native-android-widget" plugin entry in app.json.
 */
import { AppState, DEFAULT_WIDGET_PREFS, WidgetPrefs } from '@/lib/store';
import { snapshot } from '@/widgets/data';
import {
  CheckInWidget,
  CircleWidget,
  MatrixWidget,
  DARK,
  FocusWidget,
  GardenWidget,
  LIGHT,
  ReachWidget,
  StreakWidget,
  TasksWidget,
  WidgetPalette,
  WidgetProps,
} from '@/widgets/widgets';

export type WidgetName = 'CheckIn' | 'Garden' | 'Streak' | 'Tasks' | 'Focus' | 'Reach' | 'Matrix' | 'Circle';

export type WidgetSpec = {
  name: WidgetName;
  title: string;
  blurb: string;
  /** Default size on a typical phone, in dp (used for the in-app preview). */
  width: number;
  height: number;
  cells: string;
  render: (props: WidgetProps) => React.JSX.Element;
  /** Has its own look settings (theme, opacity, text size, toggles). */
  custom?: 'Matrix' | 'Circle';
};

export const WIDGETS: readonly WidgetSpec[] = [
  { name: 'Matrix', title: 'Eisenhower Matrix', blurb: 'All four quadrants and their tasks. Tick tasks off right on the home screen.', width: 320, height: 330, cells: '4 × 3', render: MatrixWidget, custom: 'Matrix' },
  { name: 'Circle', title: 'People circle', blurb: 'Your circle in four quadrants. Tap a name to call or message.', width: 320, height: 330, cells: '4 × 3', render: CircleWidget, custom: 'Circle' },
  { name: 'CheckIn', title: 'Mood check-in', blurb: 'Tap a mood right from your home screen. It counts as your daily check-in.', width: 320, height: 84, cells: '4 × 1', render: CheckInWidget },
  { name: 'Tasks', title: 'Focus today', blurb: 'Your most important tasks. Tick one off without opening the app.', width: 320, height: 176, cells: '4 × 2', render: TasksWidget },
  { name: 'Garden', title: 'Garden', blurb: 'Your latest flower, total blooms and the next Golden Lotus.', width: 164, height: 164, cells: '2 × 2', render: GardenWidget },
  { name: 'Focus', title: 'Focus timer', blurb: 'Start a 15, 25 or 50 minute session in one tap.', width: 164, height: 164, cells: '2 × 2', render: FocusWidget },
  { name: 'Streak', title: 'Streak', blurb: 'Your check-in streak and whether today is done.', width: 164, height: 76, cells: '2 × 1', render: StreakWidget },
  { name: 'Reach', title: 'Reach out', blurb: 'One person to call and one to message, from your circle.', width: 320, height: 84, cells: '4 × 1', render: ReachWidget },
];

export function specOf(name: string): WidgetSpec | undefined {
  return WIDGETS.find((w) => w.name === name);
}

/** A short "what just happened" line (e.g. "Jasmine bloomed") shown on a widget for a few minutes. */
const flashes = new Map<string, { text: string; until: number }>();
const FLASH_MS = 10 * 60_000;

export function setFlash(name: string, text: string) {
  flashes.set(name, { text, until: Date.now() + FLASH_MS });
}

function flashFor(name: string): string | undefined {
  const f = flashes.get(name);
  if (f && f.until > Date.now()) return f.text;
  flashes.delete(name);
  return undefined;
}

const SCALE: Record<WidgetPrefs['font'], number> = { small: 0.9, default: 1, large: 1.15 };

/** Palette and props from a widget's look settings; `dark` is the phone's current scheme. */
export function lookFor(spec: WidgetSpec, state: AppState, dark: boolean) {
  const prefs = spec.custom ? { ...DEFAULT_WIDGET_PREFS, ...state.widgetPrefs?.[spec.custom] } : DEFAULT_WIDGET_PREFS;
  const useDark = prefs.theme === 'auto' ? dark : prefs.theme === 'dark';
  const p: WidgetPalette = { ...(useDark ? DARK : LIGHT), alpha: Math.max(0.4, Math.min(1, prefs.opacity / 100)) };
  return { p, scale: SCALE[prefs.font], checkbox: prefs.checkbox };
}

/** Light and dark versions of one widget, as the native side expects. */
export function renderFor(name: string, state: AppState, width: number, height: number) {
  const spec = specOf(name);
  if (!spec) return null;
  const s = snapshot(state);
  const flash = flashFor(name);
  const Widget = spec.render;
  const light = lookFor(spec, state, false);
  const dark = lookFor(spec, state, true);
  return {
    light: <Widget s={s} width={width} height={height} flash={flash} {...light} />,
    dark: <Widget s={s} width={width} height={height} flash={flash} {...dark} />,
  };
}
