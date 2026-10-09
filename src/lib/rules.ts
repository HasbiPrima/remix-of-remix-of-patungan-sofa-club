import type { AppState, EventItem, Group, Role, User } from "./types";

/** Round up to the nearest Rp1.000 */
export const ceil1000 = (x: number) => Math.ceil(x / 1000) * 1000;

export function calcSlotPrices(total: number, slots: number, dpPercent: number) {
  const dpPerSlot = ceil1000((total * dpPercent) / 100 / slots);
  const lunasPerSlot = ceil1000(Math.max(0, total - dpPerSlot * slots) / slots);
  return { dpPerSlot, lunasPerSlot };
}

/** Deadline H-n at 23:59:59 WIB (UTC+7) for an event date */
export function deadline(date: string, n: number) {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d - n, 16, 59, 59, 999);
}

export const dpDeadline = (e: EventItem) => deadline(e.date, 14);
export const lunasDeadline = (e: EventItem) => deadline(e.date, 7);
export const voteDeadline = (e: EventItem) => deadline(e.date, 3);
export const eventEnd = (e: EventItem) => deadline(e.date, 0);
export const ratingStart = (e: EventItem) => deadline(e.date, 0) + 1; // H+1 00:00 WIB
export const ratingEnd = (e: EventItem) => deadline(e.date, -3);

export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (ms: number, withTime = true) =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(ms) + (withTime ? " WIB" : "");

export const fmtEventDate = (date: string) => fmtDate(deadline(date, 0) - 1000 * 60 * 60 * 23, false);

export const roleLabel: Record<Role, string> = {
  user: "User",
  host_collective: "Host Collective",
  host_venue: "Host Venue",
  admin: "Admin",
};

export const statusLabel: Record<Group["status"], string> = {
  DP_BOOKING: "DP Booking",
  PELUNASAN: "Pelunasan",
  LUNAS: "Lunas",
  SELESAI: "Selesai",
  BATAL: "Batal",
};

export const lunasCount = (g: Group) => g.members.filter((m) => m.lunasPaid).reduce((a, m) => a + 1 + (m.extraSlots?.length ?? 0), 0) + g.emptyLunasPaid;
export const dpComplete = (g: Group) => g.leaderPaidAllDp || g.members.reduce((a, m) => a + 1 + (m.extraSlots?.length ?? 0), 0) >= g.slots;
export const lunasComplete = (g: Group) => lunasCount(g) >= g.slots;

export type Action =
  | "group.create"
  | "group.join"
  | "group.pay"
  | "group.payAllDp"
  | "ticket.buy"
  | "vote"
  | "rate"
  | "referral.apply"
  | "profile.update"
  | "verify.request"
  | "event.create"
  | "event.cancel"
  | "sofa.manage"
  | "admin.verify"
  | "admin.cancelGroup"
  | "admin.viewLogs";

const roleMatrix: Record<Action, Role[]> = {
  "group.create": ["user"],
  "group.join": ["user"],
  "group.pay": ["user"],
  "group.payAllDp": ["user"],
  "ticket.buy": ["user"],
  vote: ["user"],
  rate: ["user"],
  "referral.apply": ["user"],
  "profile.update": ["user", "host_collective", "host_venue", "admin"],
  "verify.request": ["user", "host_collective", "host_venue"],
  "event.create": ["host_collective"],
  "event.cancel": ["host_collective", "admin"],
  "sofa.manage": ["host_venue"],
  "admin.verify": ["admin"],
  "admin.cancelGroup": ["admin"],
  "admin.viewLogs": ["admin"],
};

const needsVerified: Action[] = ["group.create", "group.join", "group.pay", "group.payAllDp", "ticket.buy", "event.create", "sofa.manage"];

/** Returns an error message or null if allowed */
export function can(user: User | undefined, action: Action): string | null {
  if (!user) return "Pengguna tidak ditemukan.";
  if (!roleMatrix[action].includes(user.role))
    return `Akses ditolak: peran ${roleLabel[user.role]} tidak boleh melakukan aksi ini.`;
  if (needsVerified.includes(action) && user.verify !== "terverifikasi")
    return "Akun belum terverifikasi. Verifikasi dulu di halaman Akun.";
  return null;
}

export const getEvent = (s: AppState, id: string) => s.events.find((e) => e.id === id);
export const getSofa = (s: AppState, id: string) => s.sofas.find((x) => x.id === id);
export const getVenue = (s: AppState, id: string) => s.venues.find((x) => x.id === id);
export const getUser = (s: AppState, id: string) => s.users.find((x) => x.id === id);
