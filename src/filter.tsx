import { api } from "./api";
import { IconSearch } from "./icons";

// ---------- other names of the same artist ----------
// The same artist is stored as "샤이니" in one place and "SHINee" in another, so searching one name also
// searches the other. Pairs are learned from the library ("SHINee (샤이니)": both names in one) and
// from charts (Melon's "빅뱅" next to YouTube Music's "BIGBANG"), cached on the device for a day.

const n = (s: string) => s.toLowerCase().replace(/\s+/g, "");
const SEED: [string, string][] = [
  ["샤이니", "SHINee"],
  ["빅뱅", "BIGBANG"],
];
const CACHE_KEY = "owl.aliases.v1";
const DAY = 86400_000;

let pairs: [string, string][] = SEED.map(([a, b]) => [n(a), n(b)]);

function remember(list: [string, string][]) {
  const seen = new Set(pairs.map(([a, b]) => `${a}\u0000${b}`));
  for (const [x, y] of list) {
    const a = n(x);
    const b = n(y);
    if (a && b && a !== b && !seen.has(`${a}\u0000${b}`)) {
      pairs.push([a, b]);
      seen.add(`${a}\u0000${b}`);
    }
  }
}

/** "SHINee (샤이니)" -> ["SHINee", "샤이니"] */
const split = (name: string): [string, string] | null => {
  const m = name.match(/^(.+?)\s*[(（](.+?)[)）]\s*$/);
  return m ? [m[1], m[2]] : null;
};

try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as { at: number; pairs: [string, string][] } | null;
  if (saved?.pairs) remember(saved.pairs);
} catch {
  /* no storage */
}

let loading: Promise<boolean> | null = null;

/** Refreshes the name pairs at most once a day. Resolves true when new pairs were learned. */
export function refreshAliases(): Promise<boolean> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || "null") as { at: number } | null;
      if (saved && Date.now() - saved.at < DAY) return false;
    } catch {
      /* no storage: fetch */
    }
    const before = pairs.length;
    try {
      const [artists, charts] = await Promise.all([api.artists(), api.charts()]);
      const found: [string, string][] = [];
      for (const a of artists) {
        const p = a.name ? split(a.name) : null;
        if (p) found.push(p);
      }
      for (const c of charts)
        for (const e of c.entries)
          if (e.ytArtist && e.artist && n(e.ytArtist) !== n(e.artist) && !/[,&]/.test(e.artist + e.ytArtist)) found.push([e.artist, e.ytArtist]);
      remember(found);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), pairs }));
      } catch {
        /* no storage */
      }
    } catch {
      /* offline: keep what we have */
    }
    return pairs.length > before;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

/** The query plus the other names of an artist it names (or starts to name, from 2 letters). */
function expand(want: string) {
  const out = new Set([want]);
  const hit = (name: string) => name === want || (want.length >= 2 && name.startsWith(want));
  for (const [a, b] of pairs) {
    if (hit(a)) out.add(b);
    if (hit(b)) out.add(a);
  }
  return [...out];
}

/** Case- and space-insensitive "contains" over a few fields (title, artist, album...), artist aliases included. */
export function matches(q: string, ...fields: (string | null | undefined)[]) {
  const want = n(q);
  if (!want) return true;
  const wants = expand(want);
  return fields.some((f) => {
    if (!f) return false;
    const v = n(f);
    return wants.some((w) => v.includes(w));
  });
}

/** Filter box for a list already on screen (Library tabs). */
export function FilterBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <form className="searchbar" onSubmit={(e) => (e.preventDefault(), (document.activeElement as HTMLElement | null)?.blur())}>
      <IconSearch size={18} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} enterKeyHint="search" type="search" />
    </form>
  );
}
