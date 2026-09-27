/**
 * Built-in focus sounds. Each is a 60-second seamless loop made by scripts/make-focus-sounds.py
 * (synthesised, so no recordings or licences are involved), stored in the app: no internet needed.
 */
import type { IconName } from '@/components/icons';

export type SoundId = 'white-noise' | 'rain' | 'fire' | 'wind' | 'thunderstorm' | 'birds' | 'gamma';

export type FocusSound = { id: SoundId; label: string; icon: IconName; blurb: string; tint: string };

export const SOUNDS: readonly FocusSound[] = [
  { id: 'white-noise', label: 'White noise', icon: 'noise', blurb: 'Steady and soft', tint: '#8C94A3' },
  { id: 'rain', label: 'Rain', icon: 'rain', blurb: 'A gentle shower', tint: '#4E86C4' },
  { id: 'fire', label: 'Fire', icon: 'flame', blurb: 'Crackling logs', tint: '#E07A4F' },
  { id: 'wind', label: 'Wind', icon: 'wind', blurb: 'Slow gusts', tint: '#6CA7A0' },
  { id: 'thunderstorm', label: 'Thunderstorm', icon: 'storm', blurb: 'Rain and far thunder', tint: '#6C63B5' },
  { id: 'birds', label: 'Birds', icon: 'bird', blurb: 'Morning birdsong', tint: '#5E9E4E' },
  { id: 'gamma', label: 'Gamma 40 Hz', icon: 'wave', blurb: 'Binaural beat · headphones', tint: '#B0578D' },
];

export function soundOf(id: string | undefined): FocusSound | undefined {
  return SOUNDS.find((s) => s.id === id);
}
