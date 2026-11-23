// Songs saved on this device for offline listening.
//
// Files come from our own server (never from YouTube): the audio, a few cover sizes and the lyrics are
// stored in Cache Storage under the same URLs the app already uses, and the service worker (src/sw.ts)
// answers those URLs from the device. The list of saved songs lives in the same cache as a JSON entry,
// so the files and the list are always cleared together.
//
// Songs not on the server yet are queued for a server download first ("pending") and saved to the
// device once the server has them (checked when the app opens and every few minutes).
import { useSyncExternalStore } from "react";
import { api, coverUrl, streamUrl, type ItemInput, type Song } from "./api";

const CACHE = "owl-offline";
const INDEX_URL = "/__owl/offline-index.json";
const COVER_SIZES = [120, 300, 512, 900]; // rows, cards, lock screen, now playing
const PARALLEL = 2;

export type SavedSong = { song: Song; size: number; savedAt: number };
export type PendingSong = ItemInput & { requestedAt: number };
type Index = { songs: Record<string, SavedSong>; pending: Record<string, PendingSong> };

let index: Index = { songs: {}, pending: {} };
let queue: Song[] = []; // waiting to be saved
const active = new Set<string>(); // being saved right now
let failed = 0;
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  listeners.forEach((f) => f());
};

const supported = typeof caches !== "undefined";

const ready: Promise<void> = (async () => {
  if (!supported) return;
  try {
    const res = await (await caches.open(CACHE)).match(INDEX_URL);
    if (res) index = { songs: {}, pending: {}, ...(await res.json()) };
  } catch {
    // unreadable list: start empty (files are rewritten when saved again)
  }
  changed();
})();

async function writeIndex() {
  const c = await caches.open(CACHE);
  await c.put(INDEX_URL, new Response(JSON.stringify(index), { headers: { "Content-Type": "application/json" } }));
}

// ---------- reading ----------

export const isSaved = (id?: string | null) => !!id && !!index.songs[id];
export const savedSongs = () => Object.values(index.songs);

export type OfflineView = {
  songs: SavedSong[];
  pending: PendingSong[];
  saving: { left: number; active: number; failed: number };
  has: (id?: string | null) => boolean;
  queued: (id?: string | null) => boolean;
};

let snapshot: { version: number; view: OfflineView } | null = null;
const view = (): OfflineView => {
  if (snapshot?.version === version) return snapshot.view;
  const queuedIds = new Set([...queue.map((s) => s.id), ...active]);
  const v: OfflineView = {
    songs: Object.values(index.songs),
    pending: Object.values(index.pending),
    saving: { left: queue.length + active.size, active: active.size, failed },
    has: isSaved,
    queued: (id) => !!id && queuedIds.has(id),
  };
  snapshot = { version, view: v };
  return v;
};

/** Re-renders when saved songs or the saving progress change. */
export function useOffline(): OfflineView {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    view,
    view,
  );
}

// ---------- saving ----------

/** Saves library songs to this device. Returns how many were newly queued. */
export async function saveSongs(songs: Song[]): Promise<number> {
  if (!supported) throw new Error("이 브라우저는 기기 저장을 지원하지 않아요");
  await ready;
  // Ask the browser to keep these files when space runs low (granted for installed apps).
  navigator.storage?.persist?.().catch(() => {});
  const busy = new Set([...queue.map((s) => s.id), ...active]);
  const fresh = songs.filter((s, i, all) => s.id && !index.songs[s.id] && !busy.has(s.id) && all.findIndex((x) => x.id === s.id) === i);
  queue.push(...fresh);
  failed = 0;
  changed();
  pump();
  return fresh.length;
}

function pump() {
  while (active.size < PARALLEL && queue.length) {
    const song = queue.shift()!;
    active.add(song.id);
    changed();
    saveOne(song)
      .catch(() => {
        failed++;
      })
      .finally(() => {
        active.delete(song.id);
        changed();
        pump();
      });
  }
}

async function saveOne(song: Song) {
  const c = await caches.open(CACHE);
  const res = await fetch(streamUrl(song.id), { credentials: "same-origin" });
  if (res.status === 401) window.dispatchEvent(new Event("owl:unauthorized"));
  if (!res.ok) throw new Error(`stream ${res.status}`);
  const blob = await res.blob();
  await c.put(
    streamUrl(song.id),
    new Response(blob, { headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mp4", "Content-Length": String(blob.size) } }),
  );
  // Covers and lyrics are nice to have: a failure here does not fail the song.
  const cover = song.coverArt ?? song.id;
  await Promise.all([
    ...COVER_SIZES.map((size) => copy(c, coverUrl(cover, size)!)),
    copy(c, `/api/lyrics/${encodeURIComponent(song.id)}`),
  ]);
  index.songs[song.id] = { song, size: blob.size, savedAt: Date.now() };
  await writeIndex();
}

async function copy(c: Cache, url: string) {
  try {
    const r = await fetch(url, { credentials: "same-origin" });
    if (r.ok) await c.put(url, r);
  } catch {
    /* skipped */
  }
}

// ---------- songs not on the server yet ----------

/**
 * Saves playlist or chart items: the ones on the server right away, the rest after the server has
 * downloaded them. Returns counts for the message shown to the user.
 */
export async function saveItems(items: ItemInput[]): Promise<{ now: number; later: number }> {
  await ready;
  const onServer = items.filter((i) => i.songId).map(itemSong);
  const notYet = items.filter((i) => !i.songId && i.videoId && !index.pending[i.videoId]);
  if (notYet.length) {
    await api.downloadMany(notYet);
    for (const i of notYet) index.pending[i.videoId!] = { ...i, requestedAt: Date.now() };
    await writeIndex();
    changed();
  }
  return { now: await saveSongs(onServer), later: notYet.length };
}

const itemSong = (i: ItemInput): Song => ({
  id: i.songId!,
  title: i.title,
  artist: i.artist,
  album: i.album ?? undefined,
  coverArt: i.songId!,
  duration: i.duration ?? undefined,
});

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^0-9a-z가-힣ぁ-んァ-ン一-龥]/g, "");

/** Looks for pending songs in the server library and saves the ones that arrived. */
export async function checkPending() {
  await ready;
  const list = Object.values(index.pending);
  if (!list.length || !navigator.onLine) return;
  const found: Song[] = [];
  for (const p of list) {
    try {
      const r = await api.search(`${p.artist} ${p.title}`);
      const t = norm(p.title);
      const a = norm(p.artist);
      const hit = r.song.find((s) => norm(s.title) === t && (!a || norm(s.artist).includes(a) || a.includes(norm(s.artist))));
      if (hit) {
        found.push(hit);
        delete index.pending[p.videoId!];
      } else if (Date.now() - p.requestedAt > 14 * 86400_000) {
        delete index.pending[p.videoId!]; // two weeks without arriving: the server queue gave up on it
      }
    } catch {
      return; // offline or logged out: try again later
    }
  }
  await writeIndex();
  changed();
  if (found.length) await saveSongs(found);
}

export async function cancelPending(videoId: string) {
  await ready;
  delete index.pending[videoId];
  await writeIndex();
  changed();
}

// ---------- removing ----------

export async function removeSongs(ids: string[]) {
  await ready;
  const c = await caches.open(CACHE);
  queue = queue.filter((s) => !ids.includes(s.id));
  for (const id of ids) {
    const s = index.songs[id];
    await c.delete(streamUrl(id));
    await c.delete(`/api/lyrics/${encodeURIComponent(id)}`);
    const cover = s?.song.coverArt ?? id;
    // Covers can be shared by songs of one album: keep them while another saved song uses them.
    delete index.songs[id];
    if (!Object.values(index.songs).some((o) => (o.song.coverArt ?? o.song.id) === cover)) {
      await Promise.all(COVER_SIZES.map((size) => c.delete(coverUrl(cover, size)!)));
    }
  }
  await writeIndex();
  changed();
}

export async function removeAll() {
  queue = [];
  index = { songs: {}, pending: {} };
  await caches.delete(CACHE);
  changed();
}

/** Bytes used by saved songs, and what the browser allows this app in total. */
export async function storageUse() {
  const songs = Object.values(index.songs).reduce((n, s) => n + s.size, 0);
  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  return { songs, quota: est?.quota ?? null, persisted: (await navigator.storage?.persisted?.().catch(() => false)) ?? false };
}

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)}GB` : n >= 1024 ** 2 ? `${Math.round(n / 1024 ** 2)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`;

// ---------- connection ----------

/** true while the device has a network connection. */
export function useOnline() {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener("online", f);
      window.addEventListener("offline", f);
      return () => {
        window.removeEventListener("online", f);
        window.removeEventListener("offline", f);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/** Whether a song can play right now: always online, only saved songs offline. */
export const canPlayNow = (id: string) => navigator.onLine || isSaved(id);

// Pending songs: check when the app opens, comes back to the screen, and every 5 minutes.
if (supported) {
  ready.then(() => checkPending());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkPending());
  window.addEventListener("online", () => checkPending());
  setInterval(checkPending, 5 * 60 * 1000);
}
