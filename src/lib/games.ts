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
  /** How the best score reads, e.g. "Best 42" or "Best 14 moves". */
  bestLabel: (n: number) => string;
};

export const GAMES: readonly GameInfo[] = [
  {
    id: 'breathe',
    title: 'Breathe',
    tagline: 'Follow the orb, slow and steady',
    why: 'Heavy days ask for less. Just breathe with the orb. Nothing to win.',
    minutes: '1 min',
    color: { light: '#7A6FB8', dark: '#B5ABEA' },
    soft: { light: '#ECE8F8', dark: '#262236' },
    bestLabel: (n) => `${n} calm rounds`,
  },
  {
    id: 'bubbles',
    title: 'Bubble Pop',
    tagline: 'Pop what floats by. No timer.',
    why: 'A low day. Pop a few bubbles; there is no score to beat.',
    minutes: 'Any time',
    color: { light: '#2C7FA3', dark: '#7CC3E0' },
    soft: { light: '#DDEEF6', dark: '#15293A' },
    bestLabel: (n) => `Best ${n} popped`,
  },
  {
    id: 'memory',
    title: 'Pair Up',
    tagline: 'Find the six matching pairs',
    why: 'An okay day. A gentle focus game to settle your mind.',
    minutes: '2 min',
    color: { light: '#3A9477', dark: '#6CC4A6' },
    soft: { light: '#DDEFE7', dark: '#17302A' },
    bestLabel: (n) => `Best ${n} moves`,
  },
  {
    id: 'colours',
    title: 'Colour Clash',
    tagline: 'Tap the ink colour, not the word',
    why: 'A good day. Your mind is ready for a quick challenge.',
    minutes: '30 sec',
    color: { light: '#C0573A', dark: '#F0936B' },
    soft: { light: '#F8E3D8', dark: '#3A2A22' },
    bestLabel: (n) => `Best ${n} points`,
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
