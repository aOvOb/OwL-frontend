import { Fragment, useEffect, useRef, useState } from "react";

/**
 * Renders a long list in steps: the first `step` items, then the next ones when the end comes within
 * ~1.5 screens. Rows that are rendered but off screen are also skipped by the browser
 * (content-visibility in styles.css), so a 500-album library or a 2000-song playlist stays light.
 */
export function Windowed<T>({ items, keyOf, children, step = 60 }: {
  items: T[];
  keyOf: (item: T, index: number) => string;
  children: (item: T, index: number) => React.ReactNode;
  step?: number;
}) {
  const [count, setCount] = useState(step);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => c + step);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [step, count, items.length]);

  return (
    <>
      {items.slice(0, count).map((item, i) => (
        <Fragment key={keyOf(item, i)}>{children(item, i)}</Fragment>
      ))}
      {count < items.length && <div ref={sentinel} className="windowed-sentinel" aria-hidden />}
    </>
  );
}
