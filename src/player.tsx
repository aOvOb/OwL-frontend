import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { coverUrl, streamUrl, type Song } from "./api";
import { canPlayNow } from "./offline";
import { setReloadAudio } from "./reload";
import { artistKey, balancedShuffle } from "./shuffle";

type Repeat = "off" | "all" | "one";

type PlayerState = {
  queue: Song[];
  index: number;
  current: Song | null;
  playing: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  repeat: Repeat;
  playList: (songs: Song[], start?: number, opts?: { shuffle?: boolean }) => void;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  jumpTo: (index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
};

const Ctx = createContext<PlayerState | null>(null);

export const usePlayer = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("PlayerProvider missing");
  return v;
};

/**
 * One <audio> element for the whole app. On iOS, keeping a single element and swapping its src
 * on "ended" is what keeps playback going in the background and on the lock screen.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffleState] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");
  const original = useRef<Song[]>([]); // queue order before shuffle
  // Reconnects for the current song (a backend redeploy can cut a stream): src, attempts, position then.
  const retried = useRef<{ src: string; n: number; at: number } | null>(null);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const stateRef = useRef({ queue, index, repeat, shuffle });
  stateRef.current = { queue, index, repeat, shuffle };

  if (!audioRef.current && typeof Audio !== "undefined") {
    const a = new Audio();
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    audioRef.current = a;
    setReloadAudio(a);
  }

  const load = useCallback((song: Song, autoplay = true) => {
    const a = audioRef.current!;
    a.src = streamUrl(song.id);
    a.currentTime = 0;
    setTime(0);
    setDuration(song.duration ?? 0);
    if (autoplay) a.play().catch(() => setPlaying(false));
  }, []);

  const go = useCallback(
    (i: number, autoplay = true) => {
      const { queue: q } = stateRef.current;
      if (i < 0 || i >= q.length) return;
      setIndex(i);
      load(q[i], autoplay);
    },
    [load],
  );

  // Offline, only songs saved on the device can play: skip over the others.
  const nextPlayable = (q: Song[], from: number, step: 1 | -1) => {
    for (let k = from; k >= 0 && k < q.length; k += step) if (canPlayNow(q[k].id)) return k;
    return -1;
  };

  const next = useCallback(() => {
    const { queue: q, index: i, repeat: r, shuffle: sh } = stateRef.current;
    let k = nextPlayable(q, i + 1, 1);
    if (k < 0 && r === "all") {
      // Shuffle on: each new round is shuffled again, not the same order once more.
      if (sh && q.length > 1) {
        const nq = balancedShuffle(q, q[i] ? artistKey(q[i]) : undefined);
        setQueue(nq);
        stateRef.current = { ...stateRef.current, queue: nq };
        k = nextPlayable(nq, 0, 1);
      } else k = nextPlayable(q, 0, 1);
    }
    if (k >= 0) go(k);
    else audioRef.current?.pause();
  }, [go]);

  const prev = useCallback(() => {
    const a = audioRef.current!;
    const { queue: q, index: i } = stateRef.current;
    const k = nextPlayable(q, i - 1, -1);
    if (a.currentTime > 3 || k < 0) a.currentTime = 0;
    else go(k);
  }, [go]);

  // audio element events
  useEffect(() => {
    const a = audioRef.current!;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setTime(a.currentTime);
    const onMeta = () => isFinite(a.duration) && setDuration(a.duration);
    const onEnded = () => {
      if (stateRef.current.repeat === "one") {
        a.currentTime = 0;
        a.play().catch(() => {});
      } else next();
    };
    // A stream can break while the backend is being redeployed. Some browsers report an error, others
    // just stall: either way load the song again from the same spot, up to 3 times (reset once it plays on).
    const resume = () => {
      const src = a.currentSrc;
      if (!src) return;
      const r = retried.current?.src === src ? retried.current : { src, n: 0, at: 0 };
      if (r.n >= 3) return;
      const at = a.currentTime;
      retried.current = { src, n: r.n + 1, at };
      setTimeout(() => {
        if (a.currentSrc !== src && a.src !== src) return; // another song started meanwhile
        a.src = src;
        a.currentTime = at;
        a.play().catch(() => {});
      }, 1000 * (r.n + 1));
    };
    const onError = () => resume();
    let stall: ReturnType<typeof setTimeout> | undefined;
    const onWaiting = () => {
      clearTimeout(stall);
      const at = a.currentTime;
      stall = setTimeout(() => !a.paused && a.currentTime === at && resume(), 8000);
    };
    const onProgress = () => {
      clearTimeout(stall);
      const r = retried.current;
      if (r && a.currentTime > r.at + 10) retried.current = null;
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("stalled", onWaiting);
    a.addEventListener("playing", onProgress);
    a.addEventListener("timeupdate", onProgress);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("stalled", onWaiting);
      a.removeEventListener("playing", onProgress);
      a.removeEventListener("timeupdate", onProgress);
      clearTimeout(stall);
    };
  }, [next]);

  // Lock screen / control center
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (current) {
      const art = coverUrl(current.coverArt ?? current.id, 512);
      ms.metadata = new MediaMetadata({
        title: current.title ?? "",
        artist: current.artist ?? "",
        album: current.album ?? "",
        artwork: art ? [{ src: new URL(art, location.origin).href, sizes: "512x512" }] : [],
      });
    }
    const a = audioRef.current!;
    ms.setActionHandler("play", () => a.play());
    ms.setActionHandler("pause", () => a.pause());
    ms.setActionHandler("nexttrack", () => next());
    ms.setActionHandler("previoustrack", () => prev());
    ms.setActionHandler("seekto", (d) => {
      if (d.seekTime != null) a.currentTime = d.seekTime;
    });
  }, [current, next, prev]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration || !isFinite(duration)) return;
    try {
      navigator.mediaSession.setPositionState({ duration, position: Math.min(time, duration), playbackRate: 1 });
    } catch {
      /* some browsers reject while loading */
    }
  }, [time, duration]);

  const playList = useCallback(
    (songs: Song[], start = 0, opts?: { shuffle?: boolean }) => {
      if (!songs.length) return;
      original.current = songs;
      let q = songs;
      let i = start;
      const sh = opts?.shuffle ?? false;
      if (sh) {
        q = balancedShuffle(songs);
        i = 0;
      }
      if (!canPlayNow(q[i].id)) {
        const k = nextPlayable(q, i, 1);
        if (k < 0) return window.dispatchEvent(new CustomEvent("owl:toast", { detail: "오프라인이라 기기에 저장한 곡만 재생할 수 있어요" }));
        i = k;
      }
      setShuffleState(sh);
      setQueue(q);
      stateRef.current = { ...stateRef.current, queue: q };
      retried.current = null;
      setIndex(i);
      load(q[i]);
    },
    [load],
  );

  const setShuffle = useCallback((on: boolean) => {
    const { queue: q, index: i } = stateRef.current;
    const cur = q[i];
    if (!cur) return setShuffleState(on);
    if (on) {
      original.current = q;
      const rest = balancedShuffle(q.filter((_, k) => k !== i), artistKey(cur));
      const nq = [cur, ...rest];
      setQueue(nq);
      setIndex(0);
    } else {
      const base = original.current.length ? original.current : q;
      setQueue(base);
      setIndex(Math.max(0, base.findIndex((s) => s.id === cur.id)));
    }
    setShuffleState(on);
  }, []);

  const value = useMemo<PlayerState>(
    () => ({
      queue,
      index,
      current,
      playing,
      time,
      duration,
      shuffle,
      repeat,
      playList,
      playNext: (song) => {
        const { queue: q, index: i } = stateRef.current;
        if (!q.length) return playList([song]);
        setQueue([...q.slice(0, i + 1), song, ...q.slice(i + 1)]);
      },
      addToQueue: (song) => {
        const { queue: q } = stateRef.current;
        if (!q.length) return playList([song]);
        setQueue([...q, song]);
      },
      jumpTo: (i) => go(i),
      toggle: () => {
        const a = audioRef.current!;
        if (!current) return;
        if (a.paused) a.play().catch(() => {});
        else a.pause();
      },
      next,
      prev,
      seek: (sec) => {
        const a = audioRef.current!;
        a.currentTime = sec;
        setTime(sec);
      },
      setShuffle,
      cycleRepeat: () => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off")),
    }),
    [queue, index, current, playing, time, duration, shuffle, repeat, playList, go, next, prev, setShuffle],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
