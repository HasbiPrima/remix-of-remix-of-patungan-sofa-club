import { dayStart, deadline, sofaPrices, ticketShare } from "./rules";
import type { AppState, Group, Member, Sofa, Tx, TxKind, User } from "./types";

export const SEED_NOW = Date.UTC(2026, 9, 8, 8, 40); // 8 Okt 2026 15:40 WIB
const h = (hours: number) => SEED_NOW - hours * 3600_000;

const sofa = (id: string, eventId: string, name: string, capacity: number, price: number, dp: number, drinks: string[]): Sofa => ({
  id, eventId, name, capacity, price, dp, drinkPackage: `Paket ${drinks.length} pilihan botol + mixer`, drinks,
});

const user = (u: Partial<User> & Pick<User, "id" | "name" | "role">): User => ({
  email: `${u.id}@sofamates.id`, active: true, phone: "", verify: "terverifikasi", ...u,
});

export function makeSeed(): AppState {
  const sofas: Sofa[] = [
    sofa("s11", "e1", "VIP A1", 6, 6_000_000, 1_200_000, ["Jack Daniel's", "Chivas Regal 12", "Absolut Vodka"]),
    sofa("s12", "e1", "VIP A2", 5, 4_750_000, 1_000_000, ["Jack Daniel's", "Soju Party Pack"]),
    sofa("s13", "e1", "Regular B1", 4, 2_500_000, 500_000, ["Smirnoff", "Beer Bucket"]),
    sofa("s14", "e1", "Regular B2", 4, 2_600_000, 600_000, ["Smirnoff", "Bacardi"]),
    sofa("s21", "e2", "Booth Gold 1", 8, 9_000_000, 2_000_000, ["Hennessy VS", "Jägermeister", "Bombay Sapphire"]),
    sofa("s22", "e2", "Booth Silver 2", 4, 3_100_000, 600_000, ["Jägermeister", "Bombay Sapphire"]),
    sofa("s23", "e2", "Booth Silver 3", 5, 3_000_000, 500_000, ["Jägermeister", "Beer Bucket"]),
    sofa("s31", "e3", "Terrace", 3, 1_850_000, 500_000, ["Smirnoff", "Bacardi", "Anggur Merah Lokal"]),
    sofa("s32", "e3", "Lounge", 2, 1_200_000, 500_000, ["Smirnoff", "Bacardi"]),
    sofa("s33", "e3", "Garden", 4, 2_400_000, 600_000, ["Gin Tonic Tower", "Beer Bucket"]),
    sofa("s51", "e5", "VIP 1", 5, 3_000_000, 500_000, ["Chivas Regal 12", "Absolut Vodka"]),
    sofa("s52", "e5", "VIP 2", 4, 2_800_000, 500_000, ["Chivas Regal 12", "Absolut Vodka", "Soju Party Pack"]),
    sofa("s41", "e4", "Lounge", 2, 1_200_000, 500_000, ["Gin Tonic Tower", "Beer Bucket"]),
    sofa("s42", "e4", "Terrace", 3, 1_850_000, 500_000, ["Gin Tonic Tower", "Beer Bucket"]),
    sofa("s61", "e6", "VIP A1", 6, 6_500_000, 1_500_000, ["Jack Daniel's", "Chivas Regal 12"]),
  ];

  const txs: Tx[] = [];
  let txSeq = 0;
  const pay = (userId: string, eventId: string, kind: TxKind, amount: number, at: number, extra: Partial<Tx> = {}) => {
    txSeq += 1;
    const id = `tx${txSeq}`;
    txs.unshift({ id, userId, eventId, kind, amount, status: "berhasil", gatewayRef: `PG-${id.toUpperCase()}`, createdAt: at, paidAt: at, ...extra });
    return id;
  };
  const mem = (userId: string, slotNumber: number, payStatus: Member["pay"], extra: Partial<Member> = {}): Member => ({
    userId, slotNumber, pay: payStatus, joinedAt: h(96), ...extra,
  });
  const sofaGroup = (id: string, sofaId: string, status: Group["status"], members: Member[], extra: Partial<Group> = {}): Group => {
    const s = sofas.find((x) => x.id === sofaId)!;
    const g: Group = {
      id, kind: "sofa", eventId: s.eventId, sofaId, createdBy: "hc1", status, slots: s.capacity, ...sofaPrices(s),
      members, leaderPaidAllDp: false, emptyLunasPaid: 0, votes: {}, ratings: [], createdAt: h(120), ...extra,
    };
    // Transaksi sesuai status bayar tiap slot.
    for (const m of members) {
      if (!g.leaderPaidAllDp && ["dp", "lunas", "hangus", "refund"].includes(m.pay))
        pay(m.userId, g.eventId, "dp", g.dpPerSlot, h(90), { groupId: id, memberUserId: m.userId });
      if (m.pay === "lunas" || (m.pay === "refund" && g.status === "BATAL"))
        pay(m.userId, g.eventId, "pelunasan", g.lunasPerSlot, h(40), { groupId: id, memberUserId: m.userId });
    }
    return g;
  };

  const groups: Group[] = [
    sofaGroup("g1", "s11", "DP_BOOKING", [mem("u1", 1, "dp"), mem("u2", 2, "dp", { referralId: "r1" })], { leaderId: "u1", createdBy: "hc1", proposalId: "p0", waLink: "https://chat.whatsapp.com/NeonA1Demo" }),
    sofaGroup("g2", "s13", "DP_BOOKING", [mem("u3", 1, "dp")], { leaderId: "u3" }),
    sofaGroup("g3", "s22", "DP_BOOKING", [mem("u2", 1, "belum_bayar"), mem("u6", 2, "belum_bayar")], { leaderId: "u2", createdBy: "hc2", leaderPaidAllDp: true, termsAcceptedAt: h(100) }),
    // Waktu demo 8 Okt dan semua event di November: belum ada event yang lewat batas H-7,
    // jadi semua grup sofa masih DP BOOKING. Tahap berikutnya dicoba lewat Panel Dev (majukan waktu).
    sofaGroup("g4", "s31", "DP_BOOKING", [mem("u1", 1, "dp"), mem("u3", 2, "dp"), mem("u2", 3, "dp")], { leaderId: "u1", votes: { u1: "Smirnoff", u3: "Bacardi" } }),
    sofaGroup("g5", "s52", "DP_BOOKING", [mem("u1", 1, "dp"), mem("u2", 2, "dp"), mem("u3", 3, "dp")], { leaderId: "u2", createdBy: "hc2", votes: { u1: "Absolut Vodka", u2: "Absolut Vodka", u3: "Chivas Regal 12" } }),
  ];
  // Grup DP ketua: satu transaksi DP penuh.
  pay("u2", "e2", "dp_penuh_ketua", 600_000, h(100), { groupId: "g3", memberUserId: "u2" });
  // Grup tiket 5 orang (TKT-02): bayar penuh bagiannya saat bergabung.
  const share5 = ticketShare(900_000, 5);
  groups.push({
    id: "g7", kind: "tiket", eventId: "e2", ticketPax: 5, createdBy: "hc2", leaderId: "u3", status: "PELUNASAN", slots: 5, dpPerSlot: 0, lunasPerSlot: share5,
    members: [mem("u3", 1, "lunas"), mem("u1", 2, "lunas")], leaderPaidAllDp: false, emptyLunasPaid: 0, votes: {}, ratings: [], createdAt: h(150),
  });
  pay("u3", "e2", "tiket", share5, h(140), { groupId: "g7", memberUserId: "u3", ticketPax: 5 });
  pay("u1", "e2", "tiket", share5, h(130), { groupId: "g7", memberUserId: "u1", ticketPax: 5 });
  // Tiket 1 orang.
  const t1 = pay("u2", "e1", "tiket", 150_000, h(30), { ticketPax: 1 });
  const t2 = pay("u3", "e3", "tiket", 120_000, h(20), { ticketPax: 1 });

  const events: AppState["events"] = [
    // Semua event mulai November 2026 (Jumat/Sabtu malam).
    { id: "e5", title: "Tugu Midnight Groove", collectiveId: "c2", venueId: "v1", date: "2026-11-06", time: "22:00", status: "terbit",
      description: "House & disco classics.",
      tickets: [{ pax: 1, price: 130_000, quota: 100 }, { pax: 2, price: 240_000, quota: 20 }, { pax: 5, price: 550_000, quota: 8 }] },
    { id: "e3", title: "Malioboro After Dark", collectiveId: "c1", venueId: "v3", date: "2026-11-07", time: "22:00", status: "terbit",
      description: "Lineup: Ratu Kopi, DJ Gudeg.",
      tickets: [{ pax: 1, price: 120_000, quota: 80 }, { pax: 2, price: 220_000, quota: 20 }, { pax: 5, price: 500_000, quota: 8 }] },
    { id: "e2", title: "Bassline Prambanan Rave", collectiveId: "c2", venueId: "v2", date: "2026-11-14", time: "21:00", status: "terbit", scheme: "beli_putus",
      description: "Lineup: Mantra, Dhyana, Lowkey. Techno sampai pagi.",
      tickets: [{ pax: 1, price: 200_000, quota: 150 }, { pax: 2, price: 380_000, quota: 40 }, { pax: 5, price: 900_000, quota: 10 }] },
    { id: "e1", title: "Neon Kopi Night Vol. 7", collectiveId: "c1", venueId: "v1", date: "2026-11-21", time: "22:00", status: "terbit", scheme: "bagi_hasil",
      description: "Lineup: DJ Kalea, Sendja b2b Rimba. Dress code all black.",
      tickets: [{ pax: 1, price: 150_000, quota: 120 }, { pax: 2, price: 280_000, quota: 40 }, { pax: 5, price: 650_000, quota: 15 }] },
    { id: "e4", title: "Kaliurang Sunset Sessions", collectiveId: "c2", venueId: "v3", date: "2026-11-28", time: "17:00", status: "terbit",
      description: "Senja Sound System, sunset set.",
      tickets: [{ pax: 1, price: 100_000, quota: 60 }, { pax: 2, price: 190_000, quota: 20 }, { pax: 5, price: 450_000, quota: 6 }] },
    { id: "e6", title: "Neon Kopi Year End Party", collectiveId: "c1", venueId: "v2", date: "2026-12-19", time: "22:00", status: "draft",
      description: "Pesta akhir tahun. Draft, belum terbit.",
      tickets: [{ pax: 1, price: 175_000, quota: 100 }, { pax: 2, price: 330_000, quota: 30 }, { pax: 5, price: 780_000, quota: 10 }] },
  ];

  // Pengingat/penjadwal yang waktunya sudah lewat dianggap sudah terkirim.
  const sent: string[] = [];
  for (const g of groups) {
    const e = events.find((x) => x.id === g.eventId)!;
    if (SEED_NOW > dayStart(e.date, 8)) sent.push(`dp-reminder-${g.id}`);
    if (SEED_NOW > dayStart(e.date, 4)) sent.push(`lunas-reminder-${g.id}`);
    if (SEED_NOW > deadline(e.date, 3)) sent.push(`vote-${g.id}`);
    if (SEED_NOW > dayStart(e.date, 0)) sent.push(`hari-h-${g.id}`);
  }

  return {
    version: 2,
    now: SEED_NOW,
    seq: 100,
    currentUserId: "u1",
    autoScheduler: true,
    users: [
      user({ id: "u1", name: "Budi Santoso", role: "user", phone: "0812-1111-2222", whatsapp: "6281211112222", ktpName: "BUDI SANTOSO", birthPlace: "Sleman", birthDate: "2000-03-12", nikHash: "a1", nikLast4: "0001" }),
      user({ id: "u2", name: "Sari Wulandari", role: "user", phone: "0813-3333-4444", whatsapp: "6281333334444", ktpName: "SARI WULANDARI", birthPlace: "Bantul", birthDate: "2003-07-21", nikHash: "a2", nikLast4: "0002" }),
      user({ id: "u3", name: "Dimas Prakoso", role: "user", phone: "0857-5555-6666", whatsapp: "6285755556666", ktpName: "DIMAS PRAKOSO", birthPlace: "Yogyakarta", birthDate: "2001-11-02", nikHash: "a3", nikLast4: "0003" }),
      user({ id: "u4", name: "Rina Kusuma", role: "user", phone: "0878-7777-8888", verify: "belum" }),
      user({ id: "u5", name: "Ayu Lestari", role: "user", phone: "0821-9999-0000", whatsapp: "6282199990000", verify: "menunggu", ktpName: "AYU LESTARI", birthPlace: "Klaten", birthDate: "2007-01-15", nikHash: "a5", nikLast4: "0005" }),
      user({ id: "u6", name: "Joko Saputra", role: "user", phone: "0896-1212-3434", whatsapp: "6289612123434", ktpName: "JOKO SAPUTRA", birthPlace: "Sleman", birthDate: "2006-05-10", nikHash: "a6", nikLast4: "0006" }),
      user({ id: "hc1", name: "Raka (Neon Kopi Collective)", role: "host_collective", phone: "0811-2020-3030", whatsapp: "6281120203030", collectiveId: "c1" }),
      user({ id: "hc2", name: "Tara (Bassline Jogja)", role: "host_collective", phone: "0811-4040-5050", whatsapp: "6281140405050", collectiveId: "c2" }),
      user({ id: "hv1", name: "Wulan (Liquid Jogja)", role: "host_venue", phone: "0822-6060-7070", venueId: "v1" }),
      user({ id: "hv2", name: "Agus (Boshe VVIP)", role: "host_venue", phone: "0822-8080-9090", venueId: "v2" }),
      user({ id: "adm1", name: "Admin Sofamates", role: "admin", phone: "0274-000-000" }),
    ],
    collectives: [
      { id: "c1", name: "Neon Kopi Collective", contact: "0811-2020-3030", bank: "BCA", accountNo: "8730012345", accountName: "Raka Pratama" },
      { id: "c2", name: "Bassline Jogja", contact: "bassline@jogja.id", bank: "Mandiri", accountNo: "1370098765432", accountName: "Tara Anindya" },
    ],
    venues: [
      { id: "v1", name: "Liquid Jogja", area: "Sleman", address: "Jl. Magelang KM 6, Sleman" },
      { id: "v2", name: "Boshe VVIP Club", area: "Kota Yogyakarta", address: "Jl. Magelang No. 1, Kota Yogyakarta" },
      { id: "v3", name: "Hugo's Bantul", area: "Bantul", address: "Jl. Parangtritis KM 5, Bantul" },
    ],
    events,
    sofas,
    groups,
    proposals: [
      { id: "p0", userId: "u1", eventId: "e1", sofaId: "s11", friends: 1, note: "Bareng teman kampus.", status: "disetujui", decidedBy: "hc1", decidedAt: h(121), groupId: "g1", createdAt: h(130) },
      { id: "p1", userId: "u3", eventId: "e1", sofaId: "s12", friends: 2, referralId: "r1", note: "Kami bertiga, butuh 2 orang lagi.", status: "menunggu", createdAt: h(6) },
      { id: "p2", userId: "u2", eventId: "e1", ticketPax: 5, friends: 3, note: "", status: "menunggu", createdAt: h(4) },
      { id: "p3", userId: "u2", eventId: "e1", sofaId: "s14", friends: 0, note: "", status: "ditolak", reason: "Sofa B2 disiapkan untuk tamu collective.", decidedBy: "hc1", decidedAt: h(50), createdAt: h(60) },
    ],
    referrals: [
      { id: "r1", collectiveId: "c1", code: "NEONDEWI", owner: "Dewi Anggraini", contact: "0812-5656-7878", active: true },
      { id: "r2", collectiveId: "c1", code: "KOPIJOGJA", owner: "Fajar", contact: "", active: false },
      { id: "r3", collectiveId: "c2", code: "BASS10", owner: "Bima", contact: "0813-1010-2020", active: true },
    ],
    txs,
    etickets: [
      { id: "et1", eventId: "e1", userId: "u2", pax: 1, txId: t1, code: "SFM-E1-00001", status: "aktif", at: h(30) },
      { id: "et2", eventId: "e3", userId: "u3", pax: 1, txId: t2, code: "SFM-E3-00002", status: "aktif", at: h(20) },
    ],
    payouts: [],
    notifs: [
      { id: "n1", userId: "u1", text: "Selamat datang di Sofamates! Cari grup yang masih butuh orang di Home.", at: h(5), read: false, wa: true },
      { id: "n2", userId: "u1", text: "Slot Terrace – Malioboro After Dark sudah penuh. DP dicek di H-7 (31 Okt), lalu lanjut pelunasan.", at: h(8), read: false, wa: true, link: "/grup/g4" },
      { id: "n3", userId: "adm1", text: "Ayu Lestari mengajukan verifikasi akun.", at: h(3), read: false, wa: false, link: "/admin" },
      { id: "n4", userId: "hc1", text: "Dimas Prakoso mengajukan grup untuk Neon Kopi Night Vol. 7.", at: h(6), read: false, wa: true, link: "/host" },
    ],
    logs: [
      { id: "l1", at: h(121), actorId: "hc1", action: "proposal.decide", detail: "Pengajuan p0 disetujui, grup g1 dibuat" },
      { id: "l2", at: h(90), actorId: "u2", action: "group.join", detail: "Bergabung ke grup g1 dan bayar DP" },
      { id: "l3", at: h(3), actorId: "u5", action: "verify.request", detail: "Mengajukan verifikasi akun" },
    ],
    sent,
  };
}
