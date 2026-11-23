import { Component, useEffect, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { api, ApiError } from "./api";
import { useOnline } from "./offline";

const LAST_USER = "owl.lastUser";
import { Loading, MiniPlayer, NowPlaying, TabBar, Toaster, toast } from "./components";
import { AddSongsPage, MyPlaylistPage } from "./pages/Playlists";
import { InstallBanner, InstallGuide, useGuideOpen } from "./install";
import { SheetProvider } from "./sheets";
import { ChartPage, ChartsIndex } from "./pages/Charts";
import Home from "./pages/Home";
import { AlbumPage, AllAlbumsPage, AllArtistsPage, ArtistPage, Library, PlaylistPage } from "./pages/Library";
import Login from "./pages/Login";
import Search from "./pages/Search";
import { PlayerProvider } from "./player";

function ScrollTop() {
  const { pathname } = useLocation();
  // Braces matter: newer Chrome returns a Promise from scrollTo, and React would call it as a cleanup.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Keeps one broken screen from blanking the whole app; tapping a tab recovers. */
class ErrorBoundary extends Component<{ children: React.ReactNode; resetKey: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-box" style={{ marginTop: 80 }}>
        <p>화면을 표시하지 못했어요</p>
        <button className="pill" onClick={() => location.reload()}>
          새로고침
        </button>
      </div>
    );
  }
}

function Routed({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

/** Shown while there is no connection: only songs saved on the device play. */
function OfflineBar({ force }: { force: boolean }) {
  const online = useOnline();
  const { pathname, search } = useLocation();
  if (online && !force) return null;
  return (
    <div className="offline-bar" role="status">
      <span>오프라인이에요. 기기에 저장한 곡만 재생돼요</span>
      {!(pathname === "/library" && search.includes("tab=offline")) && <Link to="/library?tab=offline">저장한 곡</Link>}
    </div>
  );
}

function Shell({ onLogout, startedOffline }: { onLogout: () => void; startedOffline: boolean }) {
  const [npOpen, setNpOpen] = useState(false);
  const nav = useNavigate();
  // The server was unreachable at start: open on the saved songs, and reload when the connection comes back
  // (the "online" event, so a server that is down while Wi-Fi is up does not reload in a loop).
  useEffect(() => {
    if (!startedOffline) return;
    nav("/library?tab=offline", { replace: true });
    const back = () => location.reload();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, [startedOffline, nav]);
  useEffect(() => {
    document.body.style.overflow = npOpen ? "hidden" : "";
  }, [npOpen]);
  return (
    <>
      <ScrollTop />
      <div className="status-cover" aria-hidden />
      <OfflineBar force={startedOffline} />
      <main className="content">
        <Routed>
        <Routes>
          <Route path="/" element={<Home onLogout={onLogout} />} />
          <Route path="/charts" element={<ChartsIndex />} />
          <Route path="/charts/:key" element={<ChartPage />} />
          <Route path="/library" element={<Library />} />
          <Route path="/search" element={<Search />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="/albums/all" element={<AllAlbumsPage />} />
          <Route path="/artists/all" element={<AllArtistsPage />} />
          <Route path="/my/:id" element={<MyPlaylistPage />} />
          <Route path="/my/:id/add" element={<AddSongsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Routed>
      </main>
      <div className="dock">
        <MiniPlayer onOpen={() => setNpOpen(true)} />
        <TabBar />
      </div>
      <NowPlaying open={npOpen} onClose={() => setNpOpen(false)} />
      <Toaster />
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  const [startedOffline, setStartedOffline] = useState(false);
  const guideOpen = useGuideOpen();

  useEffect(() => {
    api.me().then(
      (m) => {
        setUser(m.username);
        try {
          localStorage.setItem(LAST_USER, m.username);
        } catch {
          /* private mode */
        }
      },
      (e) => {
        // No connection (not "logged out"): open with the last account so saved songs still play.
        if (e instanceof ApiError) return setUser(null);
        let last: string | null = null;
        try {
          last = localStorage.getItem(LAST_USER);
        } catch {
          /* private mode */
        }
        setStartedOffline(!!last);
        setUser(last);
      },
    );
    const onUnauthorized = () => setUser(null);
    window.addEventListener("owl:unauthorized", onUnauthorized);
    return () => window.removeEventListener("owl:unauthorized", onUnauthorized);
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  const guide = guideOpen && <InstallGuide />;
  if (user === undefined) return <Loading />;
  if (user === null)
    return (
      <>
        <InstallBanner />
        <Login onLogin={setUser} />
        {guide}
      </>
    );
  return (
    <BrowserRouter>
      <PlayerProvider>
        <SheetProvider toast={toast}>
          <InstallBanner />
          <Shell onLogout={logout} startedOffline={startedOffline} />
          {guide}
        </SheetProvider>
      </PlayerProvider>
    </BrowserRouter>
  );
}
