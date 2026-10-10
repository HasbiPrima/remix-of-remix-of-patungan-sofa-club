import { describe, expect, it } from "vitest";
import { makeSeed } from "@/lib/seed";
import { actions } from "@/lib/store";
import { filledSlots, memberSlotList, occupiedSlots } from "@/lib/sofa-selection";

const setup = () => {
  const state = makeSeed();
  const user = (id: string) => state.users.find((u) => u.id === id)!;
  const group = (id: string) => state.groups.find((g) => g.id === id)!;
  return { state, user, group };
};

describe("pemilihan slot sofa", () => {
  it("menyimpan slot pilihan anggota baru", () => {
    const { state, user, group } = setup();
    expect(actions.isErr(actions.join(state, user("u1"), "g2", 3))).toBe(false);
    expect(group("g2").members.find((m) => m.userId === "u1")?.slotNumber).toBe(3);
  });
  it("menolak slot yang sudah ditempati anggota lain", () => {
    const { state, user, group } = setup();
    const occupied = occupiedSlots(group("g1"));
    expect(actions.join(state, user("u3"), "g1", occupied[0])).toBe("Slot tidak tersedia.");
    expect(group("g1").members).toHaveLength(occupied.length);
  });
  it("menyimpan slot terakhir tanpa dobel", () => {
    const { state, user, group } = setup();
    const g = group("g1");
    actions.join(state, user("u3"), "g1", g.slots);
    expect(g.members.find((m) => m.userId === "u3")?.slotNumber).toBe(g.slots);
    expect(new Set(occupiedSlots(g)).size).toBe(g.members.length);
  });
  it("menolak nomor slot di luar kapasitas", () => {
    const { state, user, group } = setup();
    expect(actions.join(state, user("u3"), "g1", group("g1").slots + 1)).toBe("Slot tidak tersedia.");
  });
  it("anggota lama tanpa nomor slot mendapat slot kosong pertama secara deterministik", () => {
    const { group } = setup();
    const g = group("g1");
    delete g.members[1]!.slotNumber;
    g.members[0]!.slotNumber = 2;
    expect(memberSlotList(g)).toEqual([[2], [1]]);
  });
});

describe("multi-slot selection", () => {
  it("satu anggota bisa memesan 3 slot dan semuanya terhitung", () => {
    const { state, user, group } = setup();
    actions.join(state, user("u3"), "g1", [3, 4, 5]);
    expect(occupiedSlots(group("g1"))).toEqual([1, 2, 3, 4, 5]);
    expect(filledSlots(group("g1"))).toBe(5);
  });
});
