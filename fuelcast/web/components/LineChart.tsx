"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clock } from "@/lib/api";

type Point = { ts: string; value: number | null };

type Props = {
  points: Point[];
  unit: string;
  yMin: number;
  yMax: number;
  height?: number;
  threshold?: { value: number; label: string };
  band?: { from: number; to: number; label: string };
  ariaLabel: string;
};

const PAD = { top: 12, right: 12, bottom: 24, left: 36 };

/** Single-series time line with a crosshair tooltip. */
export default function LineChart({ points, unit, yMin, yMax, height = 180, threshold, band, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const valid = points.filter((p) => p.value !== null) as { ts: string; value: number }[];
  const t0 = valid.length ? new Date(valid[0].ts).getTime() : 0;
  const t1 = valid.length ? new Date(valid[valid.length - 1].ts).getTime() : 1;
  const lo = Math.min(yMin, ...valid.map((p) => p.value));
  const hi = Math.max(yMax, ...valid.map((p) => p.value));
  const iw = width - PAD.left - PAD.right;
  const ih = height - PAD.top - PAD.bottom;
  const x = (ts: string) => PAD.left + ((new Date(ts).getTime() - t0) / Math.max(1, t1 - t0)) * iw;
  const y = (v: number) => PAD.top + (1 - (v - lo) / Math.max(1, hi - lo)) * ih;

  const path = useMemo(
    () => valid.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`).join(""),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valid.length, width, lo, hi, t0, t1, valid[valid.length - 1]?.value],
  );
  const area = valid.length
    ? `${path}L${x(valid[valid.length - 1].ts)},${PAD.top + ih}L${x(valid[0].ts)},${PAD.top + ih}Z`
    : "";

  const ticksY = [lo, (lo + hi) / 2, hi].map((v) => Math.round(v));
  const hours: string[] = [];
  if (valid.length) {
    const start = new Date(t0);
    start.setMinutes(0, 0, 0);
    for (let t = start.getTime() + 3600_000; t <= t1; t += 3600_000 * (iw < 420 ? 3 : 2)) {
      hours.push(new Date(t).toISOString());
    }
  }

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!valid.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    let bestD = Infinity;
    valid.forEach((p, i) => {
      const d = Math.abs(x(p.ts) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? valid[hover] : null;

  if (!valid.length) {
    return (
      <div ref={ref} className="subtle" style={{ height, display: "grid", placeItems: "center" }}>
        No data from this device
      </div>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        style={{ display: "block", touchAction: "none" }}
      >
        {band && (
          <rect
            x={PAD.left}
            width={iw}
            y={y(Math.min(hi, band.to))}
            height={Math.max(0, y(Math.max(lo, band.from)) - y(Math.min(hi, band.to)))}
            fill="var(--surface-2)"
          />
        )}
        {ticksY.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + iw} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">{v}</text>
          </g>
        ))}
        {hours.map((h) => (
          <text key={h} x={x(h)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--text-3)">
            {clock(h)}
          </text>
        ))}
        <path d={area} fill="var(--series-1-soft)" />
        {threshold && (
          <g>
            <line
              x1={PAD.left} x2={PAD.left + iw} y1={y(threshold.value)} y2={y(threshold.value)}
              stroke="var(--threshold)" strokeWidth={1.5} strokeDasharray="5 4"
            />
            <text x={PAD.left + iw - 4} y={y(threshold.value) - 5} textAnchor="end" fontSize={11} fill="var(--text-2)">
              {threshold.label}
            </text>
          </g>
        )}
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {(() => {
          const last = valid[valid.length - 1];
          return <circle cx={x(last.ts)} cy={y(last.value)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />;
        })()}
        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.ts)} x2={x(hp.ts)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--text-3)" strokeWidth={1} />
            <circle cx={x(hp.ts)} cy={y(hp.value)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          style={{
            position: "absolute",
            left: Math.min(Math.max(0, x(hp.ts) - 60), width - 130),
            top: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: 12,
            pointerEvents: "none",
            boxShadow: "var(--shadow)",
            whiteSpace: "nowrap",
          }}
        >
          <span className="subtle">{clock(hp.ts)}</span>{" "}
          <strong className="num">{Math.round(hp.value * 10) / 10}</strong> {unit}
        </div>
      )}
    </div>
  );
}
