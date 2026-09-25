/** The four Play games and which mood each one suits. */
import type { MoodValue } from '@/lib/moods';

export type GameId = 'breathe' | 'bubbles' | 'memory' | 'colours';

export type GameInfo = {
  id: GameId;
  title: string;
  tagline: string;
  /** Shown when this game is today's pick. */
  why: string;
  minutes: string;
  color: { light: string; dark: string };
  soft: { light: string; dark: string };
  /** Short record line for the game card, from the saved best scores and play counts. */
  record: (best: Record<string, number>, plays: Record<string, number>) => string | null;
};

export const GAMES: readonly GameInfo[] = [
  {
    id: 'breathe',
    title: 'Breathe',
    tagline: 'Three rhythms. Follow the orb',
    why: 'Heavy days ask for less. Just breathe with the orb. Nothing to win.',
    minutes: '1 min',
    color: { light: '#7A6FB8', dark: '#B5ABEA' },
    soft: { light: '#ECE8F8', dark: '#262236' },
    record: (_b, p) => (p.breathe ? `${p.breathe} ${p.breathe === 1 ? 'session' : 'sessions'}` : null),
  },
  {
    id: 'bubbles',
    title: 'Bubble Pop',
    tagline: 'Zen mode or a 60-second dash',
    why: 'A low day. Pop a few bubbles; there is no score to beat.',
    minutes: 'Any time',
    color: { light: '#2C7FA3', dark: '#7CC3E0' },
    soft: { light: '#DDEEF6', dark: '#15293A' },
    record: (b) => (b.bubbles60 !== undefined ? `Best ${b.bubbles60} in 60 s` : b.bubbles !== undefined ? `Best ${b.bubbles} popped` : null),
  },
  {
    id: 'memory',
    title: 'Pair Up',
    tagline: 'Flip, remember, match. Three levels',
    why: 'An okay day. A gentle focus game to settle your mind.',
    minutes: '2 min',
    color: { light: '#3A9477', dark: '#6CC4A6' },
    soft: { light: '#DDEFE7', dark: '#17302A' },
    record: (b) =>
      b['memory-hard'] !== undefined
        ? `Hard · best ${b['memory-hard']} moves`
        : b.memory !== undefined
          ? `Best ${b.memory} moves`
          : b['memory-easy'] !== undefined
            ? `Easy · best ${b['memory-easy']} moves`
            : null,
  },
  {
    id: 'colours',
    title: 'Colour Clash',
    tagline: 'Tap the ink colour, not the word',
    why: 'A good day. Your mind is ready for a quick challenge.',
    minutes: '30 sec',
    color: { light: '#C0573A', dark: '#F0936B' },
    soft: { light: '#F8E3D8', dark: '#3A2A22' },
    record: (b) => (b.colours !== undefined ? `Best ${b.colours} points` : null),
  },
];

export function gameOf(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}

/** Heavy → Breathe, Low → Bubble Pop, Okay → Pair Up, Good or Bright → Colour Clash. */
export function gameForMood(mood: MoodValue | undefined): GameInfo | undefined {
  if (mood === undefined) return undefined;
  const id: GameId = mood === 1 ? 'breathe' : mood === 2 ? 'bubbles' : mood === 3 ? 'memory' : 'colours';
  return gameOf(id);
}
