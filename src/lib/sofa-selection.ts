import type { Group, Member } from "./types";

/** Slots per member (index-aligned with group.members). Legacy members without slot numbers get the first free slot deterministically. */
export function memberSlotList(group?: Group): number[][] {
  if (!group) return [];
  const reserved = new Set(group.members.flatMap((m) => [...(m.slotNumber ? [m.slotNumber] : []), ...(m.extraSlots ?? [])]));
  return group.members.map((member) => {
    const extra = member.extraSlots ?? [];
    if (member.slotNumber) return [member.slotNumber, ...extra];
    for (let n = 1; n <= group.slots; n++) {
      if (!reserved.has(n)) { reserved.add(n); return [n, ...extra]; }
    }
    return extra;
  });
}

export function occupiedSlots(group?: Group): number[] {
  return memberSlotList(group).flat();
}

export const memberSlotCount = (m: Member) => 1 + (m.extraSlots?.length ?? 0);
export const filledSlots = (g: Group) => g.members.reduce((a, m) => a + memberSlotCount(m), 0);

export function availableSlot(capacity: number, occupied: number[], selected?: number) {
  const slot = selected ?? Array.from({ length: capacity }, (_, i) => i + 1).find((n) => !occupied.includes(n));
  return slot !== undefined && Number.isInteger(slot) && slot >= 1 && slot <= capacity && !occupied.includes(slot) ? slot : undefined;
}

/** Validates a multi-slot selection; falls back to first free slot when none chosen. */
export function availableSlots(capacity: number, occupied: number[], selected?: number[] | number): number[] | undefined {
  const list = selected === undefined ? [] : Array.isArray(selected) ? selected : [selected];
  if (list.length === 0) {
    const s = availableSlot(capacity, occupied);
    return s === undefined ? undefined : [s];
  }
  if (new Set(list).size !== list.length) return undefined;
  return list.every((s) => availableSlot(capacity, occupied, s) !== undefined) ? [...list].sort((a, b) => a - b) : undefined;
}
