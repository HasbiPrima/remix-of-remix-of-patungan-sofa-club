import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatGrid } from "@/components/StatGrid";
import { StatusBadge } from "@/components/StatusBadge";
import { EventManager } from "@/components/host/EventManager";
import { FundsPanel, GroupList, ProposalList, RatingReport, ReferralManager } from "@/components/host/Panels";
import { actions, useApp } from "@/lib/store";
import { eventEnd, fmtEventDate, getCollective, getVenue, rupiah } from "@/lib/rules";
import { filledSlots } from "@/lib/sofa-selection";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Dasbor Host — Sofamates" },
      { name: "description", content: "Kelola event, sofa, tiket, grup, pengajuan, referral, dan dana collective di Sofamates." },
      { property: "og:title", content: "Dasbor Host — Sofamates" },
      { property: "og:description", content: "Dasbor host collective dan host venue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  const { me } = useApp();
  if (me.role === "host_collective") return <CollectiveDash />;
  if (me.role === "host_venue") return <VenueDash />;
  return <p className="text-sm text-muted-foreground">Halaman ini khusus host. Ganti peran di pojok kanan atas.</p>;
}

function CollectiveDash() {
  const { state, me } = useApp();
  const events = state.events.filter((e) => e.collectiveId === me.collectiveId);
  const ids = new Set(events.map((e) => e.id));
  const groups = state.groups.filter((g) => ids.has(g.eventId));
  const pending = state.proposals.filter((p) => ids.has(p.eventId) && p.status === "menunggu").length;
  const funds = events.reduce((a, e) => a + actions.eventFunds(state, e.id).toSend, 0);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Dasbor Host Collective</p>
        <h1 className="text-2xl">{getCollective(state, me.collectiveId ?? "")?.name ?? me.name}</h1>
      </div>
      <StatGrid items={[
        { label: "Event mendatang", value: events.filter((e) => e.status === "terbit" && state.now <= eventEnd(e)).length, hint: `${events.length} total` },
        { label: "Pengajuan menunggu", value: pending },
        { label: "Grup aktif", value: groups.filter((g) => ["DP_BOOKING", "PELUNASAN", "LUNAS"].includes(g.status)).length },
        { label: "Dana bersih", value: rupiah(funds), hint: "lunas + hangus − refund" },
      ]} />
      <Tabs defaultValue={pending ? "pengajuan" : "event"}>
        <TabsList className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 flex h-auto w-full justify-start gap-1 max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:overflow-x-auto max-md:rounded-none max-md:bg-[#e4e4e9]/90 max-md:px-4 max-md:py-2 max-md:backdrop-blur-xl md:static md:flex-wrap md:justify-center [&>button]:shrink-0 max-md:[&>button]:h-9">
          <TabsTrigger value="event">Event</TabsTrigger>
          <TabsTrigger value="pengajuan">Pengajuan{pending ? ` (${pending})` : ""}</TabsTrigger>
          <TabsTrigger value="grup">Grup</TabsTrigger>
          <TabsTrigger value="referral">Referral</TabsTrigger>
          <TabsTrigger value="rating">Rating</TabsTrigger>
          <TabsTrigger value="dana">Dana</TabsTrigger>
        </TabsList>
        <TabsContent value="event" className="mt-4"><EventManager events={events} /></TabsContent>
        <TabsContent value="pengajuan" className="mt-4"><ProposalList eventIds={ids} /></TabsContent>
        <TabsContent value="grup" className="mt-4"><GroupList eventIds={ids} /></TabsContent>
        <TabsContent value="referral" className="mt-4"><ReferralManager collectiveId={me.collectiveId} /></TabsContent>
        <TabsContent value="rating" className="mt-4"><RatingReport eventIds={ids} /></TabsContent>
        <TabsContent value="dana" className="mt-4"><FundsPanel events={events} /></TabsContent>
      </Tabs>
    </div>
  );
}

/** VEN-01, VEN-02: host venue hanya melihat status booking sofa di venue-nya. */
function VenueDash() {
  const { state, me } = useApp();
  const venue = getVenue(state, me.venueId ?? "");
  const events = state.events.filter((e) => e.venueId === me.venueId && e.status !== "draft").sort((a, b) => a.date.localeCompare(b.date));
  const groups = state.groups.filter((g) => events.some((e) => e.id === g.eventId) && g.kind === "sofa");
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Dasbor Host Venue · hanya lihat</p>
        <h1 className="text-2xl">{venue?.name ?? me.name}</h1>
      </div>
      <StatGrid items={[
        { label: "Event", value: events.length },
        { label: "Sofa dalam proses", value: groups.filter((g) => g.status === "DP_BOOKING" || g.status === "PELUNASAN").length },
        { label: "Sofa terbooking (lunas)", value: groups.filter((g) => g.status === "LUNAS" || g.status === "SELESAI").length },
        { label: "Grup batal", value: groups.filter((g) => g.status === "BATAL").length },
      ]} />
      {events.map((e) => (
        <section key={e.id} className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm">{e.title}</h2>
          <p className="mb-2 text-xs text-muted-foreground">{fmtEventDate(e.date)} {e.time} WIB · {getCollective(state, e.collectiveId)?.name}{e.status === "batal" && " · BATAL"}</p>
          <ul className="divide-y text-sm">
            {state.sofas.filter((s) => s.eventId === e.id).map((s) => {
              const g = state.groups.find((x) => x.sofaId === s.id && x.status !== "BATAL") ?? state.groups.find((x) => x.sofaId === s.id);
              return (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>{s.name}<span className="block text-xs text-muted-foreground">{s.capacity} slot{g ? ` · ${filledSlots(g)}/${g.slots} anggota` : ""}</span></span>
                  {g ? <StatusBadge status={g.status} /> : <span className="text-xs text-muted-foreground">Belum dijual lewat Sofamates</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {events.length === 0 && <p className="text-sm text-muted-foreground">Belum ada event di venue ini.</p>}
      <p className="text-xs text-muted-foreground">Sofa berstatus Lunas sudah pasti terjual lewat Sofamates — jangan dijual lagi di venue. <Link to="/" className="text-primary">Lihat Home</Link></p>
    </div>
  );
}
