import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  useColorScheme, View,
} from "react-native";
import {
  api, API_URL, clock, minutesUntil, type Mode, money, type Order, STATUS_LABEL, type User,
  type UserState,
} from "./src/api";

type Tab = "now" | "orders" | "settings";
type Theme = typeof light;

const light = {
  bg: "#f6f5f1", card: "#fcfcfb", border: "#e3e1da", text: "#121211", text2: "#52514e", text3: "#7d7c76",
  brand: "#0f766e", brandInk: "#ffffff", brandSoft: "#d9f0ec", alert: "#e34948", warnSoft: "#fbefd0", warn: "#9a6700",
};
const dark: Theme = {
  bg: "#111110", card: "#1a1a19", border: "#2f2f2c", text: "#f5f5f3", text2: "#c3c2b7", text3: "#8f8e86",
  brand: "#2dd4bf", brandInk: "#062b27", brandSoft: "#123a35", alert: "#e66767", warnSoft: "#33290f", warn: "#d4a72c",
};

const STEPS: Order["status"][] = ["confirmed", "preparing", "on_the_way", "delivered"];

export default function App() {
  const t = useColorScheme() === "dark" ? dark : light;
  const s = styles(t);
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [state, setState] = useState<UserState | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("now");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async (id: number) => {
    try {
      const [st, os] = await Promise.all([api.state(id), api.orders(id)]);
      setState(st);
      setOrders(os);
      setError(null);
    } catch (e) {
      setError(`Can't reach the API at ${API_URL}. ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    // Keep retrying: a free hosted API can take up to a minute to wake up.
    let timer: ReturnType<typeof setTimeout>;
    const loadUsers = () =>
      api.users()
        .then((u) => { setUsers(u); setUserId(u[0]?.id ?? null); setError(null); })
        .catch((e) => {
          setError(`Can't reach the API at ${API_URL}. ${e.message}. Retrying…`);
          timer = setTimeout(loadUsers, 5000);
        });
    loadUsers();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (userId === null) return;
    load(userId);
    // Poll so changes made from the web dashboard show up here too.
    const timer = setInterval(() => load(userId), 4000);
    return () => clearInterval(timer);
  }, [userId, load]);

  const act = async (fn: () => Promise<unknown>) => {
    if (userId === null || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
      await load(userId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    if (userId === null) return;
    setRefreshing(true);
    await load(userId);
    setRefreshing(false);
  };

  return (
    <View style={s.root}>
      <StatusBar style={t === dark ? "light" : "dark"} />
      <View style={s.header}>
        <Text style={s.logo}>⚡ Fuelcast</Text>
        <View style={{ flex: 1 }} />
        {users.map((u) => (
          <Pressable
            key={u.id}
            onPress={() => setUserId(u.id)}
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${u.name}`}
            style={[s.avatar, { backgroundColor: u.avatar_color, opacity: u.id === userId ? 1 : 0.35 }]}
          >
            <Text style={s.avatarText}>{u.name[0]}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {error && <Text style={s.error}>{error}</Text>}
        {!state && !error && <ActivityIndicator style={{ marginTop: 40 }} />}
        {state && tab === "now" && <NowScreen s={s} t={t} state={state} busy={busy} act={act} userId={userId!} />}
        {state && tab === "orders" && <OrdersScreen s={s} orders={orders} />}
        {state && tab === "settings" && <SettingsScreen s={s} t={t} user={state.user} busy={busy} act={act} />}
      </ScrollView>

      <View style={s.tabBar}>
        {(["now", "orders", "settings"] as Tab[]).map((k) => (
          <Pressable key={k} onPress={() => setTab(k)} style={s.tabItem} accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}>
            <Text style={[s.tabIcon, { opacity: tab === k ? 1 : 0.45 }]}>{{ now: "◉", orders: "☰", settings: "⚙" }[k]}</Text>
            <Text style={[s.tabLabel, { color: tab === k ? t.brand : t.text3 }]}>
              {{ now: "Now", orders: "Orders", settings: "Guardrails" }[k]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

type Act = (fn: () => Promise<unknown>) => Promise<void>;
type S = ReturnType<typeof styles>;

function NowScreen({ s, t, state, busy, act, userId }: {
  s: S; t: Theme; state: UserState; busy: boolean; act: Act; userId: number;
}) {
  const { hunger, user } = state;
  const order = state.active_order;
  const over = hunger.score >= user.hunger_threshold;

  return (
    <>
      <View style={[s.card, { alignItems: "center" }]}>
        <Text style={s.subtle}>{user.name} · {clock(state.now)}</Text>
        <View style={[s.ring, { borderColor: over ? t.alert : t.brand }]}>
          <Text style={s.score}>{hunger.score}</Text>
          <Text style={s.subtle}>hunger</Text>
        </View>
        <Text style={s.reason}>{hunger.reason}.</Text>
        <Text style={[s.subtle, { marginTop: 4, textAlign: "center" }]}>
          {hunger.minutes_to_window === 0
            ? "You're in your hunger window."
            : hunger.minutes_to_window
              ? `Hunger window in about ${hunger.minutes_to_window} min.`
              : "No hunger window predicted yet."}
        </Text>
        <View style={s.statsRow}>
          <Stat s={s} label="Glucose" value={state.latest_reading?.glucose_mgdl != null ? `${Math.round(state.latest_reading.glucose_mgdl)}` : "–"} unit="mg/dL" />
          <Stat s={s} label="Heart" value={`${state.latest_reading?.heart_rate ?? "–"}`} unit="bpm" />
          <Stat s={s} label="Burned" value={`${hunger.energy_deficit_kcal}`} unit="kcal since meal" />
        </View>
      </View>

      {order?.status === "proposed" && (
        <View style={[s.card, { borderColor: t.brand, borderWidth: 2 }]}>
          <Text style={s.eyebrow}>Suggested for you</Text>
          <Text style={s.title}>{order.items.map((i) => i.name).join(" + ")}</Text>
          <Text style={s.subtle}>
            {order.restaurant.name} · {order.restaurant.eta_minutes} min · {order.kcal} kcal · {order.protein_g} g protein
          </Text>
          <Text style={[s.body, { marginTop: 8 }]}>Why now: {order.reason.toLowerCase()}.</Text>
          <View style={[s.row, { marginTop: 14 }]}>
            <Pressable disabled={busy} onPress={() => act(() => api.cancel(order.id))} style={[s.btn, { flex: 1 }]}>
              <Text style={s.btnText}>Not now</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => act(() => api.confirm(order.id, "phone"))}
              style={[s.btn, s.btnPrimary, { flex: 2 }]}>
              <Text style={[s.btnText, { color: t.brandInk }]}>Order · {money(order.total_cents)}</Text>
            </Pressable>
          </View>
          {order.respond_by && (
            <Text style={[s.subtle, { marginTop: 8, textAlign: "center" }]}>
              {user.mode === "autopilot"
                ? `Orders itself in ${minutesUntil(state.now, order.respond_by)} min unless you say not now`
                : `Also on your watch · expires in ${minutesUntil(state.now, order.respond_by)} min`}
            </Text>
          )}
        </View>
      )}

      {order && order.status !== "proposed" && (
        <View style={s.card}>
          <Text style={s.eyebrow}>{STATUS_LABEL[order.status]}</Text>
          <Text style={s.title}>{order.restaurant.name}</Text>
          <Text style={s.subtle}>{order.items.map((i) => i.name).join(" + ")}</Text>
          <View style={[s.row, { marginVertical: 12, gap: 4 }]}>
            {STEPS.map((st) => (
              <View key={st} style={[s.step, STEPS.indexOf(order.status) >= STEPS.indexOf(st) && { backgroundColor: t.brand }]} />
            ))}
          </View>
          {order.eta && (
            <Text style={s.body}>
              Arrives {clock(order.eta)} · {minutesUntil(state.now, order.eta)} min via {order.restaurant.delivery_partner}
            </Text>
          )}
        </View>
      )}

      {!order && (
        <View style={s.card}>
          <Text style={s.eyebrow}>Meals that fit right now</Text>
          <Text style={[s.subtle, { marginBottom: 8 }]}>
            About {state.recommendations.kcal_goal} kcal and {state.recommendations.protein_goal} g+ protein
          </Text>
          {state.recommendations.options.map((o) => (
            <View key={o.restaurant.id} style={s.option}>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{o.items.map((i) => i.name).join(" + ")}</Text>
                <Text style={s.subtle}>{o.restaurant.name} · {o.eta_minutes} min · {o.kcal} kcal</Text>
              </View>
              <Pressable disabled={busy} style={[s.btn, s.btnSm]}
                onPress={() => act(() => api.placeOrder(userId, o.restaurant.id, o.items.map((i) => i.id)))}>
                <Text style={s.btnText}>{money(o.total_cents)}</Text>
              </Pressable>
            </View>
          ))}
          {state.guardrail && over && (
            <Text style={[s.pill, { backgroundColor: t.warnSoft, color: t.warn }]}>{state.guardrail}</Text>
          )}
        </View>
      )}

      <View style={[s.card, s.row]}>
        <Text style={[s.subtle, { flex: 1 }]}>Demo: move the simulated clock</Text>
        <Pressable disabled={busy} style={[s.btn, s.btnSm]} onPress={() => act(() => api.advance(userId, 15))}>
          <Text style={s.btnText}>+15 min</Text>
        </Pressable>
        <Pressable disabled={busy} style={[s.btn, s.btnSm]} onPress={() => act(() => api.advance(userId, 60))}>
          <Text style={s.btnText}>+1 h</Text>
        </Pressable>
      </View>
    </>
  );
}

function OrdersScreen({ s, orders }: { s: S; orders: Order[] }) {
  return (
    <View style={s.card}>
      <Text style={s.eyebrow}>Recent orders</Text>
      {orders.map((o) => (
        <View key={o.id} style={s.option}>
          <View style={{ flex: 1 }}>
            <Text style={s.body}>{o.items.map((i) => i.name).join(" + ")}</Text>
            <Text style={s.subtle}>
              {new Date(o.created_at).toLocaleDateString([], { weekday: "short" })} {clock(o.created_at)} · {o.restaurant.name}
              {o.trigger === "signal" ? ` · hunger ${o.hunger_score}` : " · by hand"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.body}>{money(o.total_cents)}</Text>
            <Text style={s.subtle}>{STATUS_LABEL[o.status]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const MODES: { key: Mode; title: string; body: string }[] = [
  { key: "confirm", title: "Confirm on watch", body: "Suggests a meal; nothing is ordered without your tap." },
  { key: "autopilot", title: "Autopilot", body: "Orders unless you cancel within the cancel window." },
  { key: "off", title: "Off", body: "Never suggests or orders." },
];

function SettingsScreen({ s, t, user, busy, act }: { s: S; t: Theme; user: User; busy: boolean; act: Act }) {
  const step = (key: keyof User, delta: number, min: number, max: number) => {
    const next = Math.min(max, Math.max(min, (user[key] as number) + delta));
    return act(() => api.updateSettings(user.id, { [key]: next } as Partial<User>));
  };
  return (
    <>
      <View style={s.card}>
        <Text style={s.eyebrow}>Ordering mode</Text>
        {MODES.map((m) => (
          <Pressable key={m.key} disabled={busy} onPress={() => act(() => api.updateSettings(user.id, { mode: m.key }))}
            style={[s.option, { alignItems: "flex-start" }]} accessibilityRole="radio"
            accessibilityState={{ checked: user.mode === m.key }}>
            <View style={[s.radio, user.mode === m.key && { borderColor: t.brand, borderWidth: 6 }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.body}>{m.title}</Text>
              <Text style={s.subtle}>{m.body}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={s.card}>
        <Text style={s.eyebrow}>Limits</Text>
        <Stepper s={s} label="Order when hunger reaches" value={`${user.hunger_threshold}`} busy={busy}
          onMinus={() => step("hunger_threshold", -5, 40, 95)} onPlus={() => step("hunger_threshold", 5, 40, 95)} />
        <Stepper s={s} label="Weekly budget" value={money(user.weekly_budget_cents)} busy={busy}
          onMinus={() => step("weekly_budget_cents", -2500, 0, 100000)} onPlus={() => step("weekly_budget_cents", 2500, 0, 100000)} />
        <Stepper s={s} label="Max orders a day" value={`${user.max_orders_per_day}`} busy={busy}
          onMinus={() => step("max_orders_per_day", -1, 0, 6)} onPlus={() => step("max_orders_per_day", 1, 0, 6)} />
        <Stepper s={s} label="Autopilot cancel window" value={`${user.cancel_window_min} min`} busy={busy}
          onMinus={() => step("cancel_window_min", -1, 1, 30)} onPlus={() => step("cancel_window_min", 1, 1, 30)} />
      </View>
      <View style={s.card}>
        <Text style={s.eyebrow}>Never suggest</Text>
        <Text style={s.body}>
          {[...user.allergies.map((a) => `${a} (allergy)`), ...user.diet.map((d) => `non-${d} meals`)].join(", ") || "No restrictions"}
        </Text>
        <Text style={[s.eyebrow, { marginTop: 14 }]}>Connected devices</Text>
        <Text style={s.body}>{user.devices.map((d) => ({ cgm: "Glucose sensor (simulated)", watch: "Watch (simulated)", ring: "Ring (simulated)" }[d] ?? d)).join("\n")}</Text>
        <Text style={[s.eyebrow, { marginTop: 14 }]}>Deliver to</Text>
        <Text style={s.body}>{user.delivery_address}</Text>
      </View>
    </>
  );
}

function Stat({ s, label, value, unit }: { s: S; label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={s.subtle}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={[s.subtle, { fontSize: 11, textAlign: "center" }]}>{unit}</Text>
    </View>
  );
}

function Stepper({ s, label, value, busy, onMinus, onPlus }: {
  s: S; label: string; value: string; busy: boolean; onMinus: () => void; onPlus: () => void;
}) {
  return (
    <View style={s.option}>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
      <Pressable disabled={busy} onPress={onMinus} style={[s.btn, s.btnSm]} accessibilityLabel={`Decrease ${label}`}>
        <Text style={s.btnText}>−</Text>
      </Pressable>
      <Text style={[s.body, { minWidth: 70, textAlign: "center" }]}>{value}</Text>
      <Pressable disabled={busy} onPress={onPlus} style={[s.btn, s.btnSm]} accessibilityLabel={`Increase ${label}`}>
        <Text style={s.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 14 : 56, paddingBottom: 10, backgroundColor: t.bg,
      borderBottomWidth: 1, borderBottomColor: t.border,
    },
    logo: { fontSize: 18, fontWeight: "700", color: t.text },
    avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#fff", fontWeight: "700" },
    scroll: { padding: 16, gap: 12, paddingBottom: 32 },
    card: { backgroundColor: t.card, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 16 },
    ring: {
      width: 150, height: 150, borderRadius: 75, borderWidth: 10, alignItems: "center", justifyContent: "center",
      marginVertical: 14,
    },
    score: { fontSize: 46, fontWeight: "800", color: t.text },
    reason: { fontSize: 16, fontWeight: "600", color: t.text, textAlign: "center" },
    statsRow: { flexDirection: "row", marginTop: 16, alignSelf: "stretch" },
    statValue: { fontSize: 22, fontWeight: "700", color: t.text },
    eyebrow: { fontSize: 12, fontWeight: "700", color: t.brand, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
    title: { fontSize: 20, fontWeight: "700", color: t.text, marginBottom: 2 },
    body: { fontSize: 15, color: t.text },
    subtle: { fontSize: 13, color: t.text2 },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    btn: {
      borderWidth: 1, borderColor: t.border, backgroundColor: t.card, borderRadius: 12,
      paddingVertical: 12, paddingHorizontal: 14, alignItems: "center",
    },
    btnSm: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10 },
    btnPrimary: { backgroundColor: t.brand, borderColor: t.brand },
    btnText: { fontSize: 15, fontWeight: "600", color: t.text },
    option: {
      flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10,
      borderTopWidth: 1, borderTopColor: t.border,
    },
    step: { flex: 1, height: 6, borderRadius: 3, backgroundColor: t.border },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: t.text3, marginTop: 2 },
    pill: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, fontSize: 12, fontWeight: "600", overflow: "hidden" },
    error: { color: t.alert, fontSize: 14 },
    tabBar: {
      flexDirection: "row", borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.card,
      paddingBottom: Platform.OS === "ios" ? 24 : 8, paddingTop: 8,
    },
    tabItem: { flex: 1, alignItems: "center" },
    tabIcon: { fontSize: 18, color: t.text },
    tabLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  });
