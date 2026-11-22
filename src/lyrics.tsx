import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Lyrics } from "./api";
import { usePlayer } from "./player";

const cache = new Map<string, Lyrics>();

/**
 * Apple Music style lyrics: the line being sung is large and bright, the others dim; the view follows
 * the song (paused for a few seconds after the user scrolls), and tapping a line seeks there.
 */
export function LyricsView({ songId }: { songId: string }) {
  const p = usePlayer();
  const [lyrics, setLyrics] = useState<Lyrics | null>(cache.get(songId) ?? null);
  const [error, setError] = useState(false);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const userScrollAt = useRef(0);

  useEffect(() => {
    setError(false);
    const hit = cache.get(songId);
    if (hit) return setLyrics(hit);
    setLyrics(null);
    let alive = true;
    api.lyrics(songId).then(
      (l) => {
        cache.set(songId, l);
        if (alive) setLyrics(l);
      },
      () => alive && setError(true),
    );
    return () => {
      alive = false;
    };
  }, [songId]);

  const active = useMemo(() => {
    if (!lyrics?.synced) return -1;
    let i = -1;
    for (let k = 0; k < lyrics.lines.length; k++) {
      if ((lyrics.lines[k].t ?? 0) <= p.time + 0.25) i = k;
      else break;
    }
    return i;
  }, [lyrics, p.time]);

  useEffect(() => {
    if (active < 0 || Date.now() - userScrollAt.current < 3000) return;
    lineRefs.current[active]?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  if (error) return <div className="lyrics-empty">가사를 불러오지 못했어요</div>;
  if (!lyrics) return <div className="lyrics-empty">가사 불러오는 중…</div>;
  if (!lyrics.lines.length) return <div className="lyrics-empty">이 곡은 가사가 없어요</div>;

  return (
    <div
      className={`lyrics ${lyrics.synced ? "synced" : "plain"}`}
      ref={box}
      onTouchMove={() => (userScrollAt.current = Date.now())}
      onWheel={() => (userScrollAt.current = Date.now())}
    >
      <div className="lyrics-pad" />
      {lyrics.lines.map((l, i) => (
        <button
          key={i}
          ref={(el) => {
            lineRefs.current[i] = el;
          }}
          className={`lyric ${i === active ? "on" : ""} ${lyrics.synced && i < active ? "past" : ""}`}
          onClick={() => {
            if (l.t != null) {
              userScrollAt.current = 0;
              p.seek(l.t);
            }
          }}
          disabled={!lyrics.synced}
        >
          {l.text || "♪"}
        </button>
      ))}
      <div className="lyrics-pad" />
      <p className="lyrics-credit">가사 제공: LRCLIB</p>
    </div>
  );
}
