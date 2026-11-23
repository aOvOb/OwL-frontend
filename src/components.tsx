import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { api, coverUrl, formatTime, songToItem, ytToItem, ytToSong, type ItemInput, type Song, type YtSong } from "./api";
import { LyricsView } from "./lyrics";
import { removeSongs, saveItems, saveSongs, useOffline, useOnline, type OfflineView } from "./offline";
import { useSheets, type Action } from "./sheets";
import {
  IconBack,
  IconCheck,
  IconChart,
  IconDown,
  IconDownload,
  IconHome,
  IconLibrary,
  IconList,
  IconLyrics,
  IconMore,
  IconMusic,
  IconNext,
  IconPause,
  IconPlay,
  IconPrev,
  IconRepeat,
  IconSaved,
  IconSearch,
  IconShuffle,
} from "./icons";
import { usePlayer } from "./player";

// ---------- data loading ----------

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message ?? "불러오지 못했습니다"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, reload: useCallback(() => setTick((t) => t + 1), []) };
}

// ---------- toast ----------

let pushToast: (msg: string) => void = () => {};
export const toast = (msg: string) => pushToast(msg);

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number>(0);
  pushToast = (m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2400);
  };
  // Code outside React (e.g. the player) can show a message too.
  useEffect(() => {
    const on = (e: Event) => pushToast(String((e as CustomEvent).detail ?? ""));
    window.addEventListener("owl:toast", on);
    return () => window.removeEventListener("owl:toast", on);
  }, []);
  return <div className={`toast ${msg ? "show" : ""}`}>{msg}</div>;
}

// ---------- basics ----------

export function Cover({ id, src, size = 300, className = "", rounded = "md" }: {
  id?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
  rounded?: "sm" | "md" | "lg" | "full";
}) {
  const [failed, setFailed] = useState(false);
  const url = src ?? coverUrl(id, size);
  return (
    <div className={`cover r-${rounded} ${className}`}>
      {url && !failed ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <div className="cover-empty">
          <IconMusic size={28} />
        </div>
      )}
    </div>
  );
}

export function Page({ title, back, right, children, large = true }: {
  title?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  large?: boolean;
}) {
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="page">
      {/* Large-title screens: the bar scrolls away with the page. Detail pages: it stays, with a title. */}
      <header className={`topbar ${large ? "static" : "solid"} ${scrolled && !large ? "scrolled" : ""}`}>
        <div className="topbar-side">
          {back && (
            <button className="icon-btn accent" onClick={() => nav(-1)} aria-label="뒤로">
              <IconBack size={26} />
            </button>
          )}
        </div>
        {/* No title in the bar (Apple Music style): pages show it large, detail pages under the artwork. */}
        <div className="topbar-title" />
        <div className="topbar-side right">{right}</div>
      </header>
      {large && title && <h1 className="large-title">{title}</h1>}
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading">
      <span />
      <span />
      <span />
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box">
      <p>{message}</p>
      {onRetry && (
        <button className="pill" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ---------- song rows ----------

function Equalizer() {
  return (
    <span className="eq" aria-label="재생 중">
      <i />
      <i />
      <i />
    </span>
  );
}

function MoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="icon-btn more"
      aria-label="더 보기"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <IconMore size={20} />
    </button>
  );
}

/** A library song. Tapping plays `list` starting at this song. */
export function SongRow({ song, list, index, showCover = true, number, extraActions = [] }: {
  song: Song;
  list: Song[];
  index: number;
  showCover?: boolean;
  number?: number;
  extraActions?: Action[];
}) {
  const p = usePlayer();
  const sheets = useSheets();
  const off = useOffline();
  const online = useOnline();
  const active = p.current?.id === song.id;
  const menu = () =>
    sheets.actions(song.title ?? "", song.artist, [
      { label: "다음에 재생", run: () => (p.playNext(song), toast("다음에 재생해요")) },
      { label: "대기열 맨 뒤에 추가", run: () => (p.addToQueue(song), toast("대기열에 추가했어요")) },
      { label: "재생목록에 추가", run: () => sheets.addTo([songToItem(song)]) },
      deviceAction(off, song),
      ...extraActions,
    ]);
  return (
    <div
      className={`row ${active ? "active" : ""} ${!online && !off.has(song.id) ? "dim" : ""}`}
      onClick={() => p.playList(list, index)}
      role="button"
    >
      {showCover ? (
        <div className="row-cover">
          <Cover id={song.coverArt ?? song.id} size={120} rounded="sm" />
          {active && p.playing && (
            <div className="row-cover-eq">
              <Equalizer />
            </div>
          )}
        </div>
      ) : (
        <div className="row-num">{active && p.playing ? <Equalizer /> : number}</div>
      )}
      <div className="row-text">
        <div className="row-title">{song.title}</div>
        <div className="row-sub">
          <SavedMark id={song.id} />
          {song.artist}
        </div>
      </div>
      <div className="row-meta">{formatTime(song.duration)}</div>
      <MoreButton onClick={menu} />
    </div>
  );
}

/** Small mark before the artist name: saved on this device, or being saved. */
export function SavedMark({ id }: { id?: string | null }) {
  const off = useOffline();
  if (off.has(id))
    return (
      <span className="saved-mark" aria-label="기기에 저장됨">
        <IconSaved size={13} />
      </span>
    );
  if (off.queued(id)) return <span className="saved-mark spinner tiny" aria-label="기기에 저장 중" />;
  return null;
}

/** "기기에 저장" / "기기에서 삭제" menu item for one library song. */
export function deviceAction(off: OfflineView, song: Song): Action {
  return off.has(song.id)
    ? { label: "기기에서 삭제", run: async () => (await removeSongs([song.id]), toast("기기에서 삭제했어요")) }
    : {
        label: "기기에 저장",
        run: async () => {
          try {
            await saveSongs([song]);
            toast("기기에 저장하는 중이에요");
          } catch (e) {
            toast((e as Error).message);
          }
        },
      };
}

/**
 * Album/playlist button: "기기에 저장" -> "저장 중 (n/m)" -> "기기에 저장됨" (tap to delete from the device).
 * `items` may include songs not on the server yet; they are downloaded there first.
 */
export function DeviceSaveButton({ items, name }: { items: ItemInput[]; name: string }) {
  const off = useOffline();
  const sheets = useSheets();
  const ids = items.map((i) => i.songId).filter((x): x is string => !!x);
  if (!items.length) return null;
  const savedN = ids.filter((id) => off.has(id)).length;
  const savingN = ids.filter((id) => off.queued(id)).length;
  const waiting = items.filter((i) => !i.songId && i.videoId && off.pending.some((p) => p.videoId === i.videoId)).length;
  const all = savedN === items.length;
  if (all)
    return (
      <button
        className="pill big ghost wide"
        onClick={() =>
          sheets.actions(`"${name}"을(를) 기기에서 삭제할까요?`, `${savedN}곡의 파일이 이 기기에서 지워져요`, [
            { label: "기기에서 삭제", danger: true, run: async () => (await removeSongs(ids), toast("기기에서 삭제했어요")) },
          ])
        }
      >
        <IconSaved size={18} /> 기기에 저장됨
      </button>
    );
  return (
    <button className="pill big ghost wide" disabled={savingN > 0} onClick={() => saveToDevice(items)}>
      {savingN > 0 ? (
        <>
          <span className="spinner tiny" /> 기기에 저장 중 ({savedN}/{items.length})
        </>
      ) : (
        <>
          <IconDownload size={18} /> 기기에 저장{savedN || waiting ? ` (${savedN}/${items.length}${waiting ? `, 서버 대기 ${waiting}` : ""})` : ""}
        </>
      )}
    </button>
  );
}

/** Saves library songs, or playlist/chart items (those not on the server are downloaded there first). */
export async function saveToDevice(items: ItemInput[]) {
  try {
    const { now, later } = await saveItems(items);
    if (!now && !later) toast("이미 기기에 저장돼 있어요");
    else if (!later) toast(`${now}곡을 기기에 저장하는 중이에요`);
    else toast(`${now}곡 저장 시작, ${later}곡은 서버에 받은 뒤 저장돼요`);
  } catch (e) {
    toast((e as Error).message);
  }
}

/**
 * A YouTube Music song from a chart or search: plays if it is in the library,
 * otherwise offers a download button (and shows progress while Yubal works on it).
 */
export function YtRow({ item, playable, onDownloaded, extraActions = [] }: {
  item: YtSong;
  playable: Song[];
  onDownloaded?: (videoId: string) => void;
  extraActions?: Action[];
}) {
  const p = usePlayer();
  const sheets = useSheets();
  const off = useOffline();
  const online = useOnline();
  const song = ytToSong(item);
  const [requested, setRequested] = useState(false);
  const active = !!song && p.current?.id === song.id;
  const unplayable = !song || (!online && !off.has(song.id));
  const downloading = !song && (item.downloading || requested);

  const play = () => {
    if (!song) return;
    const i = playable.findIndex((s) => s.id === song.id);
    p.playList(playable, Math.max(0, i));
  };
  const download = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!item.videoId) return;
    setRequested(true);
    try {
      await api.download(ytToItem(item));
      toast("다운로드 대기열에 넣었어요");
      onDownloaded?.(item.videoId);
    } catch (err) {
      setRequested(false);
      toast((err as Error).message);
    }
  };

  return (
    <div className={`row ${active ? "active" : ""} ${unplayable ? "dim" : ""}`} onClick={play} role="button">
      {item.rank != null && <div className="row-rank">{item.rank}</div>}
      <div className="row-cover">
        <Cover id={song ? song.id : null} src={song ? undefined : item.thumbnail} size={120} rounded="sm" />
        {active && p.playing && (
          <div className="row-cover-eq">
            <Equalizer />
          </div>
        )}
      </div>
      <div className="row-text">
        <div className="row-title">{item.title}</div>
        <div className="row-sub">
          <SavedMark id={song?.id} />
          {item.artist}
        </div>
      </div>
      <div className="row-action">
        {song ? (
          <span className="have" aria-label="보관함에 있음">
            <IconCheck size={18} />
          </span>
        ) : downloading ? (
          <span className="spinner" aria-label="다운로드 중" />
        ) : item.videoId ? (
          <button className="icon-btn accent" onClick={download} aria-label="다운로드">
            <IconDownload size={26} />
          </button>
        ) : null}
      </div>
      <MoreButton
        onClick={() =>
          sheets.actions(item.title, item.artist, [
            ...(song
              ? [
                  { label: "다음에 재생", run: () => (p.playNext(song), toast("다음에 재생해요")) },
                  { label: "대기열 맨 뒤에 추가", run: () => (p.addToQueue(song), toast("대기열에 추가했어요")) },
                ]
              : item.videoId && !downloading
                ? [{ label: "서버에 받기", run: () => download() }]
                : []),
            { label: "재생목록에 추가", run: () => sheets.addTo([ytToItem(item)]) },
            ...(song
              ? [deviceAction(off, song)]
              : item.videoId
                ? [{ label: "서버에 받고 기기에 저장", run: () => saveToDevice([ytToItem(item)]) }]
                : []),
            ...extraActions,
          ])
        }
      />
    </div>
  );
}

// ---------- player UI ----------

export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const p = usePlayer();
  if (!p.current) return null;
  const pct = p.duration ? (p.time / p.duration) * 100 : 0;
  return (
    <div className="mini" onClick={onOpen} role="button" aria-label="지금 재생 중 열기">
      <Cover id={p.current.coverArt ?? p.current.id} size={120} rounded="sm" className="mini-cover" />
      <div className="mini-text">
        <div className="mini-title">{p.current.title}</div>
        <div className="mini-sub">{p.current.artist}</div>
      </div>
      <button
        className="icon-btn"
        onClick={(e) => {
          e.stopPropagation();
          p.toggle();
        }}
        aria-label={p.playing ? "일시정지" : "재생"}
      >
        {p.playing ? <IconPause size={26} /> : <IconPlay size={26} />}
      </button>
      <button
        className="icon-btn"
        onClick={(e) => {
          e.stopPropagation();
          p.next();
        }}
        aria-label="다음 곡"
      >
        <IconNext size={26} />
      </button>
      <div className="mini-progress" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function NowPlaying({ open, onClose }: { open: boolean; onClose: () => void }) {
  const p = usePlayer();
  const [view, setView] = useState<"art" | "lyrics" | "queue">("art");
  const [drag, setDrag] = useState<number | null>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const cur = p.current;
  const art = cur ? coverUrl(cur.coverArt ?? cur.id, 900) : undefined;
  const t = drag ?? p.time;

  return (
    <div
      className={`np ${open ? "open" : ""}`}
      style={pull ? { transform: `translateY(${pull}px)`, transition: "none" } : undefined}
      onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
      onTouchMove={(e) => {
        if (startY.current == null || view !== "art") return; // lyrics and queue scroll instead
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0) setPull(dy);
      }}
      onTouchEnd={() => {
        if (pull > 120) onClose();
        setPull(0);
        startY.current = null;
      }}
    >
      {art && <div className="np-bg" style={{ backgroundImage: `url(${art})` }} />}
      <div className="np-shade" />
      <div className="np-inner">
        <button className="np-handle" onClick={onClose} aria-label="닫기">
          <IconDown size={30} />
        </button>
        {view === "lyrics" && cur ? (
          <div className="np-lyrics">
            <div className="np-mini-head">
              <Cover id={cur.coverArt ?? cur.id} size={120} rounded="sm" />
              <div>
                <div className="np-mini-title">{cur.title}</div>
                <div className="np-mini-artist">{cur.artist}</div>
              </div>
            </div>
            <LyricsView songId={cur.id} />
          </div>
        ) : view === "queue" ? (
          <div className="np-queue">
            <h3>다음 재생</h3>
            <div className="np-queue-list">
              {p.queue.map((s, i) => (
                <button key={`${s.id}-${i}`} className={`row ${i === p.index ? "active" : ""}`} onClick={() => p.jumpTo(i)}>
                  <div className="row-cover">
                    <Cover id={s.coverArt ?? s.id} size={120} rounded="sm" />
                  </div>
                  <div className="row-text">
                    <div className="row-title">{s.title}</div>
                    <div className="row-sub">{s.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={`np-art ${p.playing ? "" : "paused"}`}>
            <Cover id={cur?.coverArt ?? cur?.id} size={900} rounded="lg" />
          </div>
        )}
        {view !== "lyrics" && (
          <div className="np-info">
            <div className="np-title">{cur?.title ?? "재생 중인 곡 없음"}</div>
            <div className="np-artist">{cur?.artist}</div>
          </div>
        )}
        <div className="np-seek">
          <input
            type="range"
            min={0}
            max={p.duration || 0}
            step={0.5}
            value={Math.min(t, p.duration || 0)}
            onChange={(e) => setDrag(Number(e.target.value))}
            onPointerUp={() => {
              if (drag != null) p.seek(drag);
              setDrag(null);
            }}
            onTouchEnd={() => {
              if (drag != null) p.seek(drag);
              setDrag(null);
            }}
            style={{ ["--pct" as string]: `${p.duration ? (t / p.duration) * 100 : 0}%` }}
            aria-label="재생 위치"
          />
          <div className="np-times">
            <span>{formatTime(t)}</span>
            <span>-{formatTime(Math.max(0, (p.duration || 0) - t))}</span>
          </div>
        </div>
        <div className="np-controls">
          <button className="icon-btn big" onClick={p.prev} aria-label="이전 곡">
            <IconPrev size={38} />
          </button>
          <button className="icon-btn huge" onClick={p.toggle} aria-label={p.playing ? "일시정지" : "재생"}>
            {p.playing ? <IconPause size={52} /> : <IconPlay size={52} />}
          </button>
          <button className="icon-btn big" onClick={p.next} aria-label="다음 곡">
            <IconNext size={38} />
          </button>
        </div>
        <div className="np-bottom">
          <button className={`icon-btn ${p.shuffle ? "on" : ""}`} onClick={() => p.setShuffle(!p.shuffle)} aria-label="셔플">
            <IconShuffle size={22} />
          </button>
          <button className={`icon-btn ${p.repeat !== "off" ? "on" : ""}`} onClick={p.cycleRepeat} aria-label="반복">
            <IconRepeat size={22} />
            {p.repeat === "one" && <span className="badge-one">1</span>}
          </button>
          <button className={`icon-btn ${view === "lyrics" ? "on" : ""}`} onClick={() => setView((v) => (v === "lyrics" ? "art" : "lyrics"))} aria-label="가사">
            <IconLyrics size={22} />
          </button>
          <button className={`icon-btn ${view === "queue" ? "on" : ""}`} onClick={() => setView((v) => (v === "queue" ? "art" : "queue"))} aria-label="대기열">
            <IconList size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function TabBar() {
  const tabs = [
    { to: "/", label: "홈", icon: <IconHome size={25} />, end: true },
    { to: "/charts", label: "차트", icon: <IconChart size={25} /> },
    { to: "/library", label: "보관함", icon: <IconLibrary size={25} /> },
    { to: "/search", label: "검색", icon: <IconSearch size={25} /> },
  ];
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
          {t.icon}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function PlayButtons({ songs }: { songs: Song[] }) {
  const p = usePlayer();
  if (!songs.length) return null;
  return (
    <div className="play-buttons">
      <button className="pill big" onClick={() => p.playList(songs, 0)}>
        <IconPlay size={18} /> 재생
      </button>
      <button className="pill big" onClick={() => p.playList(songs, 0, { shuffle: true })}>
        <IconShuffle size={18} /> 셔플
      </button>
    </div>
  );
}
