/**
 * Plays the chosen focus sound on a loop. One player for the whole app: it follows the focus
 * timer (startFocusSoundSync, started in the root layout) and plays short previews in the Focus tab.
 * On Android it keeps playing with the screen off, with a media notification to stop it.
 */
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';

import { SoundId, soundOf } from '@/lib/sounds';
import type { AppState } from '@/lib/store';

const FILES: Record<SoundId, number> = {
  'white-noise': require('../../assets/sounds/white-noise.mp3'),
  rain: require('../../assets/sounds/rain.mp3'),
  fire: require('../../assets/sounds/fire.mp3'),
  wind: require('../../assets/sounds/wind.mp3'),
  thunderstorm: require('../../assets/sounds/thunderstorm.mp3'),
  birds: require('../../assets/sounds/birds.mp3'),
  gamma: require('../../assets/sounds/gamma.mp3'),
};

let player: AudioPlayer | null = null;
let playing: SoundId | null = null;
let previewTimer: ReturnType<typeof setTimeout> | undefined;
let modeSet = false;

async function ensureMode() {
  if (modeSet) return;
  modeSet = true;
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => undefined);
}

/** Starts (or switches to) a sound on a loop. `session` shows the media notification for background play. */
export async function playSound(id: SoundId, volume: number, session = true) {
  clearTimeout(previewTimer);
  previewTimer = undefined;
  await ensureMode();
  if (!player) player = createAudioPlayer(FILES[id]);
  else if (playing !== id) player.replace(FILES[id]);
  player.loop = true;
  player.volume = volume;
  player.play();
  playing = id;
  if (session && Platform.OS !== 'web') {
    try {
      player.setActiveForLockScreen(true, { title: soundOf(id)?.label ?? 'Focus sound', artist: 'Daybloom · focus' });
    } catch {
      // Lock screen controls are optional.
    }
  }
}

/** Plays a sound for a few seconds so the user can hear it before choosing. */
export async function previewSound(id: SoundId, volume: number, seconds = 8) {
  await playSound(id, volume, false);
  previewTimer = setTimeout(() => stopSound(), seconds * 1000);
}

export function stopSound() {
  clearTimeout(previewTimer);
  previewTimer = undefined;
  if (!player) return;
  player.pause();
  if (Platform.OS !== 'web') {
    try {
      player.clearLockScreenControls();
    } catch {
      // Nothing to clear.
    }
  }
  playing = null;
}

export function setSoundVolume(volume: number) {
  if (player) player.volume = volume;
}

export function nowPlaying(): SoundId | null {
  return playing;
}

/**
 * Keeps the sound in step with the focus timer: plays while a focus session runs (not during
 * breaks or pauses) and stops when it ends. Returns a stop function.
 */
export function startFocusSoundSync(getState: () => AppState, subscribe: (l: () => void) => () => void): () => void {
  let key: string | null = null;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    const s = getState();
    const a = s.focus.active;
    const running = !!a && a.kind === 'focus' && a.endAt !== null && a.endAt > Date.now();
    const sound = soundOf(s.settings.focusSound);
    const next = running && sound ? `${sound.id}:${a!.endAt}` : null;
    if (next !== key) {
      key = next;
      clearTimeout(endTimer);
      if (next && sound) {
        void playSound(sound.id, s.settings.focusVolume);
        endTimer = setTimeout(check, Math.max(0, a!.endAt! - Date.now()) + 50);
      } else if (playing && !previewTimer) {
        // Stop the session sound; a preview (started while idle) finishes on its own.
        stopSound();
      }
    }
    if (key) setSoundVolume(s.settings.focusVolume);
  };
  check();
  const unsubscribe = subscribe(check);
  return () => {
    clearTimeout(endTimer);
    unsubscribe();
  };
}
