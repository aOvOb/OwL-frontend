// PC mini player: when the app window on a computer is made narrow, the app turns into a small
// player (like Apple Music's mini player). The window's height picks the look:
//   short   -> a bar: artwork, title, progress and buttons
//   square  -> the artwork, with title and buttons on mouse-over
//   tall    -> artwork on top, the next songs below
// Phones and tablets never switch (no mouse pointer there).
import { useEffect, useState } from "react";
import { coverUrl } from "./api";
import { IconMusic, IconNext, IconPause, IconPlay, IconPrev, IconRepeat, IconShuffle } from "./icons";
import { usePlayer } from "./player";

const MINI_WIDTH = 560;
const DESKTOP = "(hover: hover) and (pointer: fine)";

/** true while this is a computer window narrower than MINI_WIDTH. */
export function useDeskMini() {
  const check = () => window.matchMedia(DESKTOP).matches && window.innerWidth < MINI_WIDTH;
  const [mini, setMini] = useState(check);
  useEffect(() => {
    const on = () => setMini(check());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("desk-mini", mini);
  }, [mini]);
  return mini;
}

// ---------- floating mini player window (Chrome's Document Picture-in-Picture) ----------
// An installed app window cannot be made smaller than the browser's minimum, so the mini player can
// also open in its own small always-on-top window, which can be as small as a bar. The music keeps
// playing in the app window; the small window only shows and controls it.
type DocPip = { requestWindow: (o: { width: number; height: number }) => Promise<Window>; window: Window | null };
const docPip = () => (window as unknown as { documentPictureInPicture?: DocPip }).documentPictureInPicture;

/** Whether this browser can open the floating mini player (computers with Chrome or Edge). */
export const canFloat = () => !!docPip() && window.matchMedia(DESKTOP).matches;

let pipWin: Window | null = null;
const pipListeners = new Set<() => void>();
const setPip = (w: Window | null) => {
  pipWin = w;
  pipListeners.forEach((f) => f());
};

/** Opens the floating mini player (must be called from a click). */
export async function openFloating() {
  const api = docPip();
  if (!api) return;
  if (pipWin) return pipWin.focus();
  const w = await api.requestWindow({ width: 320, height: 120 });
  // The small window starts empty: give it the app's styles (absolute URLs, its own address is about:blank).
  for (const el of document.head.querySelectorAll("style, link[rel=stylesheet]")) {
    if (el instanceof HTMLLinkElement) {
      const l = w.document.createElement("link");
      l.rel = "stylesheet";
      l.href = el.href;
      w.document.head.append(l);
    } else w.document.head.append(el.cloneNode(true));
  }
  w.document.title = "OwL";
  w.document.body.className = "pip-body";
  w.addEventListener("pagehide", () => setPip(null));
  setPip(w);
}

/** The open floating window, or null. */
export function useFloating() {
  const [w, setW] = useState<Window | null>(pipWin);
  useEffect(() => {
    const on = () => setW(pipWin);
    pipListeners.add(on);
    return () => void pipListeners.delete(on);
  }, []);
  return w;
}

const clock = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/** Icon: a small window popping out of a big one. */
export const IconFloat = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="15" rx="2.5" />
    <rect x="11.5" y="11" width="7.5" height="6" rx="1.2" fill="currentColor" stroke="none" />
  </svg>
);

/** Button that opens the floating mini player (shown only where the browser supports it). */
export function FloatButton({ className = "icon-btn" }: { className?: string }) {
  if (!canFloat()) return null;
  return (
    <button
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        openFloating().catch(() => {});
      }}
      aria-label="작은 창으로 띄우기"
      title="작은 창으로 띄우기"
    >
      <IconFloat />
    </button>
  );
}

export function DeskMini({ floating = false }: { floating?: boolean }) {
  const p = usePlayer();
  const s = p.current;
  const art = s ? coverUrl(s.coverArt ?? s.id, 512) : undefined;
  const pct = p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (p.duration) p.seek(((e.clientX - r.left) / r.width) * p.duration);
  };
  const upNext = p.queue.slice(p.index + 1, p.index + 51);

  const meta = (
    <div className="dm-meta">
      <div className="dm-title">{s?.title ?? "재생 중인 곡이 없어요"}</div>
      <div className="dm-artist">{s ? s.artist : "창을 넓히면 곡을 고를 수 있어요"}</div>
    </div>
  );
  const progress = (
    <div className="dm-progress">
      <div className="dm-bar" onClick={seek} role="slider" aria-label="재생 위치" aria-valuemin={0} aria-valuemax={Math.round(p.duration)} aria-valuenow={Math.round(p.time)}>
        <b style={{ width: `${pct}%` }} />
      </div>
      <div className="dm-times">
        <span>{clock(p.time)}</span>
        <span>-{clock(p.duration - p.time)}</span>
      </div>
    </div>
  );
  const controls = (
    <div className="dm-ctrls">
      <button className={`dm-sm ${p.shuffle ? "on" : ""}`} onClick={() => p.setShuffle(!p.shuffle)} aria-label="셔플" aria-pressed={p.shuffle}>
        <IconShuffle size={14} />
      </button>
      <button onClick={p.prev} aria-label="이전 곡" disabled={!s}>
        <IconPrev size={24} />
      </button>
      <button className="dm-play" onClick={p.toggle} aria-label={p.playing ? "일시정지" : "재생"} disabled={!s}>
        {p.playing ? <IconPause size={30} /> : <IconPlay size={30} />}
      </button>
      <button onClick={p.next} aria-label="다음 곡" disabled={!s}>
        <IconNext size={24} />
      </button>
      <button className={`dm-sm ${p.repeat !== "off" ? "on" : ""}`} onClick={p.cycleRepeat} aria-label={`반복 ${p.repeat === "one" ? "한 곡" : p.repeat === "all" ? "전체" : "끔"}`}>
        <IconRepeat size={14} />
        {p.repeat === "one" && <i className="dm-one">1</i>}
      </button>
    </div>
  );
  const artwork = art ? <img className="dm-art" src={art} alt="" /> : <div className="dm-art dm-empty"><IconMusic size={48} /></div>;

  return (
    <div className="desk-mini-root">
      {!floating && <FloatButton className="dm-float" />}
      {/* short window: bar */}
      <div className="dm-mode dm-bar-mode">
        {art && <img className="dm-bg" src={art} alt="" aria-hidden />}
        <div className="dm-bar-in">
          <div className="dm-top">
            {art ? <img className="dm-thumb" src={art} alt="" /> : <div className="dm-thumb dm-empty" />}
            {meta}
          </div>
          {progress}
          {controls}
        </div>
      </div>

      {/* square window: artwork, controls on mouse-over */}
      <div className="dm-mode dm-art-mode">
        {artwork}
        <div className="dm-over">
          {meta}
          {progress}
          {controls}
        </div>
      </div>

      {/* tall window: artwork on top, next songs below */}
      <div className="dm-mode dm-queue-mode">
        <div className="dm-head">
          {artwork}
          <div className="dm-head-over">
            {meta}
            {progress}
            {controls}
          </div>
        </div>
        <div className="dm-list">
          <div className="dm-cap">다음 곡</div>
          {upNext.length === 0 && <p className="dm-none">다음 곡이 없어요</p>}
          {upNext.map((x, i) => (
            <button key={`${x.id}-${i}`} className="dm-row" onClick={() => p.jumpTo(p.index + 1 + i)}>
              <img src={coverUrl(x.coverArt ?? x.id, 120)} alt="" loading="lazy" />
              <span className="dm-row-text">
                <span className="dm-row-title">{x.title}</span>
                <span className="dm-row-sub">{x.artist}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
