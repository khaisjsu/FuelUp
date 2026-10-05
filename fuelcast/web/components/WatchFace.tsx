import { clock, minutesBetween, money, type Order, STATUS_LABEL } from "@/lib/api";

type Props = {
  now: string;
  order: Order | null;
  score: number;
  autopilot: boolean;
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
};

/** What the wrist shows: a one-tap yes/no on a proposal, then the arrival time. */
export default function WatchFace({ now, order, score, autopilot, busy, onConfirm, onDecline }: Props) {
  const content = (() => {
    if (!order) {
      return (
        <>
          <div style={{ fontSize: 30, fontWeight: 700 }} className="num">{clock(now)}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Hunger {score}</div>
          <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6 }}>Nothing to approve</div>
        </>
      );
    }
    if (order.status === "proposed") {
      const left = order.respond_by ? Math.max(0, minutesBetween(now, order.respond_by)) : 0;
      return (
        <>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{order.restaurant.name}</div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, margin: "2px 0 4px" }}>
            {order.items.map((i) => i.name).join(" + ")}
          </div>
          <div style={{ fontSize: 11, opacity: 0.7 }} className="num">
            {money(order.total_cents)} · {order.restaurant.eta_minutes} min
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={onDecline} disabled={busy} aria-label="Not now"
              style={{ ...btn, background: "#3a3a3a", color: "#fff" }}
            >✕</button>
            <button
              onClick={onConfirm} disabled={busy} aria-label="Order it"
              style={{ ...btn, background: "#2dd4bf", color: "#062b27" }}
            >✓</button>
          </div>
          <div style={{ fontSize: 10, opacity: 0.55, marginTop: 6 }}>
            {autopilot ? `Orders itself in ${left} min` : `Expires in ${left} min`}
          </div>
        </>
      );
    }
    return (
      <>
        <div style={{ fontSize: 11, opacity: 0.7 }}>{STATUS_LABEL[order.status]}</div>
        <div style={{ fontSize: 13, fontWeight: 700, margin: "2px 0" }}>{order.restaurant.name}</div>
        {order.eta && (
          <>
            <div style={{ fontSize: 28, fontWeight: 700 }} className="num">
              {Math.max(0, minutesBetween(now, order.eta))}
              <span style={{ fontSize: 13, fontWeight: 500 }}> min</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Arrives {clock(order.eta)}</div>
          </>
        )}
      </>
    );
  })();

  return (
    <div style={{ display: "grid", placeItems: "center" }}>
      <div style={{ height: 26, background: "#2b2b2b", borderRadius: "6px 6px 0 0", width: 92 }} />
      <div
        role="region"
        aria-label="Watch preview"
        style={{
          width: 176, height: 206, borderRadius: 44, background: "#000", color: "#fff",
          border: "6px solid #2b2b2b", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", textAlign: "center", padding: 16,
        }}
      >
        {content}
      </div>
      <div style={{ height: 26, background: "#2b2b2b", borderRadius: "0 0 6px 6px", width: 92 }} />
    </div>
  );
}

const btn: React.CSSProperties = {
  width: 52, height: 52, borderRadius: 26, border: "none", fontSize: 22, fontWeight: 700,
};
