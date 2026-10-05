export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export type Mode = "off" | "confirm" | "autopilot";

export type User = {
  id: number;
  name: string;
  email: string;
  persona: string;
  avatar_color: string;
  devices: string[];
  daily_kcal_target: number;
  protein_target_g: number;
  glucose_baseline: number;
  mode: Mode;
  hunger_threshold: number;
  weekly_budget_cents: number;
  max_orders_per_day: number;
  cancel_window_min: number;
  allergies: string[];
  diet: string[];
  delivery_address: string;
  sim_now: string;
};

export type Reading = {
  ts: string;
  glucose_mgdl: number | null;
  heart_rate: number;
  hrv_ms: number;
  active_kcal: number;
  steps: number;
};

export type Hunger = {
  ts: string;
  score: number;
  minutes_to_window: number | null;
  energy_deficit_kcal: number;
  reason: string;
  factors: {
    time_since_meal: number;
    glucose: number;
    energy: number;
    stress: number;
    weights: Record<string, number>;
    minutes_since_meal: number;
    glucose_mgdl: number | null;
    glucose_slope: number;
    hrv_ms: number;
    has_cgm: boolean;
    exercising: boolean;
  };
};

export type Restaurant = {
  id: number;
  name: string;
  cuisine: string;
  rating: number;
  eta_minutes: number;
  delivery_partner: string;
  delivery_fee_cents: number;
  verified: boolean;
  items?: MenuItem[];
};

export type MenuItem = {
  id: number;
  restaurant_id: number;
  name: string;
  description: string;
  price_cents: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  glycemic: "low" | "medium" | "high";
  allergens: string[];
  tags: string[];
};

export type Option = {
  restaurant: Restaurant;
  items: MenuItem[];
  kcal: number;
  protein_g: number;
  subtotal_cents: number;
  total_cents: number;
  glycemic: string;
  eta_minutes: number;
  why: string;
};

export type OrderStatus =
  | "proposed" | "confirmed" | "preparing" | "on_the_way" | "delivered"
  | "declined" | "expired" | "cancelled";

export type Order = {
  id: number;
  user_id: number;
  user_name?: string;
  restaurant: Restaurant;
  status: OrderStatus;
  trigger: "signal" | "manual";
  confirmed_via: string | null;
  hunger_score: number | null;
  reason: string;
  items: { name: string; quantity: number; price_cents: number; kcal: number; protein_g: number }[];
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  kcal: number;
  protein_g: number;
  created_at: string;
  respond_by: string | null;
  confirmed_at: string | null;
  eta: string | null;
  delivered_at: string | null;
};

export type UserState = {
  user: User;
  now: string;
  latest_reading: Reading | null;
  hunger: Hunger;
  guardrail: string | null;
  recommendations: {
    kcal_goal: number;
    protein_goal: number;
    budget_left_cents: number;
    options: Option[];
  };
  active_order: Order | null;
  today: {
    eaten_kcal: number;
    burned_kcal: number;
    meals: { ts: string; label: string; kcal: number; source: string }[];
  };
  week_spend_cents: number;
};

export type AdminStats = {
  totals: {
    users: number;
    restaurants: number;
    orders: number;
    placed: number;
    gmv_cents: number;
    avg_order_cents: number;
    signal_share: number;
    acceptance_rate: number;
    avg_hunger_at_trigger: number;
    avg_minutes_to_door: number;
  };
  by_status: Record<string, number>;
  confirmed_via: Record<string, number>;
  orders_by_day: { day: string; orders: number; gmv_cents: number }[];
  top_items: { name: string; count: number }[];
  users: {
    user: { id: number; name: string; mode: Mode; avatar_color: string; devices: string[] };
    orders: number;
    spend_cents: number;
    current_hunger: number;
    now: string;
  }[];
  recent_orders: Order[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  users: () => request<User[]>("/api/users"),
  state: (id: number) => request<UserState>(`/api/users/${id}/state`),
  readings: (id: number, hours = 10) => request<Reading[]>(`/api/users/${id}/readings?hours=${hours}`),
  hungerHistory: (id: number, hours = 10) =>
    request<{ ts: string; score: number; reason: string }[]>(`/api/users/${id}/hunger/history?hours=${hours}`),
  orders: (id: number) => request<Order[]>(`/api/users/${id}/orders`),
  updateSettings: (id: number, body: Partial<User>) =>
    request<User>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  advance: (id: number, minutes: number) =>
    post<{ now: string; events: string[] }>(`/api/sim/users/${id}/advance`, { minutes }),
  workout: (id: number, minutes = 45, intensity = "hard", kind = "Run") =>
    post(`/api/sim/users/${id}/workout`, { minutes, intensity, kind }),
  meal: (id: number, body: { label: string; kcal: number; carbs_g: number; glycemic: string }) =>
    post(`/api/sim/users/${id}/meal`, body),
  confirm: (orderId: number, via = "watch_tap") => post<Order>(`/api/orders/${orderId}/confirm`, { via }),
  cancel: (orderId: number) => post<Order>(`/api/orders/${orderId}/cancel`),
  placeOrder: (userId: number, restaurant_id: number, menu_item_ids: number[]) =>
    post<Order>(`/api/users/${userId}/orders`, { restaurant_id, menu_item_ids }),
  reset: () => post("/api/sim/reset"),
  stats: () => request<AdminStats>("/api/admin/stats"),
  restaurants: () => request<Restaurant[]>("/api/restaurants"),
};

export const unreachable = (e: unknown) =>
  `Can't reach the API at ${API_URL} (${(e as Error).message}). If it's hosted on a free plan it may be ` +
  `waking up, which can take up to a minute; this page keeps retrying.`;

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const minutesBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  proposed: "Waiting for you",
  confirmed: "Confirmed",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<OrderStatus, string> = {
  proposed: "pill-warn",
  confirmed: "pill-info",
  preparing: "pill-info",
  on_the_way: "pill-info",
  delivered: "pill-good",
  declined: "",
  expired: "",
  cancelled: "pill-bad",
};

export const VIA_LABEL: Record<string, string> = {
  watch_tap: "Watch tap",
  voice: "Voice",
  phone: "Phone",
  autopilot: "Autopilot",
};
