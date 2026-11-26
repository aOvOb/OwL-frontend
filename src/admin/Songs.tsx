import { useCallback, useEffect, useState } from "react";
import { api, type AdminSong } from "../api";
import { Cover, ErrorBox, Loading, Page } from "../components";
import { FilterBar } from "../filter";
import { useSheets } from "../sheets";

const mb = (n?: number | null) => (n ? `${(n / 1024 / 1024).toFixed(1)}MB` : "");

/**
 * Admin song manager: every song file on the server, newest first. Fix a wrong title, artist or
 * album (written into the file itself), or delete a wrong download. Changes reach the app after the
 * music server's next scan (seconds to a few minutes).
 */
export function AdminSongsPage() {
  const sheets = useSheets();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<AdminSong[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (offset: number) => {
      setBusy(true);
      try {
        const r = await api.adminSongs(query, offset);
        setTotal(r.total);
        setSongs((old) => (offset === 0 ? r.songs : [...(old ?? []), ...r.songs]));
        setMore(r.songs.length === 100);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [query],
  );
  useEffect(() => {
    load(0);
  }, [load]);

  const patch = (id: string, change: Partial<AdminSong> | null) =>
    setSongs((old) => (old ?? []).flatMap((s) => (s.id !== id ? [s] : change === null ? [] : [{ ...s, ...change }])));

  const edit = (s: AdminSong, field: "title" | "artist" | "album", label: string) =>
    sheets.prompt(label, (s[field] as string) ?? "", async (value) => {
      try {
        await api.adminEditSong(s.id, { [field]: value });
        patch(s.id, { [field]: value.trim() });
        sheets.toast("고쳤어요. 앱 목록에는 잠시 뒤에 반영돼요");
      } catch (e) {
        sheets.toast((e as Error).message);
      }
    });

  const remove = (s: AdminSong) =>
    sheets.actions(
      "서버에서 지울까요?",
      s.inPlaylist
        ? `"${s.title}"은 누군가의 재생목록에 들어 있어요. 지우면 모든 계정에서 사라지고, 재생목록에서는 흐리게 보여요.`
        : `"${s.title}"을 서버에서 지워요. 모든 계정에서 사라져요.`,
      [
        {
          label: "서버에서 지우기",
          danger: true,
          run: async () => {
            try {
              const r = await api.adminDeleteSong(s.id, s.inPlaylist);
              if (r.deleted) {
                patch(s.id, null);
                setTotal((n) => n - 1);
                sheets.toast("지웠어요");
              } else sheets.toast("재생목록에 있는 곡이라 지우지 않았어요");
            } catch (e) {
              sheets.toast((e as Error).message);
            }
          },
        },
      ],
    );

  const menu = (s: AdminSong) =>
    sheets.actions(s.title || s.path, `${s.artist}${s.album ? `, ${s.album}` : ""}`, [
      { label: "제목 고치기", run: () => edit(s, "title", "제목") },
      { label: "가수 고치기", run: () => edit(s, "artist", "가수") },
      { label: "앨범 고치기", run: () => edit(s, "album", "앨범") },
      { label: "서버에서 지우기", danger: true, run: () => remove(s) },
    ]);

  return (
    <Page title="곡 관리" back large={false}>
      <h1 className="large-title">곡 관리</h1>
      <FilterBar value={q} onChange={setQ} placeholder="제목, 가수, 앨범, 파일 이름으로 찾기" />
      {error && songs === null ? (
        <ErrorBox message={error} onRetry={() => load(0)} />
      ) : songs === null ? (
        <Loading />
      ) : (
        <>
          <p className="admin-count">
            {query ? `찾은 곡 ${songs.length}${more ? "+" : ""}개` : `서버의 곡 ${total.toLocaleString()}개`}, 새로 받은 순
          </p>
          {songs.length === 0 && <p className="empty">찾는 곡이 없어요</p>}
          <div className="list">
            {songs.map((s) => (
              <div key={s.id} className="row" role="button" onClick={() => menu(s)}>
                <div className="row-cover">
                  <Cover id={s.coverArt} size={120} rounded="sm" />
                </div>
                <div className="row-text">
                  <div className="row-title">{s.title || s.path}</div>
                  <div className="row-sub">
                    {[s.artist, s.album, mb(s.size), s.inPlaylist ? "재생목록에 있음" : ""].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {more && songs.length > 0 && (
            <div className="play-row">
              <button className="pill big ghost" disabled={busy} onClick={() => load(songs.length)}>
                {busy ? "불러오는 중" : "더 보기"}
              </button>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
