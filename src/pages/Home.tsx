import { Link } from "react-router";
import { api } from "../api";
import { Cover, ErrorBox, Loading, Page, Section, useLoad } from "../components";
import { IconChevron, IconLogout, IconShuffle } from "../icons";
import { usePlayer } from "../player";
import { CHART_STYLE } from "./Charts";

export default function Home({ onLogout }: { onLogout: () => void }) {
  const { data, error, reload } = useLoad(() => api.home(), []);
  const p = usePlayer();

  const shuffleAll = async () => {
    const songs = await api.randomSongs(100);
    p.playList(songs, 0);
  };

  return (
    <Page
      title="지금 듣기"
      right={
        <button className="icon-btn accent" onClick={onLogout} aria-label="로그아웃">
          <IconLogout size={22} />
        </button>
      }
    >
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="hero-actions">
            <button className="pill big" onClick={shuffleAll}>
              <IconShuffle size={18} /> 전체 셔플
            </button>
          </div>

          <Section
            title="인기 차트"
            action={
              <Link to="/charts" className="see-all">
                모두 보기 <IconChevron size={16} />
              </Link>
            }
          >
            <div className="shelf">
              {data.charts.map((c) => {
                const style = CHART_STYLE.find((s) => c.name?.startsWith(s.prefix));
                return (
                  <Link key={c.id} to={`/charts/${style?.key ?? ""}`} className="chart-tile" style={{ background: style?.bg }}>
                    <span className="chart-tile-brand">{style?.brand ?? c.name}</span>
                    <span className="chart-tile-name">{style?.label ?? c.name}</span>
                    <span className="chart-tile-count">{c.songCount ?? 0}곡 보관 중</span>
                  </Link>
                );
              })}
            </div>
          </Section>

          {data.playlists.length > 0 && (
            <Section title="내 재생목록">
              <div className="shelf">
                {data.playlists.map((pl) => (
                  <Link key={pl.id} to={`/playlist/${encodeURIComponent(pl.id)}`} className="card">
                    <Cover id={pl.coverArt} size={300} />
                    <div className="card-title">{pl.name}</div>
                    <div className="card-sub">{pl.songCount ?? 0}곡</div>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          <Section title="최근 추가된 앨범">
            <div className="grid">
              {data.recentAlbums.map((a) => (
                <Link key={a.id} to={`/album/${encodeURIComponent(a.id)}`} className="card">
                  <Cover id={a.coverArt ?? a.id} size={300} />
                  <div className="card-title">{a.name}</div>
                  <div className="card-sub">{a.artist}</div>
                </Link>
              ))}
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}
