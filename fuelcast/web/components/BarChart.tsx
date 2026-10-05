"use client";

import { useState } from "react";

type Bar = { label: string; value: number; display: string };

/** Single-series vertical bars with a per-bar hover tooltip. */
export default function BarChart({ bars, height = 160, ariaLabel }: { bars: Bar[]; height?: number; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div role="img" aria-label={ariaLabel} style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, borderBottom: "1px solid var(--border)" }}>
        {bars.map((b, i) => (
          <div
            key={b.label}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", position: "relative" }}
          >
            <div
              style={{
                width: "100%",
                height: `${(b.value / max) * 100}%`,
                minHeight: b.value ? 2 : 0,
                background: "var(--series-1)",
                opacity: hover === null || hover === i ? 1 : 0.55,
                borderRadius: "4px 4px 0 0",
              }}
            />
            {hover === i && (
              <div
                style={{
                  position: "absolute", bottom: `calc(${(b.value / max) * 100}% + 6px)`, left: "50%",
                  transform: "translateX(-50%)", background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "3px 8px", fontSize: 12, whiteSpace: "nowrap", zIndex: 1,
                  boxShadow: "var(--shadow)",
                }}
              >
                <span className="subtle">{b.label}</span> <strong className="num">{b.display}</strong>
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {bars.map((b) => (
          <div key={b.label} className="subtle" style={{ flex: 1, textAlign: "center", fontSize: 11 }}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}
