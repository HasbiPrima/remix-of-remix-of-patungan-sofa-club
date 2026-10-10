import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { actions, useApp } from "@/lib/store";
import type { EventInput, SofaInput } from "@/lib/domain";
import { createDeadline, eventEnd, fmtEventDate, getVenue, MIN_DP, rupiah, sofaPrices, ticketUsed } from "@/lib/rules";
import { filledSlots } from "@/lib/sofa-selection";
import type { EventItem, Pax, Sofa, TicketType } from "@/lib/types";

const eventStatusStyle: Record<EventItem["status"], string> = {
  draft: "bg-warning/15 text-warning", terbit: "bg-success/15 text-success", batal: "bg-destructive/15 text-destructive", selesai: "bg-muted text-muted-foreground",
};

export function EventManager({ events }: { events: EventItem[] }) {
  const { state, run } = useApp();
  const [editing, setEditing] = useState<EventItem | "new" | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setEditing("new")}><Plus />Event baru</Button>
      {events.length === 0 && <p className="text-sm text-muted-foreground">Belum ada event.</p>}
      {events.map((e) => (
        <div key={e.id} className="rounded-2xl border bg-card p-4 text-sm">
          <EventHeader e={e} />
          <div className="mt-3 flex flex-wrap gap-2">
            {(e.status === "draft" || e.status === "terbit") && <Button size="sm" variant="outline" onClick={() => setEditing(e)}>Ubah</Button>}
            {e.status === "draft" && <Button size="sm" onClick={() => run("event.manage", "Event diterbitkan", (d, u) => actions.saveEvent(d, u, e.id, { ...e, status: "terbit" }))}>Terbitkan</Button>}
            <Button size="sm" variant="secondary" onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? "Tutup" : "Sofa, tiket & grup"}</Button>
            {(e.status === "draft" || e.status === "terbit") && (
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                const hasPay = state.txs.some((t) => t.eventId === e.id && t.status === "berhasil");
                if (!hasPay && confirm(`Hapus ${e.title}? Event belum punya pembayaran.`)) run("event.manage", "Event dihapus", (d, u) => actions.deleteEvent(d, u, e.id));
                else if (hasPay && confirm(`Batalkan ${e.title}? Semua grup batal dan pembayaran dikembalikan penuh (U10).`)) run("event.cancel", "Event dibatalkan", (d, u) => actions.cancelEvent(d, u, e.id));
              }}>Hapus / batalkan</Button>
            )}
          </div>
          {open === e.id && <EventDetail e={e} />}
        </div>
      ))}
      {editing && <EventForm event={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}


function EventHeader({ e }: { e: EventItem }) {
  const { state } = useApp();
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <Link to="/event/$id" params={{ id: e.id }} className="font-semibold">{e.title}</Link>
        <p className="text-xs text-muted-foreground">{fmtEventDate(e.date)} {e.time} WIB · {getVenue(state, e.venueId)?.name}</p>
      </div>
      <span className={`tag ${eventStatusStyle[e.status]}`}>{e.status}</span>
    </div>
  );
}

function EventForm({ event, onClose }: { event: EventItem | null; onClose: () => void }) {
  const { state, run } = useApp();
  const [f, setF] = useState<EventInput>({
    title: event?.title ?? "", venueId: event?.venueId ?? state.venues[0]?.id ?? "", date: event?.date ?? "", time: event?.time ?? "22:00",
    description: event?.description ?? "", status: event?.status ?? "draft", poster: event?.poster ?? "", scheme: event?.scheme ?? "",
  });
  const set = (k: keyof EventInput, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{event ? "Ubah event" : "Event baru"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <Field label="Nama event"><Input maxLength={150} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Venue">
            <Select value={f.venueId} onValueChange={(v) => set("venueId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{state.venues.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} · {v.area}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tanggal"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
            <Field label="Jam (WIB)"><Input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></Field>
          </div>
          <Field label="URL poster (opsional)"><Input value={f.poster ?? ""} placeholder="https://…" onChange={(e) => set("poster", e.target.value)} /></Field>
          <Field label="Deskripsi"><Textarea rows={3} maxLength={1000} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Skema kerja sama dengan venue (informasi, EVT-05)">
            <Select value={f.scheme || "none"} onValueChange={(v) => set("scheme", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Belum diisi</SelectItem>
                <SelectItem value="beli_putus">Beli putus</SelectItem>
                <SelectItem value="bagi_hasil">Bagi hasil</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {!event && <p className="text-xs text-muted-foreground">Event baru disimpan sebagai draft dengan tiket default; atur sofa dan tiket lalu terbitkan.</p>}
          <Button className="w-full" onClick={() => run("event.manage", event ? "Event disimpan" : "Event dibuat", (d, u) => actions.saveEvent(d, u, event?.id ?? null, f)) && onClose()}>Simpan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EventDetail({ e }: { e: EventItem }) {
  const { state, run } = useApp();
  const [sofa, setSofa] = useState<Sofa | "new" | null>(null);
  const sofas = state.sofas.filter((s) => s.eventId === e.id);
  const editable = e.status === "draft" || e.status === "terbit";
  const canCreateGroup = e.status === "terbit" && state.now <= createDeadline(e);
  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm">Sofa ({sofas.length})</h3>
          {editable && <Button size="sm" variant="outline" onClick={() => setSofa("new")}><Plus />Sofa</Button>}
        </div>
        {sofas.map((s) => {
          const g = state.groups.find((x) => x.sofaId === s.id && x.status !== "BATAL");
          const p = sofaPrices(s);
          return (
            <div key={s.id} className="rounded-xl border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.capacity} slot · {rupiah(s.price)} · DP {rupiah(s.dp)} → {rupiah(p.dpPerSlot)}/slot + {rupiah(p.lunasPerSlot)}/slot</p>
                  <p className="text-xs text-muted-foreground">Vote: {s.drinks.join(", ") || "belum ada opsi"}</p>
                </div>
                {g && <Link to="/grup/$id" params={{ id: g.id }}><StatusBadge status={g.status} /></Link>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {editable && <Button size="sm" variant="outline" onClick={() => setSofa(s)}>Ubah</Button>}
                {editable && !g && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`Hapus sofa ${s.name}?`) && run("event.manage", "Sofa dihapus", (d, u) => actions.deleteSofa(d, u, s.id))}>Hapus</Button>}
                {!g && canCreateGroup && <Button size="sm" onClick={() => run("group.manage", `Grup ${s.name} dibuat`, (d, u) => actions.hostCreateGroup(d, u, e.id, { sofaId: s.id }))}>Buat grup langsung</Button>}
                {g && <span className="text-xs text-muted-foreground">{filledSlots(g)}/{g.slots} terisi</span>}
              </div>
            </div>
          );
        })}
      </div>
      <TicketEditor e={e} editable={editable} canCreateGroup={canCreateGroup} />
      {sofa && <SofaForm eventId={e.id} sofa={sofa === "new" ? null : sofa} onClose={() => setSofa(null)} />}
      {state.now > eventEnd(e) && <p className="text-xs text-muted-foreground">Event sudah lewat.</p>}
    </div>
  );
}

function TicketEditor({ e, editable, canCreateGroup }: { e: EventItem; editable: boolean; canCreateGroup: boolean }) {
  const { state, run } = useApp();
  const init = ([1, 2, 5] as Pax[]).map((pax) => e.tickets.find((t) => t.pax === pax) ?? { pax, price: 0, quota: 0 });
  const [rows, setRows] = useState<TicketType[]>(init);
  const upd = (pax: Pax, k: "price" | "quota", v: string) => setRows((r) => r.map((t) => (t.pax === pax ? { ...t, [k]: Number(v) || 0 } : t)));
  return (
    <div className="space-y-2">
      <h3 className="text-sm">Tiket (EVT-03)</h3>
      {rows.map((t) => (
        <div key={t.pax} className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
          <span className="text-xs">{t.pax} orang</span>
          <Input type="number" min={0} step={1000} aria-label={`Harga tiket ${t.pax} orang`} value={t.price} disabled={!editable} onChange={(ev) => upd(t.pax, "price", ev.target.value)} />
          <Input type="number" min={0} aria-label={`Kuota tiket ${t.pax} orang`} value={t.quota} disabled={!editable} onChange={(ev) => upd(t.pax, "quota", ev.target.value)} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Kolom: harga paket · kuota. Terjual: {([1, 2, 5] as Pax[]).map((p) => `${p} org ${ticketUsed(state, e, p)}`).join(" · ")}</p>
      <div className="flex flex-wrap gap-2">
        {editable && <Button size="sm" variant="outline" onClick={() => run("event.manage", "Tiket disimpan", (d, u) => actions.saveTickets(d, u, e.id, rows))}>Simpan tiket</Button>}
        {canCreateGroup && ([2, 5] as Pax[]).filter((p) => e.tickets.some((t) => t.pax === p)).map((p) => (
          <Button key={p} size="sm" variant="secondary" onClick={() => run("group.manage", `Grup tiket ${p} orang dibuat`, (d, u) => actions.hostCreateGroup(d, u, e.id, { pax: p }))}>Buat grup tiket {p} orang</Button>
        ))}
      </div>
    </div>
  );
}

function SofaForm({ eventId, sofa, onClose }: { eventId: string; sofa: Sofa | null; onClose: () => void }) {
  const { run } = useApp();
  const [f, setF] = useState({
    name: sofa?.name ?? "", capacity: String(sofa?.capacity ?? 4), price: String(sofa?.price ?? ""), dp: String(sofa?.dp ?? MIN_DP),
    drinkPackage: sofa?.drinkPackage ?? "", drinks: sofa?.drinks.join(", ") ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const input: SofaInput = { name: f.name, capacity: Number(f.capacity), price: Number(f.price), dp: Number(f.dp), drinkPackage: f.drinkPackage, drinks: f.drinks.split(",") };
  const preview = input.capacity > 0 && input.price > 0 ? sofaPrices({ ...input, id: "", eventId }) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{sofa ? `Ubah sofa ${sofa.name}` : "Sofa baru"}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kode sofa"><Input maxLength={20} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Kapasitas (orang)"><Input type="number" min={1} max={20} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Harga sofa (termasuk paket)"><Input type="number" min={0} step={50000} value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
            <Field label="DP sofa (min Rp500.000)"><Input type="number" min={MIN_DP} step={50000} value={f.dp} onChange={(e) => set("dp", e.target.value)} /></Field>
          </div>
          {preview && <p className="rounded-lg bg-muted p-2 text-xs">Per slot: DP {rupiah(preview.dpPerSlot)} + pelunasan {rupiah(preview.lunasPerSlot)} (dibulatkan ke atas ke Rp1.000, U1).</p>}
          <Field label="Paket minuman"><Textarea rows={2} maxLength={300} value={f.drinkPackage} onChange={(e) => set("drinkPackage", e.target.value)} /></Field>
          <Field label="Opsi vote minuman (pisahkan dengan koma, VOT-01)"><Input value={f.drinks} onChange={(e) => set("drinks", e.target.value)} /></Field>
          {sofa && <p className="text-xs text-muted-foreground">Mengubah harga tidak mengubah bagian bayar grup yang sudah dibuat (U1).</p>}
          <Button className="w-full" onClick={() => run("event.manage", sofa ? "Sofa disimpan" : "Sofa ditambahkan", (d, u) => actions.saveSofa(d, u, eventId, sofa?.id ?? null, input)) && onClose()}>Simpan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><span className="mb-1 block text-xs text-muted-foreground">{label}</span>{children}</div>;
}
