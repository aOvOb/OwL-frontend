import { Component, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { api } from "./api";
import { Loading, MiniPlayer, NowPlaying, TabBar, Toaster, toast } from "./components";
import { AddSongsPage, MyPlaylistPage } from "./pages/Playlists";
import { InstallBanner } from "./install";
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

function Shell({ onLogout }: { onLogout: () => void }) {
  const [npOpen, setNpOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = npOpen ? "hidden" : "";
  }, [npOpen]);
  return (
    <>
      <ScrollTop />
      <div className="status-cover" aria-hidden />
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

  useEffect(() => {
    api.me().then((m) => setUser(m.username), () => setUser(null));
    const onUnauthorized = () => setUser(null);
    window.addEventListener("owl:unauthorized", onUnauthorized);
    return () => window.removeEventListener("owl:unauthorized", onUnauthorized);
  }, []);

  const logout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
  };

  if (user === undefined) return <Loading />;
  if (user === null)
    return (
      <>
        <InstallBanner />
        <Login onLogin={setUser} />
      </>
    );
  return (
    <BrowserRouter>
      <PlayerProvider>
        <SheetProvider toast={toast}>
          <InstallBanner />
          <Shell onLogout={logout} />
        </SheetProvider>
      </PlayerProvider>
    </BrowserRouter>
  );
}
