import { filledSlots } from "@/lib/sofa-selection";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatGrid } from "@/components/StatGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { actions, useApp } from "@/lib/store";
import { eventEnd, fmtEventDate, getEvent, getSofa, getVenue, lunasCount, rupiah } from "@/lib/rules";
import type { Group } from "@/lib/types";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Dasbor Host — Sofamates" },
      { name: "description", content: "Pantau penjualan, grup sofa, dan kelola event atau venue di Sofamates." },
      { property: "og:title", content: "Dasbor Host — Sofamates" },
      { property: "og:description", content: "Dasbor host collective dan host venue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostPage,
});

const ACTIVE: Group["status"][] = ["DP_BOOKING", "PELUNASAN", "LUNAS"];
/** Uang masuk (simulasi) dari sebuah grup: DP terbayar + pelunasan terbayar */
const groupPaid = (g: Group) =>
  g.status === "BATAL" ? 0
    : (g.leaderPaidAllDp ? g.slots : filledSlots(g)) * g.dpPerSlot + lunasCount(g) * g.lunasPerSlot;

function HostPage() {
  const { me } = useApp();
  if (me.role === "host_collective") return <CollectiveDash />;
  if (me.role === "host_venue") return <VenueDash />;
  return <p className="text-sm text-muted-foreground">Halaman ini khusus host. Ganti peran di pojok kanan atas.</p>;
}

function CollectiveDash() {
  const { state, me, run } = useApp();
  const events = state.events.filter((e) => e.hostId === me.id);
  const ids = new Set(events.map((e) => e.id));
  const tickets = state.tickets.filter((t) => ids.has(t.eventId));
  const groups = state.groups.filter((g) => ids.has(g.eventId));
  const upcoming = events.filter((e) => !e.cancelled && state.now <= eventEnd(e));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Dasbor Host Collective</p>
        <h1 className="text-2xl">{me.name}</h1>
      </div>
      <StatGrid items={[
        { label: "Event mendatang", value: upcoming.length, hint: `${events.length} total` },
        { label: "Tiket terjual", value: tickets.reduce((a, t) => a + t.pax, 0), hint: `${tickets.length} transaksi` },
        { label: "Pendapatan tiket", value: rupiah(tickets.reduce((a, t) => a + t.price, 0)) },
        { label: "Grup sofa aktif", value: groups.filter((g) => ACTIVE.includes(g.status)).length },
      ]} />
      <section className="space-y-3">
        <h2 className="text-sm">Event saya</h2>
        {events.map((e) => {
          const eg = groups.filter((g) => g.eventId === e.id);
          const et = tickets.filter((t) => t.eventId === e.id);
          return (
            <div key={e.id} className="rounded-2xl border bg-card p-4 text-sm">
              <Link to="/event/$id" params={{ id: e.id }} className="font-semibold">{e.title}</Link>
              <p className="text-xs text-muted-foreground">{fmtEventDate(e.date)} · {getVenue(state, e.venueId)?.name}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-muted p-2">Tiket<br /><b>{et.reduce((a, t) => a + t.pax, 0)} org</b></div>
                <div className="rounded-lg bg-muted p-2">Grup aktif<br /><b>{eg.filter((g) => ACTIVE.includes(g.status)).length}</b></div>
                <div className="rounded-lg bg-muted p-2">Lunas<br /><b>{eg.filter((g) => g.status === "LUNAS" || g.status === "SELESAI").length}</b></div>
              </div>
              {e.cancelled ? <p className="mt-2 text-destructive">Dibatalkan</p> : state.now <= eventEnd(e) && (
                <Button size="sm" variant="destructive" className="mt-3"
                  onClick={() => confirm(`Batalkan ${e.title}? Semua grup akan batal dan dana dikembalikan.`) &&
                    run("event.cancel", "Event dibatalkan", (d, u) => actions.cancelEvent(d, u, e.id))}>Batalkan event</Button>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function VenueDash() {
  const { state, me, run } = useApp();
  const venues = state.venues.filter((v) => v.hostId === me.id);
  const vids = new Set(venues.map((v) => v.id));
  const sofas = state.sofas.filter((s) => vids.has(s.venueId));
  const sids = new Set(sofas.map((s) => s.id));
  const groups = state.groups.filter((g) => sids.has(g.sofaId));
  const active = groups.filter((g) => ACTIVE.includes(g.status));
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Dasbor Host Venue</p>
        <h1 className="text-2xl">{me.name}</h1>
      </div>
      <StatGrid items={[
        { label: "Sofa aktif", value: `${sofas.filter((s) => s.active).length}/${sofas.length}` },
        { label: "Booking aktif", value: active.length },
        { label: "Siap datang (lunas)", value: groups.filter((g) => g.status === "LUNAS").length },
        { label: "Dana masuk", value: rupiah(groups.reduce((a, g) => a + groupPaid(g), 0)), hint: "simulasi" },
      ]} />
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm">Booking sofa</h2>
        {active.length === 0 && <p className="text-sm text-muted-foreground">Belum ada booking aktif.</p>}
        {active.map((g) => (
          <Link key={g.id} to="/grup/$id" params={{ id: g.id }} className="flex items-center justify-between py-2 text-sm">
            <span>{getSofa(state, g.sofaId)?.name}
              <span className="block text-xs text-muted-foreground">{getEvent(state, g.eventId)?.title} · {filledSlots(g)}/{g.slots} anggota</span></span>
            <StatusBadge status={g.status} />
          </Link>
        ))}
      </section>
      {venues.map((v) => (
        <section key={v.id} className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 text-sm">Sofa di {v.name}</h2>
          <ul className="divide-y text-sm">
            {sofas.filter((s) => s.venueId === v.id).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>{s.name}<span className="block text-xs text-muted-foreground">{s.capacity} slot · {rupiah(s.price)}</span></span>
                <Switch checked={s.active} onCheckedChange={() => run("sofa.manage", s.active ? "Sofa dinonaktifkan" : "Sofa diaktifkan", (d, u) => actions.toggleSofa(d, u, s.id))} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
