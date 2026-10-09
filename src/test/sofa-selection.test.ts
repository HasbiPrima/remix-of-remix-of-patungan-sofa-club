import { describe, expect, it } from "vitest";
import { makeSeed } from "@/lib/seed";
import { actions } from "@/lib/store";
import { filledSlots, occupiedSlots } from "@/lib/sofa-selection";

describe("pemilihan slot sofa", () => {
  it("menyimpan slot pilihan ketua ketika membuat grup", () => {
    const state = makeSeed();
    const user = state.users.find((u) => u.id === "u1");
    const sofa = state.sofas.find((s) => s.venueId === "v1");
    if (!user || !sofa) throw new Error("Seed tidak lengkap");
    state.groups = [];
    const id = actions.createGroup(state, user, "e1", sofa.id, 3);
    expect(state.groups.find((g) => g.id === id)?.members[0]?.slotNumber).toBe(3);
  });
  it("menolak slot yang sudah ditempati anggota lain", () => {
    const state = makeSeed();
    const group = state.groups[0];
    const user = state.users.find((u) => !group?.members.some((m) => m.userId === u.id) && u.role === "user");
    if (!group || !user) throw new Error("Seed tidak lengkap");
    const occupied = occupiedSlots(group);
    expect(actions.join(state, user, group.id, occupied[0])).toBe("Slot tidak tersedia.");
    expect(group.members).toHaveLength(occupied.length);
  });
  it("menyimpan slot kosong pilihan anggota baru", () => {
    const state = makeSeed();
    const group = state.groups[0];
    const user = state.users.find((u) => !group?.members.some((m) => m.userId === u.id) && u.role === "user");
    if (!group || !user) throw new Error("Seed tidak lengkap");
    const selected = group.slots;
    expect(actions.join(state, user, group.id, selected)).toBeUndefined();
    expect(group.members.find((m) => m.userId === user.id)?.slotNumber).toBe(selected);
    expect(new Set(occupiedSlots(group)).size).toBe(group.members.length);
  });
  it("menolak nomor slot di luar kapasitas", () => {
    const state = makeSeed();
    const group = state.groups[0];
    const user = state.users.find((u) => !group?.members.some((m) => m.userId === u.id) && u.role === "user");
    if (!group || !user) throw new Error("Seed tidak lengkap");
    expect(actions.join(state, user, group.id, group.slots + 1)).toBe("Slot tidak tersedia.");
  });
});
describe("multi-slot selection", () => {
  it("one member can book 3 slots and they count as filled", () => {
    const state = makeSeed();
    const user = state.users.find((u) => u.id === "u1")!;
    const sofa = state.sofas.find((s) => s.venueId === "v1" && s.capacity >= 4)!;
    state.groups = [];
    const id = actions.createGroup(state, user, "e1", sofa.id, [1, 2, 3]) as string;
    const g = state.groups.find((x) => x.id === id)!;
    expect(occupiedSlots(g)).toEqual([1, 2, 3]);
    expect(filledSlots(g)).toBe(3);
  });
});
