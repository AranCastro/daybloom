/**
 * The support-circle matrix. Two questions sort each person:
 *   How do I reach them?  Call ←→ Message   (rows)
 *   How close are they?   Close ←→ Wider    (columns)
 * Read left to right, top to bottom, which is also the order the app suggests them on a low day.
 */
import type { CircleQuadrant } from '@/lib/store';

export type CircleInfo = {
  id: CircleQuadrant;
  numeral: string;
  title: string;
  meaning: string;
  hint: string;
  /** Primary action for this quadrant. */
  mode: 'call' | 'message';
  /** Pre-written opener. Deliberately says nothing about mood. */
  opener: string;
  color: { light: string; dark: string };
  soft: { light: string; dark: string };
};

export const CIRCLE: readonly CircleInfo[] = [
  {
    id: 1,
    numeral: 'I',
    title: 'Call anytime',
    meaning: 'Close · Call',
    hint: 'They pick up, even at a bad hour.',
    mode: 'call',
    opener: 'Are you free for a call?',
    color: { light: '#C0573A', dark: '#F0936B' },
    soft: { light: '#F8E3D8', dark: '#3A2A22' },
  },
  {
    id: 2,
    numeral: 'II',
    title: 'Quick call',
    meaning: 'Wider · Call',
    hint: 'A short, easy conversation lifts you.',
    mode: 'call',
    opener: 'Free for a quick call sometime today?',
    color: { light: '#2C7FA3', dark: '#7CC3E0' },
    soft: { light: '#DDEEF6', dark: '#15293A' },
  },
  {
    id: 3,
    numeral: 'III',
    title: 'Message first',
    meaning: 'Close · Message',
    hint: 'Close, but a text feels easier to start.',
    mode: 'message',
    opener: 'Hey, thinking of you. How have you been?',
    color: { light: '#8656AC', dark: '#C49BE3' },
    soft: { light: '#EFE3F7', dark: '#2C2036' },
  },
  {
    id: 4,
    numeral: 'IV',
    title: 'Light chat',
    meaning: 'Wider · Message',
    hint: 'Fun, easy company. Memes welcome.',
    mode: 'message',
    opener: "Hey! What's new with you?",
    color: { light: '#5F7F22', dark: '#B3CB6D' },
    soft: { light: '#EAF0D8', dark: '#252C14' },
  },
];

export function circleOf(q: CircleQuadrant): CircleInfo {
  return CIRCLE[q - 1];
}
