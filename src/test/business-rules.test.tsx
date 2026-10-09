import { describe, expect, it } from "vitest";
import { makeSeed } from "@/lib/seed";
import { actions } from "@/lib/store";
import { calcSlotPrices } from "@/lib/rules";

const me = (s: ReturnType<typeof makeSeed>, id: string) => s.users.find((u) => u.id === id)!;

describe("aturan bisnis", () => {
  it("harga per slot dibulatkan ke atas ke Rp1.000", () => {
    expect(calcSlotPrices(1_850_000, 3, 30)).toEqual({ dpPerSlot: 185_000, lunasPerSlot: 432_000 });
  });
  it("kode referral sendiri ditolak", () => {
    const s = makeSeed();
    expect(actions.applyReferral(s, me(s, "u4"), "RINA26")).toBe("Tidak bisa memakai kode sendiri.");
  });
  it("kode referral hanya sekali", () => {
    const s = makeSeed();
    expect(actions.applyReferral(s, me(s, "u2"), "DIMAS26")).toBe("Kode referral sudah pernah dipakai.");
  });
  it("admin menyetujui verifikasi yang menunggu", () => {
    const s = makeSeed();
    actions.adminVerify(s, me(s, "adm1"), "u5", true);
    expect(me(s, "u5").verify).toBe("terverifikasi");
  });
});
