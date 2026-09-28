/**
 * Small notes for any day, good or hard: a line or two, as many as needed through the day, each
 * with the time it was written. On Today and on any past day in the calendar. Kept on the phone
 * (and in backups) like everything else.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/icons';
import { Text } from '@/components/text';
import { Card, Input, tap } from '@/components/ui';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { confirmThen } from '@/lib/confirm';
import { addDayNote, deleteDayNote, editDayNote, NOTE_MAX, useAppState } from '@/lib/store';

function clock(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

export function DayNotesCard({ day, title = 'Notes for today', compact = false }: { day: string; title?: string; compact?: boolean }) {
  const t = useTheme();
  const notes = useAppState((s) => s.dayNotes[day]) ?? [];
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const add = () => {
    if (!draft.trim()) return;
    tap();
    addDayNote(day, draft);
    setDraft('');
  };

  const body = (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Icon name="tag" color={t.textSecondary} size={18} />
        <Text variant="label" style={{ flex: 1 }}>
          {title}
          {notes.length ? ` · ${notes.length}` : ''}
        </Text>
      </View>
      {notes.map((n) => (
        <Animated.View key={n.id} entering={FadeIn.duration(250)} layout={LinearTransition} style={[styles.note, { borderColor: t.line }]}>
          {editing === n.id ? (
            <Input
              value={editText}
              onChangeText={setEditText}
              maxLength={NOTE_MAX}
              multiline
              autoFocus
              onBlur={() => {
                editDayNote(day, n.id, editText);
                setEditing(null);
              }}
            />
          ) : (
            <Pressable
              onPress={() => (tap(), setEditText(n.text), setEditing(n.id))}
              accessibilityRole="button"
              accessibilityHint="Edit this note"
              style={{ flex: 1, gap: 2 }}>
              <Text variant="bodySm" color="text">
                {n.text}
              </Text>
              <Text variant="micro">{clock(n.at)}</Text>
            </Pressable>
          )}
          {editing !== n.id && (
            <Pressable
              hitSlop={10}
              onPress={() => confirmThen('Delete this note?', n.text, 'Delete', () => deleteDayNote(day, n.id))}
              accessibilityRole="button"
              accessibilityLabel="Delete note">
              <Icon name="trash" color={t.textMuted} size={16} />
            </Pressable>
          )}
        </Animated.View>
      ))}
      <View style={styles.addRow}>
        <Input
          value={draft}
          onChangeText={setDraft}
          placeholder={notes.length ? 'Another note…' : 'A small note about today…'}
          maxLength={NOTE_MAX}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={add}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Pressable
          onPress={add}
          disabled={!draft.trim()}
          accessibilityRole="button"
          accessibilityLabel="Add note"
          style={[styles.addBtn, { backgroundColor: t.brand, opacity: draft.trim() ? 1 : 0.35 }]}>
          <Icon name="plus" color={t.brandText} size={18} />
        </Pressable>
      </View>
      {!compact && !notes.length && <Text variant="caption">Anything at all: what happened, a thought, a small win or a hard moment. Only you see it.</Text>}
    </View>
  );

  return compact ? body : <Animated.View entering={FadeInDown.duration(350)}><Card>{body}</Card></Animated.View>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: Radius.sm, borderWidth: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
