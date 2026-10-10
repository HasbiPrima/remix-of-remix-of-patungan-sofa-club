import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePayment } from "@/components/PaymentDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { SofaMap } from "@/components/SofaMap";
import { actions, useApp } from "@/lib/store";
import {
  createDeadline, dayStart, dpDeadline, eventEnd, fmtDate, fmtEventDate, getCollective, getVenue, lunasDeadline, ownsEvent,
  payoutEnd, payoutStart, ratingEnd, ratingStart, rupiah, sofaPrices, ticketShare, ticketUsed,
} from "@/lib/rules";
import { filledSlots } from "@/lib/sofa-selection";
import type { Sofa } from "@/lib/types";
import { scrollToId } from "@/lib/utils";

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
  const { state, me, check } = useApp();
  const navigate = useNavigate();
  const payment = usePayment();
  const [selectedSofa, setSelectedSofa] = useState<Sofa | null>(null);
  const e = state.events.find((x) => x.id === id);

  if (!e || (e.status === "draft" && !ownsEvent(me, e)))
    return <p>Event tidak ditemukan. <Link to="/" className="text-primary">Kembali</Link></p>;
  const v = getVenue(state, e.venueId);
  const sofas = state.sofas.filter((s) => s.eventId === e.id);
  const eventGroups = state.groups.filter((g) => g.eventId === e.id);
  const canPropose = e.status === "terbit" && state.now <= createDeadline(e);
  const groupOf = (s: Sofa) => eventGroups.find((g) => g.sofaId === s.id && g.status !== "BATAL");

  const selectSofa = (s: Sofa) => {
    const g = groupOf(s);
    if (g) { navigate({ to: "/grup/$id", params: { id: g.id } }); return; }
    setSelectedSofa(s);
  };

  const timeline = [
    { label: "Batas membuat/mengajukan grup (H-14)", at: createDeadline(e) },
    { label: "Batas DP (H-7)", at: dpDeadline(e) },
    { label: "Batas pelunasan & vote minuman (H-3)", at: lunasDeadline(e) },
    { label: "Dana dikirim ke collective (H-2 s/d H-1)", at: payoutEnd(e), from: payoutStart(e) },
    { label: "Hari event", at: dayStart(e.date, 0) },
    { label: "Rating dibuka (H+1 s/d H+3)", at: ratingEnd(e), from: ratingStart(e) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-3xl border bg-card">
        {e.poster && <img src={e.poster} alt={`Poster ${e.title}`} className="h-48 w-full object-cover" />}
        <div className="p-5">
          <p className="text-xs font-semibold text-accent">{getCollective(state, e.collectiveId)?.name}</p>
          <h1 className="mt-1 text-2xl">{e.title}</h1>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0" />{v?.name} · {v?.address}</p>
            <p className="font-semibold text-foreground">{fmtEventDate(e.date)} · {e.time} WIB</p>
            {e.description && <p>{e.description}</p>}
          </div>
          {e.status === "batal" && <p className="mt-3 rounded-lg bg-destructive/15 p-2 text-sm text-destructive">Event ini dibatalkan. Semua pembayaran dikembalikan penuh (U10).</p>}
          {e.status === "draft" && <p className="mt-3 rounded-lg bg-warning/15 p-2 text-sm text-warning">Draft — belum terlihat oleh user.</p>}
        </div>
      </section>

      <nav aria-label="Bagian halaman" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 flex gap-2 border-b border-white/60 bg-white/45 px-4 py-2 backdrop-blur-2xl backdrop-saturate-[1.8] md:hidden">
        {[["sofa", "Sofa & grup"], ["tiket", "Tiket"], ["jadwal", "Jadwal"]].map(([id, label]) => (
          <button key={id} onClick={() => scrollToId(id!)} className="glass h-9 rounded-full px-4 text-xs font-semibold text-foreground active:scale-95">{label}</button>
        ))}
      </nav>

      <section id="jadwal" className="scroll-mt-32 max-md:order-last">
        <h2 className="mb-2 text-sm">Jadwal otomatis (23.59 WIB)</h2>
        <ol className="space-y-2 border-l pl-4">
          {timeline.map((t) => (
            <li key={t.label} className="relative text-sm">
              <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${state.now > t.at ? "bg-muted-foreground" : "bg-primary"}`} />
              <span className={state.now > t.at ? "text-muted-foreground line-through" : ""}>{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.from ? `${fmtDate(t.from, false)} – ` : ""}{fmtDate(t.at, !t.from)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section id="tiket" className="scroll-mt-32 space-y-3">
        <h2 className="text-sm">Tiket masuk</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {e.tickets.map((t) => {
            const left = t.quota - ticketUsed(state, e, t.pax);
            const groups = eventGroups.filter((g) => g.kind === "tiket" && g.ticketPax === t.pax && actions.joinState(state, g).open);
            return (
              <div key={t.pax} className="rounded-2xl border bg-card p-3 text-sm">
                <p className="text-xs text-muted-foreground">{t.pax} orang · sisa {Math.max(0, left)} paket</p>
                <p className="font-display">{rupiah(t.price)}</p>
                {t.pax > 1 && <p className="text-xs text-muted-foreground">{rupiah(ticketShare(t.price, t.pax))}/orang, grup harus penuh sebelum H-3</p>}
                {t.pax === 1 ? (
                  <Button size="sm" className="mt-2 w-full" disabled={left <= 0 || e.status !== "terbit" || state.now > eventEnd(e)}
                    onClick={() => check("ticket.buy") && payment.start("ticket.buy", "Menunggu pembayaran tiket", (d, u) => actions.buyTicket(d, u, e.id), { title: `Tiket 1 orang · ${e.title}` })}>
                    {left <= 0 ? "Kuota habis" : "Beli tiket"}
                  </Button>
                ) : (
                  <div className="mt-2 space-y-1">
                    {groups.map((g) => (
                      <Button key={g.id} asChild size="sm" variant="secondary" className="w-full">
                        <Link to="/grup/$id" params={{ id: g.id }}>Gabung grup ({filledSlots(g)}/{g.slots})</Link>
                      </Button>
                    ))}
                    {canPropose && left > 0 && me.role === "user" && (
                      <Button asChild size="sm" variant="outline" className="w-full">
                        <Link to="/pengajuan" search={{ event: e.id, pax: t.pax }}>Ajukan grup tiket</Link>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section id="sofa" className="scroll-mt-32">
        <h2 className="mb-2 text-sm">Sofa & grup patungan</h2>
        <SofaMap sofas={sofas} groups={eventGroups} selectedId={selectedSofa?.id} closed={!canPropose} onSelect={selectSofa} />
        {selectedSofa && !groupOf(selectedSofa) && (
          <SofaDetail sofa={selectedSofa} canPropose={canPropose} isUser={me.role === "user"} eventId={e.id} />
        )}
        <h3 className="mb-2 mt-5 text-xs text-muted-foreground">Rincian sofa</h3>
        <div className="space-y-3">
          {sofas.map((s) => {
            const g = groupOf(s);
            const p = g ?? sofaPrices(s);
            return (
              <div key={s.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.capacity} slot · total {rupiah(s.price)} · DP sofa {rupiah(s.dp)}</p>
                  </div>
                  {g && <StatusBadge status={g.status} />}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted p-2">DP/slot<br /><b className="text-sm">{rupiah(p.dpPerSlot)}</b></div>
                  <div className="rounded-lg bg-muted p-2">Pelunasan/slot<br /><b className="text-sm">{rupiah(p.lunasPerSlot)}</b></div>
                </div>
                {s.drinks.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Opsi minuman: {s.drinks.join(", ")}</p>}
                <div className="mt-3">
                  {g ? (
                    <Button asChild variant="secondary" className="w-full">
                      <Link to="/grup/$id" params={{ id: g.id }}><Users />Lihat grup ({filledSlots(g)}/{g.slots})</Link>
                    </Button>
                  ) : me.role === "user" ? (
                    canPropose
                      ? <Button asChild className="w-full"><Link to="/pengajuan" search={{ event: e.id, sofa: s.id }}>Ajukan grup & jadi ketua</Link></Button>
                      : <Button className="w-full" disabled>Lewat batas H-14</Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      {payment.dialog}
    </div>
  );
}

function SofaDetail({ sofa, canPropose, isUser, eventId }: { sofa: Sofa; canPropose: boolean; isUser: boolean; eventId: string }) {
  const p = sofaPrices(sofa);
  return (
    <div className="my-4 space-y-2 border-y py-4 text-sm">
      <h3 className="text-sm">{sofa.name} · belum ada grup</h3>
      <p className="text-xs text-muted-foreground">{sofa.capacity} slot · DP/slot {rupiah(p.dpPerSlot)} · pelunasan/slot {rupiah(p.lunasPerSlot)}. {sofa.drinkPackage}</p>
      {isUser && (
        canPropose
          ? <Button asChild className="w-full"><Link to="/pengajuan" search={{ event: eventId, sofa: sofa.id }}>Ajukan grup untuk sofa ini</Link></Button>
          : <p className="text-xs text-muted-foreground">Grup baru hanya bisa diajukan paling lambat H-14 (U13).</p>
      )}
    </div>
  );
}
