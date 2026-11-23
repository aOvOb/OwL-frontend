import { useLayoutEffect, useRef, useState } from "react";

/**
 * Apple Music style detail pages ("glass" pages, see Page glass):
 * - PageGlow: the page colour pours down from the top with the blurred artwork inside it,
 *   darkening toward the bottom. A fixed layer behind the content, so scrolling never repaints it.
 * - useHeroFade: the hero card fades as it slides under the floating buttons. The fade is a
 *   scroll-linked CSS animation (Safari 26, Chrome 115+), so the browser runs it with the scroll;
 *   script only measures where the card is. Older browsers get a requestAnimationFrame fallback.
 */
const NATIVE = typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** The two colours of a CSS gradient string like "linear-gradient(140deg,#1f9b48,#0b4a24)". */
export const gradientColors = (bg: string | undefined): [string, string] => {
  const c = bg?.match(/#[0-9a-f]{6}/gi) ?? [];
  return [c[0] ?? "#3a3a3e", c[1] ?? c[0] ?? "#161012"];
};

export function PageGlow({ colors, art }: { colors: [string, string]; art?: string | null }) {
  return (
    <div className="page-glow" aria-hidden style={{ "--glow-a": colors[0], "--glow-b": colors[1] } as React.CSSProperties}>
      {art && <img src={art} alt="" />}
    </div>
  );
}

/** `ready`: the hero has its final content. `key`: re-measure when the page shows something else. */
export function useHeroFade(ready: boolean, key?: string) {
  const heroRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useLayoutEffect(() => {
    const hero = heroRef.current;
    if (!ready || !hero) return;
    let h0 = 0, h1 = 1;

    const measure = () => {
      // Fade from when the card reaches the floating buttons until it has fully passed them.
      const btn = document.querySelector(".topbar.glass .glass-btn")?.getBoundingClientRect();
      const top = btn ? btn.bottom + 4 : 54;
      const r = hero.getBoundingClientRect();
      h0 = r.top + window.scrollY - top;
      h1 = h0 + r.height;
      hero.style.setProperty("--fade-h0", `${h0}px`);
      hero.style.setProperty("--fade-h1", `${h1}px`);
    };
    const frame = () => { hero.style.opacity = String(1 - 0.92 * clamp((window.scrollY - h0) / (h1 - h0))); };
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; frame(); });
    };

    measure();
    setOn(true);
    if (!NATIVE) frame();
    const ro = new ResizeObserver(() => { measure(); if (!NATIVE) frame(); });
    ro.observe(hero);
    ro.observe(document.documentElement);
    if (!NATIVE) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      hero.style.opacity = "";
    };
  }, [ready, key]);

  return { heroRef, on };
}
