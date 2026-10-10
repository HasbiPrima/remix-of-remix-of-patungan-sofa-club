import { describe, expect, it } from "vitest";
import { makeSeed } from "@/lib/seed";
import { actions } from "@/lib/store";
import { calcSlotPrices, createDeadline, deadline, dpDeadline, fmtDate, hashNik, lunasDeadline, normalizeWa } from "@/lib/rules";

const setup = () => {
  const s = makeSeed();
  const user = (id: string) => s.users.find((u) => u.id === id)!;
  const group = (id: string) => s.groups.find((g) => g.id === id)!;
  const event = (id: string) => s.events.find((e) => e.id === id)!;
  return { s, user, group, event };
};
/** Majukan waktu melewati batas H-7, supaya grup yang DP-nya lengkap masuk PELUNASAN. */
const toPelunasan = (s: ReturnType<typeof makeSeed>, e: { date: string }) => {
  s.now = deadline(e.date, 7) + 1;
  actions.runScheduler(s);
};
const txId = (r: unknown) => {
  expect(typeof r === "string" && /^tx\d+$/.test(r)).toBe(true);
  return r as string;
};

describe("jadwal dan uang (PRD bagian 5)", () => {
  it("contoh PRD: sofa Rp3jt, DP Rp500rb, 5 slot", () => {
    expect(calcSlotPrices(3_000_000, 500_000, 5)).toEqual({ dpPerSlot: 100_000, lunasPerSlot: 500_000 });
  });
  it("dibulatkan ke atas ke Rp1.000 (U1)", () => {
    expect(calcSlotPrices(1_850_000, 500_000, 3)).toEqual({ dpPerSlot: 167_000, lunasPerSlot: 450_000 });
  });
  it("batas buat grup H-14, DP H-7, pelunasan H-3 pukul 23.59 WIB", () => {
    const { event } = setup();
    expect(fmtDate(createDeadline(event("e1")))).toContain("7 Nov 2026");
    expect(fmtDate(dpDeadline(event("e1")))).toContain("14 Nov 2026");
    expect(fmtDate(lunasDeadline(event("e1")))).toContain("18 Nov 2026");
    expect(fmtDate(deadline("2026-10-30", 7))).toMatch(/23[.:]59/);
  });
  it("nomor WA dinormalkan ke format 62", () => {
    expect(normalizeWa("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeWa("12345")).toBeUndefined();
  });
});

describe("penjadwal", () => {
  it("DP kurang di H-7: grup batal dan DP di-refund penuh (U4)", () => {
    const { s, group, event } = setup();
    s.now = dpDeadline(event("e1")) + 1;
    actions.runScheduler(s);
    expect(group("g1").status).toBe("BATAL");
    expect(s.txs.filter((t) => t.kind === "refund" && t.groupId === "g1")).toHaveLength(2);
  });
  it("grup yang DP-nya dibayar ketua lanjut PELUNASAN di H-7", () => {
    const { s, group, event } = setup();
    s.now = dpDeadline(event("e2")) + 1;
    actions.runScheduler(s);
    expect(group("g3").status).toBe("PELUNASAN");
  });
  it("tidak lunas di H-3: yang lunas di-refund, sisanya hangus (U6)", () => {
    const { s, user, group, event } = setup();
    toPelunasan(s, event("e3"));
    actions.settle(s, txId(actions.payLunas(s, user("u1"), "g4")), true);
    s.now = lunasDeadline(event("e3")) + 1;
    actions.runScheduler(s);
    const g = group("g4");
    expect(g.status).toBe("BATAL");
    expect(g.members.map((m) => [m.userId, m.pay])).toEqual([["u1", "refund"], ["u3", "hangus"], ["u2", "hangus"]]);
    expect(s.txs.filter((t) => t.kind === "refund" && t.groupId === "g4").every((t) => t.userId === "u1")).toBe(true);
  });
  it("slot yang tidak dibayar dalam 30 menit dilepas (U2)", () => {
    const { s, user, group } = setup();
    const id = txId(actions.join(s, user("u3"), "g1", 3));
    expect(group("g1").members.find((m) => m.userId === "u3")?.pay).toBe("menunggu");
    s.now += 31 * 60_000;
    actions.runScheduler(s);
    expect(group("g1").members.some((m) => m.userId === "u3")).toBe(false);
    expect(s.txs.find((t) => t.id === id)?.status).toBe("kedaluwarsa");
  });
});

describe("pembayaran", () => {
  it("webhook berhasil mengubah status slot jadi DP (PAY-05)", () => {
    const { s, user, group } = setup();
    const id = txId(actions.join(s, user("u3"), "g1", 3));
    actions.settle(s, id, true);
    expect(group("g1").members.find((m) => m.userId === "u3")?.pay).toBe("dp");
  });
  it("ketua tidak bisa bayar seluruh DP setelah ada anggota yang DP (U14)", () => {
    const { s, user } = setup();
    expect(actions.payAllDp(s, user("u1"), "g1", true)).toContain("U14");
  });
  it("tombol pelunasan hanya saat status PELUNASAN (PAY-03)", () => {
    const { s, user } = setup();
    expect(actions.payLunas(s, user("u1"), "g1")).toContain("PAY-03");
  });
  it("talangan dicatat atas nama pembayar untuk slot orang lain (PAY-04)", () => {
    const { s, user, group, event } = setup();
    toPelunasan(s, event("e3"));
    const id = txId(actions.payLunas(s, user("u1"), "g4", "u3"));
    actions.settle(s, id, true);
    const tx = s.txs.find((t) => t.id === id)!;
    expect([tx.kind, tx.userId, tx.memberUserId]).toEqual(["talangan", "u1", "u3"]);
    expect(group("g4").members.find((m) => m.userId === "u3")?.pay).toBe("lunas");
  });
  it("grup tiket 5 orang LUNAS saat penuh dan menerbitkan e-tiket (TKT-02, TKT-03)", () => {
    const { s, user, group } = setup();
    for (const id of ["u2", "u5"]) {
      const u = user(id);
      u.verify = "terverifikasi"; u.whatsapp = "628123456789";
      actions.settle(s, txId(actions.join(s, u, "g7")), true);
    }
    expect(group("g7").status).toBe("PELUNASAN");
    user("u4").whatsapp = "628123456780";
    actions.settle(s, txId(actions.join(s, user("u4"), "g7")), true);
    expect(group("g7").status).toBe("LUNAS");
    expect(s.etickets.filter((t) => t.groupId === "g7")).toHaveLength(5);
  });
});

describe("pengajuan grup (GRP-02..05)", () => {
  it("user di bawah 21 tahun tidak bisa mengajukan", () => {
    const { s, user } = setup();
    expect(actions.createProposal(s, user("u6"), { eventId: "e1", sofaId: "s14", friends: 0, referralCode: "", note: "" })).toContain("21");
  });
  it("disetujui host collective: grup dibuat dan pengaju jadi ketua", () => {
    const { s, user } = setup();
    const pid = actions.createProposal(s, user("u1"), { eventId: "e1", sofaId: "s14", friends: 1, referralCode: "NEONDEWI", note: "" }) as string;
    expect(actions.decideProposal(s, user("hc2"), pid, true)).toContain("bukan penyelenggara");
    actions.decideProposal(s, user("hc1"), pid, true);
    const g = s.groups.find((x) => x.sofaId === "s14" && x.status !== "BATAL")!;
    expect(g.leaderId).toBe("u1");
    expect(g.members[0]?.referralId).toBe("r1");
  });
  it("satu grup aktif per sofa (GRP-04)", () => {
    const { s, user } = setup();
    expect(actions.createProposal(s, user("u1"), { eventId: "e1", sofaId: "s11", friends: 0, referralCode: "", note: "" })).toContain("GRP-04");
  });
  it("penolakan wajib beralasan", () => {
    const { s, user } = setup();
    expect(actions.decideProposal(s, user("hc1"), "p1", false)).toContain("Alasan");
  });
  it("tidak bisa membuat grup setelah H-14 (U13)", () => {
    const { s, user, event } = setup();
    s.now = createDeadline(event("e1")) + 1;
    expect(actions.createProposal(s, user("u1"), { eventId: "e1", sofaId: "s14", friends: 0, referralCode: "", note: "" })).toContain("H-14");
  });
});

describe("referral, verifikasi, katalog", () => {
  it("kode valid hanya untuk collective event dan harus aktif (REF-02)", () => {
    const { s } = setup();
    expect(actions.findReferral(s, "e1", "neondewi")?.id).toBe("r1");
    expect(actions.findReferral(s, "e2", "NEONDEWI")).toBeUndefined();
    expect(actions.findReferral(s, "e1", "KOPIJOGJA")).toBeUndefined();
  });
  const form = { ktpName: "Rina Kusuma", birthPlace: "Sleman", birthDate: "2000-01-01", nik: "3404010101000001", ktpImage: "x", selfieImage: "y" };
  it("satu NIK hanya untuk satu akun (AKN-05)", () => {
    const { s, user } = setup();
    user("u1").nikHash = hashNik(form.nik);
    actions.requestVerify(s, user("u4"), form);
    expect([user("u4").verify, user("u4").verifyReason]).toEqual(["ditolak", "NIK sudah dipakai akun lain (AKN-05)."]);
  });
  it("di bawah 18 tahun ditolak (AKN-03), selain itu menunggu admin", () => {
    const { s, user } = setup();
    actions.requestVerify(s, user("u4"), { ...form, birthDate: "2010-01-01" });
    expect(user("u4").verify).toBe("ditolak");
    user("u4").verify = "belum";
    actions.requestVerify(s, user("u4"), form);
    expect(user("u4").verify).toBe("menunggu");
  });
  it("admin menyetujui verifikasi yang menunggu", () => {
    const { s, user } = setup();
    actions.adminVerify(s, user("adm1"), "u5", true);
    expect(user("u5").verify).toBe("terverifikasi");
  });
  it("DP sofa minimal Rp500.000 (EVT-02)", () => {
    const { s, user } = setup();
    expect(actions.saveSofa(s, user("hc1"), "e1", null, { name: "C1", capacity: 4, price: 2_000_000, dp: 400_000, drinkPackage: "", drinks: [] })).toContain("500.000");
  });
  it("event yang sudah punya pembayaran hanya bisa dibatalkan (EVT-04)", () => {
    const { s, user } = setup();
    expect(actions.deleteEvent(s, user("hc1"), "e1")).toContain("EVT-04");
    actions.cancelEvent(s, user("hc1"), "e1");
    expect(s.groups.filter((g) => g.eventId === "e1").every((g) => g.status === "BATAL")).toBe(true);
  });
});

describe("sinkron antar peran (user, host collective, host venue)", () => {
  const notifsOf = (s: ReturnType<typeof setup>["s"], userId: string) => s.notifs.filter((n) => n.userId === userId).map((n) => n.text);
  it("pengajuan disetujui: venue tahu sofa sedang dipesan", () => {
    const { s, user } = setup();
    actions.decideProposal(s, user("hc1"), "p1", true);
    expect(notifsOf(s, "hv1").some((t) => t.includes("VIP A2") && t.includes("dipesan"))).toBe(true);
    expect(notifsOf(s, "hc1").some((t) => t.includes("disetujui"))).toBe(false); // pelaku tidak dikabari aksinya sendiri
  });
  it("disetujui admin: host collective ikut dikabari", () => {
    const { s, user } = setup();
    actions.decideProposal(s, user("adm1"), "p1", true);
    expect(notifsOf(s, "hc1").some((t) => t.includes("disetujui oleh Admin"))).toBe(true);
  });
  it("grup lunas di H-3: venue dan collective tahu sofa terbooking", () => {
    const { s, user, group, event } = setup();
    toPelunasan(s, event("e3"));
    for (const m of ["u1", "u3", "u2"]) actions.settle(s, actions.payLunas(s, user(m), "g4") as string, true);
    s.now = lunasDeadline(event("e3")) + 1;
    actions.runScheduler(s);
    expect(group("g4").status).toBe("LUNAS");
    const venueHost = s.users.find((u) => u.role === "host_venue" && u.venueId === event("e3").venueId);
    if (venueHost) expect(notifsOf(s, venueHost.id).some((t) => t.includes("terbooking"))).toBe(true);
    expect(notifsOf(s, "hc1").some((t) => t.includes("Terrace") && t.includes("LUNAS"))).toBe(true);
  });
  it("event dibatalkan: venue dikabari sekali, user dikabari per grup", () => {
    const { s, user } = setup();
    const before = notifsOf(s, "hv1").length;
    actions.cancelEvent(s, user("hc1"), "e1");
    expect(notifsOf(s, "hv1").length - before).toBe(1);
    expect(notifsOf(s, "u2").some((t) => t.includes("BATAL"))).toBe(true);
  });
  it("jadwal event berubah: venue dan anggota grup dikabari", () => {
    const { s, user, event } = setup();
    const e = event("e1");
    actions.saveEvent(s, user("hc1"), "e1", { ...e, date: "2026-11-22" });
    expect(notifsOf(s, "hv1").some((t) => t.includes("2026-11-22"))).toBe(true);
    expect(notifsOf(s, "u1").some((t) => t.includes("Jadwal Neon Kopi Night"))).toBe(true);
  });
});
