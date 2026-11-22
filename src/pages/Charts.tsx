import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { api, ytToSong, type Song } from "../api";
import { ErrorBox, Loading, Page, PlayButtons, toast, useLoad, YtRow } from "../components";
import { IconDownload } from "../icons";

export const CHART_STYLE = [
  { key: "melon", prefix: "멜론", brand: "Melon", label: "TOP 100", bg: "linear-gradient(140deg,#1f9b48,#0b4a24)" },
  { key: "yt_kr", prefix: "YouTube 한국", brand: "YouTube", label: "한국 TOP 100", bg: "linear-gradient(140deg,#e0262f,#5e0c10)" },
  { key: "apple_kr", prefix: "Apple Music", brand: "Apple Music", label: "한국 TOP 100", bg: "linear-gradient(140deg,#fa2d55,#7a1030)" },
  { key: "billboard", prefix: "Billboard", brand: "Billboard", label: "Hot 100", bg: "linear-gradient(140deg,#3a3a3c,#111113)" },
  { key: "yt_us", prefix: "YouTube 미국", brand: "YouTube", label: "미국 TOP 100", bg: "linear-gradient(140deg,#b3262e,#2a0a0c)" },
];

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
                  <div className="chart-tile-count">
                    {have}/{c.entries.length}곡 보관 중
                  </div>
                </div>
                <ol className="chart-banner-top">
                  {c.entries.slice(0, 3).map((e) => (
                    <li key={e.rank}>
                      <b>{e.rank}</b> {e.title}
                    </li>
                  ))}
                </ol>
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

  const updated = chart?.updated ? new Date(chart.updated * 1000).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <Page title={style ? `${style.brand} ${style.label}` : "차트"} back large={false}>
      <div className="chart-hero" style={{ background: style?.bg }}>
        <div className="chart-tile-brand">{style?.brand}</div>
        <div className="chart-hero-name">{style?.label}</div>
        {chart && (
          <div className="chart-tile-count">
            {playable.length}/{chart.entries.length}곡 보관 중{updated ? ` · ${updated} 기준` : ""}
          </div>
        )}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {chart && (
        <>
          <div className="play-row">
            <PlayButtons songs={playable} />
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
