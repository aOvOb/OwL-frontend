import { Link } from "react-router";
import { api } from "../api";
import { Cover, ErrorBox, Loading, Page, Section, useLoad } from "../components";
import { IconChevron, IconLogout, IconShuffle } from "../icons";
import { usePlayer } from "../player";
import { CHART_STYLE } from "./Charts";
import { MyPlaylistsShelf } from "./Playlists";

export default function Home({ onLogout }: { onLogout: () => void }) {
  const { data, error, reload } = useLoad(() => api.albums("newest", 20), []);
  const charts = useLoad(() => api.charts(), []);
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
        {!charts.data && <Loading />}
        {charts.data && (
          <div className="shelf">
            {CHART_STYLE.map((s) => {
              const c = charts.data!.find((x) => x.key === s.key);
              if (!c) return null;
              return (
                <Link key={s.key} to={`/charts/${s.key}`} className="chart-tile" style={{ background: s.bg }}>
                  <span className="chart-tile-brand">{s.brand}</span>
                  <span className="chart-tile-name">{s.label}</span>
                  <span className="chart-tile-count">1위 {c.entries[0]?.title ?? ""}</span>
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section
        title="내 재생목록"
        action={
          <Link to="/library" className="see-all">
            모두 보기 <IconChevron size={16} />
          </Link>
        }
      >
        <MyPlaylistsShelf />
      </Section>

      <Section title="최근 추가된 앨범">
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!data && !error && <Loading />}
        {data && (
          <div className="grid">
            {data.map((a) => (
              <Link key={a.id} to={`/album/${encodeURIComponent(a.id)}`} className="card">
                <Cover id={a.coverArt ?? a.id} size={300} />
                <div className="card-title">{a.name}</div>
                <div className="card-sub">{a.artist}</div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}
