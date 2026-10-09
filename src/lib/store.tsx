import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { makeSeed } from "./seed";
import {
  calcSlotPrices, can, dpComplete, dpDeadline, eventEnd, getEvent, getSofa, getUser, lunasComplete,
  lunasDeadline, ratingEnd, ratingStart, voteDeadline, type Action,
} from "./rules";
import type { AppState, Group, User } from "./types";
import { availableSlots, filledSlots, memberSlotList } from "./sofa-selection";

const KEY = "sofamates-state-v1";

type Draft = AppState;
type Ctx = {
  state: AppState;
  me: User;
  run: (action: Action | null, label: string, fn: (d: Draft, me: User) => string | void) => boolean;
  check: (action: Action) => boolean;
  reset: () => void;
};

// Keep one context instance across hot reloads so provider & consumers always match.
const g = globalThis as unknown as { __sofamatesCtx?: React.Context<Ctx | null> };
const AppCtx = g.__sofamatesCtx ?? (g.__sofamatesCtx = createContext<Ctx | null>(null));

function nextId(d: Draft, p: string) {
  d.seq += 1;
  return `${p}${d.seq}`;
}
export function notify(d: Draft, userIds: string[], text: string, link?: string) {
  for (const userId of new Set(userIds)) d.notifs.unshift({ id: nextId(d, "n"), userId, text, at: d.now, read: false, link });
}
export function log(d: Draft, actorId: string, action: string, detail: string) {
  d.logs.unshift({ id: nextId(d, "l"), at: d.now, actorId, action, detail });
}

/** Scheduler: applies automatic deadlines H-14, H-7, H-3 and event end. Returns number of changes. */
export function runScheduler(d: Draft): number {
  let changes = 0;
  for (const g of d.groups) {
    const e = getEvent(d, g.eventId);
    if (!e) continue;
    const ids = g.members.map((m) => m.userId);
    const link = `/grup/${g.id}`;
    const name = `${getSofa(d, g.sofaId)?.name} – ${e.title}`;
    if (e.cancelled && g.status !== "BATAL" && g.status !== "SELESAI") {
      g.status = "BATAL"; g.cancelReason = "Event dibatalkan penyelenggara"; changes++;
      notify(d, ids, `Grup ${name} BATAL karena event dibatalkan. Dana dikembalikan (simulasi).`, link);
      log(d, "system", "scheduler.cancel", `Grup ${g.id} batal (event dibatalkan)`);
      continue;
    }
    if (g.status === "DP_BOOKING" && d.now > dpDeadline(e)) {
      g.status = "BATAL"; g.cancelReason = "DP belum penuh hingga H-14 23.59 WIB"; changes++;
      notify(d, ids, `Grup ${name} BATAL: DP tidak terpenuhi hingga H-14. DP dikembalikan (simulasi).`, link);
      log(d, "system", "scheduler.H-14", `Grup ${g.id} batal, DP tidak penuh`);
    } else if (g.status === "PELUNASAN" && d.now > lunasDeadline(e)) {
      g.status = "BATAL"; g.cancelReason = "Pelunasan belum penuh hingga H-7 23.59 WIB"; changes++;
      notify(d, ids, `Grup ${name} BATAL: pelunasan tidak lengkap hingga H-7. DP hangus sesuai S&K.`, link);
      log(d, "system", "scheduler.H-7", `Grup ${g.id} batal, pelunasan tidak penuh`);
    } else if (g.status === "LUNAS" && d.now > eventEnd(e)) {
      g.status = "SELESAI"; changes++;
      notify(d, ids, `Event ${e.title} selesai! Beri rating H+1 sampai H+3.`, link);
      log(d, "system", "scheduler.selesai", `Grup ${g.id} selesai`);
    }
    // H-3 reminder for vote closing (one-time per group)
    const remindKey = `vote-${g.id}`;
    if ((g.status === "LUNAS" || g.status === "PELUNASAN") && d.now > voteDeadline(e) && !d.logs.some((l) => l.detail === remindKey)) {
      const tally = Object.values(g.votes).reduce<Record<string, number>>((a, v) => ({ ...a, [v]: (a[v] ?? 0) + 1 }), {});
      const win = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "pilihan venue";
      notify(d, ids, `Vote minuman ${name} ditutup (H-3). Terpilih: ${win}.`, link);
      log(d, "system", "scheduler.H-3", remindKey);
      changes++;
    }
  }
  return changes;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => makeSeed());
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(JSON.parse(raw));
    } catch { /* ignore */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (loaded.current) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const me = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0]!;

  const check = useCallback((action: Action) => {
    const err = can(me, action);
    if (err) toast.error(err);
    return !err;
  }, [me]);

  const run = useCallback<Ctx["run"]>((action, label, fn) => {
    const user = me;
    if (action) {
      const err = can(user, action);
      if (err) { toast.error(err); return false; }
    }
    const d: Draft = structuredClone(state);
    const err = fn(d, user);
    if (typeof err === "string") { toast.error(err); return false; }
    if (action) log(d, user.id, action, label);
    setState(d);
    toast.success(label);
    return true;
  }, [me, state]);

  const reset = useCallback(() => { setState(makeSeed()); toast.success("Data demo direset"); }, []);

  const value = useMemo(() => ({ state, me, run, check, reset }), [state, me, run, check, reset]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

/* ---------------- Domain actions (pure on draft) ---------------- */

export const actions = {
  createGroup(d: Draft, me: User, eventId: string, sofaId: string, selectedSlot?: number | number[]) {
    const e = getEvent(d, eventId); const s = getSofa(d, sofaId);
    if (!e || !s) return "Data tidak ditemukan.";
    if (e.cancelled) return "Event sudah dibatalkan.";
    if (d.now > dpDeadline(e)) return "Batas DP (H-14 23.59 WIB) sudah lewat.";
    if (d.groups.some((g) => g.eventId === eventId && g.sofaId === sofaId && g.status !== "BATAL"))
      return "Sofa ini sudah dipakai grup lain.";
    const picked = availableSlots(s.capacity, [], selectedSlot);
    if (!picked) return "Slot tidak tersedia.";
    const slotNumber = picked[0]!; const extraSlots = picked.slice(1);
    const id = nextId(d, "g");
    const p = calcSlotPrices(s.price, s.capacity, e.dpPercent);
    const g: Group = {
      id, eventId, sofaId, leaderId: me.id, status: "DP_BOOKING", slots: s.capacity, ...p,
      members: [{ userId: me.id, slotNumber, ...(extraSlots.length ? { extraSlots } : {}), dpPaid: true, dpCoveredByLeader: false, lunasPaid: false, joinedAt: d.now }],
      leaderPaidAllDp: false, emptyLunasPaid: 0, votes: {}, ratings: {}, createdAt: d.now,
    };
    if (picked.length >= g.slots) g.status = "PELUNASAN";
    d.groups.unshift(g);
    notify(d, [me.id], `Grup ${s.name} dibuat. Ajak teman sebelum H-14!`, `/grup/${id}`);
    return id;
  },
  join(d: Draft, me: User, groupId: string, selectedSlot?: number | number[]) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    const e = getEvent(d, g.eventId)!;
    if (g.members.some((m) => m.userId === me.id)) return "Kamu sudah anggota grup ini.";
    if (filledSlots(g) >= g.slots) return "Slot penuh.";
    if (g.status === "DP_BOOKING" && d.now > dpDeadline(e)) return "Batas DP sudah lewat.";
    if (g.status === "PELUNASAN" && d.now > lunasDeadline(e)) return "Batas pelunasan sudah lewat.";
    if (g.status !== "DP_BOOKING" && g.status !== "PELUNASAN") return "Grup tidak menerima anggota baru.";
    const perMember = memberSlotList(g);
    const occupied = perMember.flat();
    const picked = availableSlots(g.slots, occupied, selectedSlot);
    if (!picked) return "Slot tidak tersedia.";
    const slotNumber = picked[0]!; const extraSlots = picked.slice(1);
    g.members.forEach((member, index) => {
      const assigned = perMember[index]?.[0];
      if (assigned !== undefined && !member.slotNumber) member.slotNumber = assigned;
    });
    g.members.push({ userId: me.id, slotNumber, ...(extraSlots.length ? { extraSlots } : {}), dpPaid: true, dpCoveredByLeader: g.leaderPaidAllDp, lunasPaid: false, joinedAt: d.now });
    if (g.status === "DP_BOOKING" && dpComplete(g)) {
      g.status = "PELUNASAN";
      notify(d, g.members.map((m) => m.userId), `DP grup ${getSofa(d, g.sofaId)?.name} penuh! Lanjut pelunasan sebelum H-7.`, `/grup/${g.id}`);
    }
    notify(d, [g.leaderId], `${me.name} bergabung ke grupmu.`, `/grup/${g.id}`);
  },
  payAllDp(d: Draft, me: User, groupId: string) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    if (g.leaderId !== me.id) return "Hanya ketua grup yang boleh membayar seluruh DP.";
    if (g.status !== "DP_BOOKING") return "Grup tidak dalam tahap DP.";
    if (d.now > dpDeadline(getEvent(d, g.eventId)!)) return "Batas DP sudah lewat.";
    g.leaderPaidAllDp = true; g.termsAcceptedAt = d.now; g.status = "PELUNASAN";
    notify(d, g.members.map((m) => m.userId), `Ketua melunasi seluruh DP. Grup masuk tahap pelunasan.`, `/grup/${g.id}`);
  },
  payLunas(d: Draft, me: User, groupId: string) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    const mm = g.members.find((m) => m.userId === me.id);
    if (!mm) return "Kamu bukan anggota grup.";
    if (g.status !== "PELUNASAN") return "Grup tidak dalam tahap pelunasan.";
    if (mm.lunasPaid) return "Kamu sudah lunas.";
    if (d.now > lunasDeadline(getEvent(d, g.eventId)!)) return "Batas pelunasan sudah lewat.";
    mm.lunasPaid = true;
    afterLunas(d, g);
  },
  payEmptySlots(d: Draft, me: User, groupId: string) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    if (g.leaderId !== me.id) return "Hanya ketua yang boleh melunasi slot kosong.";
    if (g.status !== "PELUNASAN") return "Grup tidak dalam tahap pelunasan.";
    if (d.now > lunasDeadline(getEvent(d, g.eventId)!)) return "Batas pelunasan sudah lewat.";
    const empty = g.slots - filledSlots(g);
    if (empty <= 0) return "Tidak ada slot kosong.";
    g.emptyLunasPaid = empty;
    afterLunas(d, g);
  },
  vote(d: Draft, me: User, groupId: string, drink: string) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    if (!g.members.some((m) => m.userId === me.id)) return "Hanya anggota grup yang bisa vote.";
    if (g.status === "BATAL" || g.status === "SELESAI") return "Vote tidak tersedia.";
    if (d.now > voteDeadline(getEvent(d, g.eventId)!)) return "Vote minuman ditutup H-3 23.59 WIB.";
    g.votes[me.id] = drink;
  },
  rate(d: Draft, me: User, groupId: string, stars: number, comment: string) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    const e = getEvent(d, g.eventId)!;
    if (!g.members.some((m) => m.userId === me.id)) return "Hanya anggota grup yang bisa memberi rating.";
    if (g.status !== "SELESAI") return "Rating hanya untuk grup yang selesai.";
    if (d.now < ratingStart(e) || d.now > ratingEnd(e)) return "Rating hanya dibuka H+1 sampai H+3.";
    if (g.ratings[me.id]) return "Kamu sudah memberi rating.";
    g.ratings[me.id] = { stars, comment: comment.slice(0, 300), at: d.now };
  },
  buyTicket(d: Draft, me: User, eventId: string, pax: 1 | 2 | 5) {
    const e = getEvent(d, eventId); if (!e) return "Event tidak ditemukan.";
    if (e.cancelled) return "Event dibatalkan.";
    if (d.now > eventEnd(e)) return "Penjualan tiket sudah ditutup.";
    const price = pax === 1 ? e.tickets.p1 : pax === 2 ? e.tickets.p2 : e.tickets.p5;
    const id = nextId(d, "t");
    d.tickets.unshift({ id, eventId, userId: me.id, pax, price, at: d.now, code: `SFM-${eventId.toUpperCase()}-${String(d.seq).padStart(4, "0")}` });
    notify(d, [me.id], `Tiket ${pax} orang untuk ${e.title} berhasil dibeli.`, "/akun");
  },
  updateProfile(d: Draft, me: User, data: { whatsapp: string; ktpName: string; ktpAddress: string; gender: "pria" | "wanita" | "" }) {
    const u = d.users.find((x) => x.id === me.id)!;
    const wa = data.whatsapp.trim();
    if (!/^08\d{7,12}$/.test(wa)) return "Nomor WhatsApp harus diawali 08 dan berisi 9-14 angka.";
    const nama = data.ktpName.trim();
    if (nama.length < 3 || nama.length > 100) return "Nama sesuai KTP wajib diisi (3-100 karakter).";
    const alamat = data.ktpAddress.trim();
    if (alamat.length < 10 || alamat.length > 300) return "Alamat sesuai KTP wajib diisi (10-300 karakter).";
    if (data.gender !== "pria" && data.gender !== "wanita") return "Pilih jenis kelamin.";
    u.whatsapp = wa; u.ktpName = nama; u.ktpAddress = alamat; u.gender = data.gender;
  },
  requestVerify(d: Draft, me: User, ktpImage: string, selfieImage: string) {
    const u = d.users.find((x) => x.id === me.id)!;
    if (u.verify === "terverifikasi") return "Akun sudah terverifikasi.";
    if (u.verify === "menunggu") return "Pengajuan verifikasi sedang ditinjau.";
    if (!ktpImage || !selfieImage) return "Foto KTP dan foto muka wajib diunggah.";
    u.ktpImage = ktpImage;
    u.selfieImage = selfieImage;
    u.verify = "menunggu";
    notify(d, d.users.filter((x) => x.role === "admin").map((x) => x.id), `${u.name} mengajukan verifikasi akun.`, "/admin");
  },
  applyReferral(d: Draft, me: User, code: string) {
    const u = d.users.find((x) => x.id === me.id)!;
    if (u.referredBy) return "Kode referral sudah pernah dipakai.";
    const owner = d.users.find((x) => x.referralCode.toUpperCase() === code.trim().toUpperCase());
    if (!owner) return "Kode referral tidak ditemukan.";
    if (owner.id === u.id) return "Tidak bisa memakai kode sendiri.";
    if (d.groups.some((g) => g.members.some((m) => m.userId === u.id)) || d.tickets.some((t) => t.userId === u.id))
      return "Kode referral hanya bisa dipakai sebelum transaksi pertama.";
    u.referredBy = owner.id;
    notify(d, [owner.id], `${u.name} memakai kode referral kamu.`, "/akun");
  },
  adminVerify(d: Draft, _me: User, userId: string, approve: boolean) {
    const u = d.users.find((x) => x.id === userId); if (!u) return "Pengguna tidak ditemukan.";
    if (u.verify !== "menunggu") return "Tidak ada pengajuan yang menunggu.";
    u.verify = approve ? "terverifikasi" : "ditolak";
    notify(d, [u.id], approve ? "Akunmu sudah terverifikasi. Selamat patungan!" : "Verifikasi akunmu ditolak. Silakan ajukan ulang.", "/akun");
  },
  cancelEvent(d: Draft, me: User, eventId: string) {
    const e = getEvent(d, eventId); if (!e) return "Event tidak ditemukan.";
    if (me.role === "host_collective" && e.hostId !== me.id) return "Kamu bukan penyelenggara event ini.";
    if (e.cancelled) return "Event sudah dibatalkan.";
    if (d.now > eventEnd(e)) return "Event sudah berlangsung.";
    e.cancelled = true;
    runScheduler(d);
  },
  adminCancelGroup(d: Draft, _me: User, groupId: string, reason: string) {
    const g = d.groups.find((x) => x.id === groupId); if (!g) return "Grup tidak ditemukan.";
    if (g.status === "BATAL" || g.status === "SELESAI") return "Grup sudah tidak aktif.";
    g.status = "BATAL"; g.cancelReason = reason.trim() || "Dibatalkan admin";
    notify(d, g.members.map((m) => m.userId), `Grup dibatalkan admin: ${g.cancelReason}. Dana dikembalikan (simulasi).`, `/grup/${g.id}`);
  },
  toggleSofa(d: Draft, me: User, sofaId: string) {
    const s = getSofa(d, sofaId); if (!s) return "Sofa tidak ditemukan.";
    if (d.venues.find((v) => v.id === s.venueId)?.hostId !== me.id) return "Sofa ini bukan milik venue-mu.";
    if (s.active && d.groups.some((g) => g.sofaId === s.id && ["DP_BOOKING", "PELUNASAN", "LUNAS"].includes(g.status)))
      return "Sofa masih dipakai grup aktif.";
    s.active = !s.active;
  },
};

function afterLunas(d: Draft, g: Group) {
  if (lunasComplete(g)) {
    g.status = "LUNAS";
    notify(d, g.members.map((m) => m.userId), `Grup ${getSofa(d, g.sofaId)?.name} LUNAS! Sampai jumpa di event 🎉`, `/grup/${g.id}`);
  }
}

export { getUser };
