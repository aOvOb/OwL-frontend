import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { coverUrl, streamUrl, type Song } from "./api";

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

const shuffled = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
  const retried = useRef<string | null>(null);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const stateRef = useRef({ queue, index, repeat });
  stateRef.current = { queue, index, repeat };

  if (!audioRef.current && typeof Audio !== "undefined") {
    const a = new Audio();
    a.preload = "auto";
    a.setAttribute("playsinline", "");
    audioRef.current = a;
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

  const next = useCallback(() => {
    const { queue: q, index: i, repeat: r } = stateRef.current;
    if (i + 1 < q.length) go(i + 1);
    else if (r === "all" && q.length) go(0);
    else {
      audioRef.current?.pause();
    }
  }, [go]);

  const prev = useCallback(() => {
    const a = audioRef.current!;
    const { index: i } = stateRef.current;
    if (a.currentTime > 3 || i === 0) a.currentTime = 0;
    else go(i - 1);
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
    // A stream can break while the backend is being redeployed; resume once from the same spot.
    const onError = () => {
      const src = a.currentSrc;
      if (!src || retried.current === src) return;
      retried.current = src;
      const at = a.currentTime;
      setTimeout(() => {
        a.src = src;
        a.currentTime = at;
        a.play().catch(() => {});
      }, 1200);
    };
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
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
        q = shuffled(songs);
        i = 0;
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
      const rest = shuffled(q.filter((_, k) => k !== i));
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
