import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settings-store';

/**
 * Haptic + sound feedback, honouring the player's settings.
 * Every call is fire-and-forget and never throws into gameplay code.
 */

type SoundName = 'correct' | 'incorrect' | 'milestone';

const SOURCES: Record<SoundName, number> = {
  correct: require('../../assets/sounds/correct.wav'),
  incorrect: require('../../assets/sounds/incorrect.wav'),
  milestone: require('../../assets/sounds/milestone.wav'),
};

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let audioConfigured = false;

function hapticsOn() {
  return Platform.OS !== 'web' && useSettingsStore.getState().hapticsEnabled;
}

function soundOn() {
  return useSettingsStore.getState().soundEnabled;
}

function safe(promise: Promise<unknown> | void) {
  if (promise && typeof (promise as Promise<unknown>).catch === 'function') {
    (promise as Promise<unknown>).catch(() => undefined);
  }
}

function getPlayer(name: SoundName): AudioPlayer | null {
  try {
    if (!audioConfigured) {
      audioConfigured = true;
      // Respect the silent switch and mix with the player's own music.
      safe(setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }));
    }
    players[name] ??= createAudioPlayer(SOURCES[name]);
    return players[name] ?? null;
  } catch {
    return null;
  }
}

function play(name: SoundName) {
  if (!soundOn()) return;
  const player = getPlayer(name);
  if (!player) return;
  try {
    player.volume = 0.6;
    safe(player.seekTo(0));
    player.play();
  } catch {
    // Audio is optional.
  }
}

export const feedback = {
  /** Card crossed the commit threshold while dragging. */
  thresholdTick() {
    if (hapticsOn()) safe(Haptics.selectionAsync());
  },
  tap() {
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  correct() {
    if (hapticsOn()) safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    play('correct');
  },
  incorrect() {
    if (hapticsOn()) safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    play('incorrect');
  },
  milestone() {
    if (hapticsOn()) safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    play('milestone');
  },
  /** Preload sounds so the first answer has no delay. */
  warmUp() {
    if (!soundOn()) return;
    (Object.keys(SOURCES) as SoundName[]).forEach(getPlayer);
  },
};
