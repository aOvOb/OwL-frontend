import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { api, formatTime, songToItem } from "../api";
import { Cover, DeviceSaveButton, ErrorBox, Loading, Page, PlayButtons, SongRow, useLoad } from "../components";
import { IconCheck, IconChevron, IconPlus, IconSort } from "../icons";
import { useSheets } from "../sheets";
import { SORT_LABEL, sortActions, sortItems, useSort, type Sort, type SortKey } from "../sort";
import { APP_VERSION, BUILD_ID } from "../version";
import { Windowed } from "../windowed";
import { Downloads } from "./Downloads";
import { FilterBar, matches, refreshAliases } from "../filter";
import { OfflineSongs } from "./Offline";
import { MyPlaylistsList } from "./Playlists";

type Tab = "playlists" | "albums" | "artists" | "offline" | "downloads";

export function Library() {
  // ?tab=offline opens a tab directly (the offline bar links there).
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "playlists";
  const [q, setQ] = useState("");
  // Learn other names of artists (샤이니 = SHINee) for the search box; re-filter once they arrive.
  const [, aliasesLoaded] = useState(0);
  useEffect(() => {
    refreshAliases().then((more) => more && aliasesLoaded((x) => x + 1));
  }, []);
  const setTab = (t: Tab) => {
    setQ("");
    setParams(t === "playlists" ? {} : { tab: t }, { replace: true });
  };
  const placeholder: Record<Tab, string> = {
    playlists: "재생목록 찾기",
    albums: "앨범, 아티스트 찾기",
    artists: "아티스트 찾기",
    offline: "저장한 곡 찾기",
    downloads: "다운로드 목록에서 찾기",
  };
  const tabs: [Tab, string][] = [
    ["playlists", "재생목록"],
    ["albums", "앨범"],
    ["artists", "아티스트"],
    ["offline", "오프라인"],
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
      <FilterBar value={q} onChange={setQ} placeholder={placeholder[tab]} />
      {tab === "playlists" && <MyPlaylistsList q={q} />}
      {tab === "albums" && <Albums q={q} />}
      {tab === "artists" && <Artists q={q} />}
      {tab === "offline" && <OfflineSongs q={q} />}
      {tab === "downloads" && <Downloads q={q} />}
      <AdminLink />
      <VersionLine />
    </Page>
  );
}

/** Entry to the admin page (server state, user activity, songs), for admin accounts only (the server checks too). */
function AdminLink() {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    api.me().then((m) => setAdmin(!!m.admin), () => setAdmin(false));
  }, []);
  if (!admin) return null;
  return (
    <div className="play-row">
      <Link className="pill big ghost" to="/admin">
        관리 (관리자)
      </Link>
    </div>
  );
}

/** "앱 0.8.0 (abc1234), 서버 0.8.0 (def5678)" */
function VersionLine() {
  const server = useLoad(() => api.serverVersion(), []);
  return (
    <p className="version">
      앱 {APP_VERSION} ({BUILD_ID}), 서버 {server.data ? `${server.data.version} (${server.data.build})` : server.error ? "확인 실패" : "…"}
    </p>
  );
}

/** This account's saved albums and artists; reloads when any screen changes them. */
export function useSaved() {
  const state = useLoad(() => api.myLibrary(), []);
  const { reload } = state;
  useEffect(() => {
    window.addEventListener("owl:library-changed", reload);
    return () => window.removeEventListener("owl:library-changed", reload);
  }, [reload]);
  return state;
}

const libraryChanged = () => window.dispatchEvent(new Event("owl:library-changed"));

export function SortButton({ sort, setSort, keys, title }: { sort: Sort; setSort: (s: Sort) => void; keys: SortKey[]; title: string }) {
  const sheets = useSheets();
  return (
    <button className="sort-btn" onClick={() => sheets.actions(title, undefined, sortActions(sort, setSort, keys))}>
      <IconSort size={16} /> {SORT_LABEL[sort.key]}, {sort.dir === "asc" ? "오름차순" : "내림차순"}
    </button>
  );
}

function Albums({ q }: { q: string }) {
  const { data, error, reload } = useSaved();
  const [sort, setSort] = useSort("saved-albums", { key: "added", dir: "desc" });
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const albums = sortItems(
    data.albums.filter((a) => matches(q, a.name, a.artist)),
    sort,
    { title: (a) => a.name, artist: (a) => a.artist ?? "", added: (a) => a.addedAt },
  );
  return (
    <>
      <div className="list-tools">
        <Link to="/albums/all" className="see-all">
          서버의 모든 앨범 <IconChevron size={16} />
        </Link>
        {albums.length > 1 && <SortButton sort={sort} setSort={setSort} keys={["added", "title", "artist"]} title="앨범 정렬" />}
      </div>
      {albums.length === 0 && <p className="empty">{q ? "찾는 앨범이 없어요" : `앨범 화면에서 "보관함에 추가"를 누르면 여기에 모여요`}</p>}
      <div className="grid pad">
        <Windowed items={albums} keyOf={(a) => a.id} step={40}>
          {(a) => (
            <Link to={`/album/${encodeURIComponent(a.id)}`} className="card">
              <Cover id={a.coverArt ?? a.id} size={300} />
              <div className="card-title">{a.name}</div>
              <div className="card-sub">{a.artist}</div>
            </Link>
          )}
        </Windowed>
      </div>
    </>
  );
}

function Artists({ q }: { q: string }) {
  const { data, error, reload } = useSaved();
  const [sort, setSort] = useSort("saved-artists", { key: "added", dir: "desc" });
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const artists = sortItems(
    data.artists.filter((a) => matches(q, a.name)),
    sort,
    { title: (a) => a.name, artist: (a) => a.name, added: (a) => a.addedAt },
  );
  return (
    <>
      <div className="list-tools">
        <Link to="/artists/all" className="see-all">
          서버의 모든 아티스트 <IconChevron size={16} />
        </Link>
        {artists.length > 1 && <SortButton sort={sort} setSort={setSort} keys={["added", "title"]} title="아티스트 정렬" />}
      </div>
      {artists.length === 0 && <p className="empty">{q ? "찾는 아티스트가 없어요" : `아티스트 화면에서 "보관함에 추가"를 누르면 여기에 모여요`}</p>}
      <div className="list">
        <Windowed items={artists} keyOf={(a) => a.id}>
          {(a) => (
            <Link to={`/artist/${encodeURIComponent(a.id)}`} className="row">
              <div className="row-cover">
                <Cover id={a.coverArt ?? a.id} size={120} rounded="full" />
              </div>
              <div className="row-text">
                <div className="row-title">{a.name}</div>
              </div>
              <IconChevron size={18} className="muted" />
            </Link>
          )}
        </Windowed>
      </div>
    </>
  );
}

/** Every album on the server. */
export function AllAlbumsPage() {
  const { data, error, reload } = useLoad(() => api.albums("alphabeticalByName", 500), []);
  return (
    <Page title="서버의 모든 앨범" back large={false}>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="grid pad top-gap">
          <Windowed items={data} keyOf={(a) => a.id} step={40}>
            {(a) => (
              <Link to={`/album/${encodeURIComponent(a.id)}`} className="card">
                <Cover id={a.coverArt ?? a.id} size={300} />
                <div className="card-title">{a.name}</div>
                <div className="card-sub">{a.artist}</div>
              </Link>
            )}
          </Windowed>
        </div>
      )}
    </Page>
  );
}

/** Every artist on the server. */
export function AllArtistsPage() {
  const { data, error, reload } = useLoad(() => api.artists(), []);
  return (
    <Page title="서버의 모든 아티스트" back large={false}>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="list top-gap">
          <Windowed items={data} keyOf={(a) => a.id}>
            {(a) => (
              <Link to={`/artist/${encodeURIComponent(a.id)}`} className="row">
                <div className="row-cover">
                  <Cover id={a.coverArt ?? a.id} size={120} rounded="full" />
                </div>
                <div className="row-text">
                  <div className="row-title">{a.name}</div>
                  <div className="row-sub">앨범 {a.albumCount ?? 0}개</div>
                </div>
                <IconChevron size={18} className="muted" />
              </Link>
            )}
          </Windowed>
        </div>
      )}
    </Page>
  );
}

/** "보관함에 추가" / "보관함에 있음" toggle for an album or artist. */
function SaveToggle({ saved, onSave, onRemove }: { saved: boolean; onSave: () => Promise<unknown>; onRemove: () => Promise<unknown> }) {
  const sheets = useSheets();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      libraryChanged();
      sheets.toast(msg);
    } catch (e) {
      sheets.toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return saved ? (
    <button className="pill big ghost wide" disabled={busy} onClick={() => run(onRemove, "보관함에서 뺐어요")}>
      <IconCheck size={18} /> 보관함에 있음
    </button>
  ) : (
    <button className="pill big wide" disabled={busy} onClick={() => run(onSave, "보관함에 추가했어요")}>
      <IconPlus size={18} /> 보관함에 추가
    </button>
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
              {songs.length}곡{total ? `, ${Math.round(total / 60)}분` : ""}
            </p>
            <PlayButtons songs={songs} />
            <DeviceSaveButton items={songs.map(songToItem)} name={data.name ?? "재생목록"} />
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
  const saved = useSaved();
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
              {data.year ? `${data.year}, ` : ""}
              {songs.length}곡{data.duration ? `, ${formatTime(data.duration)}` : ""}
            </p>
            <PlayButtons songs={songs} />
            <SaveToggle
              saved={!!saved.data?.albums.some((a) => a.id === data.id)}
              onSave={() => api.saveAlbum(data)}
              onRemove={() => api.unsaveAlbum(data.id)}
            />
            <button className="pill big ghost wide" onClick={() => sheets.addTo(songs.map(songToItem))}>
              <IconPlus size={18} /> 재생목록에 추가
            </button>
            <DeviceSaveButton items={songs.map(songToItem)} name={data.name ?? "앨범"} />
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
  const saved = useSaved();
  return (
    <Page title={data?.name ?? ""} back>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <div className="artist-actions">
          <SaveToggle
            saved={!!saved.data?.artists.some((a) => a.id === data.id)}
            onSave={() => api.saveArtist(data)}
            onRemove={() => api.unsaveArtist(data.id)}
          />
        </div>
      )}
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
