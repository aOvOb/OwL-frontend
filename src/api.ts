// Backend API (same origin, login cookie is HttpOnly so it is never touched here).

export type Song = {
  id: string;
  title?: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  coverArt?: string;
  duration?: number;
  track?: number;
  year?: number;
};

export type Album = {
  id: string;
  name?: string;
  artist?: string;
  artistId?: string;
  coverArt?: string;
  songCount?: number;
  duration?: number;
  year?: number;
  song?: Song[];
};

export type Playlist = {
  id: string;
  name?: string;
  comment?: string;
  owner?: string;
  songCount?: number;
  duration?: number;
  coverArt?: string;
  entry?: Song[];
};

export type Artist = { id: string; name?: string; albumCount?: number; coverArt?: string; album?: Album[] };

export type Home = { charts: Playlist[]; playlists: Playlist[]; recentAlbums: Album[] };

export type SearchResult = { artist: Artist[]; album: Album[]; song: Song[] };

/** A YouTube Music song (search result or chart entry). songId is set when it is already in the library. */
export type YtSong = {
  videoId: string | null;
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  songId?: string | null;
  downloading?: boolean;
  rank?: number;
};

export type Chart = { key: string; name: string; updated?: number | null; entries: YtSong[] };

export type Job = {
  id: string;
  url: string;
  status: string;
  progress?: number;
  created_at?: string;
  content_info?: { title?: string; artist?: string; thumbnail_url?: string } | null;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401 && path !== "/auth/login") {
    window.dispatchEvent(new Event("owl:unauthorized"));
  }
  if (!res.ok) {
    let message = "요청에 실패했습니다";
    try {
      message = (await res.json()).error ?? message;
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const enc = encodeURIComponent;

export const api = {
  me: () => request<{ username: string }>("/me"),
  login: (username: string, password: string) =>
    request<{ username: string }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  home: () => request<Home>("/home"),
  playlists: () => request<Playlist[]>("/playlists"),
  playlist: (id: string) => request<Playlist>(`/playlists/${enc(id)}`),
  albums: (type = "newest", size = 60, offset = 0) => request<Album[]>(`/albums?type=${type}&size=${size}&offset=${offset}`),
  album: (id: string) => request<Album>(`/albums/${enc(id)}`),
  artists: () => request<Artist[]>("/artists"),
  artist: (id: string) => request<Artist>(`/artists/${enc(id)}`),
  search: (q: string) => request<SearchResult>(`/search?q=${enc(q)}`),
  randomSongs: (size = 50) => request<Song[]>(`/songs/random?size=${size}`),
  charts: (key?: string) => request<Chart[]>(`/charts${key ? `?key=${enc(key)}` : ""}`),
  ytSearch: (q: string) => request<YtSong[]>(`/yt/search?q=${enc(q)}`),
  download: (videoId: string) => request<{ id: string }>("/yt/download", { method: "POST", body: JSON.stringify({ videoId }) }),
  downloadUrl: (url: string) => request<{ id: string }>("/yt/download", { method: "POST", body: JSON.stringify({ url }) }),
  downloadMany: (videoIds: string[]) =>
    request<{ queued: number }>("/yt/download/bulk", { method: "POST", body: JSON.stringify({ videoIds }) }),
  jobs: () => request<{ jobs: Job[] }>("/yt/jobs"),
};

export const streamUrl = (id: string) => `/api/stream/${enc(id)}`;
export const coverUrl = (id?: string | null, size = 300) => (id ? `/api/cover/${enc(id)}?size=${size}` : undefined);

/** Turns a chart/search entry that is in the library into a playable Song. */
export const ytToSong = (s: YtSong): Song | null =>
  s.songId
    ? { id: s.songId, title: s.title, artist: s.artist, album: s.album ?? undefined, coverArt: s.songId, duration: s.duration ?? undefined }
    : null;

export const formatTime = (sec?: number | null) => {
  if (sec == null || !isFinite(sec)) return "";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
