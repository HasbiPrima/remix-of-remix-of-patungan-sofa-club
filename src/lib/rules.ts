import type { AppState, EventItem, Group, Member, Pax, Role, Sofa, TxKind, TxStatus, User } from "./types";

/** Round up to the nearest Rp1.000 */
export const ceil1000 = (x: number) => Math.ceil(x / 1000) * 1000;

export const MIN_DP = 500_000;
export const HOLD_MS = 30 * 60_000;

/** U1: DP dan pelunasan dihitung per slot dari kapasitas sofa, dibulatkan ke atas ke Rp1.000. */
export function calcSlotPrices(price: number, dp: number, capacity: number) {
  return { dpPerSlot: ceil1000(dp / capacity), lunasPerSlot: ceil1000(Math.max(0, price - dp) / capacity) };
}
export const sofaPrices = (s: Sofa) => calcSlotPrices(s.price, s.dp, s.capacity);
/** Grup tiket 2/5 orang: tanpa DP, tiap orang bayar harga paket ÷ jumlah orang. */
export const ticketShare = (price: number, pax: Pax) => ceil1000(price / pax);

/** Deadline H-n at 23:59:59 WIB (UTC+7) for an event date (U3). */
export function deadline(date: string, n: number) {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d - n, 16, 59, 59, 999);
}
/** 00:00 WIB at H-n */
export const dayStart = (date: string, n: number) => deadline(date, n + 1) + 1;

export const createDeadline = (e: EventItem) => deadline(e.date, 14); // GRP-05, U13
export const dpDeadline = (e: EventItem) => deadline(e.date, 7); // batas DP H-7
export const lunasDeadline = (e: EventItem) => deadline(e.date, 3); // batas pelunasan H-3
export const voteDeadline = (e: EventItem) => deadline(e.date, 3); // VOT-03, U12
export const payoutStart = (e: EventItem) => dayStart(e.date, 2); // H-2
export const payoutEnd = (e: EventItem) => deadline(e.date, 1); // H-1
export const eventEnd = (e: EventItem) => deadline(e.date, 0);
export const ratingStart = (e: EventItem) => dayStart(e.date, -1); // H+1 00:00 WIB
export const ratingEnd = (e: EventItem) => deadline(e.date, -3); // H+3 23:59 WIB

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

export const fmtEventDate = (date: string) => fmtDate(dayStart(date, 0), false);

export function countdown(now: number, to: number) {
  const ms = to - now;
  if (ms <= 0) return "lewat";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d > 0 ? `${d} hari ${h} jam` : `${h} jam ${Math.floor((ms % 3_600_000) / 60_000)} menit`;
}

/** Umur dalam tahun penuh pada waktu `now` (AKN-03). */
export function ageAt(birthDate: string | undefined, now: number) {
  if (!birthDate) return undefined;
  const [y = 0, m = 1, d = 1] = birthDate.split("-").map(Number);
  const t = new Date(now + 7 * 3_600_000); // WIB
  let age = t.getUTCFullYear() - y;
  if (t.getUTCMonth() + 1 < m || (t.getUTCMonth() + 1 === m && t.getUTCDate() < d)) age--;
  return age;
}

/** Demo hash NIK (di produksi: HMAC-SHA256 di server). */
export function hashNik(nik: string) {
  let h = 2166136261;
  for (const c of nik) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Normalisasi nomor WA ke format 62 (AKN-07). Mengembalikan undefined kalau tidak valid. */
export function normalizeWa(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const wa = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return /^628\d{7,12}$/.test(wa) ? wa : undefined;
}

export const roleLabel: Record<Role, string> = {
  user: "User",
  host_collective: "Host Collective",
  host_venue: "Host Venue",
  admin: "Admin",
};

export const statusLabel: Record<GroupStatus, string> = {
  DP_BOOKING: "DP Booking",
  PELUNASAN: "Pelunasan",
  LUNAS: "Lunas",
  SELESAI: "Selesai",
  BATAL: "Batal",
};
type GroupStatus = Group["status"];

export const payLabel: Record<Member["pay"], string> = {
  menunggu: "Menunggu bayar",
  belum_bayar: "DP ditanggung ketua",
  dp: "DP",
  lunas: "Lunas",
  hangus: "Hangus",
  refund: "Refund",
};

export const memberSlotCount = (m: Member) => 1 + (m.extraSlots?.length ?? 0);
/** Anggota yang masih menempati slot (belum keluar, belum hangus/refund). */
export const activeMembers = (g: Group) => g.members.filter((m) => !m.leftAt && m.pay !== "hangus" && m.pay !== "refund");
export const dpSlots = (g: Group) =>
  activeMembers(g).filter((m) => m.pay === "dp" || m.pay === "lunas").reduce((a, m) => a + memberSlotCount(m), 0);
export const lunasCount = (g: Group) =>
  activeMembers(g).filter((m) => m.pay === "lunas").reduce((a, m) => a + memberSlotCount(m), 0) + g.emptyLunasPaid;
export const dpComplete = (g: Group) => g.leaderPaidAllDp || dpSlots(g) >= g.slots;
export const lunasComplete = (g: Group) => lunasCount(g) >= g.slots;
export const isMember = (g: Group, userId: string) => activeMembers(g).some((m) => m.userId === userId);

export type Action =
  | "group.join"
  | "group.pay"
  | "group.payAllDp"
  | "group.leave"
  | "proposal.create"
  | "ticket.buy"
  | "vote"
  | "rate"
  | "profile.update"
  | "verify.request"
  | "event.manage"
  | "event.cancel"
  | "group.manage"
  | "proposal.decide"
  | "referral.manage"
  | "admin.verify"
  | "admin.users"
  | "admin.refund"
  | "admin.payout";

const roleMatrix: Record<Action, Role[]> = {
  "group.join": ["user"],
  "group.pay": ["user"],
  "group.payAllDp": ["user"],
  "group.leave": ["user"],
  "proposal.create": ["user"],
  "ticket.buy": ["user"],
  vote: ["user"],
  rate: ["user"],
  "profile.update": ["user", "host_collective", "host_venue", "admin"],
  "verify.request": ["user"],
  "event.manage": ["host_collective", "admin"],
  "event.cancel": ["host_collective", "admin"],
  "group.manage": ["host_collective", "admin"],
  "proposal.decide": ["host_collective", "admin"],
  "referral.manage": ["host_collective", "admin"],
  "admin.verify": ["admin"],
  "admin.users": ["admin"],
  "admin.refund": ["admin"],
  "admin.payout": ["admin"],
};

/** AKN-06: hanya akun Terverifikasi yang bisa bergabung, mengajukan grup, dan membayar. */
const needsVerified: Action[] = ["group.join", "group.pay", "group.payAllDp", "proposal.create", "ticket.buy", "vote", "rate"];

/** Returns an error message or null if allowed */
export function can(user: User | undefined, action: Action): string | null {
  if (!user) return "Pengguna tidak ditemukan.";
  if (!user.active) return "Akun dinonaktifkan admin.";
  if (!roleMatrix[action].includes(user.role))
    return `Akses ditolak: peran ${roleLabel[user.role]} tidak boleh melakukan aksi ini.`;
  if (needsVerified.includes(action) && user.verify !== "terverifikasi")
    return "Akun belum terverifikasi. Verifikasi dulu di halaman Akun.";
  return null;
}

/** Host collective hanya boleh mengelola event milik collective-nya. */
export const ownsEvent = (u: User, e: EventItem) => u.role === "admin" || (u.role === "host_collective" && u.collectiveId === e.collectiveId);

/** Batas berikutnya untuk hitung mundur di grup (GRP-06). */
export function nextDeadline(e: EventItem, g: Group): { label: string; at: number } | undefined {
  if (g.status === "DP_BOOKING") return { label: "Batas DP (H-7)", at: dpDeadline(e) };
  if (g.status === "PELUNASAN") return { label: g.kind === "tiket" ? "Batas penuh (H-3)" : "Batas pelunasan (H-3)", at: lunasDeadline(e) };
  if (g.status === "LUNAS") return { label: "Hari H", at: dayStart(e.date, 0) };
  return undefined;
}

export const getEvent = (s: AppState, id: string) => s.events.find((e) => e.id === id);
export const getSofa = (s: AppState, id: string | undefined) => s.sofas.find((x) => x.id === id);
export const getVenue = (s: AppState, id: string) => s.venues.find((x) => x.id === id);
export const getUser = (s: AppState, id: string | undefined) => s.users.find((x) => x.id === id);
export const getCollective = (s: AppState, id: string) => s.collectives.find((x) => x.id === id);
export const groupName = (s: AppState, g: Group) =>
  g.kind === "sofa" ? getSofa(s, g.sofaId)?.name ?? "Sofa" : `Tiket ${g.ticketPax} orang`;
export const ticketType = (e: EventItem, pax: Pax) => e.tickets.find((t) => t.pax === pax);
/** Paket tiket yang sudah terpakai: pembelian 1 orang + grup tiket yang tidak batal. */
export const ticketUsed = (s: AppState, e: EventItem, pax: Pax) =>
  pax === 1
    ? s.etickets.filter((t) => t.eventId === e.id && t.pax === 1 && t.status !== "batal").length
    : s.groups.filter((g) => g.eventId === e.id && g.kind === "tiket" && g.ticketPax === pax && g.status !== "BATAL").length;

export const txKindLabel: Record<TxKind, string> = {
  dp: "DP", dp_penuh_ketua: "DP penuh ketua", pelunasan: "Pelunasan", talangan: "Talangan", tiket: "Tiket", refund: "Refund",
};
export const txStatusLabel: Record<TxStatus, string> = { pending: "Menunggu", berhasil: "Berhasil", gagal: "Gagal", kedaluwarsa: "Kedaluwarsa" };
