export type MoodValue = 1 | 2 | 3 | 4 | 5;

export type Mood = {
  value: MoodValue;
  label: string;
  line: string;
  /** Two-stop gradient used by the orb. */
  colors: readonly [string, string];
};

/** Ordered from lightest to heaviest, the order they are shown on screen. */
export const MOODS: readonly Mood[] = [
  { value: 5, label: 'Bright', line: 'Glad to hear it. Carry it gently.', colors: ['#FFD27A', '#F0A04B'] },
  { value: 4, label: 'Good', line: 'A good day. Noted.', colors: ['#B9DDA6', '#6FAE7C'] },
  { value: 3, label: 'Okay', line: 'Okay is a perfectly fine place to be.', colors: ['#C9D8E2', '#8FA9BC'] },
  { value: 2, label: 'Low', line: 'Thank you for being honest today.', colors: ['#C3BCE6', '#8C84C6'] },
  { value: 1, label: 'Heavy', line: 'Heavy days pass. You are not alone in this.', colors: ['#9B92B5', '#5A506F'] },
];

export const LOW_THRESHOLD: MoodValue = 2;

export function moodOf(value: number | undefined): Mood | undefined {
  return MOODS.find((m) => m.value === value);
}

export function isLow(value: number | undefined): boolean {
  return value !== undefined && value <= LOW_THRESHOLD;
}
