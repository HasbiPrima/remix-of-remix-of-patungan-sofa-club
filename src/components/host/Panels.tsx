import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { actions, useApp } from "@/lib/store";
import {
  ageAt, fmtDate, fmtEventDate, getEvent, getSofa, getUser, groupName, payoutEnd, payoutStart, rupiah,
} from "@/lib/rules";
import { filledSlots } from "@/lib/sofa-selection";
import type { EventItem } from "@/lib/types";

/** GRP-03: pengajuan masuk. */
export function ProposalList({ eventIds }: { eventIds: Set<string> }) {
  const { state, run } = useApp();
  const [reason, setReason] = useState<Record<string, string>>({});
  const list = state.proposals.filter((p) => eventIds.has(p.eventId)).sort((a, b) => (a.status === "menunggu" ? -1 : 1) - (b.status === "menunggu" ? -1 : 1) || b.createdAt - a.createdAt);
  if (list.length === 0) return <p className="text-sm text-muted-foreground">Belum ada pengajuan.</p>;
  return (
    <div className="space-y-2">
      {list.map((p) => {
        const u = getUser(state, p.userId);
        const ref = state.referrals.find((r) => r.id === p.referralId);
        return (
          <div key={p.id} className="rounded-2xl border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p.sofaId ? `Sofa ${getSofa(state, p.sofaId)?.name}` : `Grup tiket ${p.ticketPax} orang`} · {getEvent(state, p.eventId)?.title}</p>
                <p className="text-xs text-muted-foreground">{u?.name} ({ageAt(u?.birthDate, state.now) ?? "?"} th) · {p.friends} teman · {fmtDate(p.createdAt)}{ref ? ` · kode ${ref.code}` : ""}</p>
                {p.note && <p className="mt-1 text-xs">“{p.note}”</p>}
                {p.reason && <p className="mt-1 text-xs text-destructive">Ditolak: {p.reason}</p>}
              </div>
              <span className="tag bg-muted">{p.status}</span>
            </div>
            {p.status === "menunggu" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input className="h-9 flex-1" placeholder="Alasan kalau ditolak" value={reason[p.id] ?? ""} onChange={(e) => setReason({ ...reason, [p.id]: e.target.value })} />
                <Button size="sm" onClick={() => run("proposal.decide", "Pengajuan disetujui, grup dibuat", (d, me) => actions.decideProposal(d, me, p.id, true))}>Setujui</Button>
                <Button size="sm" variant="outline" onClick={() => run("proposal.decide", "Pengajuan ditolak", (d, me) => actions.decideProposal(d, me, p.id, false, reason[p.id] ?? ""))}>Tolak</Button>
              </div>
            )}
            {p.groupId && <Link to="/grup/$id" params={{ id: p.groupId }} className="mt-1 inline-block text-xs text-primary">Buka grup</Link>}
          </div>
        );
      })}
    </div>
  );
}

/** Grup per event (CRUD: dibuat dari tab Event, dibatalkan di sini). */
export function GroupList({ eventIds }: { eventIds: Set<string> }) {
  const { state, run } = useApp();
  const groups = state.groups.filter((g) => eventIds.has(g.eventId));
  if (groups.length === 0) return <p className="text-sm text-muted-foreground">Belum ada grup.</p>;
  return (
    <ul className="divide-y rounded-2xl border bg-card px-4 text-sm">
      {groups.map((g) => (
        <li key={g.id} className="flex items-center justify-between gap-2 py-3">
          <Link to="/grup/$id" params={{ id: g.id }} className="min-w-0 flex-1">
            {groupName(state, g)}
            <span className="block text-xs text-muted-foreground">{getEvent(state, g.eventId)?.title} · {filledSlots(g)}/{g.slots} · ketua {getUser(state, g.leaderId)?.name ?? "-"}</span>
          </Link>
          <StatusBadge status={g.status} />
          {(g.status === "DP_BOOKING" || g.status === "PELUNASAN" || g.status === "LUNAS") && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
              const r = prompt("Alasan pembatalan grup? Semua pembayaran akan di-refund penuh.");
              if (r !== null) run("group.manage", "Grup dibatalkan", (d, me) => actions.cancelGroup(d, me, g.id, r.slice(0, 200)));
            }}>Batalkan</Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** REF-01, REF-03: kelola kode referral dan laporan per kode. */
export function ReferralManager({ collectiveId }: { collectiveId?: string | undefined }) {
  const { state, run } = useApp();
  const [form, setForm] = useState<{ id: string | null; code: string; owner: string; contact: string } | null>(null);
  const codes = state.referrals.filter((r) => !collectiveId || r.collectiveId === collectiveId);
  return (
    <div className="space-y-3">
      {collectiveId && <Button className="w-full" variant="outline" onClick={() => setForm({ id: null, code: "", owner: "", contact: "" })}><Plus />Kode baru</Button>}
      {form && (
        <div className="space-y-2 rounded-2xl border bg-card p-3">
          <Input placeholder="KODE" maxLength={30} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <Input placeholder="Nama pemilik (penerima komisi)" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <Input placeholder="Kontak (opsional)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => run("referral.manage", "Kode disimpan", (d, me) => actions.saveReferral(d, me, form.id, form)) && setForm(null)}>Simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => setForm(null)}>Batal</Button>
          </div>
        </div>
      )}
      {codes.map((r) => {
        const members = state.groups.flatMap((g) => g.members.filter((m) => m.referralId === r.id).map((m) => ({ g, m })));
        const userGroups = new Set(members.map((x) => x.g.id));
        const txs = state.txs.filter((t) => t.status === "berhasil" && t.kind !== "refund" && members.some(({ g, m }) => t.groupId === g.id && t.memberUserId === m.userId));
        const proposals = state.proposals.filter((p) => p.referralId === r.id).length;
        return (
          <div key={r.id} className="rounded-2xl border bg-card p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-primary">{r.code}</p>
                <p className="text-xs text-muted-foreground">{r.owner}{r.contact && ` · ${r.contact}`}</p>
              </div>
              <span className={`tag ${r.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{r.active ? "aktif" : "nonaktif"}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-muted p-2">Transaksi<br /><b>{txs.length}</b></div>
              <div className="rounded-lg bg-muted p-2">Total nilai<br /><b>{rupiah(txs.reduce((a, t) => a + t.amount, 0))}</b></div>
              <div className="rounded-lg bg-muted p-2">Grup / pengajuan<br /><b>{userGroups.size} / {proposals}</b></div>
            </div>
            {userGroups.size > 0 && <p className="mt-2 text-xs text-muted-foreground">Grup: {[...userGroups].map((id) => groupName(state, state.groups.find((g) => g.id === id)!)).join(", ")}</p>}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setForm({ id: r.id, code: r.code, owner: r.owner, contact: r.contact })}>Ubah</Button>
              <Button size="sm" variant="ghost" onClick={() => run("referral.manage", r.active ? "Kode dinonaktifkan" : "Kode diaktifkan", (d, me) => actions.toggleReferral(d, me, r.id))}>{r.active ? "Nonaktifkan" : "Aktifkan"}</Button>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Sistem hanya mencatat dan mencocokkan kode. Komisi dibayar collective sendiri di luar Sofamates (REF-04).</p>
    </div>
  );
}

/** RAT-03, RAT-04: rata-rata rating dan catatan per user, hanya host collective & admin. */
export function RatingReport({ eventIds }: { eventIds: Set<string> }) {
  const { state } = useApp();
  const ratings = state.groups.filter((g) => eventIds.has(g.eventId)).flatMap((g) => g.ratings.map((r) => ({ ...r, g })));
  const byUser = new Map<string, typeof ratings>();
  for (const r of ratings) byUser.set(r.to, [...(byUser.get(r.to) ?? []), r]);
  if (byUser.size === 0) return <p className="text-sm text-muted-foreground">Belum ada rating.</p>;
  return (
    <div className="space-y-2">
      {[...byUser.entries()].map(([userId, list]) => (
        <div key={userId} className="rounded-2xl border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold">{getUser(state, userId)?.name}</p>
            <p className="flex items-center gap-1 text-primary"><Star className="h-4 w-4 fill-current" />{(list.reduce((a, r) => a + r.stars, 0) / list.length).toFixed(1)} <span className="text-xs text-muted-foreground">({list.length})</span></p>
          </div>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {list.map((r) => (
              <li key={`${r.from}-${r.to}-${r.g.id}`}>{r.stars}★ dari {getUser(state, r.from)?.name} · {groupName(state, r.g)} · {fmtDate(r.at, false)}{r.note && ` — “${r.note}”`}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** ADM-04 ringkasan dana per event; admin juga mencatat payout (ADM-03). */
export function FundsPanel({ events, admin = false }: { events: EventItem[]; admin?: boolean }) {
  const { state, run } = useApp();
  const [form, setForm] = useState<Record<string, { amount: string; proof: string }>>({});
  return (
    <div className="space-y-3">
      {events.map((e) => {
        const f = actions.eventFunds(state, e.id);
        const payouts = state.payouts.filter((p) => p.eventId === e.id);
        const v = form[e.id] ?? { amount: String(Math.max(0, f.remaining)), proof: "" };
        const inWindow = state.now >= payoutStart(e) && state.now <= payoutEnd(e);
        if (f.masuk === 0 && payouts.length === 0) return null;
        return (
          <div key={e.id} className="rounded-2xl border bg-card p-4 text-sm">
            <p className="font-semibold">{e.title}</p>
            <p className="text-xs text-muted-foreground">{fmtEventDate(e.date)} · jadwal transfer {fmtDate(payoutStart(e), false)} – {fmtDate(payoutEnd(e), false)}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg bg-muted p-2">Dana masuk<br /><b>{rupiah(f.masuk)}</b></div>
              <div className="rounded-lg bg-muted p-2">DP hangus<br /><b>{rupiah(f.hangus)}</b></div>
              <div className="rounded-lg bg-muted p-2">Refund<br /><b>{rupiah(f.refund)}</b>{f.refundPending > 0 && <span className="block text-warning">{rupiah(f.refundPending)} belum diproses</span>}</div>
              <div className="rounded-lg bg-muted p-2">Harus dikirim<br /><b className="text-primary">{rupiah(f.toSend)}</b></div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Sudah dikirim {rupiah(f.sent)} · sisa {rupiah(f.remaining)}{f.unresolved > 0 && ` · ${f.unresolved} grup belum selesai pelunasan`}</p>
            {payouts.map((p) => <p key={p.id} className="text-xs">✓ {rupiah(p.amount)} · {fmtDate(p.at)} · bukti: {p.proof}</p>)}
            {admin && f.remaining > 0 && (
              <div className="mt-3 space-y-2 rounded-xl border p-3">
                {!inWindow && <p className="text-xs text-warning">Di luar jadwal H-2 sampai H-1.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" aria-label="Jumlah transfer" value={v.amount} onChange={(ev) => setForm({ ...form, [e.id]: { ...v, amount: ev.target.value } })} />
                  <Input placeholder="No. bukti / nama file" value={v.proof} onChange={(ev) => setForm({ ...form, [e.id]: { ...v, proof: ev.target.value } })} />
                </div>
                <Button size="sm" className="w-full" onClick={() => run("admin.payout", "Pengiriman dana dicatat", (d, me) => actions.recordPayout(d, me, e.id, Number(v.amount), v.proof))}>Catat transfer ke collective</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
