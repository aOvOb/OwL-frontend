import { useEffect, useState } from "react";

/**
 * Apple Music style detail pages ("glass" pages, see Page glass):
 * - PageGlow: the page colour pours down from the top, darkening toward the bottom. A fixed layer
 *   behind the content, so scrolling never repaints it.
 * - CoverMosaic: the artwork fills the top edge to edge and fades out at the bottom. A heavily
 *   blurred copy spills below it, so the colour under the artwork is the artwork's own, for any cover.
 *   Title and buttons sit on the fade.
 */

/** The two colours of a CSS gradient string like "linear-gradient(140deg,#1f9b48,#0b4a24)". */
export const gradientColors = (bg: string | undefined): [string, string] => {
  const c = bg?.match(/#[0-9a-f]{6}/gi) ?? [];
  return [c[0] ?? "#3a3a3e", c[1] ?? c[0] ?? "#161012"];
};

export function PageGlow({ colors }: { colors: [string, string] }) {
  return <div className="page-glow" aria-hidden style={{ "--glow-a": colors[0], "--glow-b": colors[1] } as React.CSSProperties} />;
}

/**
 * Average brightness (0..1) of images, or null when none can be read. Only same-origin images
 * (our server's /api/cover) can be read; YouTube thumbnails are blocked by the browser.
 */
function useBrightness(urls: string[]) {
  const [value, setValue] = useState<number | null>(null);
  const key = urls.join("|");
  useEffect(() => {
    let alive = true;
    const own = urls.filter((u) => u.startsWith("/"));
    if (!own.length) { setValue(null); return; }
    const read = (u: string) =>
      new Promise<number | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement("canvas");
            c.width = c.height = 8;
            const g = c.getContext("2d", { willReadFrequently: true })!;
            g.drawImage(img, 0, 0, 8, 8);
            const d = g.getImageData(0, 0, 8, 8).data;
            let sum = 0;
            for (let i = 0; i < d.length; i += 4) sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
            resolve(sum / (d.length / 4));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = u;
      });
    Promise.all(own.map(read)).then((vals) => {
      const ok = vals.filter((v): v is number => v != null);
      if (alive) setValue(ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

/**
 * Full-bleed artwork header. `art`: up to 9 cover URLs (3x3; repeats when fewer).
 * `fallback`: shown while there is no artwork yet (the chart's own colours).
 */
export function CoverMosaic({ art, fallback, children }: { art: string[]; fallback: string; children: React.ReactNode }) {
  const tiles = art.length ? Array.from({ length: 9 }, (_, i) => art[i % art.length]) : [];
  // Title sits over the lower two rows: judge brightness there. Unknown counts as bright (darker shade).
  const brightness = useBrightness(tiles.slice(3));
  const bright = brightness == null || brightness > 0.55;
  const grid = (cls: string) => (
    <div className={cls} aria-hidden>
      {tiles.map((u, i) => <img key={i} src={u} alt="" />)}
    </div>
  );
  return (
    <section className={`cover-head ${bright ? "bright" : ""}`}>
      <div className="cover-fallback" style={{ background: fallback }} aria-hidden />
      {tiles.length > 0 && grid("cover-bleed")}
      {tiles.length > 0 && grid("cover-grid")}
      <div className="cover-shade" aria-hidden />
      <div className="cover-text">{children}</div>
    </section>
  );
}
