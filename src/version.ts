declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

/** Semantic version of the app (package.json), e.g. 0.7.0. */
export const APP_VERSION: string = __APP_VERSION__;

/** The build this app was made from (commit id in production). */
export const BUILD_ID: string = __BUILD_ID__;

/**
 * Makes sure an installed app does not keep running an old cached version: if the server has a different
 * build, drop the service worker and its caches and reload once.
 */
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
    if ("caches" in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
    location.reload();
  } catch {
    /* offline: keep running what we have */
  }
}
