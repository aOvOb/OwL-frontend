/**
 * Reloading into a new app version stops the music, so it waits while a song is playing: it happens
 * once playback has been paused for a few seconds (not in the short gap between two songs).
 */
let audio: HTMLAudioElement | null = null;
let waiting = false;

export const setReloadAudio = (a: HTMLAudioElement) => {
  audio = a;
};

export function reloadWhenIdle() {
  const a = audio;
  if (!a || a.paused) return location.reload();
  if (waiting) return;
  waiting = true;
  a.addEventListener("pause", () => setTimeout(() => a.paused && location.reload(), 3000));
}
