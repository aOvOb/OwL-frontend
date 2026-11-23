import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api, itemToSong, prepareCover, songToItem, ytToItem, type ItemInput, type PlaylistSummary, type Song } from "../api";
import { Cover, DeviceSaveButton, ErrorBox, Loading, Page, PlayButtons, useLoad, YtRow } from "../components";
import { IconCheck, IconChevron, IconDownload, IconMore, IconPlus, IconSearch, IconSort } from "../icons";
import { PlaylistThumb, useSheets } from "../sheets";
import { SORT_LABEL, sortActions, sortItems, useSort } from "../sort";
import { matches } from "../filter";
import { Windowed } from "../windowed";

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

export function MyPlaylistsList({ q = "" }: { q?: string }) {
  const { data, error, reload } = useLoad(() => api.myPlaylists(), []);
  usePlaylistsChanged(reload);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const shown = data.filter((pl) => matches(q, pl.name));
  return (
    <div className="list">
      {!q && <NewPlaylistRow />}
      {q && shown.length === 0 && <p className="empty small">찾는 재생목록이 없어요</p>}
      {shown.map((pl) => (
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

/** Search YouTube Music or the library and add songs straight into one playlist. */
export function AddSongsPage() {
  const { id = "" } = useParams();
  const sheets = useSheets();
  const [text, setText] = useState("");
  const [scope, setScope] = useState<"yt" | "lib">("yt");
  const [results, setResults] = useState<ItemInput[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const { data: pl } = useLoad(() => api.myPlaylist(id), [id]);
  // Before searching: songs already on the server, newest downloads first or shuffled.
  const [suggest, setSuggest] = useState<"recent" | "random">("recent");
  const [shuffleTick, setShuffleTick] = useState(0);
  const suggestions = useLoad(
    () => (suggest === "recent" ? api.recentSongs(60) : api.randomSongs(60)).then((s) => s.map(songToItem)),
    [suggest, shuffleTick],
  );

  const keyOf = (i: ItemInput) => i.videoId ?? i.songId ?? `${i.title}|${i.artist}`;
  const already = useMemo(() => new Set((pl?.items ?? []).map(keyOf)), [pl]);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setLoading(true);
    try {
      if (scope === "yt") setResults((await api.ytSearch(q)).map(ytToItem));
      else setResults((await api.search(q)).song.map(songToItem));
    } catch (err) {
      sheets.toast((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (text.trim()) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const add = async (item: ItemInput) => {
    const k = keyOf(item);
    setAdded((s) => new Set(s).add(k));
    try {
      await api.addToPlaylist(id, [item]);
      sheets.toast(item.songId ? "추가했어요" : "추가했어요. 받는 대로 재생돼요");
      window.dispatchEvent(new Event("owl:playlists-changed"));
    } catch (err) {
      setAdded((s) => {
        const n = new Set(s);
        n.delete(k);
        return n;
      });
      sheets.toast((err as Error).message);
    }
  };

  return (
    <Page title={pl ? `${pl.name}에 추가` : "노래 추가"} back large={false}>
      <form className="searchbar top" onSubmit={search}>
        <IconSearch size={18} />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (!e.target.value) setResults(null); // cleared: back to suggestions
          }}
          placeholder="노래, 가수"
          enterKeyHint="search"
          type="search"
        />
      </form>
      <div className="segmented">
        <button className={scope === "yt" ? "on" : ""} onClick={() => setScope("yt")}>
          유튜브 뮤직
        </button>
        <button className={scope === "lib" ? "on" : ""} onClick={() => setScope("lib")}>
          보관함
        </button>
      </div>
      {loading && <Loading />}
      {!loading && results && results.length === 0 && <p className="empty">검색 결과가 없어요</p>}
      {!loading && !results && (
        <div className="suggest-head">
          <button className={`chip ${suggest === "recent" ? "on" : ""}`} onClick={() => setSuggest("recent")}>
            최근 받은 곡
          </button>
          <button
            className={`chip ${suggest === "random" ? "on" : ""}`}
            onClick={() => (suggest === "random" ? setShuffleTick((n) => n + 1) : setSuggest("random"))}
          >
            무작위{suggest === "random" ? " · 다시 섞기" : ""}
          </button>
        </div>
      )}
      {!loading && !results && !suggestions.data && <Loading />}
      {!loading && (results ?? suggestions.data) && (
        <div className="list">
          {(results ?? suggestions.data ?? []).map((r) => {
            const k = keyOf(r);
            const done = added.has(k) || already.has(k);
            return (
              <div key={k} className="row static">
                <div className="row-cover">
                  <Cover id={r.songId ?? null} src={r.songId ? undefined : r.thumbnail} size={120} rounded="sm" />
                </div>
                <div className="row-text">
                  <div className="row-title">{r.title}</div>
                  <div className="row-sub">
                    {r.artist}
                    {!r.songId && " · 받아서 추가"}
                  </div>
                </div>
                <button className={`icon-btn ${done ? "" : "accent"}`} disabled={done} onClick={() => add(r)} aria-label={done ? "추가됨" : "추가"}>
                  {done ? <IconCheck size={22} /> : <IconPlus size={24} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Page>
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

  // Sort choice per playlist (this device). Play order follows what is shown.
  const [sort, setSort] = useSort(`playlist-${id}`, { key: "manual", dir: "asc" });
  const items = useMemo(
    () => sortItems(data?.items ?? [], sort, { title: (i) => i.title, artist: (i) => i.artist, added: (i) => i.addedAt || 0 }),
    [data, sort],
  );
  const playable = useMemo(() => items.map(itemToSong).filter((s): s is Song => !!s), [items]);
  const missing = (data?.items ?? []).filter((i) => !i.songId && !i.downloading && i.videoId);

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
      { label: "노래 추가", run: () => nav(`/my/${data.id}/add`) },
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
    if (r) sheets.toast(r.queued ? `${r.queued}곡을 다운로드 대기열에 넣었어요` : "이미 대기열에 있어요");
    reload();
  };

  return (
    <Page
      title={data?.name ?? ""}
      back
      large={false}
      right={
        <>
          <button className="icon-btn accent" onClick={() => sheets.actions("정렬", `${SORT_LABEL[sort.key]} · ${sort.dir === "asc" ? "오름차순" : "내림차순"}`, sortActions(sort, setSort))} aria-label="정렬">
            <IconSort size={21} />
          </button>
          <button className="icon-btn accent" onClick={menu} aria-label="재생목록 메뉴">
            <IconMore size={22} />
          </button>
        </>
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
            <Link to={`/my/${data.id}/add`} className="pill big ghost wide">
              <IconPlus size={18} /> 노래 추가
            </Link>
            {missing.length > 0 && (
              <button className="pill big ghost wide" onClick={downloadMissing}>
                <IconDownload size={18} /> 안 받은 {missing.length}곡 받기
              </button>
            )}
            <DeviceSaveButton items={data.items} name={data.name} />
          </div>
          {data.items.length === 0 && <p className="empty">아직 노래가 없어요. 노래 추가를 눌러 찾아 보세요</p>}
          <div className="list">
            <Windowed items={items} keyOf={(it) => `${it.index}-${it.videoId ?? it.songId}`}>
              {(it) => (
                <YtRow
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
              )}
            </Windowed>
            <Link to={`/my/${data.id}/add`} className="row add-row">
              <span className="add-row-icon">
                <IconPlus size={24} />
              </span>
              <div className="row-text">
                <div className="row-title accent-text">노래 추가</div>
              </div>
            </Link>
          </div>
        </>
      )}
    </Page>
  );
}
