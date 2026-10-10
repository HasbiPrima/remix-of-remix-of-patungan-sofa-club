import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatGrid } from "@/components/StatGrid";
import { EventManager } from "@/components/host/EventManager";
import { FundsPanel, GroupList, ProposalList, RatingReport, ReferralManager } from "@/components/host/Panels";
import { actions, useApp } from "@/lib/store";
import {
  ageAt, fmtDate, getCollective, getEvent, getUser, getVenue, roleLabel, rupiah, txKindLabel, txStatusLabel,
} from "@/lib/rules";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Sofamates" },
      { name: "description", content: "Verifikasi akun, kelola pengguna, transaksi, refund, pengiriman dana, dan log aktivitas Sofamates." },
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
  const [reason, setReason] = useState<Record<string, string>>({});
  const [txFilter, setTxFilter] = useState("");
  if (me.role !== "admin") return <p className="text-sm text-muted-foreground">Halaman ini khusus admin.</p>;
  const pending = state.users.filter((u) => u.verify === "menunggu");
  const refunds = state.txs.filter((t) => t.kind === "refund" && t.status === "pending");
  const allEvents = new Set(state.events.map((e) => e.id));
  const proposalsWaiting = state.proposals.filter((p) => p.status === "menunggu").length;
  const masuk = state.txs.filter((t) => t.kind !== "refund" && t.status === "berhasil").reduce((a, t) => a + t.amount, 0);
  const txs = state.txs.filter((t) => {
    const q = txFilter.trim().toLowerCase();
    return !q || [t.gatewayRef, txKindLabel[t.kind], getUser(state, t.userId)?.name, getEvent(state, t.eventId)?.title].some((x) => x?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Dasbor Admin</p>
        <h1 className="text-2xl">Ringkasan Sofamates</h1>
      </div>
      <StatGrid items={[
        { label: "Verifikasi menunggu", value: pending.length, hint: `${state.users.filter((u) => u.verify === "terverifikasi" && u.role === "user").length} user terverifikasi` },
        { label: "Refund menunggu", value: refunds.length, hint: rupiah(refunds.reduce((a, t) => a + t.amount, 0)) },
        { label: "Pengajuan menunggu", value: proposalsWaiting },
        { label: "Dana masuk", value: rupiah(masuk), hint: `${state.txs.length} transaksi` },
      ]} />

      <Tabs defaultValue="verifikasi">
        <TabsList className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 flex h-auto w-full justify-start gap-1 max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:overflow-x-auto max-md:rounded-none max-md:bg-[#e4e4e9]/90 max-md:px-4 max-md:py-2 max-md:backdrop-blur-xl md:static md:flex-wrap md:justify-center [&>button]:shrink-0 max-md:[&>button]:h-9">
          <TabsTrigger value="verifikasi">Verifikasi{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
          <TabsTrigger value="akun">Akun</TabsTrigger>
          <TabsTrigger value="event">Event</TabsTrigger>
          <TabsTrigger value="pengajuan">Pengajuan</TabsTrigger>
          <TabsTrigger value="grup">Grup</TabsTrigger>
          <TabsTrigger value="transaksi">Transaksi</TabsTrigger>
          <TabsTrigger value="refund">Refund{refunds.length ? ` (${refunds.length})` : ""}</TabsTrigger>
          <TabsTrigger value="dana">Dana</TabsTrigger>
          <TabsTrigger value="lainnya">Referral & rating</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>

        <TabsContent value="verifikasi" className="mt-4 space-y-3">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada verifikasi yang menunggu.</p>}
          {pending.map((u) => (
            <div key={u.id} className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
              <div>
                <p className="font-semibold">{u.name}</p>
                <p className="text-xs text-muted-foreground">KTP: {u.ktpName} · {u.birthPlace}, {u.birthDate} ({ageAt(u.birthDate, state.now)} th) · NIK ••••{u.nikLast4}</p>
                <p className="text-xs text-muted-foreground">Cek wajah otomatis: belum tersedia (layanan belum diputuskan, PRD bagian 11) → tinjau manual (ADM-02).</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[["Foto KTP", u.ktpImage], ["Foto wajah", u.selfieImage]].map(([label, src]) => (
                  src ? <img key={label} src={src} alt={`${label} ${u.name}`} className="h-32 w-full rounded-xl border object-cover" />
                    : <div key={label} className="flex h-32 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground">{label} (data demo)</div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Input className="h-9 flex-1" placeholder="Alasan kalau ditolak" value={reason[u.id] ?? ""} onChange={(e) => setReason({ ...reason, [u.id]: e.target.value })} />
                <Button size="sm" onClick={() => run("admin.verify", `${u.name} diverifikasi`, (d, a) => actions.adminVerify(d, a, u.id, true))}>Setujui</Button>
                <Button size="sm" variant="outline" onClick={() => run("admin.verify", `${u.name} ditolak`, (d, a) => actions.adminVerify(d, a, u.id, false, reason[u.id] ?? ""))}>Tolak</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="akun" className="mt-4">
          <ul className="divide-y rounded-2xl border bg-card px-4 text-sm">
            {state.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 py-3">
                <span className="min-w-0">{u.name}
                  <span className="block text-xs text-muted-foreground">
                    {roleLabel[u.role]} · {u.email}
                    {u.collectiveId && ` · ${getCollective(state, u.collectiveId)?.name}`}{u.venueId && ` · ${getVenue(state, u.venueId)?.name}`}
                    {u.role === "user" && ` · ${u.verify}`}
                  </span>
                </span>
                <Button size="sm" variant={u.active ? "ghost" : "secondary"} disabled={u.id === me.id}
                  onClick={() => run("admin.users", u.active ? `${u.name} dinonaktifkan` : `${u.name} diaktifkan`, (d, a) => actions.toggleUserActive(d, a, u.id))}>
                  {u.active ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="event" className="mt-4"><EventManager events={state.events} /></TabsContent>
        <TabsContent value="pengajuan" className="mt-4"><ProposalList eventIds={allEvents} /></TabsContent>
        <TabsContent value="grup" className="mt-4"><GroupList eventIds={allEvents} /></TabsContent>

        <TabsContent value="transaksi" className="mt-4 space-y-2">
          <Input placeholder="Cari ref, jenis, nama, event…" value={txFilter} onChange={(e) => setTxFilter(e.target.value)} />
          <ul className="divide-y rounded-2xl border bg-card px-4 text-sm">
            {txs.slice(0, 100).map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2 py-2">
                <span className="min-w-0">
                  {txKindLabel[t.kind]} · {getUser(state, t.userId)?.name}
                  {t.memberUserId && t.memberUserId !== t.userId && <span className="text-muted-foreground"> untuk {getUser(state, t.memberUserId)?.name}</span>}
                  <span className="block text-xs text-muted-foreground">{getEvent(state, t.eventId)?.title} · {t.gatewayRef} · {fmtDate(t.paidAt ?? t.createdAt)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <b>{rupiah(t.amount)}</b>
                  <span className="block text-xs text-muted-foreground">{txStatusLabel[t.status]}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Transaksi tidak pernah dihapus atau diubah jumlahnya; koreksi dicatat sebagai baris baru.</p>
        </TabsContent>

        <TabsContent value="refund" className="mt-4 space-y-2">
          {refunds.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada refund yang menunggu.</p>}
          {refunds.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-3 text-sm">
              <span>{getUser(state, t.userId)?.name} · {rupiah(t.amount)}
                <span className="block text-xs text-muted-foreground">{getEvent(state, t.eventId)?.title} · asal {t.refundOf} · {fmtDate(t.createdAt)}</span>
              </span>
              <Button size="sm" onClick={() => run("admin.refund", "Refund ditandai sudah ditransfer", (d, a) => actions.processRefund(d, a, t.id))}>Proses</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="dana" className="mt-4"><FundsPanel events={state.events} admin /></TabsContent>
        <TabsContent value="lainnya" className="mt-4 space-y-5">
          <div><h2 className="mb-2 text-sm">Kode referral semua collective</h2><ReferralManager /></div>
          <div><h2 className="mb-2 text-sm">Rating user</h2><RatingReport eventIds={allEvents} /></div>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <ul className="max-h-[32rem] space-y-1 overflow-y-auto rounded-2xl border bg-card p-4 text-xs">
            {state.logs.slice(0, 200).map((l) => (
              <li key={l.id}><span className="text-muted-foreground">{fmtDate(l.at)}</span> · {getUser(state, l.actorId)?.name ?? "Sistem"} · <code>{l.action}</code> · {l.detail}</li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
