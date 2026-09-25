/** Month calendar: pick a day, see coloured dots for the tasks due on it. Weeks start on Sunday. */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { tap } from '@/components/ui';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dayKey, fromKey } from '@/lib/dates';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Props = {
  /** Selected day, YYYY-MM-DD. */
  selected?: string;
  onSelect: (day: string) => void;
  /** Day -> dot colours (at most three are drawn). */
  marks?: Record<string, string[]>;
  /** Called when the visible month changes (first day of the month). */
  onMonth?: (first: Date) => void;
  compact?: boolean;
};

export function MonthCalendar({ selected, onSelect, marks = {}, onMonth, compact }: Props) {
  const t = useTheme();
  const today = dayKey();
  const start = selected ? fromKey(selected) : new Date();
  const [month, setMonth] = useState(() => new Date(start.getFullYear(), start.getMonth(), 1));

  function shift(n: number) {
    tap();
    const next = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(next);
    onMonth?.(next);
  }

  // Six rows of seven days, starting on the Sunday on or before the 1st.
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = first.getDay();
  const days = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - lead + i));
  const rows = [0, 1, 2, 3, 4, 5]
    .map((r) => days.slice(r * 7, r * 7 + 7))
    // Drop a trailing row that is entirely next month.
    .filter((row) => row[0].getMonth() === month.getMonth() || row[6].getMonth() === month.getMonth());
  const cell = compact ? 38 : 44;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.head}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.nav}>
          <Icon name="back" color={t.textSecondary} size={20} />
        </Pressable>
        <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'center' }}>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Next month" style={styles.nav}>
          <Icon name="arrow" color={t.textSecondary} size={20} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEK.map((w, i) => (
          <Text key={i} variant="small" color="textMuted" style={[styles.week, { width: `${100 / 7}%` }]} accessibilityLabel={WEEK_FULL[i]}>
            {w}
          </Text>
        ))}
      </View>

      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((d) => {
            const key = dayKey(d);
            const inMonth = d.getMonth() === month.getMonth();
            const isSel = key === selected;
            const isToday = key === today;
            const dots = (marks[key] ?? []).slice(0, 3);
            return (
              <Pressable
                key={key}
                onPress={() => (tap(), onSelect(key))}
                accessibilityRole="button"
                accessibilityLabel={`${d.getDate()} ${MONTHS[d.getMonth()]}${dots.length ? `, ${marks[key].length} due` : ''}`}
                aria-selected={isSel}
                style={[styles.cellWrap, { width: `${100 / 7}%`, height: cell + 8 }]}>
                <View
                  style={[
                    styles.cell,
                    { width: cell, height: cell, borderRadius: cell / 2 },
                    isSel && { backgroundColor: t.brand },
                    !isSel && isToday && { borderWidth: 1.5, borderColor: t.accent },
                  ]}>
                  <Text
                    variant="body"
                    style={{
                      fontSize: 15,
                      fontFamily: isSel || isToday ? Fonts.bodyStrong : Fonts.body,
                      color: isSel ? t.brandText : inMonth ? t.text : t.textMuted,
                      opacity: inMonth ? 1 : 0.55,
                    }}>
                    {d.getDate()}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {dots.map((c, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: c }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center' },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  week: { textAlign: 'center', fontFamily: Fonts.bodyStrong, fontSize: 12 },
  cellWrap: { alignItems: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
