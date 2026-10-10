/* Pure domain actions on a draft AppState. Return a string = error message, otherwise success. */
import {
  activeMembers, ageAt, createDeadline, dpComplete, dpDeadline, eventEnd, getEvent, getSofa, getUser, getVenue, groupName,
  hashNik, HOLD_MS, isMember, lunasComplete, lunasDeadline, MIN_DP, normalizeWa, ownsEvent, ratingEnd, ratingStart,
  sofaPrices, ticketShare, ticketType, ticketUsed, voteDeadline, dayStart, memberSlotCount,
} from "./rules";
import { availableSlots, filledSlots, memberSlotList } from "./sofa-selection";
import type { AppState, EventItem, Group, Member, Pax, Sofa, TicketType, Tx, TxKind, User } from "./types";

type Draft = AppState;

/** Actions return an id (e.g. "tx12") on create, "" or undefined on success, or an error message. */
export const isErr = (r: unknown): r is string => typeof r === "string" && r !== "" && !/^[a-z]+\d+$/.test(r);

export function nextId(d: Draft, p: string) {
  d.seq += 1;
  return `${p}${d.seq}`;
}
export function notify(d: Draft, userIds: (string | undefined)[], text: string, link?: string) {
  for (const userId of new Set(userIds.filter((x): x is string => !!x))) {
    const u = getUser(d, userId);
    d.notifs.unshift({ id: nextId(d, "n"), userId, text, at: d.now, read: false, wa: !!u?.whatsapp, link });
  }
}
export function log(d: Draft, actorId: string, action: string, detail: string) {
  d.logs.unshift({ id: nextId(d, "l"), at: d.now, actorId, action, detail });
}
const admins = (d: Draft) => d.users.filter((u) => u.role === "admin").map((u) => u.id);
const collectiveHosts = (d: Draft, collectiveId: string) =>
  d.users.filter((u) => u.role === "host_collective" && u.collectiveId === collectiveId).map((u) => u.id);
const venueHosts = (d: Draft, venueId: string) =>
  d.users.filter((u) => u.role === "host_venue" && u.venueId === venueId).map((u) => u.id);
/**
 * Kabari penyelenggara: host collective pemilik event, dan (kalau `venue`) host venue tempat event,
 * supaya venue tahu sofa mana yang sedang dipesan/terjual dan tidak menjualnya dua kali.
 */
function notifyHosts(d: Draft, e: EventItem, text: string, opts: { venue?: boolean; collective?: boolean; except?: string } = {}) {
  const ids = [
    ...(opts.collective === false ? [] : collectiveHosts(d, e.collectiveId)),
    ...(opts.venue ? venueHosts(d, e.venueId) : []),
  ].filter((id) => id !== opts.except);
  notify(d, ids, text, "/host");
}
const memberIds = (g: Group) => activeMembers(g).map((m) => m.userId);
const findGroup = (d: Draft, id: string) => d.groups.find((g) => g.id === id);
const activeGroupForSofa = (d: Draft, sofaId: string) => d.groups.find((g) => g.sofaId === sofaId && g.status !== "BATAL");

/* ---------------- Referral (REF-01..04) ---------------- */

/** REF-02: kode valid kalau aktif dan milik collective penyelenggara event. */
export function findReferral(d: Draft, eventId: string, code: string) {
  const e = getEvent(d, eventId);
  const c = code.trim().toUpperCase();
  if (!e || !c) return undefined;
  return d.referrals.find((r) => r.active && r.collectiveId === e.collectiveId && r.code === c);
}

/* ---------------- Transaksi ---------------- */

function newTx(d: Draft, t: Omit<Tx, "id" | "status" | "gatewayRef" | "createdAt">): Tx {
  const id = nextId(d, "tx");
  const tx: Tx = { ...t, id, status: "pending", gatewayRef: `PG-${id.toUpperCase()}`, createdAt: d.now };
  d.txs.unshift(tx);
  return tx;
}

/** Refund adalah transaksi baru yang menunjuk transaksi asalnya; diproses admin (PAY-07). */
function refundTx(d: Draft, tx: Tx) {
  if (tx.status !== "berhasil" || tx.kind === "refund") return;
  if (d.txs.some((x) => x.refundOf === tx.id)) return;
  const r = newTx(d, { userId: tx.userId, eventId: tx.eventId, kind: "refund", amount: tx.amount, refundOf: tx.id,
    ...(tx.groupId ? { groupId: tx.groupId } : {}), ...(tx.memberUserId ? { memberUserId: tx.memberUserId } : {}) });
  notify(d, [tx.userId], `Refund ${rupiahShort(tx.amount)} sedang diproses admin.`, "/akun");
  return r;
}
const rupiahShort = (n: number) => `Rp${n.toLocaleString("id-ID")}`;
const paidTxs = (d: Draft, g: Group) => d.txs.filter((t) => t.groupId === g.id && t.status === "berhasil" && t.kind !== "refund");

function issueTicket(d: Draft, e: EventItem, userId: string, pax: Pax, txId: string, groupId?: string) {
  const id = nextId(d, "et");
  d.etickets.unshift({ id, eventId: e.id, userId, pax, txId, ...(groupId ? { groupId } : {}), status: "aktif", at: d.now,
    code: `SFM-${e.id.toUpperCase()}-${String(d.seq).padStart(5, "0")}` });
}

/* ---------------- Grup: pembuatan ---------------- */

function sofaCheck(d: Draft, e: EventItem | undefined, sofaId: string | undefined): string | Sofa {
  if (!e) return "Event tidak ditemukan.";
  if (e.status !== "terbit") return "Event belum terbit atau sudah ditutup.";
  if (d.now > createDeadline(e)) return "Grup baru hanya bisa dibuat paling lambat H-14 (U13).";
  const s = getSofa(d, sofaId);
  if (!s || s.eventId !== e.id) return "Sofa tidak ditemukan di event ini.";
  if (activeGroupForSofa(d, s.id)) return "Sofa ini sudah punya grup aktif (GRP-04). Pilih sofa lain.";
  return s;
}
function ticketCheck(d: Draft, e: EventItem | undefined, pax: Pax | undefined): string | TicketType {
  if (!e) return "Event tidak ditemukan.";
  if (e.status !== "terbit") return "Event belum terbit atau sudah ditutup.";
  if (pax !== 2 && pax !== 5) return "Grup tiket hanya untuk paket 2 atau 5 orang.";
  if (d.now > createDeadline(e)) return "Grup baru hanya bisa dibuat paling lambat H-14 (U13).";
  const t = ticketType(e, pax);
  if (!t) return "Paket tiket ini tidak dijual.";
  if (ticketUsed(d, e, pax) >= t.quota) return "Kuota paket tiket habis.";
  return t;
}

function makeGroup(d: Draft, e: EventItem, target: { sofa?: Sofa; ticket?: TicketType }, createdBy: string, leaderId?: string, proposalId?: string) {
  const id = nextId(d, "g");
  const base = { id, eventId: e.id, createdBy, members: [] as Member[], leaderPaidAllDp: false, emptyLunasPaid: 0, votes: {}, ratings: [], createdAt: d.now,
    ...(leaderId ? { leaderId } : {}), ...(proposalId ? { proposalId } : {}) };
  const g: Group = target.sofa
    ? { ...base, kind: "sofa", sofaId: target.sofa.id, status: "DP_BOOKING", slots: target.sofa.capacity, ...sofaPrices(target.sofa) }
    : { ...base, kind: "tiket", ticketPax: target.ticket!.pax, status: "PELUNASAN", slots: target.ticket!.pax, dpPerSlot: 0,
      lunasPerSlot: ticketShare(target.ticket!.price, target.ticket!.pax) };
  if (leaderId) g.members.push({ userId: leaderId, slotNumber: 1, pay: "menunggu", joinedAt: d.now });
  d.groups.unshift(g);
  if (target.sofa)
    notifyHosts(d, e, `Sofa ${target.sofa.name} di ${e.title} sedang dipesan lewat Sofamates (DP BOOKING). Jangan dijual langsung di venue.`, { venue: true, except: createdBy });
  else notifyHosts(d, e, `Grup tiket ${target.ticket!.pax} orang dibuka untuk ${e.title}.`, { except: createdBy });
  return g;
}

/** GRP-01: host collective/admin membuat grup langsung (tanpa ketua). */
export function hostCreateGroup(d: Draft, me: User, eventId: string, target: { sofaId?: string; pax?: Pax }) {
  const e = getEvent(d, eventId);
  if (e && !ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  const t = target.sofaId ? sofaCheck(d, e, target.sofaId) : ticketCheck(d, e, target.pax);
  if (typeof t === "string") return t;
  const g = makeGroup(d, e!, "capacity" in t ? { sofa: t } : { ticket: t }, me.id);
  return g.id;
}

/* ---------------- Pengajuan (GRP-02, GRP-03) ---------------- */

export function createProposal(d: Draft, me: User, data: { eventId: string; sofaId?: string; pax?: Pax; friends: number; referralCode: string; note: string }) {
  const age = ageAt(me.birthDate, d.now);
  if (age === undefined || age < 21) return "Pengajuan grup hanya untuk user 21 tahun ke atas.";
  if (!me.whatsapp) return "Isi nomor WhatsApp dulu di halaman Akun (AKN-07).";
  const e = getEvent(d, data.eventId);
  const t = data.sofaId ? sofaCheck(d, e, data.sofaId) : ticketCheck(d, e, data.pax);
  if (typeof t === "string") return t;
  const cap = "capacity" in t ? t.capacity : t.pax;
  if (!Number.isInteger(data.friends) || data.friends < 0 || data.friends >= cap) return `Jumlah teman harus 0 sampai ${cap - 1}.`;
  if (d.proposals.some((p) => p.userId === me.id && p.status === "menunggu" && p.eventId === data.eventId && p.sofaId === data.sofaId && p.ticketPax === data.pax))
    return "Kamu sudah punya pengajuan yang menunggu untuk pilihan ini.";
  const ref = data.referralCode.trim() ? findReferral(d, data.eventId, data.referralCode) : undefined;
  const id = nextId(d, "p");
  d.proposals.unshift({ id, userId: me.id, eventId: data.eventId, friends: data.friends, note: data.note.trim().slice(0, 300), status: "menunggu", createdAt: d.now,
    ...(data.sofaId ? { sofaId: data.sofaId } : data.pax ? { ticketPax: data.pax } : {}), ...(ref ? { referralId: ref.id } : {}) });
  notify(d, [...collectiveHosts(d, e!.collectiveId), ...admins(d)], `${me.name} mengajukan grup untuk ${e!.title}.`, "/host");
  return id;
}

export function decideProposal(d: Draft, me: User, proposalId: string, approve: boolean, reason = "") {
  const p = d.proposals.find((x) => x.id === proposalId);
  if (!p) return "Pengajuan tidak ditemukan.";
  if (p.status !== "menunggu") return "Pengajuan sudah diputuskan.";
  const e = getEvent(d, p.eventId);
  if (!e) return "Event tidak ditemukan.";
  if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  if (!approve && !reason.trim()) return "Alasan penolakan wajib diisi (GRP-03).";
  if (approve) {
    const t = p.sofaId ? sofaCheck(d, e, p.sofaId) : ticketCheck(d, e, p.ticketPax);
    if (typeof t === "string") return t;
    const g = makeGroup(d, e, "capacity" in t ? { sofa: t } : { ticket: t }, me.id, p.userId, p.id);
    if (p.referralId) g.members[0]!.referralId = p.referralId;
    p.groupId = g.id;
    notify(d, [p.userId], `Pengajuan grup ${groupName(d, g)} disetujui. Kamu ketuanya — bayar bagianmu dan isi link grup WA.`, `/grup/${g.id}`);
  } else {
    p.reason = reason.trim().slice(0, 300);
    notify(d, [p.userId], `Pengajuan grup untuk ${e.title} ditolak: ${p.reason}`, "/pengajuan");
  }
  notifyHosts(d, e, `Pengajuan ${getUser(d, p.userId)?.name} untuk ${e.title} ${approve ? "disetujui" : "ditolak"} oleh ${me.name}.`, { except: me.id });
  p.status = approve ? "disetujui" : "ditolak";
  p.decidedBy = me.id;
  p.decidedAt = d.now;
}

/* ---------------- Bergabung & bayar ---------------- */

/** Kapan grup masih menerima anggota baru. */
export function joinState(d: Draft, g: Group): { open: boolean; free: boolean; why?: string } {
  const e = getEvent(d, g.eventId);
  if (!e || e.status === "batal") return { open: false, free: false, why: "Event dibatalkan." };
  if (filledSlots(g) >= g.slots) return { open: false, free: false, why: "Grup penuh." };
  if (g.kind === "tiket")
    return g.status === "PELUNASAN" && d.now <= lunasDeadline(e) ? { open: true, free: false } : { open: false, free: false, why: "Grup tiket sudah ditutup." };
  if (g.status === "DP_BOOKING" && d.now <= dpDeadline(e)) return { open: true, free: g.leaderPaidAllDp };
  // U5: setelah H-7 pendaftaran ditutup, kecuali grup yang DP-nya dibayar penuh ketua (sampai H-3).
  if (g.status === "PELUNASAN" && g.leaderPaidAllDp && d.now <= lunasDeadline(e)) return { open: true, free: true };
  return { open: false, free: false, why: g.status === "PELUNASAN" ? "Pendaftaran ditutup setelah H-7 (U5)." : "Grup tidak menerima anggota baru." };
}

/** Bergabung. Kalau perlu bayar, slot ditahan 30 menit (U2) dan transaksi pending dibuat; hasilnya id transaksi. */
export function join(d: Draft, me: User, groupId: string, selectedSlot?: number | number[], referralCode = "") {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  if (!me.whatsapp) return "Isi nomor WhatsApp dulu di halaman Akun (AKN-07).";
  if (isMember(g, me.id)) return "Kamu sudah anggota grup ini.";
  const js = joinState(d, g);
  if (!js.open) return js.why ?? "Grup tidak menerima anggota baru.";
  const occupied = memberSlotList(g).flat();
  const picked = availableSlots(g.slots, occupied, selectedSlot);
  if (!picked) return "Slot tidak tersedia.";
  const perMember = memberSlotList(g);
  activeMembers(g).forEach((m, i) => { if (!m.slotNumber && perMember[i]?.[0] !== undefined) m.slotNumber = perMember[i]![0]; });
  const ref = referralCode.trim() ? findReferral(d, g.eventId, referralCode) : undefined;
  const m: Member = { userId: me.id, slotNumber: picked[0]!, ...(picked.length > 1 ? { extraSlots: picked.slice(1) } : {}),
    pay: js.free ? "belum_bayar" : "menunggu", joinedAt: d.now, ...(ref ? { referralId: ref.id } : {}) };
  g.members = g.members.filter((x) => x.userId !== me.id);
  g.members.push(m);
  const age = ageAt(me.birthDate, d.now) ?? 0;
  if (!g.leaderId && age >= 21) {
    g.leaderId = me.id;
    notify(d, [me.id], `Kamu menjadi ketua ${groupName(d, g)} karena grup ini belum punya ketua.`, `/grup/${g.id}`);
  }
  if (js.free) {
    notify(d, [g.leaderId], `${me.name} bergabung ke grupmu (DP sudah ditanggung ketua).`, `/grup/${g.id}`);
    return "";
  }
  m.holdUntil = d.now + HOLD_MS;
  const kind: TxKind = g.kind === "tiket" ? "tiket" : "dp";
  const amount = (g.kind === "tiket" ? g.lunasPerSlot : g.dpPerSlot) * picked.length;
  return newTx(d, { userId: me.id, groupId: g.id, memberUserId: me.id, eventId: g.eventId, kind, amount, slots: picked,
    ...(g.ticketPax ? { ticketPax: g.ticketPax } : {}) }).id;
}

/** Ketua (dari pengajuan) membayar DP/bagian slotnya sendiri. */
export function payOwnShare(d: Draft, me: User, groupId: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const m = activeMembers(g).find((x) => x.userId === me.id);
  if (!m || m.pay !== "menunggu") return "Tidak ada tagihan untuk slotmu.";
  if (!joinStateIgnoringFull(d, g)) return "Batas pembayaran sudah lewat.";
  if (g.kind === "sofa" && g.leaderPaidAllDp) return "DP sudah dibayar penuh ketua.";
  const kind: TxKind = g.kind === "tiket" ? "tiket" : "dp";
  const amount = (g.kind === "tiket" ? g.lunasPerSlot : g.dpPerSlot) * memberSlotCount(m);
  return newTx(d, { userId: me.id, groupId: g.id, memberUserId: me.id, eventId: g.eventId, kind, amount, slots: memberSlotList(g)[activeMembers(g).indexOf(m)] ?? [] }).id;
}
function joinStateIgnoringFull(d: Draft, g: Group) {
  const e = getEvent(d, g.eventId)!;
  return g.kind === "tiket" ? d.now <= lunasDeadline(e) : g.status === "DP_BOOKING" && d.now <= dpDeadline(e);
}

/** PAY-02, U14: ketua bayar seluruh DP, hanya saat DP BOOKING dan belum ada anggota lain yang membayar DP. */
export function canPayAllDp(d: Draft, g: Group, userId: string) {
  const e = getEvent(d, g.eventId);
  if (g.kind !== "sofa") return "Hanya untuk grup sofa.";
  if (g.leaderId !== userId) return "Hanya ketua grup yang boleh membayar seluruh DP.";
  if (g.leaderPaidAllDp) return "DP sudah dibayar penuh.";
  if (g.status !== "DP_BOOKING" || !e || d.now > dpDeadline(e)) return "Opsi ini hanya selama DP BOOKING (U14).";
  if (activeMembers(g).some((m) => m.pay === "dp" || (m.userId !== userId && m.pay === "menunggu")))
    return "Sudah ada anggota yang membayar DP, jadi opsi ini tidak tersedia (U14).";
  return null;
}
export function payAllDp(d: Draft, me: User, groupId: string, termsAccepted: boolean) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const err = canPayAllDp(d, g, me.id); if (err) return err;
  if (!termsAccepted) return "Setujui S&K risiko dulu (PAY-02).";
  g.termsAcceptedAt = d.now;
  const s = getSofa(d, g.sofaId)!;
  return newTx(d, { userId: me.id, groupId: g.id, memberUserId: me.id, eventId: g.eventId, kind: "dp_penuh_ketua", amount: Math.max(s.dp, MIN_DP) }).id;
}

/** PAY-03: pelunasan hanya saat status PELUNASAN. */
export function payLunas(d: Draft, me: User, groupId: string, forUserId = me.id) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const e = getEvent(d, g.eventId)!;
  if (g.kind !== "sofa") return "Grup tiket dibayar penuh saat bergabung.";
  if (g.status !== "PELUNASAN") return "Tombol pelunasan hanya ada saat status PELUNASAN (PAY-03).";
  if (d.now > lunasDeadline(e)) return "Batas pelunasan H-3 sudah lewat.";
  if (!isMember(g, me.id)) return "Kamu bukan anggota grup.";
  const target = activeMembers(g).find((m) => m.userId === forUserId);
  if (!target) return "Slot tidak ditemukan.";
  if (target.pay === "lunas") return "Slot ini sudah lunas.";
  if (target.pay === "menunggu") return "Slot ini belum membayar DP.";
  const kind: TxKind = forUserId === me.id ? "pelunasan" : "talangan"; // PAY-04
  return newTx(d, { userId: me.id, groupId: g.id, memberUserId: forUserId, eventId: g.eventId, kind, amount: g.lunasPerSlot * memberSlotCount(target) }).id;
}

/** PAY-04: talangan pelunasan untuk slot kosong (grup yang DP-nya dibayar ketua). */
export function payEmptySlots(d: Draft, me: User, groupId: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const e = getEvent(d, g.eventId)!;
  if (!isMember(g, me.id)) return "Kamu bukan anggota grup.";
  if (g.status !== "PELUNASAN" || d.now > lunasDeadline(e)) return "Talangan hanya saat PELUNASAN sampai H-3.";
  const empty = g.slots - filledSlots(g) - g.emptyLunasPaid;
  if (empty <= 0) return "Tidak ada slot kosong.";
  return newTx(d, { userId: me.id, groupId: g.id, eventId: g.eventId, kind: "talangan", amount: g.lunasPerSlot * empty, slots: Array.from({ length: empty }, (_, i) => i) }).id;
}

/** TKT-01: beli tiket 1 orang selama kuota ada. */
export function buyTicket(d: Draft, me: User, eventId: string) {
  const e = getEvent(d, eventId); if (!e) return "Event tidak ditemukan.";
  if (e.status !== "terbit") return "Penjualan tiket tidak dibuka.";
  if (d.now > eventEnd(e)) return "Penjualan tiket sudah ditutup.";
  const t = ticketType(e, 1); if (!t) return "Tiket 1 orang tidak dijual.";
  if (ticketUsed(d, e, 1) >= t.quota) return "Kuota tiket habis.";
  return newTx(d, { userId: me.id, eventId, kind: "tiket", amount: t.price, ticketPax: 1 }).id;
}

/** Simulasi webhook payment gateway (PAY-05): status berubah hanya lewat sini. */
export function settle(d: Draft, txId: string, ok: boolean) {
  const tx = d.txs.find((t) => t.id === txId);
  if (!tx || tx.status !== "pending") return "Transaksi tidak ditemukan atau sudah diproses.";
  const g = tx.groupId ? findGroup(d, tx.groupId) : undefined;
  const m = g && tx.memberUserId ? activeMembers(g).find((x) => x.userId === tx.memberUserId) : undefined;
  if (!ok) {
    tx.status = "gagal";
    if (g && m && m.pay === "menunggu" && m.holdUntil) g.members = g.members.filter((x) => x !== m); // slot dilepas
    return;
  }
  if (m?.holdUntil && m.holdUntil < d.now) { tx.status = "kedaluwarsa"; return "Waktu tahan slot 30 menit sudah habis. Slot dilepas."; }
  tx.status = "berhasil";
  tx.paidAt = d.now;
  const e = getEvent(d, tx.eventId)!;
  if (!g) { issueTicket(d, e, tx.userId, 1, tx.id); notify(d, [tx.userId], `Tiket 1 orang ${e.title} aktif. Kodenya ada di menu Parties.`, "/parties"); return; }
  const name = groupName(d, g);
  if (tx.kind === "dp_penuh_ketua") {
    g.leaderPaidAllDp = true;
    activeMembers(g).forEach((x) => { if (x.pay === "menunggu") { x.pay = "belum_bayar"; delete x.holdUntil; } });
    notify(d, memberIds(g), `Ketua membayar seluruh DP ${name}. Anggota cukup bayar pelunasan di tahap PELUNASAN.`, `/grup/${g.id}`);
  } else if (tx.kind === "dp" && m) {
    m.pay = "dp"; delete m.holdUntil;
  } else if (tx.kind === "tiket" && m) {
    m.pay = "lunas"; delete m.holdUntil;
    if (g.kind === "tiket" && lunasComplete(g)) {
      g.status = "LUNAS";
      for (const x of activeMembers(g)) {
        const own = paidTxs(d, g).find((t) => t.memberUserId === x.userId);
        issueTicket(d, e, x.userId, g.ticketPax!, own?.id ?? tx.id, g.id);
      }
      notify(d, memberIds(g), `Grup ${name} penuh dan LUNAS. Tiket ada di menu Parties.`, "/parties");
      notifyHosts(d, e, `${name} untuk ${e.title} penuh dan lunas.`);
    }
  } else if ((tx.kind === "pelunasan" || tx.kind === "talangan") && m) {
    m.pay = "lunas";
  } else if (tx.kind === "talangan") {
    g.emptyLunasPaid += tx.slots?.length ?? 0;
  }
  notify(d, [tx.userId], `Pembayaran ${rupiahShort(tx.amount)} untuk ${name} berhasil.`, `/grup/${g.id}`);
  if (tx.kind === "dp" || tx.kind === "tiket") notify(d, [g.leaderId !== tx.userId ? g.leaderId : undefined], `${getUser(d, tx.userId)?.name} bergabung ke ${name}.`, `/grup/${g.id}`);
}

/** GRP-09, U11: keluar sebelum bayar = bebas; setelah bayar, uangnya hangus. */
export function leave(d: Draft, me: User, groupId: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const m = activeMembers(g).find((x) => x.userId === me.id);
  if (!m) return "Kamu bukan anggota grup.";
  if (g.status !== "DP_BOOKING" && g.status !== "PELUNASAN") return "Grup sudah tidak aktif.";
  if (g.leaderId === me.id && g.leaderPaidAllDp) return "Ketua yang sudah membayar seluruh DP tidak bisa keluar.";
  const paid = m.pay === "dp" || m.pay === "lunas";
  d.txs.filter((t) => t.groupId === g.id && t.memberUserId === me.id && t.status === "pending").forEach((t) => { t.status = "gagal"; });
  if (paid) { m.pay = "hangus"; m.leftAt = d.now; } else g.members = g.members.filter((x) => x !== m);
  if (g.leaderId === me.id) delete g.leaderId;
  delete g.votes[me.id];
  notify(d, memberIds(g), `${me.name} keluar dari ${groupName(d, g)}.`, `/grup/${g.id}`);
}

export function setWaLink(d: Draft, me: User, groupId: string, link: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const e = getEvent(d, g.eventId)!;
  if (g.leaderId !== me.id && !ownsEvent(me, e)) return "Hanya ketua atau host collective yang bisa mengisi link WA (GRP-08).";
  const v = link.trim();
  if (v && !/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(v)) return "Link harus berbentuk https://chat.whatsapp.com/…";
  if (v) g.waLink = v; else delete g.waLink;
}

/* ---------------- Vote (VOT-01..04) & rating (RAT-01..04) ---------------- */

export function voteResult(g: Group) {
  const tally: Record<string, number> = {};
  for (const [uid, v] of Object.entries(g.votes)) if (isMember(g, uid)) tally[v] = (tally[v] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(tally));
  const top = Object.keys(tally).filter((k) => tally[k] === max && max > 0);
  const final = g.drinkPick ?? (top.length === 1 ? top[0] : undefined);
  return { tally, top, final, tie: top.length > 1 && !g.drinkPick };
}
export function vote(d: Draft, me: User, groupId: string, drink: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const m = activeMembers(g).find((x) => x.userId === me.id);
  if (!m || m.pay === "menunggu") return "Hanya anggota grup yang sudah bergabung yang bisa vote.";
  if (g.kind !== "sofa" || g.status === "BATAL" || g.status === "SELESAI") return "Vote tidak tersedia.";
  if (d.now > voteDeadline(getEvent(d, g.eventId)!)) return "Vote minuman ditutup H-3 23.59 WIB.";
  if (!getSofa(d, g.sofaId)?.drinks.includes(drink)) return "Pilihan minuman tidak tersedia untuk sofa ini.";
  g.votes[me.id] = drink;
}
export function pickDrink(d: Draft, me: User, groupId: string, drink: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  if (g.leaderId !== me.id) return "Hanya ketua yang memutuskan hasil seri (U12).";
  if (d.now <= voteDeadline(getEvent(d, g.eventId)!)) return "Hasil seri diputuskan setelah vote ditutup.";
  const r = voteResult(g);
  if (!r.tie || !r.top.includes(drink)) return "Pilih salah satu minuman dengan suara terbanyak.";
  g.drinkPick = drink;
  notify(d, memberIds(g), `Ketua memilih ${drink} untuk ${groupName(d, g)}.`, `/grup/${g.id}`);
}
export function rate(d: Draft, me: User, groupId: string, toUserId: string, stars: number, note: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  const e = getEvent(d, g.eventId)!;
  if (!isMember(g, me.id)) return "Hanya anggota grup yang bisa memberi rating.";
  if (g.status !== "SELESAI") return "Rating hanya untuk grup yang selesai.";
  if (d.now < ratingStart(e) || d.now > ratingEnd(e)) return "Rating hanya dibuka H+1 sampai H+3 (U7).";
  if (toUserId === me.id || !isMember(g, toUserId)) return "Pilih anggota lain di grupmu.";
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return "Nilai 1 sampai 5.";
  if (g.ratings.some((r) => r.from === me.id && r.to === toUserId)) return "Kamu sudah menilai anggota ini.";
  g.ratings.push({ from: me.id, to: toUserId, stars, note: note.trim().slice(0, 300), at: d.now });
}

/* ---------------- Akun & verifikasi (AKN-01..07) ---------------- */

export function updateProfile(d: Draft, me: User, data: { name: string; whatsapp: string }) {
  const u = d.users.find((x) => x.id === me.id)!;
  const name = data.name.trim();
  if (name.length < 3 || name.length > 100) return "Nama tampilan 3-100 karakter.";
  const wa = normalizeWa(data.whatsapp);
  if (!wa) return "Nomor WhatsApp tidak valid. Contoh: 081234567890 atau 6281234567890.";
  u.name = name; u.whatsapp = wa;
}

export function requestVerify(d: Draft, me: User, data: { ktpName: string; birthPlace: string; birthDate: string; nik: string; ktpImage: string; selfieImage: string }) {
  const u = d.users.find((x) => x.id === me.id)!;
  if (u.verify === "terverifikasi") return "Akun sudah terverifikasi.";
  if (u.verify === "menunggu") return "Pengajuan verifikasi sedang ditinjau.";
  const nama = data.ktpName.trim();
  if (nama.length < 3 || nama.length > 100) return "Nama sesuai KTP wajib diisi (3-100 karakter).";
  if (data.birthPlace.trim().length < 3) return "Tempat lahir wajib diisi.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birthDate)) return "Tanggal lahir wajib diisi.";
  if (!/^\d{16}$/.test(data.nik)) return "NIK harus 16 angka.";
  if (!data.ktpImage || !data.selfieImage) return "Foto KTP dan foto wajah wajib diunggah.";
  Object.assign(u, { ktpName: nama, birthPlace: data.birthPlace.trim(), birthDate: data.birthDate, ktpImage: data.ktpImage, selfieImage: data.selfieImage });
  const hash = hashNik(data.nik);
  if (d.users.some((x) => x.id !== u.id && x.nikHash === hash)) {
    u.verify = "ditolak"; u.verifyReason = "NIK sudah dipakai akun lain (AKN-05).";
    return;
  }
  u.nikHash = hash; u.nikLast4 = data.nik.slice(-4);
  const age = ageAt(data.birthDate, d.now) ?? 0;
  if (age < 18) { u.verify = "ditolak"; u.verifyReason = "Umur di bawah 18 tahun (AKN-03)."; return; }
  u.verify = "menunggu"; delete u.verifyReason;
  notify(d, admins(d), `${u.name} mengajukan verifikasi akun.`, "/admin");
}

/** ADM-02: admin meninjau verifikasi. */
export function adminVerify(d: Draft, me: User, userId: string, approve: boolean, reason = "") {
  const u = d.users.find((x) => x.id === userId); if (!u) return "Pengguna tidak ditemukan.";
  if (u.verify !== "menunggu") return "Tidak ada pengajuan yang menunggu.";
  if (!approve && !reason.trim()) return "Alasan penolakan wajib diisi.";
  u.verify = approve ? "terverifikasi" : "ditolak";
  u.verifiedBy = me.id; u.verifiedAt = d.now;
  if (approve) delete u.verifyReason; else u.verifyReason = reason.trim().slice(0, 300);
  notify(d, [u.id], approve ? "Akunmu sudah terverifikasi. Selamat patungan!" : `Verifikasi ditolak: ${u.verifyReason} Silakan kirim ulang.`, "/akun");
}

export function toggleUserActive(d: Draft, me: User, userId: string) {
  const u = d.users.find((x) => x.id === userId); if (!u) return "Pengguna tidak ditemukan.";
  if (u.id === me.id) return "Tidak bisa menonaktifkan akun sendiri.";
  u.active = !u.active;
}

/* ---------------- Event, sofa, tiket (EVT-01..05) ---------------- */

export type EventInput = Pick<EventItem, "title" | "venueId" | "date" | "time" | "description" | "status"> & { poster?: string; scheme?: EventItem["scheme"] | "" };

export function saveEvent(d: Draft, me: User, id: string | null, data: EventInput) {
  const title = data.title.trim();
  if (title.length < 3 || title.length > 150) return "Nama event 3-150 karakter.";
  if (!d.venues.some((v) => v.id === data.venueId)) return "Pilih venue.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !/^\d{2}:\d{2}$/.test(data.time)) return "Tanggal dan jam wajib diisi.";
  const fields = { title, venueId: data.venueId, date: data.date, time: data.time, description: data.description.trim().slice(0, 1000), status: data.status,
    ...(data.poster?.trim() ? { poster: data.poster.trim() } : {}), ...(data.scheme ? { scheme: data.scheme } : {}) };
  if (id) {
    const e = getEvent(d, id); if (!e) return "Event tidak ditemukan.";
    if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
    if (e.status === "batal" || e.status === "selesai") return "Event yang batal/selesai tidak bisa diubah.";
    if (fields.status !== "draft" && fields.status !== "terbit") return "Status tidak valid.";
    if (e.status === "terbit" && fields.status === "draft" && d.txs.some((t) => t.eventId === e.id)) return "Event yang sudah punya pembayaran tidak bisa dikembalikan ke draft.";
    const before = { status: e.status, date: e.date, time: e.time, venueId: e.venueId };
    delete e.poster; delete e.scheme;
    Object.assign(e, fields);
    announceEvent(d, me, e, before);
    return e.id;
  }
  const collectiveId = me.role === "host_collective" ? me.collectiveId : d.collectives[0]?.id;
  if (!collectiveId) return "Akun host belum terhubung ke collective.";
  const nid = nextId(d, "e");
  d.events.unshift({ id: nid, collectiveId, ...fields, status: fields.status === "terbit" ? "terbit" : "draft",
    tickets: [{ pax: 1, price: 100_000, quota: 100 }, { pax: 2, price: 190_000, quota: 30 }, { pax: 5, price: 450_000, quota: 10 }] });
  announceEvent(d, me, d.events[0]!, null);
  return nid;
}

/** Kabari venue (dan collective kalau admin yang mengubah) saat event terbit atau jadwal/venue-nya berubah; anggota grup ikut dikabari perubahan jadwal. */
function announceEvent(d: Draft, me: User, e: EventItem, before: Pick<EventItem, "status" | "date" | "time" | "venueId"> | null) {
  if (e.status !== "terbit") return;
  const when = `${e.date} ${e.time} WIB`;
  const collective = d.collectives.find((c) => c.id === e.collectiveId)?.name ?? "collective";
  if (!before || before.status !== "terbit") {
    notifyHosts(d, e, `Event baru di venue-mu: ${e.title}, ${when} (${collective}). Sofa yang dipesan lewat Sofamates akan muncul di dasbor.`, { venue: true, except: me.id });
    return;
  }
  if (before.date === e.date && before.time === e.time && before.venueId === e.venueId) return;
  const venueName = getVenue(d, e.venueId)?.name ?? "venue baru";
  notifyHosts(d, e, `Jadwal/tempat ${e.title} berubah menjadi ${when} di ${venueName}.`, { venue: true, except: me.id });
  if (before.venueId !== e.venueId)
    notify(d, venueHosts(d, before.venueId).filter((x) => x !== me.id), `${e.title} dipindah ke venue lain. Sofa event ini tidak lagi dipesan di venue-mu.`, "/host");
  const people = [...d.groups.filter((g) => g.eventId === e.id && g.status !== "BATAL").flatMap(memberIds), ...d.etickets.filter((t) => t.eventId === e.id && t.status === "aktif").map((t) => t.userId)];
  notify(d, people, `Jadwal ${e.title} berubah: ${when} di ${venueName}. Batas DP dan pelunasan ikut menyesuaikan.`, `/event/${e.id}`);
}

/** EVT-04: event yang sudah punya pembayaran tidak bisa dihapus, hanya dibatalkan. */
export function deleteEvent(d: Draft, me: User, id: string) {
  const e = getEvent(d, id); if (!e) return "Event tidak ditemukan.";
  if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  if (d.txs.some((t) => t.eventId === id && t.status === "berhasil")) return "Event sudah punya pembayaran, jadi hanya bisa dibatalkan (EVT-04).";
  const sofaIds = new Set(d.sofas.filter((s) => s.eventId === id).map((s) => s.id));
  d.events = d.events.filter((x) => x.id !== id);
  d.sofas = d.sofas.filter((s) => !sofaIds.has(s.id));
  d.groups = d.groups.filter((g) => g.eventId !== id);
  d.proposals = d.proposals.filter((p) => p.eventId !== id);
}

/** U10: event batal → semua grup batal dan pembayaran dikembalikan penuh. */
export function cancelEvent(d: Draft, me: User, id: string) {
  const e = getEvent(d, id); if (!e) return "Event tidak ditemukan.";
  if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  if (e.status === "batal") return "Event sudah dibatalkan.";
  if (d.now > eventEnd(e)) return "Event sudah berlangsung.";
  e.status = "batal";
  notifyHosts(d, e, `Event ${e.title} (${e.date}) DIBATALKAN oleh ${me.name}. Semua sofa dan tiket lewat Sofamates batal; pembayaran dikembalikan penuh.`, { venue: true, except: me.id });
  notify(d, admins(d).filter((x) => x !== me.id), `Event ${e.title} dibatalkan. Proses refund di panel admin.`, "/admin");
  for (const t of d.etickets) if (t.eventId === id && !t.groupId) { t.status = "batal"; const tx = d.txs.find((x) => x.id === t.txId); if (tx) refundTx(d, tx); }
  runScheduler(d);
}

export type SofaInput = { name: string; capacity: number; price: number; dp: number; drinkPackage: string; drinks: string[] };
export function saveSofa(d: Draft, me: User, eventId: string, id: string | null, data: SofaInput) {
  const e = getEvent(d, eventId); if (!e) return "Event tidak ditemukan.";
  if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  const name = data.name.trim();
  if (!name || name.length > 20) return "Kode sofa 1-20 karakter.";
  if (d.sofas.some((s) => s.eventId === eventId && s.id !== id && s.name.toLowerCase() === name.toLowerCase())) return "Kode sofa sudah dipakai di event ini.";
  if (!Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > 20) return "Kapasitas 1-20 orang.";
  if (!Number.isInteger(data.price) || data.price <= 0) return "Harga sofa wajib diisi.";
  if (!Number.isInteger(data.dp) || data.dp < MIN_DP) return "DP sofa minimal Rp500.000 (EVT-02).";
  if (data.dp > data.price) return "DP tidak boleh melebihi harga sofa.";
  const drinks = [...new Set(data.drinks.map((x) => x.trim()).filter(Boolean))].slice(0, 10);
  const fields = { name, capacity: data.capacity, price: data.price, dp: data.dp, drinkPackage: data.drinkPackage.trim().slice(0, 300), drinks };
  if (id) {
    const s = getSofa(d, id); if (!s || s.eventId !== eventId) return "Sofa tidak ditemukan.";
    const g = activeGroupForSofa(d, id);
    if (g && (s.capacity !== fields.capacity)) return "Kapasitas tidak bisa diubah selama sofa punya grup aktif.";
    Object.assign(s, fields); // harga per slot grup aktif tidak berubah (U1)
    if (e.status === "terbit") notifyHosts(d, e, `Sofa ${s.name} di ${e.title} diperbarui (${s.capacity} orang).`, { venue: true, except: me.id });
    return s.id;
  }
  const nid = nextId(d, "s");
  d.sofas.push({ id: nid, eventId, ...fields });
  if (e.status === "terbit") notifyHosts(d, e, `Sofa baru ${name} (${fields.capacity} orang) dijual lewat Sofamates di ${e.title}.`, { venue: true, except: me.id });
  return nid;
}
export function deleteSofa(d: Draft, me: User, id: string) {
  const s = getSofa(d, id); if (!s) return "Sofa tidak ditemukan.";
  const e = getEvent(d, s.eventId)!;
  if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  if (d.groups.some((g) => g.sofaId === id && g.status !== "BATAL")) return "Sofa masih punya grup aktif. Batalkan grupnya dulu (EVT-04).";
  if (d.txs.some((t) => t.status === "berhasil" && d.groups.some((g) => g.id === t.groupId && g.sofaId === id))) return "Sofa sudah punya pembayaran, tidak bisa dihapus (EVT-04).";
  d.sofas = d.sofas.filter((x) => x.id !== id);
  if (e.status === "terbit") notifyHosts(d, e, `Sofa ${s.name} dihapus dari ${e.title}.`, { venue: true, except: me.id });
}

export function saveTickets(d: Draft, me: User, eventId: string, tickets: TicketType[]) {
  const e = getEvent(d, eventId); if (!e) return "Event tidak ditemukan.";
  if (!ownsEvent(me, e)) return "Kamu bukan penyelenggara event ini.";
  for (const t of tickets) {
    if (![1, 2, 5].includes(t.pax)) return "Jenis tiket hanya 1, 2, atau 5 orang.";
    if (!Number.isInteger(t.price) || t.price < 0 || !Number.isInteger(t.quota) || t.quota < 0) return "Harga dan kuota harus angka 0 atau lebih.";
    if (t.quota < ticketUsed(d, e, t.pax)) return `Kuota tiket ${t.pax} orang tidak boleh di bawah yang sudah terjual.`;
  }
  e.tickets = tickets.filter((t) => t.quota > 0 || t.price > 0);
}

/** Admin atau host membatalkan grup → refund penuh. */
export function cancelGroup(d: Draft, me: User, groupId: string, reason: string) {
  const g = findGroup(d, groupId); if (!g) return "Grup tidak ditemukan.";
  if (!ownsEvent(me, getEvent(d, g.eventId)!)) return "Kamu bukan penyelenggara event ini.";
  if (g.status === "BATAL" || g.status === "SELESAI") return "Grup sudah tidak aktif.";
  cancelWithRefund(d, g, reason.trim() || "Dibatalkan penyelenggara", { except: me.id });
}

/* ---------------- Referral CRUD ---------------- */

export function saveReferral(d: Draft, me: User, id: string | null, data: { code: string; owner: string; contact: string }) {
  const collectiveId = me.role === "host_collective" ? me.collectiveId : id ? d.referrals.find((r) => r.id === id)?.collectiveId : d.collectives[0]?.id;
  if (!collectiveId) return "Collective tidak ditemukan.";
  const code = data.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,30}$/.test(code)) return "Kode 3-30 huruf besar/angka tanpa spasi.";
  if (data.owner.trim().length < 2) return "Nama pemilik kode wajib diisi.";
  if (d.referrals.some((r) => r.collectiveId === collectiveId && r.code === code && r.id !== id)) return "Kode sudah dipakai di collective ini (REF-01).";
  if (id) {
    const r = d.referrals.find((x) => x.id === id); if (!r || r.collectiveId !== collectiveId) return "Kode tidak ditemukan.";
    Object.assign(r, { code, owner: data.owner.trim(), contact: data.contact.trim() });
    return r.id;
  }
  const nid = nextId(d, "r");
  d.referrals.push({ id: nid, collectiveId, code, owner: data.owner.trim(), contact: data.contact.trim(), active: true });
  return nid;
}
export function toggleReferral(d: Draft, me: User, id: string) {
  const r = d.referrals.find((x) => x.id === id); if (!r) return "Kode tidak ditemukan.";
  if (me.role === "host_collective" && r.collectiveId !== me.collectiveId) return "Kode ini bukan milik collective-mu.";
  r.active = !r.active;
}

/* ---------------- Admin: refund & payout ---------------- */

export function processRefund(d: Draft, _me: User, txId: string) {
  const r = d.txs.find((t) => t.id === txId);
  if (!r || r.kind !== "refund" || r.status !== "pending") return "Refund tidak ditemukan atau sudah diproses.";
  r.status = "berhasil"; r.paidAt = d.now;
  notify(d, [r.userId], `Refund ${rupiahShort(r.amount)} sudah ditransfer.`, "/akun");
}

/** ADM-04: dana masuk, DP hangus, refund, dan dana yang harus dikirim ke collective. */
export function eventFunds(d: Draft, eventId: string) {
  const txs = d.txs.filter((t) => t.eventId === eventId);
  const masuk = txs.filter((t) => t.kind !== "refund" && t.status === "berhasil").reduce((a, t) => a + t.amount, 0);
  const refund = txs.filter((t) => t.kind === "refund").reduce((a, t) => a + t.amount, 0);
  const refundPending = txs.filter((t) => t.kind === "refund" && t.status === "pending").reduce((a, t) => a + t.amount, 0);
  const hangus = d.groups.filter((g) => g.eventId === eventId).reduce((a, g) => a + txs
    .filter((t) => t.groupId === g.id && t.status === "berhasil" && (t.kind === "dp" || t.kind === "dp_penuh_ketua") && !txs.some((r) => r.refundOf === t.id))
    .filter((t) => g.status === "BATAL" || g.members.find((m) => m.userId === t.memberUserId)?.pay === "hangus")
    .reduce((s, t) => s + t.amount, 0), 0);
  const groups = d.groups.filter((g) => g.eventId === eventId);
  const pending = groups.filter((g) => g.status === "DP_BOOKING" || g.status === "PELUNASAN");
  const sent = d.payouts.filter((p) => p.eventId === eventId).reduce((a, p) => a + p.amount, 0);
  const toSend = masuk - refund; // lunas + hangus − refund
  return { masuk, refund, refundPending, hangus, toSend, sent, remaining: toSend - sent, unresolved: pending.length };
}

export function recordPayout(d: Draft, me: User, eventId: string, amount: number, proof: string) {
  const e = getEvent(d, eventId); if (!e) return "Event tidak ditemukan.";
  const f = eventFunds(d, eventId);
  if (f.unresolved > 0) return "Masih ada grup yang belum selesai pelunasan.";
  if (!Number.isInteger(amount) || amount <= 0 || amount > f.remaining) return `Jumlah harus 1 sampai ${rupiahShort(f.remaining)}.`;
  if (!proof.trim()) return "Bukti transfer wajib dicatat (ADM-03).";
  d.payouts.unshift({ id: nextId(d, "po"), eventId, collectiveId: e.collectiveId, amount, proof: proof.trim().slice(0, 200), by: me.id, at: d.now });
  notify(d, collectiveHosts(d, e.collectiveId), `Dana ${rupiahShort(amount)} untuk ${e.title} sudah ditransfer.`, "/host");
}

/* ---------------- Penjadwal (GRP-07, PAY-08, U2-U9, NTF-01) ---------------- */

function cancelWithRefund(d: Draft, g: Group, reason: string, hosts: { quiet?: boolean; except?: string } = {}) {
  const e = getEvent(d, g.eventId);
  if (e && !hosts.quiet)
    notifyHosts(d, e, `${groupName(d, g)} di ${e.title} BATAL: ${reason}.${g.kind === "sofa" ? " Sofa ini tidak lagi dipesan lewat Sofamates." : ""}`,
      { venue: g.kind === "sofa", ...(hosts.except ? { except: hosts.except } : {}) });
  const members = memberIds(g); // ambil sebelum status bayar berubah jadi refund/hangus
  g.status = "BATAL"; g.cancelReason = reason;
  for (const tx of paidTxs(d, g)) refundTx(d, tx);
  for (const tx of d.txs) if (tx.groupId === g.id && tx.status === "pending") tx.status = "kedaluwarsa";
  for (const m of activeMembers(g)) m.pay = m.pay === "dp" || m.pay === "lunas" ? "refund" : m.pay;
  for (const t of d.etickets) if (t.groupId === g.id) t.status = "batal";
  notify(d, members, `Grup ${groupName(d, g)} BATAL: ${reason}. Pembayaran dikembalikan penuh.`, `/grup/${g.id}`);
  log(d, "system", "grup.batal", `Grup ${g.id} batal: ${reason}`);
}

/** U6: yang tidak lunas DP-nya hangus; yang sudah lunas di-refund penuh. */
function failAtH3(d: Draft, g: Group) {
  const members = memberIds(g); // ambil sebelum status bayar berubah jadi refund/hangus
  g.status = "BATAL"; g.cancelReason = "Ada slot yang belum lunas di batas H-3 (U6)";
  const lunas = new Set(activeMembers(g).filter((m) => m.pay === "lunas").map((m) => m.userId));
  for (const tx of paidTxs(d, g)) {
    const forLunas = tx.memberUserId ? lunas.has(tx.memberUserId) && tx.kind !== "dp_penuh_ketua" : tx.kind === "talangan";
    if (forLunas) refundTx(d, tx);
  }
  for (const m of activeMembers(g)) m.pay = lunas.has(m.userId) ? "refund" : "hangus";
  const e = getEvent(d, g.eventId);
  if (e) notifyHosts(d, e, `Booking ${groupName(d, g)} di ${e.title} BATAL di H-3 karena ada slot belum lunas. DP yang hangus masuk ke collective; sofa tidak lagi dipesan lewat Sofamates.`, { venue: true });
  notify(d, members, `Booking ${groupName(d, g)} BATAL: ada slot belum lunas di H-3. Yang lunas di-refund penuh; DP yang tidak lunas hangus ke collective.`, `/grup/${g.id}`);
  log(d, "system", "scheduler.H-3", `Grup ${g.id} batal, pelunasan tidak lengkap`);
}

function once(d: Draft, key: string) {
  if (d.sent.includes(key)) return false;
  d.sent.push(key);
  return true;
}

/** Penjadwal: batas H-7, H-3, slot tahan 30 menit, selesai, dan pengingat. Mengembalikan jumlah perubahan. */
export function runScheduler(d: Draft): number {
  let changes = 0;
  for (const g of d.groups) {
    const e = getEvent(d, g.eventId);
    if (!e) continue;
    const name = `${groupName(d, g)} – ${e.title}`;
    const link = `/grup/${g.id}`;
    // U2: slot menunggu bayar yang lewat 30 menit dilepas.
    for (const m of [...g.members]) {
      if (m.pay === "menunggu" && m.holdUntil && m.holdUntil < d.now) {
        g.members = g.members.filter((x) => x !== m);
        d.txs.filter((t) => t.groupId === g.id && t.memberUserId === m.userId && t.status === "pending").forEach((t) => { t.status = "kedaluwarsa"; });
        notify(d, [m.userId], `Slot di ${name} dilepas karena pembayaran tidak selesai dalam 30 menit.`, link);
        changes++;
      }
    }
    if (g.status === "BATAL" || g.status === "SELESAI") continue;
    // Host sudah dikabari sekali lewat pembatalan event, tidak per grup.
    if (e.status === "batal") { cancelWithRefund(d, g, "Event dibatalkan penyelenggara (U10)", { quiet: true }); changes++; continue; }
    if (g.kind === "sofa" && g.status === "DP_BOOKING") {
      if (d.now > dayStart(e.date, 8) && once(d, `dp-reminder-${g.id}`)) {
        notify(d, memberIds(g), `Pengingat: batas DP ${name} besok H-7 pukul 23.59 WIB. Ajak teman supaya slot penuh.`, link); changes++;
      }
      if (d.now > dpDeadline(e)) {
        if (dpComplete(g)) {
          g.status = "PELUNASAN";
          notify(d, memberIds(g), `DP ${name} lengkap. Status PELUNASAN — lunasi sebelum H-3 23.59 WIB.`, link);
          notifyHosts(d, e, `DP ${name} lengkap, grup lanjut ke pelunasan.`);
          log(d, "system", "scheduler.H-7", `Grup ${g.id} lanjut pelunasan`);
        } else cancelWithRefund(d, g, "DP belum lengkap di batas H-7 (U4)");
        changes++;
      }
    }
    if (g.status === "PELUNASAN") {
      if (g.kind === "sofa" && d.now > dayStart(e.date, 4) && once(d, `lunas-reminder-${g.id}`)) {
        notify(d, activeMembers(g).filter((m) => m.pay !== "lunas").map((m) => m.userId), `Pengingat: lunasi ${name} sebelum H-3 23.59 WIB.`, link); changes++;
      }
      if (d.now > lunasDeadline(e)) {
        if (g.kind === "tiket") cancelWithRefund(d, g, "Grup tiket tidak penuh sebelum H-3 (U9)");
        else if (lunasComplete(g)) {
          g.status = "LUNAS";
          notify(d, memberIds(g), `${name} LUNAS! Sampai jumpa di hari H.`, link);
          notifyHosts(d, e, `Sofa ${name} LUNAS dan terbooking lewat Sofamates (${g.slots} orang). Jangan dijual lagi di venue.`, { venue: true });
          log(d, "system", "scheduler.H-3", `Grup ${g.id} lunas`);
        } else {
          // PAY-08: DP hangus otomatis ditandai milik collective.
          failAtH3(d, g);
        }
        changes++;
      }
    }
    // Vote ditutup H-3 (VOT-03, U12)
    if (g.kind === "sofa" && (g.status as Group["status"]) !== "BATAL" && d.now > voteDeadline(e) && once(d, `vote-${g.id}`)) {
      const r = voteResult(g);
      if (r.tie) notify(d, [g.leaderId], `Vote minuman ${name} seri (${r.top.join(" vs ")}). Ketua yang memutuskan.`, link);
      else notify(d, memberIds(g), `Vote minuman ${name} ditutup. Terpilih: ${r.final ?? "belum ada suara"}.`, link);
      changes++;
    }
    if (g.status === "LUNAS" && d.now > dayStart(e.date, 0) && once(d, `hari-h-${g.id}`)) {
      notify(d, memberIds(g), `Hari ini ${e.title}! Datang bareng grup ${groupName(d, g)}.`, link); changes++;
    }
    if (g.status === "LUNAS" && d.now > eventEnd(e)) {
      g.status = "SELESAI"; changes++;
      if (g.kind === "sofa") notify(d, memberIds(g), `Rating dibuka untuk ${name} sampai H+3. Nilai anggota grupmu.`, link);
      log(d, "system", "scheduler.selesai", `Grup ${g.id} selesai`);
    }
  }
  for (const e of d.events) if (e.status === "terbit" && d.now > eventEnd(e)) { e.status = "selesai"; changes++; }
  return changes;
}
