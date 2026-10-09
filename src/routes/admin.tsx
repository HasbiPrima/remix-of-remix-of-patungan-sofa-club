import { filledSlots } from "@/lib/sofa-selection";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { StatGrid } from "@/components/StatGrid";
import { actions, useApp } from "@/lib/store";
import { fmtDate, getEvent, getSofa, getUser, roleLabel, rupiah } from "@/lib/rules";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Sofamates" },
      { name: "description", content: "Verifikasi akun, pantau grup, dan lihat log aktivitas Sofamates." },
      { property: "og:title", content: "Admin — Sofamates" },
      { property: "og:description", content: "Panel admin Sofamates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { state, me, run } = useApp();
  if (me.role !== "admin") return <p className="text-sm text-muted-foreground">Halaman ini khusus admin.</p>;
  const pending = state.users.filter((u) => u.verify === "menunggu");
  const activeGroups = state.groups.filter((g) => ["DP_BOOKING", "PELUNASAN", "LUNAS"].includes(g.status));
  const ticketRevenue = state.tickets.reduce((a, t) => a + t.price, 0);
  const byStatus = (s: string) => state.groups.filter((g) => g.status === s).length;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Dasbor Admin</p>
        <h1 className="text-2xl">Ringkasan Sofamates</h1>
      </div>
      <StatGrid items={[
        { label: "Pengguna", value: state.users.length, hint: `${state.users.filter((u) => u.verify === "terverifikasi").length} terverifikasi` },
        { label: "Event aktif", value: state.events.filter((e) => !e.cancelled).length, hint: `${state.events.length} total` },
        { label: "Grup aktif", value: activeGroups.length, hint: `${byStatus("SELESAI")} selesai · ${byStatus("BATAL")} batal` },
        { label: "Penjualan tiket", value: rupiah(ticketRevenue), hint: `${state.tickets.length} transaksi` },
      ]} />
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm">Pengajuan verifikasi ({pending.length})</h2>
        {pending.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada pengajuan.</p>}
        {pending.map((u) => (
          <div key={u.id} className="flex items-center justify-between py-2 text-sm">
            <span>{u.name}<span className="block text-xs text-muted-foreground">{roleLabel[u.role]} · {u.phone}</span></span>
            <span className="flex gap-2">
              <Button size="sm" onClick={() => run("admin.verify", `${u.name} diverifikasi`, (d, a) => actions.adminVerify(d, a, u.id, true))}>Setujui</Button>
              <Button size="sm" variant="outline" onClick={() => run("admin.verify", `${u.name} ditolak`, (d, a) => actions.adminVerify(d, a, u.id, false))}>Tolak</Button>
            </span>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm">Grup aktif ({activeGroups.length})</h2>
        {activeGroups.map((g) => (
          <div key={g.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <Link to="/grup/$id" params={{ id: g.id }} className="flex-1">{getSofa(state, g.sofaId)?.name}
              <span className="block text-xs text-muted-foreground">{getEvent(state, g.eventId)?.title} · {filledSlots(g)}/{g.slots}</span></Link>
            <StatusBadge status={g.status} />
            <Button size="sm" variant="destructive" onClick={() => {
              const reason = prompt("Alasan pembatalan?");
              if (reason !== null) run("admin.cancelGroup", "Grup dibatalkan", (d, a) => actions.adminCancelGroup(d, a, g.id, reason.slice(0, 200)));
            }}>Batalkan</Button>
          </div>
        ))}
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm">Log aktivitas</h2>
        <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
          {state.logs.slice(0, 50).map((l) => (
            <li key={l.id}><span className="text-muted-foreground">{fmtDate(l.at)}</span> · {getUser(state, l.actorId)?.name ?? "Sistem"} · {l.detail}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
