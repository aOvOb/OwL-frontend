import { useEffect, useMemo, useRef, useState } from "react";

export type UsagePoint = { t: number; value: number | null };

/**
 * One measure over time as a thin line with a faint fill (the admin page's CPU and memory graphs; each
 * measure gets its own chart, never two scales on one). A gap in the data (server off) stays a gap.
 * Hover or touch shows a crosshair with the time and value.
 */
export function UsageChart({
  title,
  points,
  step,
  max,
  format,
  ticks,
  from,
  to,
}: {
  title: string;
  points: UsagePoint[];
  /** Seconds between points; a longer gap breaks the line. */
  step: number;
  /** Top of the y axis. */
  max: number;
  format: (v: number) => string;
  /** Y values to draw grid lines at. */
  ticks: number[];
  from: number;
  to: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const H = 140;
  const pad = { l: 44, r: 8, t: 8, b: 22 };
  const w = Math.max(100, width - pad.l - pad.r);
  const h = H - pad.t - pad.b;
  const x = (t: number) => pad.l + ((t - from) / Math.max(1, to - from)) * w;
  const y = (v: number) => pad.t + h - (Math.min(v, max) / max) * h;

  // Runs of consecutive points: a gap longer than 2.5 steps starts a new run.
  const runs = useMemo(() => {
    const out: UsagePoint[][] = [];
    let cur: UsagePoint[] = [];
    let last = -Infinity;
    for (const p of points) {
      if (p.value == null || p.t - last > step * 2.5) {
        if (cur.length) out.push(cur);
        cur = [];
      }
      if (p.value != null) cur.push(p);
      last = p.t;
    }
    if (cur.length) out.push(cur);
    return out;
  }, [points, step]);

  const line = (r: UsagePoint[]) => r.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.value!).toFixed(1)}`).join("");
  const area = (r: UsagePoint[]) =>
    `${line(r)}L${x(r[r.length - 1].t).toFixed(1)},${pad.t + h}L${x(r[0].t).toFixed(1)},${pad.t + h}Z`;

  const valid = points.filter((p) => p.value != null);
  const latest = valid[valid.length - 1];
  const peak = valid.reduce<UsagePoint | null>((m, p) => (!m || p.value! > m.value! ? p : m), null);
  const shown = hover != null ? valid[hover] : null;

  const span = to - from;
  const timeLabel = (t: number) =>
    new Date(t * 1000).toLocaleString("ko-KR", span > 86400 * 1.5 ? { month: "numeric", day: "numeric" } : { hour: "2-digit", minute: "2-digit", hour12: false });
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => from + f * span);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!valid.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = from + ((e.clientX - rect.left - pad.l) / w) * span;
    let best = 0;
    for (let i = 1; i < valid.length; i++) if (Math.abs(valid[i].t - t) < Math.abs(valid[best].t - t)) best = i;
    setHover(best);
  };

  return (
    <div className="usage">
      <div className="usage-head">
        <span className="usage-title">{title}</span>
        <span className="usage-now">
          {shown ? (
            <>
              {new Date(shown.t * 1000).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}{" "}
              <b>{format(shown.value!)}</b>
            </>
          ) : latest ? (
            <>
              지금 <b>{format(latest.value!)}</b>
              {peak && <span className="muted">, 최고 {format(peak.value!)}</span>}
            </>
          ) : (
            "기록 없음"
          )}
        </span>
      </div>
      <div ref={box} className="usage-plot">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`${title} 그래프`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={pad.l + w} y1={y(v)} y2={y(v)} className="usage-grid" />
              <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" className="usage-axis">
                {format(v)}
              </text>
            </g>
          ))}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 6} textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"} className="usage-axis">
              {timeLabel(t)}
            </text>
          ))}
          {runs.map((r, i) =>
            r.length > 1 ? (
              <g key={i}>
                <path d={area(r)} className="usage-area" />
                <path d={line(r)} className="usage-line" />
              </g>
            ) : (
              <circle key={i} cx={x(r[0].t)} cy={y(r[0].value!)} r={2} className="usage-dot" />
            ),
          )}
          {shown && (
            <g>
              <line x1={x(shown.t)} x2={x(shown.t)} y1={pad.t} y2={pad.t + h} className="usage-cross" />
              <circle cx={x(shown.t)} cy={y(shown.value!)} r={4.5} className="usage-mark" />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
