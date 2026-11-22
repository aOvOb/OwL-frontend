import { useState } from "react";
import { Link, useParams } from "react-router";
import { api, formatTime, songToItem } from "../api";
import { Cover, ErrorBox, Loading, Page, PlayButtons, SongRow, useLoad } from "../components";
import { IconChevron, IconPlus } from "../icons";
import { useSheets } from "../sheets";
import { MyPlaylistsList } from "./Playlists";

type Tab = "playlists" | "albums" | "artists" | "downloads";

export function Library() {
  const [tab, setTab] = useState<Tab>("playlists");
  const tabs: [Tab, string][] = [
    ["playlists", "재생목록"],
    ["albums", "앨범"],
    ["artists", "아티스트"],
    ["downloads", "다운로드"],
  ];
  return (
    <Page title="보관함">
      <div className="segmented">
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "playlists" && <MyPlaylistsList />}
      {tab === "albums" && <Albums />}
      {tab === "artists" && <Artists />}
      {tab === "downloads" && <Downloads />}
    </Page>
  );
}

function Albums() {
  const { data, error, reload } = useLoad(() => api.albums("alphabeticalByName", 500), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="grid pad">
      {data.map((a) => (
        <Link key={a.id} to={`/album/${encodeURIComponent(a.id)}`} className="card">
          <Cover id={a.coverArt ?? a.id} size={300} />
          <div className="card-title">{a.name}</div>
          <div className="card-sub">{a.artist}</div>
        </Link>
      ))}
    </div>
  );
}

function Artists() {
  const { data, error, reload } = useLoad(() => api.artists(), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="list">
      {data.map((a) => (
        <Link key={a.id} to={`/artist/${encodeURIComponent(a.id)}`} className="row">
          <div className="row-cover">
            <Cover id={a.coverArt ?? a.id} size={120} rounded="full" />
          </div>
          <div className="row-text">
            <div className="row-title">{a.name}</div>
            <div className="row-sub">앨범 {a.albumCount ?? 0}개</div>
          </div>
          <IconChevron size={18} className="muted" />
        </Link>
      ))}
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "대기 중",
  fetching_info: "정보 확인 중",
  downloading: "받는 중",
  importing: "정리 중",
  completed: "완료",
  failed: "실패",
  cancelled: "취소됨",
};

function Downloads() {
  const { data, error, reload } = useLoad(() => api.jobs(), []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const jobs = [...data.jobs].reverse();
  const active = jobs.filter((j) => !["completed", "failed", "cancelled"].includes(j.status)).length;
  return (
    <>
      <div className="downloads-head">
        <span>
          진행 중 {active}개 · 전체 {jobs.length}개
        </span>
        <button className="pill" onClick={reload}>
          새로고침
        </button>
      </div>
      <div className="list">
        {jobs.length === 0 && <p className="empty">다운로드 기록이 없어요</p>}
        {jobs.slice(0, 200).map((j) => (
          <div key={j.id} className="row static">
            <div className="row-text">
              <div className="row-title">{j.content_info?.title ?? j.url.replace(/^https:\/\/(music\.)?youtube\.com\//, "")}</div>
              <div className="row-sub">{j.content_info?.artist ?? ""}</div>
            </div>
            <div className={`job-status s-${j.status}`}>
              {STATUS[j.status] ?? j.status}
              {j.status === "downloading" && j.progress ? ` ${Math.round(j.progress)}%` : ""}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function PlaylistPage() {
  const { id = "" } = useParams();
  const { data, error, reload } = useLoad(() => api.playlist(id), [id]);
  const songs = data?.entry ?? [];
  const total = songs.reduce((s, x) => s + (x.duration ?? 0), 0);
  return (
    <Page title={data?.name ?? ""} back large={false}>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="detail-head">
            <Cover id={data.coverArt ?? songs[0]?.coverArt} size={600} rounded="lg" className="detail-cover" />
            <h1>{data.name}</h1>
            {data.comment && <p className="detail-sub">{data.comment}</p>}
            <p className="detail-meta">
              {songs.length}곡{total ? ` · ${Math.round(total / 60)}분` : ""}
            </p>
            <PlayButtons songs={songs} />
          </div>
          <div className="list">
            {songs.map((s, i) => (
              <SongRow key={`${s.id}-${i}`} song={s} list={songs} index={i} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

export function AlbumPage() {
  const { id = "" } = useParams();
  const sheets = useSheets();
  const { data, error, reload } = useLoad(() => api.album(id), [id]);
  const songs = data?.song ?? [];
  return (
    <Page title={data?.name ?? ""} back large={false}>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="detail-head">
            <Cover id={data.coverArt ?? data.id} size={600} rounded="lg" className="detail-cover" />
            <h1>{data.name}</h1>
            {data.artistId ? (
              <Link to={`/artist/${encodeURIComponent(data.artistId)}`} className="detail-artist">
                {data.artist}
              </Link>
            ) : (
              <p className="detail-artist">{data.artist}</p>
            )}
            <p className="detail-meta">
              {data.year ? `${data.year} · ` : ""}
              {songs.length}곡{data.duration ? ` · ${formatTime(data.duration)}` : ""}
            </p>
            <PlayButtons songs={songs} />
            <button className="pill big ghost wide" onClick={() => sheets.addTo(songs.map(songToItem))}>
              <IconPlus size={18} /> 재생목록에 추가
            </button>
          </div>
          <div className="list">
            {songs.map((s, i) => (
              <SongRow key={s.id} song={s} list={songs} index={i} showCover={false} number={s.track ?? i + 1} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

export function ArtistPage() {
  const { id = "" } = useParams();
  const { data, error, reload } = useLoad(() => api.artist(id), [id]);
  return (
    <Page title={data?.name ?? ""} back>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="grid pad">
          {(data.album ?? []).map((a) => (
            <Link key={a.id} to={`/album/${encodeURIComponent(a.id)}`} className="card">
              <Cover id={a.coverArt ?? a.id} size={300} />
              <div className="card-title">{a.name}</div>
              <div className="card-sub">{a.year ?? ""}</div>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
