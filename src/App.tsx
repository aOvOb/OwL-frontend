import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { api } from "./api";
import { Loading, MiniPlayer, NowPlaying, TabBar, Toaster } from "./components";
import { ChartPage, ChartsIndex } from "./pages/Charts";
import Home from "./pages/Home";
import { AlbumPage, ArtistPage, Library, PlaylistPage } from "./pages/Library";
import Login from "./pages/Login";
import Search from "./pages/Search";
import { PlayerProvider } from "./player";

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const [npOpen, setNpOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = npOpen ? "hidden" : "";
  }, [npOpen]);
  return (
    <>
      <ScrollTop />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home onLogout={onLogout} />} />
          <Route path="/charts" element={<ChartsIndex />} />
          <Route path="/charts/:key" element={<ChartPage />} />
          <Route path="/library" element={<Library />} />
          <Route path="/search" element={<Search />} />
          <Route path="/playlist/:id" element={<PlaylistPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
  if (user === null) return <Login onLogin={setUser} />;
  return (
    <BrowserRouter>
      <PlayerProvider>
        <Shell onLogout={logout} />
      </PlayerProvider>
    </BrowserRouter>
  );
}
