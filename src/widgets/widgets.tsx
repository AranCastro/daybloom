'use no memo';
/**
 * Daybloom home-screen widgets (Android). Each widget is a plain function of the
 * app snapshot, its size and a palette; the native side draws it on the home screen,
 * and components/widget-mock.tsx draws the same tree inside the app as a preview.
 *
 * Taps either open a screen (OPEN_URI with a daybloom:// link) or run a small
 * action in the background (see widgets/task-handler.ts).
 */
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { CIRCLE } from '@/lib/circle';
import { MOODS } from '@/lib/moods';
import { QUADRANTS } from '@/lib/quadrants';
import type { Snapshot } from '@/widgets/data';
import { budSvg, doneSvg, flowerSvg, iconSvg, orbSvg, tickSvg } from '@/widgets/svg';

// ── Palette ──────────────────────────────────────────────────────────────────

export type WidgetPalette = {
  from: `#${string}`;
  to: `#${string}`;
  ink: `#${string}`;
  dim: `#${string}`;
  muted: `#${string}`;
  line: `#${string}`;
  chip: `#${string}`;
  brand: `#${string}`;
  brandInk: `#${string}`;
  accent: `#${string}`;
  mode: 'light' | 'dark';
  /** Background opacity 0.4–1 (matrix widgets let the user choose). */
  alpha?: number;
};

export const LIGHT: WidgetPalette = {
  from: '#FBF6EF',
  to: '#EEF4EE',
  ink: '#1D1B18',
  dim: '#6B655C',
  muted: '#9A9288',
  line: '#E6DED3',
  chip: '#FFFFFF',
  brand: '#2F4A3F',
  brandInk: '#FFFFFF',
  accent: '#D0683E',
  mode: 'light',
};

export const DARK: WidgetPalette = {
  from: '#221E1A',
  to: '#16221D',
  ink: '#F3EEE7',
  dim: '#AAA196',
  muted: '#7F776D',
  line: '#35302A',
  chip: '#2B2723',
  brand: '#A8D0BC',
  brandInk: '#10201A',
  accent: '#F0936B',
  mode: 'dark',
};

const DISPLAY = 'Fraunces_600SemiBold';
const BOLD = 'Manrope_700Bold';
const BODY = 'Manrope_500Medium';

export type WidgetProps = {
  s: Snapshot;
  p: WidgetPalette;
  width: number;
  height: number;
  flash?: string;
  /** Text size multiplier (Small 0.9, Default 1, Large 1.15). */
  scale?: number;
  /** Matrix: tick circles. Circle: call and message buttons. */
  checkbox?: boolean;
};

type Rgba = `rgba(${number}, ${number}, ${number}, ${number})`;

/** #RRGGBB at the palette's opacity. */
function bg(hex: `#${string}`, alpha = 1): `#${string}` | Rgba {
  if (alpha >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Deep links into the app (scheme "daybloom" in app.json). */
export const LINK = {
  today: 'daybloom://today',
  garden: 'daybloom://journey',
  matrix: 'daybloom://matrix',
  circle: 'daybloom://circle',
  focus: (preset?: string) => (preset ? `daybloom://focus?preset=${preset}` : 'daybloom://focus'),
};

function open(uri: string) {
  return { clickAction: 'OPEN_URI', clickActionData: { uri } } as const;
}

// ── Shared pieces ────────────────────────────────────────────────────────────

function Shell({ p, children, padding = 14, uri, app }: { p: WidgetPalette; children: any; padding?: number; uri?: string; app?: boolean }) {
  return (
    <FlexWidget
      {...(uri ? open(uri) : app ? { clickAction: 'OPEN_APP' } : {})}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        borderRadius: 24,
        padding,
        backgroundGradient: { from: bg(p.from, p.alpha), to: bg(p.to, p.alpha), orientation: 'TL_BR' },
      }}
    >
      {children}
    </FlexWidget>
  );
}

function Label({ text, p }: { text: string; p: WidgetPalette }) {
  return <TextWidget text={text.toUpperCase()} style={{ fontSize: 10, fontFamily: BOLD, color: p.dim, letterSpacing: 0.12 }} />;
}

function Spacer({ size }: { size: number }) {
  return <FlexWidget style={{ height: size, width: size }} />;
}

function Grow() {
  return <FlexWidget style={{ flex: 1 }} />;
}

/** Shown on every widget until onboarding is done. */
function Welcome({ p }: { p: WidgetPalette }) {
  return (
    <Shell p={p} app>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', height: 'match_parent', width: 'match_parent' }}>
        <SvgWidget svg={budSvg(40)} style={{ height: 40, width: 40 }} />
        <Spacer size={10} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text="Daybloom" style={{ fontSize: 16, fontFamily: DISPLAY, color: p.ink }} />
          <TextWidget text="Open the app to begin" style={{ fontSize: 12, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

// ── 1. Mood check-in ─────────────────────────────────────────────────────────

/** Five mood orbs; one tap checks in from the home screen (and grows the day's flower). */
export function CheckInWidget({ s, p, width, height, flash }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const tall = height >= 120;
  const wide = !tall && width >= 340;
  const orb = tall ? Math.min(46, Math.floor((width - 40) / 6)) : wide ? Math.min(38, Math.floor((width - 190) / 5.4)) : Math.min(34, Math.floor((width - 32) / 6.4));
  const title = s.mood ? 'Today, noted.' : 'How is today?';
  const status = flash ?? (s.moodLabel ? `Noted: ${s.moodLabel}` : 'One tap is enough');

  const orbs = (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', ...(wide ? {} : { width: 'match_parent', justifyContent: 'space-between' }) }}>
      {MOODS.map((m, i) => (
        <FlexWidget key={m.value} style={{ flexDirection: 'row', alignItems: 'center' }}>
          {i > 0 && wide && <Spacer size={6} />}
          <FlexWidget
            clickAction="MOOD"
            clickActionData={{ value: m.value }}
            accessibilityLabel={`Check in: ${m.label}`}
            style={{ alignItems: 'center' }}
          >
            <SvgWidget svg={orbSvg(m.colors, orb, s.mood === m.value ? p.ink : undefined)} style={{ height: orb, width: orb }} />
            {tall && (
              <TextWidget
                text={m.label}
                style={{ fontSize: 10, fontFamily: s.mood === m.value ? BOLD : BODY, color: s.mood === m.value ? p.ink : p.dim, marginTop: 4 }}
              />
            )}
          </FlexWidget>
        </FlexWidget>
      ))}
    </FlexWidget>
  );

  if (tall) {
    return (
      <Shell p={p} padding={16}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
          <FlexWidget style={{ flex: 1 }} {...open(LINK.today)}>
            <Label text="Daybloom" p={p} />
            <TextWidget text={title} style={{ fontSize: 19, fontFamily: DISPLAY, color: p.ink }} />
          </FlexWidget>
          {s.streak > 0 && <StreakPill s={s} p={p} />}
        </FlexWidget>
        <Grow />
        {orbs}
        <Grow />
        <TextWidget text={status} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
      </Shell>
    );
  }

  if (wide) {
    return (
      <Shell p={p} padding={12}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', height: 'match_parent', width: 'match_parent' }}>
          <FlexWidget style={{ flex: 1, paddingLeft: 4 }} {...open(LINK.today)}>
            <TextWidget text={title} style={{ fontSize: 16, fontFamily: DISPLAY, color: p.ink }} maxLines={1} truncate="END" />
            <TextWidget text={status} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
          </FlexWidget>
          {orbs}
        </FlexWidget>
      </Shell>
    );
  }

  // Standard 4 × 1: a title line, then the five orbs across the full width.
  return (
    <Shell p={p} padding={12}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingHorizontal: 2 }} {...open(LINK.today)}>
        <TextWidget text={title} style={{ fontSize: 14, fontFamily: DISPLAY, color: p.ink }} maxLines={1} />
        <FlexWidget style={{ flex: 1 }} />
        <TextWidget text={status} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
      </FlexWidget>
      <Grow />
      {orbs}
    </Shell>
  );
}

function StreakPill({ s, p }: { s: Snapshot; p: WidgetPalette }) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.chip, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
      <SvgWidget svg={iconSvg('flame', p.accent, 14, p.accent)} style={{ height: 14, width: 14 }} />
      <Spacer size={4} />
      <TextWidget text={String(s.streak)} style={{ fontSize: 12, fontFamily: BOLD, color: p.ink }} />
    </FlexWidget>
  );
}

// ── 2. Garden ────────────────────────────────────────────────────────────────

export function GardenWidget({ s, p, width }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const g = s.garden;
  const wide = width >= 240;
  const hero = g.latest ? flowerSvg(g.latest, 72, true) : budSvg(72);
  const count = `${g.total} ${g.total === 1 ? 'bloom' : 'blooms'}`;
  const sub = g.today ? `${g.today} today` : 'Nothing yet today';
  const golden = g.toGolden === 1 ? 'Golden Lotus next' : `Golden Lotus in ${g.toGolden}`;

  if (!wide) {
    return (
      <Shell p={p} uri={LINK.garden}>
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center' }}>
          <FlexWidget style={{ flex: 1 }}>
            <Label text="Garden" p={p} />
          </FlexWidget>
          {g.today > 0 && <TextWidget text={`+${g.today}`} style={{ fontSize: 11, fontFamily: BOLD, color: p.accent }} />}
        </FlexWidget>
        <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <SvgWidget svg={hero} style={{ height: 72, width: 72 }} />
        </FlexWidget>
        <TextWidget text={count} style={{ fontSize: 17, fontFamily: DISPLAY, color: p.ink }} />
        <TextWidget text={golden} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
      </Shell>
    );
  }

  return (
    <Shell p={p} uri={LINK.garden} padding={16}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', height: 'match_parent' }}>
        <SvgWidget svg={hero} style={{ height: 88, width: 88 }} />
        <Spacer size={12} />
        <FlexWidget style={{ flex: 1 }}>
          <Label text="Your garden" p={p} />
          <TextWidget text={count} style={{ fontSize: 22, fontFamily: DISPLAY, color: p.ink }} />
          <TextWidget text={`${sub} · ${golden}`} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
          <Spacer size={8} />
          <FlexWidget style={{ flexDirection: 'row' }}>
            {g.recent.slice(1, 5).map((f, i) => (
              <SvgWidget key={i} svg={flowerSvg(f, 26)} style={{ height: 26, width: 26, marginRight: 4 }} />
            ))}
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

// ── 3. Streak ────────────────────────────────────────────────────────────────

export function StreakWidget({ s, p }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const line = s.checkedToday ? 'Checked in today' : s.streak > 0 ? 'Not yet today' : 'Start today';
  return (
    <Shell p={p} uri={LINK.today} padding={12}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', height: 'match_parent', width: 'match_parent' }}>
        <FlexWidget style={{ height: 40, width: 40, borderRadius: 14, backgroundColor: p.chip, alignItems: 'center', justifyContent: 'center' }}>
          <SvgWidget svg={iconSvg('flame', p.accent, 22, s.checkedToday ? p.accent : 'none')} style={{ height: 22, width: 22 }} />
        </FlexWidget>
        <Spacer size={10} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={`${s.streak} ${s.streak === 1 ? 'day' : 'days'}`}
            style={{ fontSize: 20, fontFamily: DISPLAY, color: p.ink }}
            maxLines={1}
          />
          <TextWidget text={line} style={{ fontSize: 11, fontFamily: BODY, color: s.checkedToday ? p.dim : p.accent }} maxLines={1} truncate="END" />
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

// ── 4. Focus list (tasks) ────────────────────────────────────────────────────

export function TasksWidget({ s, p, height, flash }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const rows = Math.max(1, Math.floor((height - 84) / 30));
  const items = s.tasks.items.slice(0, rows);
  const more = s.tasks.more + (s.tasks.items.length - items.length);
  const sub = flash ?? (s.tasks.doneToday ? `${s.tasks.doneToday} done today` : s.low && items.length ? 'One thing is enough' : '');

  return (
    <Shell p={p} padding={16}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }} {...open(LINK.matrix)}>
        <FlexWidget style={{ flex: 1 }}>
          <Label text="Focus today" p={p} />
          {!!sub && <TextWidget text={sub} style={{ fontSize: 11, fontFamily: BODY, color: flash ? p.accent : p.dim }} maxLines={1} truncate="END" />}
        </FlexWidget>
        <FlexWidget style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: p.brand, alignItems: 'center', justifyContent: 'center' }} {...open(LINK.matrix)}>
          <SvgWidget svg={iconSvg('plus', p.brandInk, 16)} style={{ height: 16, width: 16 }} />
        </FlexWidget>
      </FlexWidget>
      <Spacer size={8} />
      {items.length === 0 ? (
        <FlexWidget style={{ flex: 1, width: 'match_parent', justifyContent: 'center' }} {...open(LINK.matrix)}>
          <TextWidget text="Nothing urgent." style={{ fontSize: 15, fontFamily: DISPLAY, color: p.ink }} />
          <TextWidget text="A good day to plan something that matters." style={{ fontSize: 12, fontFamily: BODY, color: p.dim }} maxLines={2} />
        </FlexWidget>
      ) : (
        items.map((t) => (
          <FlexWidget key={t.id} style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', height: 30 }}>
            <FlexWidget clickAction="TASK_DONE" clickActionData={{ id: t.id }} accessibilityLabel={`Mark done: ${t.title}`} style={{ paddingRight: 10, paddingVertical: 4 }}>
              <SvgWidget svg={tickSvg(p.muted, 22)} style={{ height: 22, width: 22 }} />
            </FlexWidget>
            <FlexWidget style={{ flex: 1 }} {...open(LINK.matrix)}>
              <TextWidget text={t.title} style={{ fontSize: 14, fontFamily: BODY, color: p.ink }} maxLines={1} truncate="END" />
            </FlexWidget>
            {t.due && <TextWidget text={t.due.text} style={{ fontSize: 11, fontFamily: BOLD, color: t.due.late ? p.accent : p.dim, marginLeft: 8 }} />}
          </FlexWidget>
        ))
      )}
      {items.length > 0 && <Grow />}
      {more > 0 && <TextWidget text={`+${more} more in your matrix`} style={{ fontSize: 11, fontFamily: BODY, color: p.muted }} {...open(LINK.matrix)} />}
    </Shell>
  );
}

// ── 5. Focus timer ───────────────────────────────────────────────────────────

export function FocusWidget({ s, p }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const f = s.focus;

  if (f.running) {
    const done = !f.paused && f.leftMin === 0;
    const title = done ? 'Time is up' : f.paused ? 'Paused' : f.kind === 'break' ? 'On a break' : 'Focusing';
    const line = done ? 'Open to collect your flower' : f.paused ? `${f.leftMin} min left` : `Until ${f.until}`;
    return (
      <Shell p={p} uri={LINK.focus()}>
        <Label text="Focus" p={p} />
        <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <SvgWidget svg={done ? flowerSvg({ ...GOLD_BUD }, 56) : iconSvg('clock', p.brand, 40)} style={{ height: done ? 56 : 40, width: done ? 56 : 40 }} />
        </FlexWidget>
        <TextWidget text={title} style={{ fontSize: 17, fontFamily: DISPLAY, color: p.ink }} />
        <TextWidget text={f.task ?? line} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} truncate="END" />
        {f.task && <TextWidget text={line} style={{ fontSize: 11, fontFamily: BOLD, color: p.accent }} maxLines={1} />}
      </Shell>
    );
  }

  const presets = [
    { id: 'gentle', min: 15 },
    { id: 'classic', min: 25 },
    { id: 'deep', min: 50 },
  ];
  const suggested = s.low ? 'gentle' : 'classic';
  return (
    <Shell p={p} uri={LINK.focus()}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
        <FlexWidget style={{ flex: 1 }}>
          <Label text="Focus" p={p} />
        </FlexWidget>
        {f.sessionsToday > 0 && <TextWidget text={`${f.sessionsToday} today`} style={{ fontSize: 11, fontFamily: BOLD, color: p.accent }} />}
      </FlexWidget>
      <Grow />
      <TextWidget text="Grow a flower" style={{ fontSize: 17, fontFamily: DISPLAY, color: p.ink }} />
      <TextWidget text="Pick a session" style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} />
      <Spacer size={8} />
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
        {presets.map((x, i) => (
          <FlexWidget key={x.id} style={{ flex: 1, flexDirection: 'row' }}>
            {i > 0 && <Spacer size={6} />}
            <FlexWidget
              {...open(LINK.focus(x.id))}
              accessibilityLabel={`${x.min} minute focus`}
              style={{
                flex: 1,
                height: 32,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: x.id === suggested ? p.brand : p.chip,
              }}
            >
              <TextWidget text={String(x.min)} style={{ fontSize: 13, fontFamily: BOLD, color: x.id === suggested ? p.brandInk : p.ink }} />
            </FlexWidget>
          </FlexWidget>
        ))}
      </FlexWidget>
    </Shell>
  );
}

/** A small golden bloom shown when a session has finished but not been collected yet. */
const GOLD_BUD = {
  id: 'bud',
  name: 'Bloom',
  rarity: 'common' as const,
  petals: 8,
  shape: 'round' as const,
  petal: '#F5C12E',
  petalInner: '#F9D65E',
  center: '#C4631B',
  line: '',
};

// ── 6. Reach out ─────────────────────────────────────────────────────────────

export function ReachWidget({ s, p }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const picks = s.reach;
  if (picks.length === 0) {
    return (
      <Shell p={p} uri={LINK.circle} padding={14}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', height: 'match_parent', width: 'match_parent' }}>
          <FlexWidget style={{ flex: 1 }}>
            <Label text="Reach out" p={p} />
            <TextWidget text="Add the people who lift you" style={{ fontSize: 14, fontFamily: DISPLAY, color: p.ink }} maxLines={1} truncate="END" />
          </FlexWidget>
          <SvgWidget svg={iconSvg('arrow', p.accent, 20)} style={{ height: 20, width: 20 }} />
        </FlexWidget>
      </Shell>
    );
  }
  return (
    <Shell p={p} padding={12}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', height: 'match_parent', width: 'match_parent' }}>
        {picks.map((x, i) => {
          const uri = x.uri;
          return (
            <FlexWidget key={x.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
              {i > 0 && <Spacer size={8} />}
              <FlexWidget
                {...open(uri)}
                accessibilityLabel={`${x.mode === 'call' ? 'Call' : 'Message'} ${x.name}`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: p.chip, borderRadius: 18, padding: 8 }}
              >
                <FlexWidget style={{ height: 34, width: 34, borderRadius: 17, backgroundColor: p.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <TextWidget text={x.name.slice(0, 1).toUpperCase()} style={{ fontSize: 15, fontFamily: BOLD, color: p.brandInk }} />
                </FlexWidget>
                <Spacer size={8} />
                <FlexWidget style={{ flex: 1 }}>
                  <TextWidget text={x.name} style={{ fontSize: 13, fontFamily: BOLD, color: p.ink }} maxLines={1} truncate="END" />
                  <TextWidget text={x.mode === 'call' ? 'Call' : 'Message'} style={{ fontSize: 11, fontFamily: BODY, color: p.dim }} maxLines={1} />
                </FlexWidget>
                <SvgWidget svg={iconSvg(x.mode === 'call' ? 'phone' : 'chat', p.accent, 18)} style={{ height: 18, width: 18 }} />
              </FlexWidget>
            </FlexWidget>
          );
        })}
      </FlexWidget>
    </Shell>
  );
}

// ── 7 & 8. Matrix widgets (Eisenhower tasks, people circle) ──────────────────

const HEADER = 46;

/** The shared 2 × 2 frame: a header, then four equal cells split by hairlines. */
function Grid({ p, width, height, title, addUri, addLabel, cell }: {
  p: WidgetPalette;
  width: number;
  height: number;
  title: string;
  addUri: string;
  addLabel: string;
  cell: (q: 1 | 2 | 3 | 4, w: number, h: number) => React.JSX.Element;
}) {
  const cw = Math.floor((width - 1) / 2);
  const ch = Math.floor((height - HEADER - 2) / 2);
  const row = (a: 1 | 2 | 3 | 4, b: 1 | 2 | 3 | 4) => (
    <FlexWidget style={{ flexDirection: 'row', height: ch, width: 'match_parent' }}>
      {cell(a, cw, ch)}
      <FlexWidget style={{ width: 1, height: 'match_parent', backgroundColor: p.line }} />
      {cell(b, width - cw - 1, ch)}
    </FlexWidget>
  );
  return (
    <Shell p={p} padding={0}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', height: HEADER, width: 'match_parent', paddingLeft: 16, paddingRight: 10 }}>
        <FlexWidget style={{ flex: 1 }} {...open(addUri)}>
          <TextWidget text={title} style={{ fontSize: 16, fontFamily: DISPLAY, color: p.ink }} maxLines={1} truncate="END" />
        </FlexWidget>
        <FlexWidget {...open(addUri)} accessibilityLabel={addLabel} style={{ height: 32, width: 32, borderRadius: 16, backgroundColor: p.brand, alignItems: 'center', justifyContent: 'center' }}>
          <SvgWidget svg={iconSvg('plus', p.brandInk, 16)} style={{ height: 16, width: 16 }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: p.line }} />
      {row(1, 2)}
      <FlexWidget style={{ height: 1, width: 'match_parent', backgroundColor: p.line }} />
      {row(3, 4)}
    </Shell>
  );
}

/** Fits a list into a cell: how many lines show, and whether a "+n more" line is needed. */
function fit(count: number, h: number, titleH: number, lineH: number) {
  const room = Math.max(0, Math.floor((h - 16 - titleH) / lineH));
  if (count <= room) return { show: count, more: 0 };
  const show = Math.max(0, room - 1);
  return { show, more: count - show };
}

function Empty({ text, p, k, uri }: { text: string; p: WidgetPalette; k: number; uri: string }) {
  return (
    <FlexWidget {...open(uri)} style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text={text} style={{ fontSize: 12 * k, fontFamily: BODY, color: p.muted }} />
    </FlexWidget>
  );
}

/** All four Eisenhower quadrants, like the Matrix tab. */
export function MatrixWidget({ s, p, width, height, scale = 1, checkbox = true }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const k = scale;
  const titleH = Math.round(18 * k) + 4;
  const lineH = Math.round(24 * k);
  const box = Math.round(16 * k);

  return (
    <Grid
      p={p}
      width={width}
      height={height}
      title="Eisenhower Matrix"
      addUri={LINK.matrix}
      addLabel="Add a task"
      cell={(q, w, h) => {
        const info = QUADRANTS[q - 1];
        const uri = `daybloom://quadrant/${q}`;
        const tasks = s.matrix[q - 1].tasks;
        const { show, more } = fit(tasks.length, h, titleH, lineH);
        return (
          <FlexWidget key={q} style={{ width: w, height: h, paddingHorizontal: 12, paddingVertical: 8 }}>
            <FlexWidget {...open(uri)} style={{ height: titleH, width: 'match_parent' }}>
              <TextWidget text={info.action} style={{ fontSize: 12.5 * k, fontFamily: BOLD, color: info.color[p.mode] as `#${string}` }} maxLines={1} truncate="END" />
            </FlexWidget>
            {tasks.length === 0 ? (
              <Empty text="No tasks" p={p} k={k} uri={uri} />
            ) : (
              tasks.slice(0, show).map((t) => (
                <FlexWidget key={t.id} style={{ flexDirection: 'row', alignItems: 'center', height: lineH, width: 'match_parent' }}>
                  {checkbox && (
                    <FlexWidget
                      clickAction="TASK_TOGGLE"
                      clickActionData={{ id: t.id }}
                      accessibilityLabel={`${t.done ? 'Mark not done' : 'Mark done'}: ${t.title}`}
                      style={{ paddingRight: 8, paddingVertical: 3 }}
                    >
                      <SvgWidget svg={t.done ? doneSvg(info.color[p.mode], box) : tickSvg(p.muted, box)} style={{ height: box, width: box }} />
                    </FlexWidget>
                  )}
                  <FlexWidget {...open(uri)} style={{ flex: 1 }}>
                    <TextWidget
                      text={t.title}
                      style={{ fontSize: 13.5 * k, fontFamily: BODY, color: t.done ? p.muted : t.due?.late ? p.accent : p.ink }}
                      maxLines={1}
                      truncate="END"
                    />
                  </FlexWidget>
                  {t.due && w >= 200 && <TextWidget text={t.due.text} style={{ fontSize: 10.5 * k, fontFamily: BOLD, color: t.due.late ? p.accent : p.dim, marginLeft: 6 }} />}
                </FlexWidget>
              ))
            )}
            {more > 0 && <TextWidget {...open(uri)} text={`+${more} more`} style={{ fontSize: 11 * k, fontFamily: BODY, color: p.muted }} />}
          </FlexWidget>
        );
      }}
    />
  );
}

/** All four circle quadrants, like the People tab. Tap a name to call or message. */
export function CircleWidget({ s, p, width, height, scale = 1, checkbox = true }: WidgetProps) {
  if (!s.onboarded) return <Welcome p={p} />;
  const k = scale;
  const titleH = Math.round(18 * k) + 4;
  const lineH = Math.round(28 * k);
  const dot = Math.round(20 * k);

  return (
    <Grid
      p={p}
      width={width}
      height={height}
      title="Your circle"
      addUri={LINK.circle}
      addLabel="Add a person"
      cell={(q, w, h) => {
        const info = CIRCLE[q - 1];
        const color = info.color[p.mode] as `#${string}`;
        const soft = info.soft[p.mode] as `#${string}`;
        const people = s.circle[q - 1].people;
        const { show, more } = fit(people.length, h, titleH, lineH);
        return (
          <FlexWidget key={q} style={{ width: w, height: h, paddingHorizontal: 12, paddingVertical: 8 }}>
            <FlexWidget {...open(LINK.circle)} style={{ height: titleH, width: 'match_parent' }}>
              <TextWidget text={info.title} style={{ fontSize: 12.5 * k, fontFamily: BOLD, color }} maxLines={1} truncate="END" />
            </FlexWidget>
            {people.length === 0 ? (
              <Empty text="No one yet" p={p} k={k} uri={LINK.circle} />
            ) : (
              people.slice(0, show).map((x) => (
                <FlexWidget
                  key={x.id}
                  {...open(x.uri)}
                  accessibilityLabel={`${info.mode === 'call' ? 'Call' : 'Message'} ${x.name}`}
                  style={{ flexDirection: 'row', alignItems: 'center', height: lineH, width: 'match_parent' }}
                >
                  <FlexWidget style={{ height: dot, width: dot, borderRadius: dot / 2, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
                    <TextWidget text={x.name.slice(0, 1).toUpperCase()} style={{ fontSize: 10.5 * k, fontFamily: BOLD, color }} />
                  </FlexWidget>
                  <Spacer size={8} />
                  <FlexWidget style={{ flex: 1 }}>
                    <TextWidget text={x.name} style={{ fontSize: 13.5 * k, fontFamily: BODY, color: p.ink }} maxLines={1} truncate="END" />
                  </FlexWidget>
                  {checkbox && (
                    <SvgWidget svg={iconSvg(info.mode === 'call' ? 'phone' : 'chat', color, Math.round(15 * k))} style={{ height: Math.round(15 * k), width: Math.round(15 * k), marginLeft: 6 }} />
                  )}
                </FlexWidget>
              ))
            )}
            {more > 0 && <TextWidget {...open(LINK.circle)} text={`+${more} more`} style={{ fontSize: 11 * k, fontFamily: BODY, color: p.muted }} />}
          </FlexWidget>
        );
      }}
    />
  );
}
