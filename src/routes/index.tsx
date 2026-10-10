import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, MapPin, Sofa as SofaIcon, Ticket } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/lib/store";
import { actions } from "@/lib/store";
import { countdown, eventEnd, fmtEventDate, getCollective, getVenue, groupName, nextDeadline, rupiah } from "@/lib/rules";
import { filledSlots } from "@/lib/sofa-selection";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sofamates — Patungan Sofa Club di Jogja" },
      { name: "description", content: "Cari event collective di club DIY, patungan sofa bareng teman, atau beli tiket 1, 2, dan 5 orang." },
      { property: "og:title", content: "Sofamates — Patungan Sofa Club di Jogja" },
      { property: "og:description", content: "Patungan sofa dan tiket event collective di club wilayah DIY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { state } = useApp();
  const [collective, setCollective] = useState("semua");
  const [date, setDate] = useState("");
  const match = (e: { collectiveId: string; date: string }) => (collective === "semua" || e.collectiveId === collective) && (!date || e.date === date);
  const events = state.events
    .filter((e) => e.status !== "draft" && match(e))
    .sort((a, b) => a.date.localeCompare(b.date));
  const openGroups = state.groups
    .map((g) => ({ g, e: state.events.find((e) => e.id === g.eventId)! }))
    .filter(({ g, e }) => e && match(e) && actions.joinState(state, g).open)
    .sort((a, b) => a.e.date.localeCompare(b.e.date));

  return (
    <div className="space-y-6">
      {/* Panel kaca mengambang di atas foto: foto terlihat buram di balik teks. */}
      <section className="relative overflow-hidden rounded-[1.75rem] shadow-[0_12px_40px_rgb(31_38_135/0.18)]">
        <img src={hero} alt="Sofa club dengan lampu neon" width={1280} height={720} className="h-64 w-full object-cover sm:h-80" />
        <div className="glass absolute inset-x-3 bottom-3 rounded-[1.4rem] p-4 sm:inset-x-4 sm:bottom-4 sm:p-5">
          <span className="tag bg-primary text-primary-foreground">DIY · Jogja</span>
          <h1 className="mt-2 text-2xl leading-tight sm:text-3xl">Patungan sofa, pesta tetap <span className="text-primary">mewah</span>.</h1>
          <p className="mt-1 max-w-md text-sm text-foreground/70">Grup dibuka H-14, DP sampai H-7, pelunasan sampai H-3.</p>
        </div>
      </section>

      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {[{ id: "semua", name: "Semua collective" }, ...state.collectives].map((c) => (
            <button key={c.id} onClick={() => setCollective(c.id)}
              className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", collective === c.id ? "border-primary bg-primary text-primary-foreground" : "glass border-transparent text-foreground")}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="tgl" className="shrink-0 text-xs text-muted-foreground">Tanggal</label>
          <Input id="tgl" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          {date && <button className="shrink-0 text-xs text-primary" onClick={() => setDate("")}>Semua tanggal</button>}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm">Grup yang masih butuh orang</h2>
        {openGroups.length === 0 && <p className="text-sm text-muted-foreground">Belum ada grup terbuka untuk filter ini.</p>}
        {openGroups.map(({ g, e }) => {
          const v = getVenue(state, e.venueId);
          const nd = nextDeadline(e, g);
          const perPerson = g.dpPerSlot + g.lunasPerSlot;
          return (
            <Link key={g.id} to="/grup/$id" params={{ id: g.id }} className="block rounded-2xl border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-accent">{e.title}</p>
                  <h3 className="mt-0.5 flex items-center gap-1.5 text-base">
                    {g.kind === "sofa" ? <SofaIcon className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}{groupName(state, g)}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{v?.name} · {fmtEventDate(e.date)}</p>
                </div>
                <StatusBadge status={g.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted p-2">Sisa slot<br /><b className="text-sm">{g.slots - filledSlots(g)}/{g.slots}</b></div>
                <div className="rounded-lg bg-muted p-2">Per orang<br /><b className="text-sm">{rupiah(perPerson)}</b></div>
                <div className="rounded-lg bg-muted p-2">{g.leaderPaidAllDp ? "Tanpa DP" : g.kind === "tiket" ? "Bayar penuh" : `DP ${rupiah(g.dpPerSlot)}`}<br /><b className="text-sm">{g.kind === "tiket" ? "saat gabung" : "lalu lunas"}</b></div>
              </div>
              {nd && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{nd.label}: {countdown(state.now, nd.at)} lagi</p>}
            </Link>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm">Event</h2>
        {events.length === 0 && <p className="text-sm text-muted-foreground">Belum ada event untuk filter ini.</p>}
        {events.map((e) => {
          const v = getVenue(state, e.venueId);
          const sofas = state.sofas.filter((s) => s.eventId === e.id);
          const taken = state.groups.filter((g) => g.eventId === e.id && g.kind === "sofa" && g.status !== "BATAL").length;
          const past = state.now > eventEnd(e);
          const minTicket = Math.min(...e.tickets.map((t) => t.price / t.pax));
          return (
            <Link key={e.id} to="/event/$id" params={{ id: e.id }}
              className="block rounded-2xl border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-accent">{getCollective(state, e.collectiveId)?.name}</p>
                  <h3 className="mt-0.5 text-base">{e.title}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{v?.name} · {v?.area}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="font-semibold">{fmtEventDate(e.date)}</p>
                  <p className="text-muted-foreground">{e.time} WIB</p>
                  {e.status === "batal" ? <span className="tag mt-1 bg-destructive/15 text-destructive">Batal</span>
                    : past ? <span className="tag mt-1 bg-muted text-muted-foreground">Selesai</span> : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><SofaIcon className="h-3.5 w-3.5" />{sofas.length - taken} dari {sofas.length} sofa belum punya grup</span>
                {Number.isFinite(minTicket) && <span>Tiket mulai <b className="text-foreground">{rupiah(Math.ceil(minTicket / 1000) * 1000)}</b>/org</span>}
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
