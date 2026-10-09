import { calcSlotPrices } from "./rules";
import type { AppState, Group, Sofa } from "./types";

export const SEED_NOW = Date.UTC(2026, 9, 8, 8, 40); // 8 Okt 2026 15:40 WIB

const h = (hours: number) => SEED_NOW - hours * 3600_000;

export function makeSeed(): AppState {
  const sofas: Sofa[] = [
    { id: "s1", venueId: "v1", name: "Sofa VIP A1", capacity: 6, price: 6_000_000, active: true },
    { id: "s2", venueId: "v1", name: "Sofa VIP A2", capacity: 5, price: 4_750_000, active: true },
    { id: "s3", venueId: "v1", name: "Sofa Regular B1", capacity: 4, price: 2_500_000, active: true },
    { id: "s4", venueId: "v2", name: "Booth Gold 1", capacity: 8, price: 9_000_000, active: true },
    { id: "s5", venueId: "v2", name: "Booth Silver 2", capacity: 4, price: 3_100_000, active: true },
    { id: "s6", venueId: "v3", name: "Sofa Terrace", capacity: 3, price: 1_850_000, active: true },
    { id: "s7", venueId: "v3", name: "Sofa Lounge", capacity: 2, price: 1_200_000, active: true },
  ];

  const mk = (
    id: string,
    eventId: string,
    sofaId: string,
    leaderId: string,
    status: Group["status"],
    dpPercent: number,
    extra: Partial<Group>,
  ): Group => {
    const sofa = sofas.find((s) => s.id === sofaId)!;
    const p = calcSlotPrices(sofa.price, sofa.capacity, dpPercent);
    return {
      id, eventId, sofaId, leaderId, status, slots: sofa.capacity, ...p,
      members: [], leaderPaidAllDp: false, emptyLunasPaid: 0, votes: {}, ratings: {}, createdAt: h(72),
      ...extra,
    };
  };
  const m = (userId: string, lunas = false, covered = false) => ({
    userId, dpPaid: true, dpCoveredByLeader: covered, lunasPaid: lunas, joinedAt: h(48),
  });

  return {
    now: SEED_NOW,
    seq: 100,
    currentUserId: "u1",
    autoScheduler: true,
    users: [
      { id: "u1", name: "Budi Santoso", role: "user", phone: "0812-1111-2222", verify: "terverifikasi", referralCode: "BUDI26" },
      { id: "u2", name: "Sari Wulandari", role: "user", phone: "0813-3333-4444", verify: "terverifikasi", referralCode: "SARI26", referredBy: "u1" },
      { id: "u3", name: "Dimas Prakoso", role: "user", phone: "0857-5555-6666", verify: "terverifikasi", referralCode: "DIMAS26" },
      { id: "u4", name: "Rina Kusuma", role: "user", phone: "0878-7777-8888", verify: "belum", referralCode: "RINA26" },
      { id: "u5", name: "Ayu Lestari", role: "user", phone: "0821-9999-0000", verify: "menunggu", referralCode: "AYU26" },
      { id: "hc1", name: "Raka (Neon Kopi Collective)", role: "host_collective", phone: "0811-2020-3030", verify: "terverifikasi", referralCode: "NEON26" },
      { id: "hc2", name: "Tara (Bassline Jogja)", role: "host_collective", phone: "0811-4040-5050", verify: "terverifikasi", referralCode: "BASS26" },
      { id: "hv1", name: "Wulan (Liquid & Boshe)", role: "host_venue", phone: "0822-6060-7070", verify: "terverifikasi", referralCode: "WULAN26" },
      { id: "hv2", name: "Agus (Hugo's Bantul)", role: "host_venue", phone: "0822-8080-9090", verify: "terverifikasi", referralCode: "AGUS26" },
      { id: "adm1", name: "Admin Sofamates", role: "admin", phone: "0274-000-000", verify: "terverifikasi", referralCode: "ADMIN26" },
    ],
    venues: [
      { id: "v1", name: "Liquid Jogja", area: "Sleman", hostId: "hv1" },
      { id: "v2", name: "Boshe VVIP Club", area: "Kota Yogyakarta", hostId: "hv1" },
      { id: "v3", name: "Hugo's Bantul", area: "Bantul", hostId: "hv2" },
    ],
    sofas,
    events: [
      { id: "e1", title: "Neon Kopi Night Vol. 7", collective: "Neon Kopi Collective", hostId: "hc1", venueId: "v1", date: "2026-10-30", lineup: "DJ Kalea, Sendja b2b Rimba", dpPercent: 30, tickets: { p1: 150_000, p2: 280_000, p5: 650_000 }, drinks: ["Jack Daniel's", "Chivas Regal 12", "Absolut Vodka", "Soju Party Pack"], cancelled: false },
      { id: "e2", title: "Bassline Prambanan Rave", collective: "Bassline Jogja", hostId: "hc2", venueId: "v2", date: "2026-10-20", lineup: "Mantra, Dhyana, Lowkey", dpPercent: 40, tickets: { p1: 200_000, p2: 380_000, p5: 900_000 }, drinks: ["Hennessy VS", "Jägermeister", "Bombay Sapphire"], cancelled: false },
      { id: "e3", title: "Malioboro After Dark", collective: "Neon Kopi Collective", hostId: "hc1", venueId: "v3", date: "2026-10-13", lineup: "Ratu Kopi, DJ Gudeg", dpPercent: 30, tickets: { p1: 120_000, p2: 220_000, p5: 500_000 }, drinks: ["Smirnoff", "Bacardi", "Anggur Merah Lokal"], cancelled: false },
      { id: "e4", title: "Kaliurang Sunset Sessions", collective: "Bassline Jogja", hostId: "hc2", venueId: "v3", date: "2026-10-06", lineup: "Senja Sound System", dpPercent: 30, tickets: { p1: 100_000, p2: 190_000, p5: 450_000 }, drinks: ["Gin Tonic Tower", "Beer Bucket"], cancelled: false },
    ],
    groups: [
      mk("g1", "e1", "s1", "u1", "DP_BOOKING", 30, { members: [m("u1"), m("u2")] }),
      mk("g2", "e1", "s3", "u3", "DP_BOOKING", 30, { members: [m("u3")] }),
      mk("g3", "e2", "s5", "u2", "PELUNASAN", 40, { leaderPaidAllDp: true, termsAcceptedAt: h(200), members: [m("u2", true), m("u1", false, true)] }),
      mk("g4", "e3", "s6", "u1", "LUNAS", 30, { members: [m("u1", true), m("u3", true), m("u2", true)], votes: { u1: "Smirnoff", u3: "Bacardi" } }),
      mk("g5", "e4", "s7", "u3", "SELESAI", 30, { members: [m("u3", true), m("u1", true)], ratings: { u3: { stars: 5, comment: "Sound mantap, view sunset juara!", at: h(10) } } }),
    ],
    tickets: [
      { id: "t1", eventId: "e1", userId: "u2", pax: 2, price: 280_000, at: h(30), code: "SFM-E1-0001" },
      { id: "t2", eventId: "e3", userId: "u3", pax: 1, price: 120_000, at: h(20), code: "SFM-E3-0002" },
    ],
    notifs: [
      { id: "n1", userId: "u1", text: "Selamat datang di Sofamates! Coba buat grup sofa pertamamu.", at: h(5), read: false },
      { id: "n2", userId: "u1", text: "Grup Sofa Lounge (Kaliurang Sunset Sessions) selesai. Beri rating sampai H+3!", at: h(8), read: false, link: "/grup/g5" },
      { id: "n3", userId: "adm1", text: "Ayu Lestari mengajukan verifikasi akun.", at: h(3), read: false, link: "/admin" },
    ],
    logs: [
      { id: "l1", at: h(72), actorId: "u1", action: "group.create", detail: "Membuat grup g1 untuk Neon Kopi Night Vol. 7" },
      { id: "l2", at: h(48), actorId: "u2", action: "group.join", detail: "Bergabung ke grup g1 dan bayar DP" },
      { id: "l3", at: h(3), actorId: "u5", action: "verify.request", detail: "Mengajukan verifikasi akun" },
    ],
  };
}
