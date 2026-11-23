import { useLayoutEffect, useRef, useState } from "react";

/**
 * Apple Music style detail header: the big title in the hero card rides up with the page, shrinks,
 * and settles in a glass capsule at the top centre; the card fades as it goes under the top.
 *
 * Smoothness: the browser does the motion, not script on every frame.
 * - Docking is `position: sticky` on a zero-height anchor (moves exactly with the scroll, no lag).
 * - Shrinking, the capsule and the card fade are scroll-linked CSS animations (Safari 26, Chrome 115+).
 * Script only measures positions (on load and resize) into CSS variables.
 * Older browsers get the same result from a requestAnimationFrame fallback.
 */
const SCALE = 17 / 30; // hero title 30px -> 17px in the bar
const NATIVE = typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => t * t * (3 - 2 * t);

/** `ready`: the hero is rendered with its final content. `key`: re-measure when the page shows something else. */
export function useDockTitle(ready: boolean, key?: string) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current, dock = dockRef.current, name = nameRef.current, hero = heroRef.current;
    if (!ready || !wrap || !dock || !name || !hero) return;
    let m = { S: 0, dx: 0, h0: 0, h1: 1 };

    const measure = () => {
      const y = window.scrollY;
      const bar = document.querySelector(".topbar.glass");
      const safeTop = bar ? parseFloat(getComputedStyle(bar).paddingTop) - 4 : 0;
      const barCenter = safeTop + 26, barBottom = safeTop + 48;
      // Measure from the wrapper, never from the sticky anchor itself: once docked, its box is
      // wherever it is stuck, which would feed a wrong position back in. The anchor is the
      // wrapper's first child, so both start at the same place.
      const dr = wrap.getBoundingClientRect(), nr = name.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      const D = dr.top + y, ny = nr.top - dr.top, nx = nr.left - dr.left;
      const T = barCenter - ny - nr.height / 2; // sticky top: title centre lands on the bar centre
      const S = D - T; // scroll position where it docks
      const vw = document.documentElement.clientWidth;
      const dx = vw / 2 - (nr.width * SCALE) / 2 - dr.left - nx;
      const h0 = hr.top + y - barBottom, h1 = h0 + hr.height;
      m = { S, dx, h0, h1 };
      const s = wrap.style;
      s.setProperty("--dock-top", `${T}px`);
      s.setProperty("--dock-s", `${S}px`);
      s.setProperty("--dock-dx", `${dx}px`);
      s.setProperty("--dock-nx", `${nx}px`);
      s.setProperty("--dock-ny", `${ny}px`);
      s.setProperty("--dock-nh", `${nr.height}px`);
      s.setProperty("--dock-pw", `${nr.width * SCALE + 36}px`);
      s.setProperty("--dock-px", `${vw / 2 - dr.left}px`);
      s.setProperty("--dock-h0", `${h0}px`);
      s.setProperty("--dock-h1", `${h1}px`);
    };

    // Fallback only: browsers without scroll-linked animations.
    const frame = () => {
      const y = window.scrollY;
      const fly = dock.querySelector<HTMLElement>(".title-dock-fly"), pill = dock.querySelector<HTMLElement>(".title-dock-pill");
      const start = Math.max(0, m.S - 110); // never already shrunk at the top of the page
      const t = ease(clamp((y - start) / Math.max(1, m.S - start)));
      if (fly) fly.style.transform = `translateX(${m.dx * t}px) scale(${1 - (1 - SCALE) * t})`;
      if (pill) pill.style.opacity = String(clamp((y - (m.S - 40)) / 40));
      hero.style.opacity = String(1 - 0.92 * clamp((y - m.h0) / (m.h1 - m.h0)));
    };
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

  return { wrapRef, dockRef, nameRef, heroRef, on };
}

/** The zero-height sticky anchor holding the flying title and its glass capsule. */
export function DockTitle({ dockRef, text, on }: { dockRef: React.RefObject<HTMLDivElement | null>; text: string; on: boolean }) {
  return (
    <div className="title-dock" ref={dockRef} aria-hidden>
      {on && (
        <>
          <div className="title-dock-pill glass-surface" />
          <div className="title-dock-fly">{text}</div>
        </>
      )}
    </div>
  );
}
