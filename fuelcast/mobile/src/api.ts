// On a phone, localhost is the phone itself. Set EXPO_PUBLIC_API_URL to your
// computer's LAN address, e.g. http://192.168.1.20:8000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

export type Mode = "off" | "confirm" | "autopilot";

export type OrderStatus =
  | "proposed" | "confirmed" | "preparing" | "on_the_way" | "delivered"
  | "declined" | "expired" | "cancelled";

export type User = {
  id: number;
  name: string;
  persona: string;
  avatar_color: string;
  devices: string[];
  mode: Mode;
  hunger_threshold: number;
  weekly_budget_cents: number;
  max_orders_per_day: number;
  cancel_window_min: number;
  allergies: string[];
  diet: string[];
  delivery_address: string;
};

export type Order = {
  id: number;
  status: OrderStatus;
  trigger: "signal" | "manual";
  confirmed_via: string | null;
  hunger_score: number | null;
  reason: string;
  restaurant: { id: number; name: string; cuisine: string; eta_minutes: number; delivery_partner: string };
  items: { name: string; kcal: number; protein_g: number }[];
  total_cents: number;
  kcal: number;
  protein_g: number;
  created_at: string;
  respond_by: string | null;
  eta: string | null;
};

export type Option = {
  restaurant: { id: number; name: string; cuisine: string; rating: number };
  items: { id: number; name: string }[];
  kcal: number;
  protein_g: number;
  total_cents: number;
  eta_minutes: number;
  why: string;
};

export type UserState = {
  user: User;
  now: string;
  latest_reading: { glucose_mgdl: number | null; heart_rate: number; hrv_ms: number } | null;
  hunger: {
    score: number;
    minutes_to_window: number | null;
    energy_deficit_kcal: number;
    reason: string;
    factors: { glucose_slope: number; has_cgm: boolean; minutes_since_meal: number };
  };
  guardrail: string | null;
  recommendations: { kcal_goal: number; protein_goal: number; options: Option[] };
  active_order: Order | null;
  today: { eaten_kcal: number; burned_kcal: number };
  week_spend_cents: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  users: () => request<User[]>("/api/users"),
  state: (id: number) => request<UserState>(`/api/users/${id}/state`),
  orders: (id: number) => request<Order[]>(`/api/users/${id}/orders?limit=15`),
  confirm: (orderId: number, via: "watch_tap" | "voice" | "phone" = "phone") =>
    post<Order>(`/api/orders/${orderId}/confirm`, { via }),
  cancel: (orderId: number) => post<Order>(`/api/orders/${orderId}/cancel`),
  placeOrder: (userId: number, restaurant_id: number, menu_item_ids: number[]) =>
    post<Order>(`/api/users/${userId}/orders`, { restaurant_id, menu_item_ids }),
  advance: (id: number, minutes: number) =>
    post<{ events: string[] }>(`/api/sim/users/${id}/advance`, { minutes }),
  updateSettings: (id: number, body: Partial<User>) =>
    request<User>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
};

export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const clock = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export const minutesUntil = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));

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
