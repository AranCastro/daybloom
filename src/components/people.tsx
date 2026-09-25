/** Support-circle building blocks: avatar, quadrant chip, reach buttons and the person sheet. */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon, IconName } from '@/components/icons';
import { Text } from '@/components/text';
import { Button, Input, tap } from '@/components/ui';
import { Fonts, Radius } from '@/constants/theme';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { CIRCLE, circleOf } from '@/lib/circle';
import { canPickContacts, pickContact } from '@/lib/pick-contact';
import { call, sms, whatsapp } from '@/lib/reach';
import { addPerson, CircleQuadrant, deletePerson, editPerson, markReached, Person } from '@/lib/store';

export function useCircleColors(q: CircleQuadrant) {
  const dark = useIsDark();
  const info = circleOf(q);
  return { color: dark ? info.color.dark : info.color.light, soft: dark ? info.soft.dark : info.soft.light };
}

export function CircleChip({ q, size = 24 }: { q: CircleQuadrant; size?: number }) {
  const { color } = useCircleColors(q);
  return (
    <View style={[styles.center, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ color: '#fff', fontFamily: Fonts.display, fontSize: size * 0.46, lineHeight: size * 0.62 }}>
        {circleOf(q).numeral}
      </Text>
    </View>
  );
}

export function Avatar({ person, size = 40 }: { person: Person; size?: number }) {
  const { color, soft } = useCircleColors(person.quadrant);
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: soft, borderWidth: 1.5, borderColor: color }]}>
      <Text style={{ color, fontFamily: Fonts.bodyStrong, fontSize: size * 0.36 }}>{initials || '?'}</Text>
    </View>
  );
}

/** Call / SMS / WhatsApp. The quadrant's preferred mode is shown first and filled. */
export function ReachButtons({ person, compact }: { person: Person; compact?: boolean }) {
  const t = useTheme();
  const { color } = useCircleColors(person.quadrant);
  const info = circleOf(person.quadrant);
  if (!person.phone) {
    return (
      <Text variant="small" color="textMuted">
        Add a phone number to call or message in one tap.
      </Text>
    );
  }
  const phone = person.phone;
  const go = (fn: () => Promise<boolean>) => async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (await fn()) markReached(person.id);
  };
  const actions: { key: string; label: string; icon: IconName; run: () => void }[] = [
    { key: 'call', label: 'Call', icon: 'phone', run: go(() => call(phone)) },
    { key: 'wa', label: 'WhatsApp', icon: 'send', run: go(() => whatsapp(phone, info.opener)) },
    { key: 'sms', label: 'SMS', icon: 'chat', run: go(() => sms(phone, info.opener)) },
  ];
  if (info.mode === 'message') actions.push(actions.shift()!);

  return (
    <View style={styles.reachRow}>
      {actions.map((a, i) => {
        const primary = i === 0;
        return (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={`${a.label} ${person.name}`}
            onPress={a.run}
            style={({ pressed }) => [
              styles.reachBtn,
              compact && { paddingVertical: 9 },
              { backgroundColor: primary ? color : 'transparent', borderColor: primary ? color : t.line, opacity: pressed ? 0.7 : 1 },
            ]}>
            <Icon name={a.icon} color={primary ? '#fff' : t.text} size={17} />
            <Text variant="bodyStrong" style={{ color: primary ? '#fff' : t.text, fontSize: 13.5 }}>
              {a.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Add / edit sheet ────────────────────────────────────────────────────────

type SheetProps = { visible: boolean; onClose: () => void; person?: Person | null; defaultQuadrant?: CircleQuadrant };

export function PersonSheet(props: SheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible && <SheetBody {...props} />}
    </Modal>
  );
}

function SheetBody({ onClose, person, defaultQuadrant = 1 }: SheetProps) {
  const t = useTheme();
  const [name, setName] = useState(person?.name ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [q, setQ] = useState<CircleQuadrant>(person?.quadrant ?? defaultQuadrant);

  async function fromContacts() {
    const picked = await pickContact();
    if (!picked) return;
    if (picked.name) setName(picked.name);
    if (picked.phone) setPhone(picked.phone);
  }

  function save() {
    if (!name.trim()) return;
    if (person) editPerson(person.id, { name: name.trim(), phone: phone.trim() || undefined, quadrant: q });
    else addPerson(name, q, phone);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: t.surface }]}>
        <View style={[styles.grabber, { backgroundColor: t.line }]} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16 }}>
          {person ? (
            <View style={styles.personHead}>
              <Avatar person={person} size={52} />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{person.name}</Text>
                <Text variant="small">{circleOf(person.quadrant).title}</Text>
              </View>
            </View>
          ) : (
            <Text variant="heading">Add to your circle</Text>
          )}
          {person && <ReachButtons person={person} />}

          {canPickContacts && !person && (
            <Button title="Choose from contacts" icon="people" kind="secondary" onPress={fromContacts} />
          )}
          <Input value={name} onChangeText={setName} placeholder="Name" autoCapitalize="words" autoFocus={!person && !canPickContacts} />
          <Input value={phone} onChangeText={setPhone} placeholder="Phone number (optional)" keyboardType="phone-pad" />

          <View style={{ gap: 10 }}>
            <Text variant="label">On a low day, they are…</Text>
            <View style={styles.qGrid}>
              {CIRCLE.map((info) => (
                <CircleOption key={info.id} q={info.id} selected={q === info.id} onPress={() => setQ(info.id)} />
              ))}
            </View>
          </View>

          <Button title={person ? 'Save changes' : 'Add person'} icon={person ? 'check' : 'plus'} onPress={save} disabled={!name.trim()} />
          {person && (
            <Pressable
              onPress={() => {
                deletePerson(person.id);
                onClose();
              }}
              style={styles.delete}>
              <Icon name="trash" color={t.textMuted} size={18} />
              <Text variant="small" color="textMuted">
                Remove from circle
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function CircleOption({ q, selected, onPress }: { q: CircleQuadrant; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const { color, soft } = useCircleColors(q);
  const info = circleOf(q);
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      accessibilityRole="radio"
      aria-selected={selected}
      style={[styles.qOption, { backgroundColor: selected ? soft : t.background, borderColor: selected ? color : t.line }]}>
      <CircleChip q={q} size={24} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={{ color: selected ? color : t.text, fontSize: 14.5 }}>
          {info.title}
        </Text>
        <Text variant="small" style={{ fontSize: 11.5, lineHeight: 15 }}>
          {info.meaning}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  reachRow: { flexDirection: 'row', gap: 8 },
  reachBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(10,8,6,0.38)' },
  sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 36, maxHeight: '90%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  qOption: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  delete: { flexDirection: 'row', gap: 8, alignSelf: 'center', alignItems: 'center', padding: 8 },
});
