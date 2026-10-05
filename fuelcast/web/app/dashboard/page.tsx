"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import HungerGauge from "@/components/HungerGauge";
import LineChart from "@/components/LineChart";
import WatchFace from "@/components/WatchFace";
import {
  api, clock, money, type Mode, type Order, type Reading, STATUS_LABEL, STATUS_TONE, type User,
  type UserState, unreachable, VIA_LABEL,
} from "@/lib/api";

const FACTOR_LABEL: Record<string, string> = {
  glucose: "Glucose trend",
  time_since_meal: "Time since meal",
  energy: "Calories burned",
  stress: "Low HRV",
};

const STEPS: Order["status"][] = ["confirmed", "preparing", "on_the_way", "delivered"];

export default function Dashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [state, setState] = useState<UserState | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [history, setHistory] = useState<{ ts: string; score: number }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async (id: number) => {
    try {
      const [s, r, h, o] = await Promise.all([
        api.state(id), api.readings(id, 10), api.hungerHistory(id, 10), api.orders(id),
      ]);
      setState(s);
      setReadings(r);
      setHistory(h);
      setOrders(o);
      setError(null);
    } catch (e) {
      setError(unreachable(e));
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loadUsers = () =>
      api.users()
        .then((u) => {
          setUsers(u);
          setUserId((cur) => cur ?? u[0]?.id ?? null);
          setError(null);
        })
        .catch((e) => {
          setError(unreachable(e));
          timer = setTimeout(loadUsers, 5000);
        });
    loadUsers();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (userId !== null) {
      setEvents([]);
      load(userId);
    }
  }, [userId, load]);

  const act = async (fn: () => Promise<unknown>) => {
    if (userId === null || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const res = await fn();
      const evs = (res as { events?: string[] } | undefined)?.events;
      if (evs?.length) setEvents((prev) => [...evs.reverse(), ...prev].slice(0, 6));
      await load(userId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const advance = (minutes: number) => act(() => api.advance(userId!, minutes));

  // "Play" runs the simulated clock 5 minutes per second.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => advance(5), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, userId]);

  // Pause when a decision is waiting so the presenter can tap the watch.
  useEffect(() => {
    if (playing && state?.active_order?.status === "proposed" && state.user.mode === "confirm") setPlaying(false);
  }, [state, playing]);

  const user = state?.user;
  const order = state?.active_order ?? null;

  return (
    <main className="container page">
      <div className="page-head">
        <div>
          <p className="subtle">Live demo · simulated CGM and watch data</p>
          <h1>Personal dashboard</h1>
        </div>
        <span className="spacer" />
        <div className="persona-tabs" role="group" aria-label="Choose a demo user">
          {users.map((u) => (
            <button
              key={u.id}
              className="persona-tab"
              aria-pressed={u.id === userId}
              onClick={() => { setPlaying(false); setUserId(u.id); }}
            >
              <span className="avatar" style={{ background: u.avatar_color }}>{u.name[0]}</span>
              <span>
                <strong style={{ fontSize: 14 }}>{u.name}</strong>
                <br />
                <span className="subtle">{u.devices.map((d) => d.toUpperCase()).join(" + ")}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      {state && user && (
        <>
          <div className="sim-bar">
            <span className="sim-clock num">{clock(state.now)}</span>
            <button className="btn btn-primary" onClick={() => setPlaying((p) => !p)}>
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
            <button className="btn" disabled={busy} onClick={() => advance(15)}>+15 min</button>
            <button className="btn" disabled={busy} onClick={() => advance(60)}>+1 hour</button>
            <span className="hide-sm" style={{ width: 1, height: 24, background: "var(--border)" }} />
            <button className="btn" disabled={busy} onClick={() => act(() => api.workout(userId!, 45, "hard", "Run"))}>
              🏃 Start a run
            </button>
            <button
              className="btn" disabled={busy}
              onClick={() => act(() => api.meal(userId!, { label: "Snack", kcal: 250, carbs_g: 30, glycemic: "medium" }))}
            >
              🍎 Log a snack
            </button>
            <span className="spacer" />
            <label className="row subtle" style={{ gap: 6 }}>
              Mode
              <select
                value={user.mode}
                onChange={(e) => act(() => api.updateSettings(userId!, { mode: e.target.value as Mode }))}
              >
                <option value="confirm">Confirm on watch</option>
                <option value="autopilot">Autopilot</option>
                <option value="off">Off</option>
              </select>
            </label>
            <button
              className="btn btn-sm"
              onClick={() => { setPlaying(false); act(async () => { await api.reset(); }); }}
            >
              Reset demo
            </button>
          </div>

          {events.length > 0 && (
            <div className="events" style={{ marginBottom: 16 }} aria-live="polite">
              {events.slice(0, 3).map((e, i) => <div className="event" key={i}>{e}</div>)}
            </div>
          )}

          <section className="grid cols-3">
            <div className="card">
              <h3>Hunger score</h3>
              <div className="row" style={{ alignItems: "center", gap: 16 }}>
                <HungerGauge score={state.hunger.score} threshold={user.hunger_threshold} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ fontWeight: 600 }}>{state.hunger.reason}.</p>
                  <p className="subtle" style={{ marginTop: 6 }}>
                    {state.hunger.minutes_to_window === 0
                      ? "In the hunger window now."
                      : state.hunger.minutes_to_window
                        ? `Hunger window in about ${state.hunger.minutes_to_window} min.`
                        : "No hunger window predicted yet."}{" "}
                    Orders at {user.hunger_threshold}.
                  </p>
                  {state.guardrail && !order && state.hunger.score >= user.hunger_threshold && (
                    <p className="pill pill-warn" style={{ marginTop: 8 }}>{state.guardrail}</p>
                  )}
                </div>
              </div>
              <div className="grid" style={{ gap: 8, marginTop: 14 }}>
                {(["glucose", "time_since_meal", "energy", "stress"] as const)
                  .filter((k) => k !== "glucose" || state.hunger.factors.has_cgm)
                  .map((k) => {
                    const w = state.hunger.factors.weights[k === "time_since_meal" ? "time" : k] ?? 0;
                    const v = state.hunger.factors[k];
                    return (
                      <div className="factor" key={k}>
                        <span className="muted">{FACTOR_LABEL[k]}</span>
                        <div className="factor-track"><div className="factor-fill" style={{ width: `${v * 100}%` }} /></div>
                        <span className="subtle num" title={`weight ${w}`}>{Math.round(v * w * 100)}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="card">
              <h3>On the wrist</h3>
              <WatchFace
                now={state.now}
                order={order}
                score={state.hunger.score}
                autopilot={user.mode === "autopilot"}
                busy={busy}
                onConfirm={() => order && act(() => api.confirm(order.id, "watch_tap"))}
                onDecline={() => order && act(() => api.cancel(order.id))}
              />
              <p className="subtle" style={{ textAlign: "center", marginTop: 10 }}>
                {user.mode === "confirm" && "Confirm mode: nothing is ordered without a tap."}
                {user.mode === "autopilot" && `Autopilot: orders itself unless cancelled within ${user.cancel_window_min} min.`}
                {user.mode === "off" && "Auto-ordering is off."}
              </p>
            </div>

            <div className="card">
              <h3>Today</h3>
              <div className="grid cols-2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="stat-label">Eaten</div>
                  <div className="stat-value">{state.today.eaten_kcal} <span className="subtle">kcal</span></div>
                </div>
                <div>
                  <div className="stat-label">Burned</div>
                  <div className="stat-value">{state.today.burned_kcal} <span className="subtle">kcal</span></div>
                </div>
                <div>
                  <div className="stat-label">Glucose</div>
                  <div className="stat-value">
                    {state.latest_reading?.glucose_mgdl != null ? Math.round(state.latest_reading.glucose_mgdl) : "–"}{" "}
                    <span className="subtle">mg/dL</span>
                  </div>
                </div>
                <div>
                  <div className="stat-label">Heart rate</div>
                  <div className="stat-value">{state.latest_reading?.heart_rate ?? "–"} <span className="subtle">bpm</span></div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                {state.today.meals.map((m, i) => (
                  <div key={i} className="row" style={{ fontSize: 13, padding: "4px 0", borderTop: "1px solid var(--border)" }}>
                    <span className="subtle num" style={{ width: 64 }}>{clock(m.ts)}</span>
                    <span>{m.label}</span>
                    <span className="spacer" />
                    <span className="num muted">{m.kcal} kcal</span>
                    {m.source === "order" && <span className="pill pill-brand">Fuelcast</span>}
                  </div>
                ))}
              </div>
              <p className="subtle" style={{ marginTop: 8 }}>
                Week: {money(state.week_spend_cents)} of {money(user.weekly_budget_cents)} budget
              </p>
            </div>
          </section>

          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Glucose (simulated CGM), mg/dL</h3>
              <LineChart
                ariaLabel="Glucose over the last 10 hours"
                points={readings.map((r) => ({ ts: r.ts, value: r.glucose_mgdl }))}
                unit="mg/dL" yMin={70} yMax={140}
                band={{ from: user.glucose_baseline - 5, to: user.glucose_baseline + 5, label: "usual" }}
              />
              <p className="subtle" style={{ marginTop: 6 }}>Shaded band is this person's usual level ({user.glucose_baseline} mg/dL).</p>
            </div>
            <div className="card">
              <h3>Hunger score</h3>
              <LineChart
                ariaLabel="Hunger score over the last 10 hours"
                points={history.map((h) => ({ ts: h.ts, value: h.score }))}
                unit="/ 100" yMin={0} yMax={100}
                threshold={{ value: user.hunger_threshold, label: `orders at ${user.hunger_threshold}` }}
              />
              <p className="subtle" style={{ marginTop: 6 }}>Recomputed every 5 minutes from all signals.</p>
            </div>
          </section>

          <section className="grid cols-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>
                Meals that fit right now · ~{state.recommendations.kcal_goal} kcal, {state.recommendations.protein_goal} g+ protein
              </h3>
              <div className="grid" style={{ gap: 10 }}>
                {state.recommendations.options.map((o, i) => (
                  <div className={`option ${i === 0 ? "option-best" : ""}`} key={o.restaurant.id}>
                    <div className="row">
                      <strong>{o.items.map((it) => it.name).join(" + ")}</strong>
                      {i === 0 && <span className="pill pill-brand">Best fit</span>}
                      <span className="spacer" />
                      <span className="num">{money(o.total_cents)}</span>
                    </div>
                    <div className="subtle">
                      {o.restaurant.name} · {o.restaurant.cuisine} · ★ {o.restaurant.rating} · {o.eta_minutes} min via {o.restaurant.delivery_partner}
                    </div>
                    <div className="row" style={{ fontSize: 13 }}>
                      <span className="muted">{o.why}</span>
                      <span className="spacer" />
                      <button
                        className="btn btn-sm" disabled={busy || !!order}
                        onClick={() => act(() => api.placeOrder(userId!, o.restaurant.id, o.items.map((it) => it.id)))}
                      >
                        Order this
                      </button>
                    </div>
                  </div>
                ))}
                {!state.recommendations.options.length && <p className="subtle">Nothing fits the remaining budget.</p>}
              </div>
              <p className="subtle" style={{ marginTop: 10 }}>
                Filtered for {user.allergies.length ? `${user.allergies.join(", ")} allergy` : "no allergies"}
                {user.diet.length ? `, ${user.diet.join(", ")}` : ""}.
              </p>
            </div>

            <div className="card">
              <h3>Orders</h3>
              {order && order.status !== "proposed" && (
                <div style={{ marginBottom: 14 }}>
                  <div className="row">
                    <strong>{order.restaurant.name}</strong>
                    <span className={`pill ${STATUS_TONE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
                    <span className="spacer" />
                    {order.eta && <span className="subtle">Arrives {clock(order.eta)}</span>}
                  </div>
                  <div className="steps" aria-hidden>
                    {STEPS.map((s) => (
                      <div key={s} className={`step ${STEPS.indexOf(order.status) >= STEPS.indexOf(s) ? "step-on" : ""}`} />
                    ))}
                  </div>
                  {["confirmed", "preparing"].includes(order.status) && (
                    <button className="btn btn-sm" disabled={busy} onClick={() => act(() => api.cancel(order.id))}>Cancel order</button>
                  )}
                </div>
              )}
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Time</th><th>Meal</th><th>Why</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th></tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 8).map((o) => (
                      <tr key={o.id}>
                        <td className="num subtle" style={{ whiteSpace: "nowrap" }}>
                          {new Date(o.created_at).toLocaleDateString([], { weekday: "short" })} {clock(o.created_at)}
                        </td>
                        <td>
                          {o.items.map((i) => i.name).join(" + ")}
                          <div className="subtle">{o.restaurant.name}</div>
                        </td>
                        <td className="subtle" style={{ maxWidth: 220 }}>
                          {o.trigger === "manual" ? "Ordered by hand" : `Hunger ${o.hunger_score}`}
                          {o.confirmed_via && ` · ${VIA_LABEL[o.confirmed_via] ?? o.confirmed_via}`}
                        </td>
                        <td><span className={`pill ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span></td>
                        <td className="num" style={{ textAlign: "right" }}>{money(o.total_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="card" style={{ marginTop: 16 }}>
            <h3>Guardrails for {user.name.split(" ")[0]}</h3>
            <div className="row" style={{ gap: 20 }}>
              <Setting label="Order when hunger reaches" value={user.hunger_threshold} min={40} max={95}
                onSave={(v) => act(() => api.updateSettings(userId!, { hunger_threshold: v }))} />
              <Setting label="Weekly budget ($)" value={user.weekly_budget_cents / 100} min={0} max={1000}
                onSave={(v) => act(() => api.updateSettings(userId!, { weekly_budget_cents: v * 100 }))} />
              <Setting label="Max orders a day" value={user.max_orders_per_day} min={0} max={6}
                onSave={(v) => act(() => api.updateSettings(userId!, { max_orders_per_day: v }))} />
              <Setting label="Autopilot cancel window (min)" value={user.cancel_window_min} min={1} max={30}
                onSave={(v) => act(() => api.updateSettings(userId!, { cancel_window_min: v }))} />
            </div>
            <p className="subtle" style={{ marginTop: 10 }}>{user.persona}. Delivers to {user.delivery_address}.</p>
          </section>
        </>
      )}
    </main>
  );
}

function Setting({ label, value, min, max, onSave }: {
  label: string; value: number; min: number; max: number; onSave: (v: number) => void;
}) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="grid" style={{ gap: 4, fontSize: 13 }}>
      <span className="muted">{label}</span>
      <input
        type="number" min={min} max={max} value={v} style={{ width: 120 }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Number(v);
          if (!Number.isNaN(n) && n !== value) onSave(Math.min(max, Math.max(min, Math.round(n))));
        }}
      />
    </label>
  );
}
