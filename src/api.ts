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
  ytTitle?: string | null;
  ytArtist?: string | null;
};

export type Chart = { key: string; name: string; updated?: number | null; entries: YtSong[] };

/** What gets stored in an OwL playlist. title/artist are YouTube Music's names (= the file's tags). */
export type ItemInput = {
  videoId?: string | null;
  songId?: string | null;
  title: string;
  artist: string;
  album?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
};

export type PlaylistSummary = { id: string; name: string; count: number; cover: boolean; updatedAt: number; thumbnails: string[] };
export type PlaylistItemView = ItemInput & { index: number; downloading: boolean };
export type MyPlaylist = { id: string; name: string; cover: boolean; updatedAt: number; items: PlaylistItemView[] };

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

  myPlaylists: () => request<PlaylistSummary[]>("/my/playlists"),
  myPlaylist: (id: string) => request<MyPlaylist>(`/my/playlists/${enc(id)}`),
  createPlaylist: (name: string, items: ItemInput[] = []) =>
    request<MyPlaylist>("/my/playlists", { method: "POST", body: JSON.stringify({ name, items }) }),
  renamePlaylist: (id: string, name: string) =>
    request<MyPlaylist>(`/my/playlists/${enc(id)}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  deletePlaylist: (id: string) => request<void>(`/my/playlists/${enc(id)}`, { method: "DELETE" }),
  addToPlaylist: (id: string, items: ItemInput[]) =>
    request<MyPlaylist>(`/my/playlists/${enc(id)}/items`, { method: "POST", body: JSON.stringify({ items }) }),
  removeFromPlaylist: (id: string, index: number) =>
    request<MyPlaylist>(`/my/playlists/${enc(id)}/items/${index}`, { method: "DELETE" }),
  setPlaylistCover: (id: string, jpeg: Blob) =>
    request<MyPlaylist>(`/my/playlists/${enc(id)}/cover`, { method: "PUT", body: jpeg, headers: { "Content-Type": "image/jpeg" } }),
  removePlaylistCover: (id: string) => request<MyPlaylist>(`/my/playlists/${enc(id)}/cover`, { method: "DELETE" }),
};

export const playlistCoverUrl = (p: { id: string; cover: boolean; updatedAt: number }) =>
  p.cover ? `/api/my/playlists/${enc(p.id)}/cover?v=${p.updatedAt}` : undefined;

/** Chart or search entry -> playlist item (uses YouTube Music's own names when the chart had its own). */
export const ytToItem = (s: YtSong & { ytTitle?: string | null; ytArtist?: string | null }): ItemInput => ({
  videoId: s.videoId,
  songId: s.songId ?? null,
  title: s.ytTitle || s.title,
  artist: s.ytArtist || s.artist,
  album: s.album ?? null,
  duration: s.duration ?? null,
  thumbnail: s.thumbnail ?? null,
});

export const songToItem = (s: Song): ItemInput => ({
  songId: s.id,
  title: s.title ?? "",
  artist: s.artist ?? "",
  album: s.album ?? null,
  duration: s.duration ?? null,
});

export const itemToSong = (i: PlaylistItemView): Song | null =>
  i.songId ? { id: i.songId, title: i.title, artist: i.artist, album: i.album ?? undefined, coverArt: i.songId, duration: i.duration ?? undefined } : null;

/**
 * Shrinks a picked photo in the browser before upload: centered square, at most 1000px,
 * JPEG re-compressed until it is under ~1MB. The server checks and re-encodes it again.
 */
export async function prepareCover(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new ApiError(400, "사진을 읽을 수 없어요");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, 1000);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  for (const q of [0.88, 0.8, 0.7, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= 1024 * 1024) return blob;
  }
  throw new ApiError(400, "사진을 줄이지 못했어요");
}

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
