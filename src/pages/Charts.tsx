import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { api, formatBasis, ytToItem, ytToSong, type Chart, type Song, type YtSong } from "../api";
import { ErrorBox, Loading, Page, toast, useLoad, YtRow } from "../components";
import { IconDownload, IconPlay, IconPlus, IconShuffle } from "../icons";
import { usePlayer } from "../player";
import { useSheets } from "../sheets";
import { Windowed } from "../windowed";
import { CoverMosaic, gradientColors, PageGlow } from "../glass";

export const CHART_STYLE = [
  { key: "melon", prefix: "멜론", brand: "Melon", label: "TOP 100", bg: "linear-gradient(140deg,#1f9b48,#0b4a24)", shade: "linear-gradient(180deg,rgba(11,74,36,0) 20%,rgba(11,74,36,.92) 78%)" },
  { key: "yt_kr", prefix: "YouTube 한국", brand: "YouTube", label: "한국 TOP 100", bg: "linear-gradient(140deg,#e0262f,#5e0c10)", shade: "linear-gradient(180deg,rgba(94,12,16,0) 20%,rgba(94,12,16,.92) 78%)" },
  { key: "apple_kr", prefix: "Apple Music", brand: "Apple Music", label: "한국 TOP 100", bg: "linear-gradient(140deg,#fa2d55,#7a1030)", shade: "linear-gradient(180deg,rgba(122,16,48,0) 20%,rgba(122,16,48,.92) 78%)" },
  { key: "billboard", prefix: "Billboard", brand: "Billboard", label: "Hot 100", bg: "linear-gradient(140deg,#3a3a3c,#111113)", shade: "linear-gradient(180deg,rgba(17,17,19,0) 20%,rgba(17,17,19,.94) 78%)" },
  { key: "billboard_global", prefix: "Billboard", brand: "Billboard", label: "Global 200", bg: "linear-gradient(140deg,#2b3a67,#0d1226)", shade: "linear-gradient(180deg,rgba(13,18,38,0) 20%,rgba(13,18,38,.94) 78%)" },
  { key: "yt_us", prefix: "YouTube 미국", brand: "YouTube", label: "미국 TOP 100", bg: "linear-gradient(140deg,#b3262e,#2a0a0c)", shade: "linear-gradient(180deg,rgba(42,10,12,0) 20%,rgba(42,10,12,.94) 78%)" },
];

/** How many chart songs the server has ready to play: "98/100곡 준비됨", or "100곡 모두 준비됨". */
const readyText = (have: number, total: number) => (total > 0 && have >= total ? `${total}곡 모두 준비됨` : `${have}/${total}곡 준비됨`);

/** Cover art for a chart entry: our copy if downloaded, else YouTube Music's image at the wanted size. */
export const entryArt = (e: YtSong, size = 300) =>
  e.songId
    ? `/api/cover/${encodeURIComponent(e.songId)}?size=${size}`
    : e.thumbnail
      ? e.thumbnail.replace(/=w\d+-h\d+/, `=w${size}-h${size}`)
      : null;

const topArt = (entries: YtSong[], n: number, size: number) =>
  entries.map((e) => entryArt(e, size)).filter((u): u is string => !!u).slice(0, n);

/** Home shelf tile: the #1 song's artwork under the brand color. */
export function ChartTile({ chart, style }: { chart: Chart; style: (typeof CHART_STYLE)[number] }) {
  const [art] = topArt(chart.entries, 1, 400);
  return (
    <Link to={`/charts/${style.key}`} className="chart-tile art" style={{ background: style.bg }}>
      {art && <img className="chart-tile-img" src={art} alt="" loading="lazy" />}
      <span className="chart-tile-shade" style={{ background: style.shade }} />
      <span className="chart-tile-text">
        <span className="chart-tile-brand">{style.brand}</span>
        <span className="chart-tile-name">{style.label}</span>
        <span className="chart-tile-count">1위 {chart.entries[0]?.title ?? ""}</span>
      </span>
    </Link>
  );
}

type ChartStyle = (typeof CHART_STYLE)[number];
let savedOrder: string[] | null = null; // per session, so tabs do not flash the default order

const normalizeOrder = (keys: string[] | undefined) => {
  const known = CHART_STYLE.map((s) => s.key);
  const kept = (keys ?? []).filter((k) => known.includes(k));
  return [...kept, ...known.filter((k) => !kept.includes(k))];
};

/** Chart order for this account (saved on the server, so it follows the account across devices). */
export function useChartOrder() {
  const [order, setOrder] = useState<string[]>(savedOrder ?? normalizeOrder([]));
  useEffect(() => {
    api.prefs().then(
      (p) => {
        savedOrder = normalizeOrder(p.chartOrder);
        setOrder(savedOrder);
      },
      () => {},
    );
  }, []);
  const save = (next: string[]) => {
    savedOrder = next;
    setOrder(next);
    api.savePrefs({ chartOrder: next }).catch((e) => toast(e.message));
  };
  const styles = order.map((k) => CHART_STYLE.find((s) => s.key === k)).filter((s): s is ChartStyle => !!s);
  return { order, styles, save };
}

const LONG_PRESS_MS = 450;

export function ChartsIndex() {
  const { data, error, reload } = useLoad(() => api.charts(undefined, 3), []);
  const { order, save } = useChartOrder();
  const [list, setList] = useState<string[]>(order);
  const [drag, setDrag] = useState<{ key: string; dy: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: number; key: string; startY: number; startIndex: number; h: number; active: boolean } | null>(null);
  const blockClick = useRef(false);
  const listNow = useRef(list);
  listNow.current = list;

  useEffect(() => {
    if (!press.current?.active) setList(order);
  }, [order]);

  // While dragging, stop the page from scrolling (needs a non-passive listener).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => press.current?.active && e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [data]);

  const begin = (key: string, y: number, target: HTMLElement) => {
    const startIndex = listNow.current.indexOf(key);
    const h = target.offsetHeight + 12; // row height + gap
    press.current = {
      key,
      startY: y,
      startIndex,
      h,
      active: false,
      timer: window.setTimeout(() => {
        if (!press.current) return;
        press.current.active = true;
        navigator.vibrate?.(12);
        setDrag({ key, dy: 0 });
      }, LONG_PRESS_MS),
    };
  };

  const move = (y: number) => {
    const p = press.current;
    if (!p) return;
    const dy = y - p.startY;
    if (!p.active) {
      if (Math.abs(dy) > 8) {
        clearTimeout(p.timer); // normal scroll, not a long press
        press.current = null;
      }
      return;
    }
    const cur = listNow.current;
    const target = Math.max(0, Math.min(cur.length - 1, p.startIndex + Math.round(dy / p.h)));
    const at = cur.indexOf(p.key);
    if (target !== at) {
      const next = cur.filter((k) => k !== p.key);
      next.splice(target, 0, p.key);
      setList(next);
    }
    setDrag({ key: p.key, dy: dy - (target - p.startIndex) * p.h });
  };

  const end = () => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    if (p.active) {
      blockClick.current = true; // the finger lifting must not open the chart
      setDrag(null);
      if (listNow.current.join() !== order.join()) save(listNow.current);
    }
  };

  return (
    <Page title="차트">
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && <p className="hint">꾹 눌러서 끌면 순서를 바꿀 수 있어요</p>}
      <div className="chart-list" ref={listRef}>
        {data &&
          list.map((key) => {
            const s = CHART_STYLE.find((x) => x.key === key)!;
            const c = data.find((x) => x.key === s.key);
            if (!c) return null;
            const dragging = drag?.key === s.key;
            return (
              <Link
                key={s.key}
                to={`/charts/${s.key}`}
                className={`chart-banner ${dragging ? "dragging" : ""} ${drag ? "reordering" : ""}`}
                style={{ background: s.bg, transform: dragging ? `translateY(${drag!.dy}px) scale(1.03)` : undefined }}
                onTouchStart={(e) => begin(s.key, e.touches[0].clientY, e.currentTarget)}
                onTouchMove={(e) => move(e.touches[0].clientY)}
                onTouchEnd={end}
                onTouchCancel={end}
                onMouseDown={(e) => begin(s.key, e.clientY, e.currentTarget)}
                onMouseMove={(e) => press.current && move(e.clientY)}
                onMouseUp={end}
                onMouseLeave={() => press.current && !press.current.active && end()}
                onContextMenu={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (blockClick.current) {
                    e.preventDefault();
                    blockClick.current = false;
                  }
                }}
                draggable={false}
              >
                <div>
                  <div className="chart-tile-brand">{s.brand}</div>
                  <div className="chart-banner-name">{s.label}</div>
                  <div className="chart-basis">{formatBasis(c.basis)}</div>
                  <div className="chart-tile-count">
                    {readyText(c.have, c.total)}
                  </div>
                </div>
                <div className="chart-fan" aria-hidden>
                  {topArt(c.entries, 3, 240).map((u, i) => (
                    <img key={i} src={u} alt="" loading="lazy" className={`fan-${i}`} />
                  ))}
                </div>
              </Link>
            );
          })}
      </div>
    </Page>
  );
}

export function ChartPage() {
  const { key = "" } = useParams();
  const style = CHART_STYLE.find((s) => s.key === key);
  const { data, error, reload } = useLoad(() => api.charts(key), [key]);
  const chart = data?.[0];
  const sheets = useSheets();
  const [busy, setBusy] = useState(false);
  const colors = gradientColors(style?.bg);
  const player = usePlayer();

  // Refresh while downloads are running so finished songs become playable.
  const pending = chart?.entries.some((e) => e.downloading) ?? false;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [pending, reload]);

  const playable = useMemo(
    () => (chart?.entries ?? []).map(ytToSong).filter((s): s is Song => !!s),
    [chart],
  );
  const missing = (chart?.entries ?? []).filter((e) => !e.songId && !e.downloading && e.videoId).map(ytToItem);

  const downloadAll = async () => {
    setBusy(true);
    try {
      const r = await api.downloadMany(missing);
      toast(r.queued ? `${r.queued}곡을 다운로드 대기열에 넣었어요` : "이미 대기열에 있어요");
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={style ? `${style.brand} ${style.label}` : "차트"} back glass tint={colors[0]}>
      <PageGlow colors={colors} />
      <CoverMosaic art={chart ? topArt(chart.entries, 9, 300) : []} fallback={style?.bg ?? colors[0]}>
        <div className="cover-title">{style?.label ?? "차트"}</div>
        <div className="cover-brand">{style?.brand}</div>
        {chart && <div className="cover-basis">{formatBasis(chart.basis)}</div>}
      </CoverMosaic>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {chart && (
        <>
          <div className="cover-actions">
            <button className="round-btn" aria-label="셔플" disabled={!playable.length} onClick={() => player.playList(playable, 0, { shuffle: true })}>
              <IconShuffle size={22} />
            </button>
            <button className="play-btn" disabled={!playable.length} onClick={() => player.playList(playable, 0)}>
              <IconPlay size={18} /> 재생
            </button>
            <button className="round-btn" aria-label="차트 전체를 재생목록에 추가" onClick={() => sheets.addTo(chart.entries.filter((e) => e.videoId || e.songId).map(ytToItem))}>
              <IconPlus size={22} />
            </button>
          </div>
          <p className="cover-desc"><b>{readyText(playable.length, chart.entries.length)}.</b> 서버에 없는 곡은 흐리게 보이고, 받으면 바로 들을 수 있어요.</p>
          {missing.length > 0 && (
            <button className="pill big ghost cover-more" onClick={downloadAll} disabled={busy}>
              <IconDownload size={18} /> 나머지 {missing.length}곡 받기
            </button>
          )}
          <div className="list">
            <Windowed items={chart.entries} keyOf={(e) => `${e.rank}-${e.videoId}`} step={40}>
              {(e) => <YtRow item={e} playable={playable} />}
            </Windowed>
          </div>
        </>
      )}
    </Page>
  );
}
