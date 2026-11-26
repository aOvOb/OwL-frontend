import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { api } from "../api";
import { Loading, Page, Toaster, toast } from "../components";
import { AdminActivityPage } from "../pages/Activity";
import { AdminSongsPage } from "../pages/Admin";
import { AdminPage } from "../pages/AdminHome";
import { Downloads } from "../pages/Downloads";
import Login from "../pages/Login";
import { SheetProvider } from "../sheets";
import "../styles.css";

/**
 * The admin app, on its own domain (admin.<domain>): Caddy asks for the admin gate login first, then this
 * asks for an OwL admin account. The music app does not carry these screens, and its domain does not
 * pass /api/admin/* through.
 */
function DownloadsPage() {
  return (
    <Page title="다운로드 대기열" back large={false}>
      <h1 className="large-title">다운로드 대기열</h1>
      <Downloads />
    </Page>
  );
}

function AdminApp() {
  const [me, setMe] = useState<{ username: string; admin?: boolean } | null | undefined>(undefined);
  const check = useCallback(() => {
    api.me().then(setMe, () => setMe(null));
  }, []);
  useEffect(() => {
    check();
    const out = () => setMe(null);
    window.addEventListener("owl:unauthorized", out);
    return () => window.removeEventListener("owl:unauthorized", out);
  }, [check]);

  if (me === undefined) return <Loading />;
  if (me === null) return <Login onLogin={check} />;
  if (!me.admin)
    return (
      <main className="content admin-content">
        <Page title="관리">
          <p className="empty">관리자 계정만 쓸 수 있어요 ({me.username})</p>
          <div className="play-row">
            <button className="pill big ghost" onClick={() => api.logout().finally(() => setMe(null))}>
              다른 계정으로 로그인
            </button>
          </div>
        </Page>
      </main>
    );
  return (
    <BrowserRouter>
      <SheetProvider toast={toast}>
        <main className="content admin-content">
          <Routes>
            <Route path="/" element={<AdminPage />} />
            <Route path="/activity" element={<AdminActivityPage />} />
            <Route path="/songs" element={<AdminSongsPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Toaster />
      </SheetProvider>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
