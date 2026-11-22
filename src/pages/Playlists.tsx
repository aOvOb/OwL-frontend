import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, itemToSong, prepareCover, type PlaylistSummary, type Song } from "../api";
import { ErrorBox, Loading, Page, PlayButtons, useLoad, YtRow } from "../components";
import { IconChevron, IconDownload, IconMore } from "../icons";
import { PlaylistThumb, useSheets } from "../sheets";

/** Reloads when any screen adds to or changes a playlist. */
function usePlaylistsChanged(reload: () => void) {
  useEffect(() => {
    window.addEventListener("owl:playlists-changed", reload);
    return () => window.removeEventListener("owl:playlists-changed", reload);
  }, [reload]);
}

export function NewPlaylistRow() {
  const sheets = useSheets();
  const nav = useNavigate();
  return (
    <button
      className="row"
      onClick={() =>
        sheets.prompt("새 재생목록", "", async (name) => {
          const pl = await api.createPlaylist(name);
          window.dispatchEvent(new Event("owl:playlists-changed"));
          nav(`/my/${pl.id}`);
        })
      }
    >
      <span className="pl-thumb plus">+</span>
      <div className="row-text">
        <div className="row-title accent-text">새 재생목록</div>
      </div>
    </button>
  );
}

export function MyPlaylistsList() {
  const { data, error, reload } = useLoad(() => api.myPlaylists(), []);
  usePlaylistsChanged(reload);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="list">
      <NewPlaylistRow />
      {data.map((pl) => (
        <Link key={pl.id} to={`/my/${pl.id}`} className="row">
          <PlaylistThumb pl={pl} />
          <div className="row-text">
            <div className="row-title">{pl.name}</div>
            <div className="row-sub">{pl.count}곡</div>
          </div>
          <IconChevron size={18} className="muted" />
        </Link>
      ))}
      {data.length === 0 && <p className="empty small">차트나 검색에서 ⋯ 를 눌러 재생목록에 담아 보세요</p>}
    </div>
  );
}

export function MyPlaylistsShelf() {
  const { data, reload } = useLoad(() => api.myPlaylists(), []);
  usePlaylistsChanged(reload);
  if (!data || data.length === 0) return null;
  return (
    <div className="shelf">
      {data.map((pl: PlaylistSummary) => (
        <Link key={pl.id} to={`/my/${pl.id}`} className="card">
          <PlaylistThumb pl={pl} large />
          <div className="card-title">{pl.name}</div>
          <div className="card-sub">{pl.count}곡</div>
        </Link>
      ))}
    </div>
  );
}

export function MyPlaylistPage() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const sheets = useSheets();
  const { data, error, reload } = useLoad(() => api.myPlaylist(id), [id]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Songs still downloading: refresh until they become playable.
  const pending = data?.items.some((i) => i.downloading) ?? false;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(reload, 15000);
    return () => clearInterval(t);
  }, [pending, reload]);

  const playable = useMemo(() => (data?.items ?? []).map(itemToSong).filter((s): s is Song => !!s), [data]);
  const missing = (data?.items ?? []).filter((i) => !i.songId && !i.downloading && i.videoId).map((i) => i.videoId!);

  const changed = () => {
    reload();
    window.dispatchEvent(new Event("owl:playlists-changed"));
  };

  const pickCover = async (file?: File) => {
    if (!file || !data) return;
    setUploading(true);
    try {
      const jpeg = await prepareCover(file);
      await api.setPlaylistCover(data.id, jpeg);
      sheets.toast("사진을 바꿨어요");
      changed();
    } catch (e) {
      sheets.toast((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const menu = () => {
    if (!data) return;
    sheets.actions(data.name, `${data.items.length}곡`, [
      { label: "사진 변경", run: () => fileInput.current?.click() },
      ...(data.cover ? [{ label: "사진 제거", run: async () => (await api.removePlaylistCover(data.id), changed()) }] : []),
      {
        label: "이름 변경",
        run: () =>
          sheets.prompt("이름 변경", data.name, async (name) => {
            await api.renamePlaylist(data.id, name);
            changed();
          }),
      },
      {
        label: "재생목록 삭제",
        danger: true,
        run: () =>
          sheets.actions(`"${data.name}"을(를) 삭제할까요?`, "노래 파일은 지워지지 않아요", [
            {
              label: "삭제",
              danger: true,
              run: async () => {
                await api.deletePlaylist(data.id);
                window.dispatchEvent(new Event("owl:playlists-changed"));
                nav("/library", { replace: true });
              },
            },
          ]),
      },
    ]);
  };

  const downloadMissing = async () => {
    const r = await api.downloadMany(missing).catch((e) => (sheets.toast(e.message), null));
    if (r) sheets.toast(r.queued ? `${r.queued}곡 다운로드를 요청했어요` : "대기열이 가득 찼어요");
    reload();
  };

  return (
    <Page
      title={data?.name ?? ""}
      back
      large={false}
      right={
        <button className="icon-btn accent" onClick={menu} aria-label="재생목록 메뉴">
          <IconMore size={22} />
        </button>
      }
    >
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickCover(e.target.files?.[0])} />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="detail-head">
            <button className="detail-cover-btn" onClick={() => fileInput.current?.click()} aria-label="사진 변경">
              <PlaylistThumb
                large
                pl={{ id: data.id, cover: data.cover, updatedAt: data.updatedAt, thumbnails: data.items.map((i) => i.songId ?? i.thumbnail ?? "").filter(Boolean).slice(0, 4) }}
              />
              {uploading && <span className="cover-uploading">올리는 중…</span>}
            </button>
            <h1>{data.name}</h1>
            <p className="detail-meta">
              {data.items.length}곡 · 재생 가능 {playable.length}곡
            </p>
            <PlayButtons songs={playable} />
            {missing.length > 0 && (
              <button className="pill big ghost wide" onClick={downloadMissing}>
                <IconDownload size={18} /> 안 받은 {missing.length}곡 받기
              </button>
            )}
          </div>
          {data.items.length === 0 && <p className="empty">아직 노래가 없어요. 차트나 검색에서 ⋯ → 재생목록에 추가</p>}
          <div className="list">
            {data.items.map((it) => (
              <YtRow
                key={`${it.index}-${it.videoId ?? it.songId}`}
                item={{ ...it, videoId: it.videoId ?? null, title: it.title, artist: it.artist }}
                playable={playable}
                extraActions={[
                  {
                    label: "이 재생목록에서 삭제",
                    danger: true,
                    run: async () => {
                      await api.removeFromPlaylist(data.id, it.index);
                      changed();
                    },
                  },
                ]}
              />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
