import type { Song } from "./api";

/** The main artist of a song ("IVE, Foo" and "IVE feat. Foo" both count as IVE). */
export const artistKey = (s: Song) =>
  (s.artist ?? "").split(/\s*(?:,|\/|&|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)[0].trim().toLowerCase() || `#${s.id}`;

const shuffled = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Shuffle that keeps one artist's songs apart. Each artist's songs (in random order) are spread
 * evenly over the list from a random starting point, then the lists are merged by position; any
 * two neighbours still by the same artist are split by swapping in a later song.
 * `avoid` is an artist that should not come first (the one that just played).
 */
export function balancedShuffle(songs: Song[], avoid?: string): Song[] {
  const groups = new Map<string, Song[]>();
  for (const s of songs) {
    const k = artistKey(s);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const placed: { pos: number; song: Song }[] = [];
  for (const g of groups.values()) {
    const m = g.length;
    const start = Math.random() / m;
    shuffled(g).forEach((song, j) => placed.push({ pos: start + j / m + (Math.random() - 0.5) * (0.2 / m), song }));
  }
  const out = shuffled(placed) // random order among equal positions
    .sort((a, b) => a.pos - b.pos)
    .map((p) => p.song);

  const differs = (i: number, k: string) => artistKey(out[i]) !== k;
  // Bring in the next song not by artist k (the song moved back is checked again when the loop gets there).
  const swapIn = (i: number, k: string) => {
    for (let j = i + 1; j < out.length; j++)
      if (differs(j, k)) {
        [out[i], out[j]] = [out[j], out[i]];
        return;
      }
  };
  if (avoid && out.length > 1 && !differs(0, avoid)) swapIn(0, avoid);
  for (let i = 1; i < out.length; i++) if (!differs(i, artistKey(out[i - 1]))) swapIn(i, artistKey(out[i - 1]));
  return out;
}
