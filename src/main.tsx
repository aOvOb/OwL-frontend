import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles.css";
import { reloadWhenIdle } from "./reload";
import { ensureLatest } from "./version";

ensureLatest();
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && ensureLatest());

// Home-screen apps on iOS stay suspended instead of reloading, so look for a new version whenever the
// app comes back to the screen and once an hour; autoUpdate then reloads into it (not while music plays).
registerSW({
  immediate: true,
  onNeedReload: reloadWhenIdle,
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => registration.update().catch(() => {});
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
    setInterval(check, 60 * 60 * 1000);
  },
});

// No pinch or double-tap zoom: it is an app, not a page. iOS ignores user-scalable=no in Safari,
// so its gesture events are cancelled too.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
