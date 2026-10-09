import { filledSlots } from "@/lib/sofa-selection";
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Music, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaymentDialog } from "@/components/PaymentDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { TermsCheck } from "@/components/TermsCheck";
import { SofaMap, SofaSlots } from "@/components/SofaMap";
import { actions, useApp } from "@/lib/store";
import {
  calcSlotPrices, dpDeadline, eventEnd, fmtDate, fmtEventDate, getEvent, getVenue, lunasDeadline, ratingEnd, rupiah, voteDeadline,
} from "@/lib/rules";
import type { Sofa } from "@/lib/types";

export const Route = createFileRoute("/event/$id")({
  head: () => ({
    meta: [
      { title: "Detail Event — Sofamates" },
      { name: "description", content: "Lihat sofa, harga per slot, jadwal DP dan pelunasan, serta paket tiket event." },
      { property: "og:title", content: "Detail Event — Sofamates" },
      { property: "og:description", content: "Patungan sofa dan beli tiket event collective di club DIY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const { state, me, run, check } = useApp();
  const navigate = useNavigate();
  const e = getEvent(state, id);
  const [ticket, setTicket] = useState<1 | 2 | 5 | null>(null);
  const [sofa, setSofa] = useState<Sofa | null>(null);
  const [selectedSofa, setSelectedSofa] = useState<Sofa | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number[]>([]);
  const [payAll, setPayAll] = useState(false);
  const [terms, setTerms] = useState(false);
  const [paying, setPaying] = useState(false);

  if (!e) return <p>Event tidak ditemukan. <Link to="/" className="text-primary">Kembali</Link></p>;
  const v = getVenue(state, e.venueId);
  const sofas = state.sofas.filter((s) => s.venueId === e.venueId);
  const eventGroups = state.groups.filter((g) => g.eventId === e.id);
  const selectedGroup = selectedSofa ? eventGroups.find((g) => g.sofaId === selectedSofa.id && g.status !== "BATAL") : undefined;
  const selectedPrices = selectedSofa ? calcSlotPrices(selectedSofa.price, selectedSofa.capacity, e.dpPercent) : null;
  const ticketPrice = ticket === 1 ? e.tickets.p1 : ticket === 2 ? e.tickets.p2 : e.tickets.p5;
  const prices = sofa ? calcSlotPrices(sofa.price, sofa.capacity, e.dpPercent) : null;
  const createAmount = prices && sofa ? (payAll ? prices.dpPerSlot * sofa.capacity : prices.dpPerSlot * Math.max(selectedSlot.length, 1)) : 0;

  const selectSofa = (selected: Sofa) => {
    setSelectedSofa(selected);
    setSelectedSlot([]);
    const group = eventGroups.find((g) => g.sofaId === selected.id && g.status !== "BATAL");
    if (group) {
      navigate({ to: "/grup/$id", params: { id: group.id } });
      return;
    }
    if (!selected.active || e.cancelled || state.now > dpDeadline(e)) return;
    if (check("group.create")) {
      setSofa(selected);
      setPayAll(false);
      setTerms(false);
    }
  };

  const timeline = [
    { label: "Batas DP penuh (H-14)", at: dpDeadline(e) },
    { label: "Batas pelunasan (H-7)", at: lunasDeadline(e) },
    { label: "Vote minuman ditutup (H-3)", at: voteDeadline(e) },
    { label: "Hari event", at: eventEnd(e) },
    { label: "Rating ditutup (H+3)", at: ratingEnd(e) },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-card p-5">
        <p className="text-xs font-semibold text-accent">{e.collective}</p>
        <h1 className="mt-1 text-2xl">{e.title}</h1>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2"><MapPin className="h-4 w-4" />{v?.name}, {v?.area}</p>
          <p className="flex items-center gap-2"><Music className="h-4 w-4" />{e.lineup}</p>
          <p className="font-semibold text-foreground">{fmtEventDate(e.date)}</p>
        </div>
        {e.cancelled && <p className="mt-3 rounded-lg bg-destructive/15 p-2 text-sm text-destructive">Event ini dibatalkan.</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm">Jadwal otomatis</h2>
        <ol className="space-y-2 border-l pl-4">
          {timeline.map((t) => (
            <li key={t.label} className="relative text-sm">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${state.now > t.at ? "bg-muted-foreground" : "bg-primary"}`} />
              <span className={state.now > t.at ? "text-muted-foreground line-through" : ""}>{t.label}</span>
              <span className="block text-xs text-muted-foreground">{fmtDate(t.at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-sm">Tiket masuk</h2>
        <div className="grid grid-cols-3 gap-2">
          {([1, 2, 5] as const).map((p) => (
            <button key={p} onClick={() => check("ticket.buy") && setTicket(p)}
              className="rounded-2xl border bg-card p-3 text-left transition hover:border-primary">
              <p className="text-xs text-muted-foreground">{p} orang</p>
              <p className="font-display text-sm">{rupiah(p === 1 ? e.tickets.p1 : p === 2 ? e.tickets.p2 : e.tickets.p5)}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm">Sofa & grup patungan</h2>
        <SofaMap sofas={sofas} groups={eventGroups} selectedId={selectedSofa?.id}
          closed={e.cancelled || state.now > lunasDeadline(e)} onSelect={selectSofa} />
        {selectedSofa && selectedPrices && (
          <div className="my-4 space-y-3 border-y py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-sm">{selectedSofa.name}</h3><p className="text-xs text-muted-foreground">{selectedSofa.capacity} slot · DP/slot {rupiah(selectedPrices.dpPerSlot)}</p></div>
              {selectedGroup && <StatusBadge status={selectedGroup.status} />}
            </div>
            {!selectedSofa.active && <p className="text-sm text-muted-foreground">Sofa ini sedang dinonaktifkan oleh venue.</p>}
            {e.cancelled && <p className="text-sm text-destructive">Pemesanan ditutup karena event dibatalkan.</p>}
            <Button className="w-full" disabled={!selectedGroup && (!selectedSofa.active || e.cancelled || state.now > dpDeadline(e))} onClick={() => {
              if (selectedGroup) { navigate({ to: "/grup/$id", params: { id: selectedGroup.id } }); return; }
              if (check("group.create")) { setSofa(selectedSofa); setPayAll(false); setTerms(false); setSelectedSlot([]); }
            }}>{selectedGroup ? "Lihat slot di grup ini" : !selectedSofa.active || e.cancelled ? "Pemesanan ditutup" : state.now > dpDeadline(e) ? "Batas DP lewat" : "Pilih slot & buat grup"}</Button>
          </div>
        )}
        <h3 className="mb-2 mt-5 text-xs text-muted-foreground">Rincian sofa</h3>
        <div className="space-y-3">
          {sofas.filter((s) => s.active).map((s) => {
            const g = state.groups.find((x) => x.eventId === e.id && x.sofaId === s.id && x.status !== "BATAL");
            const p = calcSlotPrices(s.price, s.capacity, e.dpPercent);
            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.capacity} slot · total {rupiah(s.price)}</p>
                  </div>
                  {g && <StatusBadge status={g.status} />}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted p-2">DP/slot<br /><b className="text-sm">{rupiah(p.dpPerSlot)}</b></div>
                  <div className="rounded-lg bg-muted p-2">Pelunasan/slot<br /><b className="text-sm">{rupiah(p.lunasPerSlot)}</b></div>
                </div>
                <div className="mt-3">
                  {g ? (
                    <Button asChild variant="secondary" className="w-full">
                      <Link to="/grup/$id" params={{ id: g.id }}><Users />Lihat grup ({filledSlots(g)}/{g.slots})</Link>
                    </Button>
                  ) : (
                    <Button className="w-full" disabled={e.cancelled || state.now > dpDeadline(e)}
                      onClick={() => { if (check("group.create")) { setSelectedSofa(s); setSofa(s); setPayAll(false); setTerms(false); setSelectedSlot([]); } }}>
                      {state.now > dpDeadline(e) ? "Batas DP lewat" : "Buat grup & jadi ketua"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={!!sofa && !paying} onOpenChange={(o) => !o && setSofa(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Buat grup {sofa?.name}</DialogTitle></DialogHeader>
          {prices && sofa && (
            <div className="space-y-3 text-sm">
              <SofaSlots capacity={sofa.capacity} selected={selectedSlot} onSelect={setSelectedSlot} />
              <p className="text-muted-foreground">DP {e.dpPercent}% dibagi {sofa.capacity} slot, dibulatkan ke atas ke Rp1.000.</p>
              <div className="flex gap-2">
                <Button variant={payAll ? "outline" : "default"} className="flex-1" onClick={() => setPayAll(false)}>DP {selectedSlot.length || 1} slot</Button>
                <Button variant={payAll ? "default" : "outline"} className="flex-1" onClick={() => setPayAll(true)}>Seluruh DP</Button>
              </div>
              {payAll && <TermsCheck checked={terms} onChange={setTerms} />}
              <p className="text-center font-display text-xl text-primary">{rupiah(createAmount)}</p>
              <Button className="w-full" disabled={selectedSlot.length === 0 || payAll && !terms} onClick={() => setPaying(true)}>Lanjut bayar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PaymentDialog open={paying} onOpenChange={(o) => { setPaying(o); if (!o) setSofa(null); }}
        title={`DP ${sofa?.name ?? ""} · slot ${selectedSlot.join(", ")}`} amount={createAmount}
        sofaSelection={sofa && selectedSlot.length ? { name: sofa.name, slots: selectedSlot } : undefined}
        onPaid={() => {
          if (!sofa) return;
          let gid = "";
          const ok = run("group.create", `Grup ${sofa.name} dibuat`, (d, u) => {
            const r = actions.createGroup(d, u, e.id, sofa.id, selectedSlot);
            if (!r || !r.startsWith("g")) return r ?? "Gagal";
            gid = r;
            if (payAll) return actions.payAllDp(d, u, gid);
          });
          if (ok && gid) navigate({ to: "/grup/$id", params: { id: gid } });
        }} />

      <PaymentDialog open={ticket !== null} onOpenChange={(o) => !o && setTicket(null)}
        title={`Tiket ${ticket} orang · ${e.title}`} amount={ticketPrice}
        onPaid={() => ticket && run("ticket.buy", `Tiket ${ticket} orang dibeli`, (d, u) => actions.buyTicket(d, u, e.id, ticket))} />
      <p className="text-center text-[11px] text-muted-foreground">Masuk sebagai {me.name}</p>
    </div>
  );
}
