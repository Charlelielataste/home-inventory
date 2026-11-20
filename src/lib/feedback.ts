import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { createKvPref, savedRecord } from '@/lib/kv-pref';

/**
 * Touch feedback: a short sound and/or a vibration per kind of action.
 * Base components (Button, IconButton, ListRow, Chip…) play one by default;
 * business actions (save, delete, scan) play their own.
 *
 * - tap: buttons, opening a screen · tick: − / +, checkboxes, chips, selection
 * - open / close: folding a room, scanner, cancel · hold: long press (vibration only)
 * - success: item saved, restocked · delete: deletion done · error: invalid input · scan: barcode read
 */
export type Feedback = 'tap' | 'tick' | 'open' | 'close' | 'hold' | 'success' | 'delete' | 'error' | 'scan';

/** Every kind has a sound except `hold` (vibration only): a missing file is a type error. */
const SOUNDS: Record<Exclude<Feedback, 'hold'>, number> = {
  tap: require('../../assets/sounds/tap.m4a'),
  tick: require('../../assets/sounds/tick.m4a'),
  open: require('../../assets/sounds/open.m4a'),
  close: require('../../assets/sounds/close.m4a'),
  success: require('../../assets/sounds/success.mp3'),
  delete: require('../../assets/sounds/delete.m4a'),
  error: require('../../assets/sounds/error.m4a'),
  scan: require('../../assets/sounds/scan.mp3'),
};

/** UI sounds stay discreet. */
const VOLUME = 0.6;

// ---------- Preferences (display preference: kv-store, not in backups) ----------

export type FeedbackPrefs = { sounds: boolean; haptics: boolean };

const prefs = createKvPref<FeedbackPrefs>('feedback.prefs', (saved) => {
  const s = savedRecord(saved);
  return {
    sounds: typeof s.sounds === 'boolean' ? s.sounds : true,
    haptics: typeof s.haptics === 'boolean' ? s.haptics : true,
  };
});

export function setFeedbackPref(key: keyof FeedbackPrefs, value: boolean) {
  prefs.set({ ...prefs.get(), [key]: value });
}

export const useFeedbackPrefs = prefs.use;

// ---------- Sounds ----------

const players: Partial<Record<Feedback, AudioPlayer>> = {};
let audioReady = false;

/** Loads the sounds once (root layout), so the first tap plays without delay. */
export function preloadFeedback() {
  if (audioReady) return;
  audioReady = true;
  // Silent / vibrate mode mutes the sounds (Android and iOS); never pauses the user's music
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  for (const [kind, source] of Object.entries(SOUNDS) as [Feedback, number][]) {
    try {
      const player = createAudioPlayer(source);
      player.volume = VOLUME;
      // Rewind as soon as a sound ends, so the next play() starts right away. Calling
      // seekTo(0) just before play() is not enough: the seek is async and a player that
      // has reached the end stays silent (heard on a real device: each sound played once).
      // pause() first: a finished player is still "playing" and would restart on its own.
      player.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) return;
        player.pause();
        player.seekTo(0).catch(() => {});
      });
      players[kind] = player;
    } catch {
      // No sound for this kind
    }
  }
}

function playSound(kind: Feedback) {
  const player = players[kind];
  if (!player) return;
  try {
    // Still playing (fast − / + taps): restart it from the beginning
    if (player.playing) player.seekTo(0).catch(() => {});
    else player.play();
  } catch {
    // Feedback must never break an action
  }
}

// ---------- Vibrations ----------

/** Light touches on Android: system haptics (follow the phone's "touch vibration" setting). */
const ANDROID_HAPTICS = {
  tap: Haptics.AndroidHaptics.Virtual_Key,
  tick: Haptics.AndroidHaptics.Clock_Tick,
  open: Haptics.AndroidHaptics.Context_Click,
  close: Haptics.AndroidHaptics.Context_Click,
  hold: Haptics.AndroidHaptics.Long_Press,
} as const;

function vibrate(kind: Feedback) {
  const run = (): Promise<void> => {
    switch (kind) {
      case 'success':
      case 'scan':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'delete':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      default:
        break;
    }
    if (Platform.OS === 'android') return Haptics.performAndroidHapticsAsync(ANDROID_HAPTICS[kind]);
    if (kind === 'tick') return Haptics.selectionAsync();
    return Haptics.impactAsync(
      kind === 'hold' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
  };
  try {
    run().catch(() => {});
  } catch {
    // Feedback must never break an action
  }
}

/** Plays the sound and / or vibration of an action, according to the user's settings. */
export function giveFeedback(kind: Feedback) {
  const { sounds, haptics } = prefs.get();
  if (haptics) vibrate(kind);
  if (sounds) playSound(kind);
}

/** Wraps a handler so it plays a feedback first (false: no feedback, the action plays its own). */
export function withFeedback<A extends unknown[]>(kind: Feedback | false, handler: (...args: A) => void) {
  return (...args: A) => {
    if (kind) giveFeedback(kind);
    handler(...args);
  };
}
