import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Ticket } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useApp } from "@/lib/store";
import { countdown, eventEnd, fmtEventDate, getEvent, getVenue, groupName, nextDeadline, payLabel, ratingEnd, ratingStart } from "@/lib/rules";
import type { Group } from "@/lib/types";

export const Route = createFileRoute("/parties")({
  head: () => ({
    meta: [
      { title: "Parties — Sofamates" },
      { name: "description", content: "Grup dan tiket yang sedang kamu ikuti, plus party yang sudah selesai." },
      { property: "og:title", content: "Parties — Sofamates" },
      { property: "og:description", content: "Grup dan tiket Sofamates kamu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PartiesPage,
});

function PartiesPage() {
  const { state, me } = useApp();
  const mine = state.groups.filter((g) => g.members.some((m) => m.userId === me.id));
  const upcoming = mine.filter((g) => ["DP_BOOKING", "PELUNASAN", "LUNAS"].includes(g.status));
  const completed = mine.filter((g) => g.status === "SELESAI");
  const cancelled = mine.filter((g) => g.status === "BATAL");
  const tickets = state.etickets.filter((t) => t.userId === me.id);
  const activeTickets = tickets.filter((t) => { const e = getEvent(state, t.eventId); return t.status === "aktif" && e && state.now <= eventEnd(e); });

  const card = (g: Group) => {
    const e = getEvent(state, g.eventId)!;
    const nd = nextDeadline(e, g);
    const m = g.members.find((x) => x.userId === me.id)!;
    const rateOpen = g.status === "SELESAI" && g.kind === "sofa" && state.now >= ratingStart(e) && state.now <= ratingEnd(e);
    return (
      <Link key={g.id} to="/grup/$id" params={{ id: g.id }} className="block rounded-2xl border bg-card p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-accent">{e.title}</p>
            <p className="font-semibold">{groupName(state, g)}{g.leaderId === me.id && " · ketua"}</p>
            <p className="text-xs text-muted-foreground">{fmtEventDate(e.date)} · {getVenue(state, e.venueId)?.name} · {payLabel[m.pay]}</p>
          </div>
          <StatusBadge status={g.status} />
        </div>
        {nd && <p className="mt-2 text-xs text-muted-foreground">{nd.label}: {countdown(state.now, nd.at)} lagi</p>}
        {g.status === "BATAL" && <p className="mt-2 text-xs text-destructive">{g.cancelReason}</p>}
        {rateOpen && <span className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"><Star className="h-4 w-4" />Beri rating anggota</span>}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Parties</h1>
      <Tabs defaultValue="upcoming">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="flex-1">Upcoming ({upcoming.length + activeTickets.length})</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-4 space-y-3">
          {upcoming.length + activeTickets.length === 0 && <p className="text-sm text-muted-foreground">Belum ada party. <Link to="/" className="text-primary">Cari grup</Link></p>}
          {activeTickets.length > 0 && <h2 className="text-sm">Tiket</h2>}
          {activeTickets.map((t) => {
            const e = getEvent(state, t.eventId)!;
            return (
              <div key={t.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-sm">
                <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary text-primary">
                  <Ticket className="h-6 w-6" /><span className="text-[10px]">QR</span>
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-muted-foreground">Tiket {t.pax} orang · {fmtEventDate(e.date)} {e.time} WIB</p>
                  <p className="mt-1 break-all font-mono text-sm">{t.code}</p>
                  <p className="text-[11px] text-muted-foreground">Tunjukkan kode ini di pintu masuk (TKT-03).</p>
                </div>
              </div>
            );
          })}
          {upcoming.length > 0 && <h2 className="text-sm">Grup</h2>}
          {upcoming.map(card)}
          {cancelled.length > 0 && <h2 className="pt-2 text-sm text-muted-foreground">Batal</h2>}
          {cancelled.map(card)}
        </TabsContent>
        <TabsContent value="completed" className="mt-4 space-y-3">
          {completed.length === 0 && <p className="text-sm text-muted-foreground">Belum ada party yang selesai.</p>}
          {completed.map(card)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
