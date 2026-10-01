/**
 * Charts for routine history (lib/routine-stats): a progress ring, a calendar heat map, weekly bars,
 * time-of-day and weekday bars, and the two-week strip on each routine row. One hue (the brand
 * colour) in light-to-dark steps carries "how much was done"; numbers are always written out beside
 * the marks, so nothing depends on colour alone. Tap a day or a bar to read its numbers.
 */
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { fromKey, shortDate, weekdayShort } from '@/lib/dates';
import { clockText } from '@/lib/routines';
import { DayCell, percent, Tally } from '@/lib/routine-stats';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = Easing.out(Easing.cubic);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Done share of one day as a fill: none, part, all. */
function useFill() {
  const t = useTheme();
  return (c: DayCell) => {
    if (c.future || !c.due) return { backgroundColor: 'transparent', borderColor: 'transparent' };
    if (c.done === 0) return { backgroundColor: t.surfaceAlt, borderColor: t.line };
    if (c.done < c.due) return { backgroundColor: t.brand, borderColor: t.brand, opacity: 0.25 + 0.5 * (c.done / c.due) };
    return { backgroundColor: t.brand, borderColor: t.brand };
  };
}

function dayText(c: DayCell): string {
  const d = fromKey(c.day);
  const when = `${weekdayShort(d)} ${shortDate(d)}`;
  if (c.future) return `${when} · still to come`;
  if (!c.due) return `${when} · not due`;
  return `${when} · ${c.done} of ${c.due} done`;
}

// ── Ring ─────────────────────────────────────────────────────────────────────

export function ProgressRing({ value, size = 132, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const t = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 900, easing: EASE });
  }, [value, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={t.surfaceAlt} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.brand}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ── Heat map ─────────────────────────────────────────────────────────────────

export function HeatMap({ cells, weekStart }: { cells: DayCell[]; weekStart: 0 | 1 }) {
  const t = useTheme();
  const fill = useFill();
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<DayCell | null>(null);
  const weeks = Math.ceil(cells.length / 7);
  const label = 26;
  const gap = 3;
  const size = width ? Math.min(22, Math.floor((width - label - gap * (weeks - 1)) / weeks)) : 0;
  const rows = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);
  // Month names above the first week of each month.
  const months = Array.from({ length: weeks }, (_, w) => {
    const d = fromKey(cells[w * 7].day);
    const prev = w ? fromKey(cells[(w - 1) * 7].day) : null;
    return !prev || prev.getMonth() !== d.getMonth() ? d.toLocaleDateString('en-IN', { month: 'short' }) : '';
  });

  return (
    <View style={{ gap: 8 }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Text variant="caption" color={picked ? 'text' : 'textMuted'}>
        {picked ? dayText(picked) : 'Tap a day to see it.'}
      </Text>
      {size > 0 && (
        <View>
          <View style={{ marginLeft: label, height: 14 }}>
            {months.map((m, w) =>
              m ? (
                <Text key={w} variant="micro" numberOfLines={1} style={{ position: 'absolute', left: w * (size + gap), width: 44 }}>
                  {m}
                </Text>
              ) : null,
            )}
          </View>
          {rows.map((wd, row) => (
            <View key={wd} style={{ flexDirection: 'row', alignItems: 'center', gap, marginTop: gap }}>
              <Text variant="micro" style={{ width: label - gap }}>
                {row % 2 === 0 ? DAYS[wd].slice(0, 1) : ''}
              </Text>
              {Array.from({ length: weeks }, (_, w) => {
                const c = cells[w * 7 + row];
                if (!c) return <View key={w} style={{ width: size, height: size }} />;
                const on = picked?.day === c.day;
                return (
                  <Pressable
                    key={w}
                    onPress={() => (tap(), setPicked(on ? null : c))}
                    hitSlop={2}
                    accessibilityRole="button"
                    accessibilityLabel={dayText(c)}
                    style={[
                      styles.cell,
                      { width: size, height: size, borderRadius: Math.max(3, size / 4) },
                      fill(c),
                      !c.due && !c.future && { backgroundColor: 'transparent' },
                      on && { borderColor: t.text, borderWidth: 2, opacity: 1 },
                    ]}>
                    {!c.due && !c.future && <View style={[styles.dot, { backgroundColor: t.line }]} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <View style={styles.legend}>
        <LegendSwatch label="Not due" dot />
        <LegendSwatch label="Missed" cell={{ day: '', due: 1, done: 0, future: false }} />
        <LegendSwatch label="Part" cell={{ day: '', due: 2, done: 1, future: false }} />
        <LegendSwatch label="All done" cell={{ day: '', due: 1, done: 1, future: false }} />
      </View>
    </View>
  );
}

function LegendSwatch({ label, cell, dot }: { label: string; cell?: DayCell; dot?: boolean }) {
  const t = useTheme();
  const fill = useFill();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.cell, { width: 12, height: 12, borderRadius: 3 }, cell ? fill(cell) : { borderColor: 'transparent' }]}>
        {dot && <View style={[styles.dot, { backgroundColor: t.line }]} />}
      </View>
      <Text variant="micro">{label}</Text>
    </View>
  );
}

// ── Bars ─────────────────────────────────────────────────────────────────────

function GrowBar({ share, height, delay, color, track }: { share: number; height: number; delay: number; color: string; track: string }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(share, { duration: 700, easing: EASE }));
  }, [share, delay, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(share > 0 ? 4 : 0, h.value * height) }));
  return (
    <View style={{ height, width: '100%', justifyContent: 'flex-end', backgroundColor: track, borderRadius: 6, overflow: 'hidden' }}>
      <Animated.View style={[{ backgroundColor: color, borderRadius: 6, width: '100%' }, style]} />
    </View>
  );
}

/** Done out of due for each of the last eight weeks; the current week is drawn in full colour. */
export function WeekBars({ weeks }: { weeks: (Tally & { start: string })[] }) {
  const t = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked ?? weeks.length - 1;
  const w = weeks[shown];
  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption" color="text">
        {shown === weeks.length - 1 ? 'This week' : `Week of ${shortDate(fromKey(w.start))}`} · {w.due ? `${w.done} of ${w.due} done (${percent(w)}%)` : 'not due'}
      </Text>
      <View style={styles.bars}>
        {weeks.map((x, i) => (
          <Pressable
            key={x.start}
            onPress={() => (tap(), setPicked(i === picked ? null : i))}
            accessibilityRole="button"
            accessibilityLabel={`Week of ${shortDate(fromKey(x.start))}: ${x.done} of ${x.due} done`}
            style={styles.barCol}>
            <Text variant="micro" strong color={i === shown ? 'text' : 'textMuted'}>
              {x.due ? x.done : '–'}
            </Text>
            <GrowBar
              share={x.due ? x.done / x.due : 0}
              height={96}
              delay={i * 60}
              color={i === shown ? t.brand : t.brand + '73'}
              track={t.surfaceAlt}
            />
            <Text variant="micro" color={i === shown ? 'text' : 'textMuted'}>
              {fromKey(x.start).getDate()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Horizontal bars: each time of day, or each weekday, with its done share written out. */
export function ShareRows({ rows }: { rows: (Tally & { label: string })[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {rows.map((x, i) => (
        <View key={x.label} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="small" color="text">
              {x.label}
            </Text>
            <Text variant="small" strong color={x.due ? 'text' : 'textMuted'}>
              {x.due ? `${x.done}/${x.due} · ${percent(x)}%` : 'not due'}
            </Text>
          </View>
          <HBar share={x.due ? x.done / x.due : 0} delay={i * 80} color={t.brand} track={t.surfaceAlt} />
        </View>
      ))}
    </View>
  );
}

function HBar({ share, delay, color, track }: { share: number; delay: number; color: string; track: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withDelay(delay, withTiming(share, { duration: 700, easing: EASE }));
  }, [share, delay, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: color }, style]} />
    </View>
  );
}

export const slotRows = (slots: (Tally & { time: string })[]) => slots.map((s) => ({ ...s, label: clockText(s.time) }));
export const weekdayRows = (days: Tally[], weekStart: 0 | 1) =>
  Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7).map((d) => ({ ...days[d], label: DAYS[d] }));

/** Two weeks of one routine as small squares, for its row in the list. */
export function DayStrip({ cells }: { cells: DayCell[] }) {
  const fill = useFill();
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessible accessibilityLabel={`Last two weeks: ${cells.filter((c) => c.due && c.done >= c.due).length} complete days`}>
      {cells.map((c) => (
        <View key={c.day} style={[styles.cell, { width: 9, height: 9, borderRadius: 2.5 }, fill(c)]}>
          {!c.due && !c.future && <View style={[styles.dot, { width: 3, height: 3, backgroundColor: t.line }]} />}
        </View>
      ))}
    </View>
  );
}

/** Seven small columns, Monday or Sunday first: this week across every routine. */
export function WeekColumns({ days, weekStart, today }: { days: Tally[]; weekStart: 0 | 1; today: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
      {days.map((d, i) => {
        const wd = (i + weekStart) % 7;
        return (
          <View key={i} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
            <GrowBar share={d.due ? d.done / d.due : 0} height={44} delay={i * 50} color={wd === today ? t.brand : t.brand + '8C'} track={t.surfaceAlt} />
            <Text variant="micro" strong={wd === today} color={wd === today ? 'text' : 'textMuted'}>
              {DAYS[wd].slice(0, 1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bars: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
});
