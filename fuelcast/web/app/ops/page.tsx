"use client";

import { useEffect, useState } from "react";
import BarChart from "@/components/BarChart";
import {
  type AdminStats, api, clock, money, type Restaurant, STATUS_LABEL, STATUS_TONE, unreachable, VIA_LABEL,
} from "@/lib/api";

const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function Ops() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      Promise.all([api.stats(), api.restaurants()])
        .then(([s, r]) => { setStats(s); setRestaurants(r); setError(null); })
        .catch((e) => setError(unreachable(e)));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <main className="container page">
      <div className="page-head">
        <div>
          <p className="subtle">Internal · refreshes every 5 seconds</p>
          <h1>Operations</h1>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {stats && (
        <>
          <section className="grid cols-4">
            <Tile label="Orders placed" value={String(stats.totals.placed)} note={`${stats.totals.orders} proposed in total`} />
            <Tile label="Gross order value" value={money(stats.totals.gmv_cents)} note={`${money(stats.totals.avg_order_cents)} average`} />
            <Tile label="Suggestions accepted" value={pct(stats.totals.acceptance_rate)} note="of signal-triggered suggestions answered" />
            <Tile label="Triggered by body signals" value={pct(stats.totals.signal_share)} note={`avg hunger ${stats.totals.avg_hunger_at_trigger} at trigger`} />
          </section>

          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Orders placed per day</h3>
              <BarChart
                ariaLabel="Orders placed per day"
                bars={stats.orders_by_day.map((d) => ({
                  label: new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: "short" }),
                  value: d.orders,
                  display: `${d.orders} orders · ${money(d.gmv_cents)}`,
                }))}
              />
            </div>
            <div className="card">
              <h3>How orders were approved</h3>
              <table className="table">
                <tbody>
                  {Object.entries(stats.confirmed_via).sort((a, b) => b[1] - a[1]).map(([via, n]) => (
                    <tr key={via}>
                      <td>{VIA_LABEL[via] ?? via}</td>
                      <td style={{ width: "55%" }}>
                        <div className="factor-track">
                          <div className="factor-fill" style={{ width: `${(n / stats.totals.placed) * 100}%` }} />
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: "right" }}>{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="subtle" style={{ marginTop: 8 }}>
                Average {stats.totals.avg_minutes_to_door} min from suggestion to door.
              </p>
              <div className="row" style={{ marginTop: 12, gap: 6 }}>
                {Object.entries(stats.by_status).map(([s, n]) => (
                  <span key={s} className={`pill ${STATUS_TONE[s as keyof typeof STATUS_TONE] ?? ""}`}>
                    {STATUS_LABEL[s as keyof typeof STATUS_LABEL] ?? s}: {n}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Users</h3>
              <table className="table">
                <thead><tr><th>User</th><th>Mode</th><th>Hunger now</th><th style={{ textAlign: "right" }}>Orders · spend</th></tr></thead>
                <tbody>
                  {stats.users.map((u) => (
                    <tr key={u.user.id}>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="avatar" style={{ background: u.user.avatar_color, width: 26, height: 26, fontSize: 12 }}>{u.user.name[0]}</span>
                          <span>{u.user.name}<div className="subtle">{u.user.devices.join(", ")}</div></span>
                        </div>
                      </td>
                      <td>{u.user.mode}</td>
                      <td className="num">{u.current_hunger} <span className="subtle">at {clock(u.now)}</span></td>
                      <td className="num" style={{ textAlign: "right" }}>{u.orders} · {money(u.spend_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Most ordered</h3>
              <table className="table">
                <tbody>
                  {stats.top_items.map((t) => (
                    <tr key={t.name}><td>{t.name}</td><td className="num" style={{ textAlign: "right" }}>{t.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Recent orders</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>#</th><th>When</th><th>User</th><th>Meal</th><th>Trigger</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th></tr>
                </thead>
                <tbody>
                  {stats.recent_orders.map((o) => (
                    <tr key={o.id}>
                      <td className="num subtle">{o.id}</td>
                      <td className="num subtle" style={{ whiteSpace: "nowrap" }}>
                        {new Date(o.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} {clock(o.created_at)}
                      </td>
                      <td>{o.user_name}</td>
                      <td>{o.items.map((i) => i.name).join(" + ")}<div className="subtle">{o.restaurant.name}</div></td>
                      <td className="subtle" style={{ maxWidth: 260 }}>
                        {o.trigger === "signal" ? `Hunger ${o.hunger_score}` : "Manual"}
                        {o.reason && o.reason !== "Historical demo order" ? ` · ${o.reason}` : ""}
                      </td>
                      <td><span className={`pill ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                      <td className="num" style={{ textAlign: "right" }}>{money(o.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Partner kitchens</h3>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Kitchen</th><th>Cuisine</th><th>Rating</th><th>ETA</th><th>Delivery</th><th>Menu items</th></tr></thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name} {r.verified && <span className="pill pill-good">✓ Verified</span>}</td>
                      <td>{r.cuisine}</td>
                      <td className="num">★ {r.rating}</td>
                      <td className="num">{r.eta_minutes} min</td>
                      <td>{r.delivery_partner} · {money(r.delivery_fee_cents)}</td>
                      <td className="num">{r.items?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: 28 }}>{value}</div>
      <div className="subtle">{note}</div>
    </div>
  );
}
