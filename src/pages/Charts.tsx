import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { api, formatBasis, ytToItem, ytToSong, type Chart, type Song, type YtSong } from "../api";
import { ErrorBox, Loading, Page, PlayButtons, toast, useLoad, YtRow } from "../components";
import { IconDownload, IconPlus } from "../icons";
import { useSheets } from "../sheets";

export const CHART_STYLE = [
  { key: "melon", prefix: "멜론", brand: "Melon", label: "TOP 100", bg: "linear-gradient(140deg,#1f9b48,#0b4a24)", shade: "linear-gradient(180deg,rgba(11,74,36,0) 20%,rgba(11,74,36,.92) 78%)" },
  { key: "yt_kr", prefix: "YouTube 한국", brand: "YouTube", label: "한국 TOP 100", bg: "linear-gradient(140deg,#e0262f,#5e0c10)", shade: "linear-gradient(180deg,rgba(94,12,16,0) 20%,rgba(94,12,16,.92) 78%)" },
  { key: "apple_kr", prefix: "Apple Music", brand: "Apple Music", label: "한국 TOP 100", bg: "linear-gradient(140deg,#fa2d55,#7a1030)", shade: "linear-gradient(180deg,rgba(122,16,48,0) 20%,rgba(122,16,48,.92) 78%)" },
  { key: "billboard", prefix: "Billboard", brand: "Billboard", label: "Hot 100", bg: "linear-gradient(140deg,#3a3a3c,#111113)", shade: "linear-gradient(180deg,rgba(17,17,19,0) 20%,rgba(17,17,19,.94) 78%)" },
  { key: "yt_us", prefix: "YouTube 미국", brand: "YouTube", label: "미국 TOP 100", bg: "linear-gradient(140deg,#b3262e,#2a0a0c)", shade: "linear-gradient(180deg,rgba(42,10,12,0) 20%,rgba(42,10,12,.94) 78%)" },
];

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

export function ChartsIndex() {
  const { data, error, reload } = useLoad(() => api.charts(), []);
  return (
    <Page title="차트">
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      <div className="chart-list">
        {data &&
          CHART_STYLE.map((s) => {
            const c = data.find((x) => x.key === s.key);
            if (!c) return null;
            const have = c.entries.filter((e) => e.songId).length;
            return (
              <Link key={s.key} to={`/charts/${s.key}`} className="chart-banner" style={{ background: s.bg }}>
                <div>
                  <div className="chart-tile-brand">{s.brand}</div>
                  <div className="chart-banner-name">{s.label}</div>
                  <div className="chart-basis">{formatBasis(c.basis)}</div>
                  <div className="chart-tile-count">
                    {have}/{c.entries.length}곡 보관 중
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
  const missing = (chart?.entries ?? []).filter((e) => !e.songId && !e.downloading && e.videoId).map((e) => e.videoId!) ;

  const downloadAll = async () => {
    setBusy(true);
    try {
      const r = await api.downloadMany(missing);
      toast(r.queued ? `${r.queued}곡 다운로드를 요청했어요` : "대기열이 가득 찼어요. 잠시 뒤에 다시 시도하세요");
      reload();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={style ? `${style.brand} ${style.label}` : "차트"} back large={false}>
      <div className="chart-hero" style={{ background: style?.bg }}>
        {chart && topArt(chart.entries, 1, 600)[0] && <img className="chart-hero-bg" src={topArt(chart.entries, 1, 600)[0]} alt="" />}
        {chart && (
          <div className="chart-hero-mosaic" aria-hidden>
            {topArt(chart.entries, 4, 300).map((u, i) => (
              <img key={i} src={u} alt="" />
            ))}
          </div>
        )}
        <div className="chart-tile-brand">{style?.brand}</div>
        <div className="chart-hero-name">{style?.label}</div>
        {chart && (
          <>
            <div className="chart-basis">{formatBasis(chart.basis)}</div>
            <div className="chart-tile-count">
              {playable.length}/{chart.entries.length}곡 보관 중
            </div>
          </>
        )}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {chart && (
        <>
          <div className="play-row">
            <PlayButtons songs={playable} />
            <button className="pill big ghost" onClick={() => sheets.addTo(chart.entries.filter((e) => e.videoId || e.songId).map(ytToItem))}>
              <IconPlus size={18} /> 차트 전체를 재생목록에 추가
            </button>
            {missing.length > 0 && (
              <button className="pill big ghost" onClick={downloadAll} disabled={busy}>
                <IconDownload size={18} /> 나머지 {missing.length}곡 받기
              </button>
            )}
          </div>
          <div className="list">
            {chart.entries.map((e) => (
              <YtRow key={`${e.rank}-${e.videoId}`} item={e} playable={playable} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
