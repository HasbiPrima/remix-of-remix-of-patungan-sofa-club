import { Armchair, Check, Disc3, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filledSlots, occupiedSlots } from "@/lib/sofa-selection";
import type { Group, Sofa } from "@/lib/types";

export function SofaMap({ sofas, groups, selectedId, onSelect, closed = false }: {
  sofas: Sofa[]; groups: Group[]; selectedId?: string | undefined; onSelect: (sofa: Sofa) => void; closed?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" />Tersedia</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Dipilih</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground" />Penuh / ditutup</span>
      </div>
      <div className="sofa-floor">
        <div className="sofa-stage"><Disc3 className="h-5 w-5" /><span>DJ / PANGGUNG</span></div>
        <div className="sofa-floor-grid">
          {sofas.map((sofa, index) => {
            const group = groups.find((g) => g.sofaId === sofa.id && g.status !== "BATAL");
            const remaining = group ? group.slots - filledSlots(group) : sofa.capacity;
            const blocked = (closed && !group) || remaining <= 0 || (!!group && !["DP_BOOKING", "PELUNASAN"].includes(group.status));
            return (
              <Button key={sofa.id} variant="ghost" aria-pressed={selectedId === sofa.id}
                aria-label={`${sofa.name}, ${blocked ? "ditutup" : `${remaining} slot tersedia`}`}
                onClick={() => onSelect(sofa)} className={cn("sofa-map-item", selectedId === sofa.id && "sofa-map-selected", blocked && "sofa-map-blocked")}>
                <span className="sofa-map-code">{String(index + 1).padStart(2, "0")}{selectedId === sofa.id && <Check className="h-3 w-3" />}</span>
                <span className="sofa-shape" aria-hidden="true"><span /><span /><span /></span>
                <span className="max-w-full whitespace-normal text-center text-xs font-semibold">{sofa.name}</span>
                <span className="text-[11px] text-muted-foreground">{blocked ? "Tidak tersedia" : group ? `${remaining}/${group.slots} slot tersedia` : "Belum ada grup"}</span>
              </Button>
            );
          })}
        </div>
        <div className="sofa-bar"><Wine className="h-4 w-4" />BAR</div>
      </div>
    </div>
  );
}

export function SofaSlots({ capacity, group, selected = [], onSelect, disabled = false }: {
  capacity: number; group?: Group | undefined; selected?: number[]; onSelect?: (slots: number[]) => void; disabled?: boolean;
}) {
  const occupied = occupiedSlots(group);
  const toggle = (slot: number) =>
    onSelect?.(selected.includes(slot) ? selected.filter((x) => x !== slot) : [...selected, slot].sort((a, b) => a - b));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Pilihan slot sofa">
        {Array.from({ length: capacity }, (_, i) => i + 1).map((slot) => {
          const on = selected.includes(slot);
          return (
            <Button key={slot} variant="outline" disabled={disabled || occupied.includes(slot)} aria-pressed={on}
              aria-label={`Slot ${slot}${occupied.includes(slot) ? " terisi" : " tersedia"}`} onClick={() => toggle(slot)}
              className={cn("sofa-slot", on && "sofa-slot-selected", occupied.includes(slot) && "sofa-slot-occupied")}>
              <Armchair /><span>{slot}</span>
            </Button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted-foreground">{selected.length ? `Pilihanmu: slot ${selected.join(", ")} (${selected.length} slot)` : `${capacity - occupied.length} slot tersedia · bisa pilih lebih dari satu`} · {occupied.length} terisi</p>
    </div>
  );
}
