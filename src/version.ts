import { reloadWhenIdle } from "./reload";

declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

/** Semantic version of the app (package.json), e.g. 0.7.0. */
export const APP_VERSION: string = __APP_VERSION__;

/** The build this app was made from (commit id in production). */
export const BUILD_ID: string = __BUILD_ID__;

/**
 * Makes sure an installed app does not keep running an old cached version: if the server has a different
 * build, drop the service worker and the app's cached files and reload once (after the music is paused).
 * Songs saved for offline listening ("owl-offline") are the user's data, not app files: they are kept.
 */
const KEEP = new Set(["owl-offline"]);

export async function ensureLatest() {
  try {
    const res = await fetch("/version.json", { cache: "no-store" });
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (!build || build === BUILD_ID) return;
    const flag = `owl-reloaded-for-${build}`;
    if (sessionStorage.getItem(flag)) return; // reload at most once per new build
    sessionStorage.setItem(flag, "1");
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ("caches" in window) await Promise.all((await caches.keys()).filter((k) => !KEEP.has(k)).map((k) => caches.delete(k)));
    reloadWhenIdle();
  } catch {
    /* offline: keep running what we have */
  }
}
