import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, ytToSong, type SearchResult, type Song, type YtSong } from "../api";
import { Cover, ErrorBox, Loading, Page, Section, SongRow, toast, YtRow } from "../components";
import { IconSearch } from "../icons";

type Scope = "yt" | "lib";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const scope = (params.get("s") as Scope) ?? "yt";
  const [text, setText] = useState(q);
  const [lib, setLib] = useState<SearchResult | null>(null);
  const [yt, setYt] = useState<YtSong[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => setText(q), [q]);

  useEffect(() => {
    if (!q) {
      setLib(null);
      setYt(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const run = scope === "lib" ? api.search(q).then((r) => alive && setLib(r)) : api.ytSearch(q).then((r) => alive && setYt(r));
    run.catch((e) => alive && setError(e.message)).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q, scope]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    // A pasted YouTube / YouTube Music link (song, album or playlist) is downloaded as is.
    if (/^https:\/\/(music\.youtube\.com|(www\.)?youtube\.com|youtu\.be)\//.test(v)) {
      api.downloadUrl(v).then(() => toast("링크 다운로드를 요청했어요"), (err) => toast(err.message));
      setText("");
      return;
    }
    setParams({ q: v, s: scope });
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const ytPlayable = useMemo(() => (yt ?? []).map(ytToSong).filter((s): s is Song => !!s), [yt]);

  return (
    <Page title="검색">
      <form className="searchbar" onSubmit={submit}>
        <IconSearch size={18} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={scope === "yt" ? "노래, 가수 또는 유튜브 링크" : "보관함에서 찾기"}
          enterKeyHint="search"
          type="search"
        />
      </form>
      <div className="segmented">
        <button className={scope === "yt" ? "on" : ""} onClick={() => setParams(q ? { q, s: "yt" } : { s: "yt" })}>
          유튜브 뮤직
        </button>
        <button className={scope === "lib" ? "on" : ""} onClick={() => setParams(q ? { q, s: "lib" } : { s: "lib" })}>
          보관함
        </button>
      </div>

      {!q && <p className="empty">{scope === "yt" ? "듣고 싶은 노래를 찾아 바로 받아 보세요" : "보관함에 있는 노래, 앨범, 아티스트를 찾아요"}</p>}
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}

      {scope === "yt" && yt && !loading && (
        <div className="list">
          {yt.length === 0 && <p className="empty">검색 결과가 없어요</p>}
          {yt.map((item) => (
            <YtRow key={item.videoId ?? item.title} item={item} playable={ytPlayable} />
          ))}
        </div>
      )}

      {scope === "lib" && lib && !loading && (
        <>
          {lib.song.length === 0 && lib.album.length === 0 && lib.artist.length === 0 && <p className="empty">검색 결과가 없어요</p>}
          {lib.artist.length > 0 && (
            <Section title="아티스트">
              <div className="shelf">
                {lib.artist.map((a) => (
                  <Link key={a.id} to={`/artist/${encodeURIComponent(a.id)}`} className="card artist-card">
                    <Cover id={a.coverArt ?? a.id} size={240} rounded="full" />
                    <div className="card-title">{a.name}</div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
          {lib.album.length > 0 && (
            <Section title="앨범">
              <div className="shelf">
                {lib.album.map((a) => (
                  <Link key={a.id} to={`/album/${encodeURIComponent(a.id)}`} className="card">
                    <Cover id={a.coverArt ?? a.id} size={300} />
                    <div className="card-title">{a.name}</div>
                    <div className="card-sub">{a.artist}</div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
          {lib.song.length > 0 && (
            <Section title="노래">
              <div className="list">
                {lib.song.map((s, i) => (
                  <SongRow key={s.id} song={s} list={lib.song} index={i} />
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </Page>
  );
}
