import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { actions, useApp } from "@/lib/store";
import { ageAt, createDeadline, fmtDate, fmtEventDate, getEvent, getSofa, rupiah, sofaPrices } from "@/lib/rules";
import type { Pax } from "@/lib/types";

type Search = { event?: string; sofa?: string; pax?: Pax };

export const Route = createFileRoute("/pengajuan")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s['event'] === "string" ? { event: s['event'] } : {}),
    ...(typeof s['sofa'] === "string" ? { sofa: s['sofa'] } : {}),
    ...(s['pax'] === 2 || s['pax'] === 5 || s['pax'] === "2" || s['pax'] === "5" ? { pax: Number(s['pax']) as Pax } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Pengajuan Grup — Sofamates" },
      { name: "description", content: "Ajukan grup patungan sofa atau tiket dan pantau status pengajuanmu." },
      { property: "og:title", content: "Pengajuan Grup — Sofamates" },
      { property: "og:description", content: "Ajukan grup patungan sofa di event collective DIY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalPage,
});

const statusStyle = { menunggu: "bg-warning/15 text-warning", disetujui: "bg-success/15 text-success", ditolak: "bg-destructive/15 text-destructive" };

function ProposalPage() {
  const search = Route.useSearch();
  const { state, me, run } = useApp();
  const navigate = useNavigate();
  const [eventId, setEventId] = useState(search.event ?? "");
  const [target, setTarget] = useState(search.sofa ? `s:${search.sofa}` : search.pax ? `t:${search.pax}` : "");
  const [friends, setFriends] = useState("0");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");

  if (me.role !== "user") return <p className="text-sm text-muted-foreground">Pengajuan grup khusus akun user. Host collective membuat grup langsung dari dasbor host.</p>;
  const age = ageAt(me.birthDate, state.now);
  const blockers = [
    me.verify !== "terverifikasi" && "Akun belum terverifikasi (AKN-06).",
    me.verify === "terverifikasi" && (age === undefined || age < 21) && "Pengajuan grup khusus user 21 tahun ke atas (AKN-03).",
    !me.whatsapp && "Nomor WhatsApp belum diisi (AKN-07).",
  ].filter(Boolean) as string[];

  const events = state.events.filter((e) => e.status === "terbit" && state.now <= createDeadline(e));
  const e = getEvent(state, eventId);
  const freeSofas = e ? state.sofas.filter((s) => s.eventId === e.id && !state.groups.some((g) => g.sofaId === s.id && g.status !== "BATAL")) : [];
  const ticketOptions = e ? e.tickets.filter((t) => t.pax !== 1) : [];
  const ref = code.trim() && e ? actions.findReferral(state, e.id, code) : undefined;
  const mine = state.proposals.filter((p) => p.userId === me.id);

  const submit = () => {
    const [kind, value] = target.split(":");
    const ok = run("proposal.create", "Pengajuan terkirim, menunggu keputusan host", (d, u) => actions.createProposal(d, u, {
      eventId, ...(kind === "s" && value ? { sofaId: value } : { pax: Number(value) as Pax }), friends: Number(friends), referralCode: ref ? code : "", note,
    }));
    if (ok) { setTarget(""); setNote(""); setCode(""); setFriends("0"); navigate({ to: "/pengajuan", search: {} }); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl">Pengajuan grup</h1>
        <p className="text-sm text-muted-foreground">Ajukan grup untuk sofa atau tiket 2/5 orang. Disetujui host collective atau admin, lalu kamu jadi ketua.</p>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
        {blockers.length > 0 ? (
          <div className="space-y-2">
            {blockers.map((b) => <p key={b} className="rounded-lg bg-muted p-2">{b}</p>)}
            <Button asChild size="sm"><Link to="/akun">Buka halaman Akun</Link></Button>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Event (paling lambat H-14)</label>
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setTarget(""); }}>
                <SelectTrigger><SelectValue placeholder="Pilih event" /></SelectTrigger>
                <SelectContent>
                  {events.map((x) => <SelectItem key={x.id} value={x.id}>{x.title} · {fmtEventDate(x.date)}</SelectItem>)}
                </SelectContent>
              </Select>
              {events.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Tidak ada event yang masih menerima pengajuan.</p>}
            </div>
            {e && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Sofa atau paket tiket</label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger><SelectValue placeholder="Pilih sofa / tiket" /></SelectTrigger>
                  <SelectContent>
                    {freeSofas.map((s) => {
                      const p = sofaPrices(s);
                      return <SelectItem key={s.id} value={`s:${s.id}`}>Sofa {s.name} · {s.capacity} slot · DP {rupiah(p.dpPerSlot)}/slot</SelectItem>;
                    })}
                    {ticketOptions.map((t) => <SelectItem key={t.pax} value={`t:${t.pax}`}>Grup tiket {t.pax} orang · {rupiah(t.price)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Batas pengajuan: {fmtDate(createDeadline(e))}. Sofa yang sudah punya grup tidak bisa dipilih (GRP-04).</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="friends">Teman yang sudah ikut</label>
                <Input id="friends" type="number" min={0} value={friends} onChange={(ev) => setFriends(ev.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground" htmlFor="ref">Kode referral (opsional)</label>
                <Input id="ref" maxLength={30} value={code} onChange={(ev) => setCode(ev.target.value)} />
              </div>
            </div>
            {code.trim() && e && <p className={`text-xs ${ref ? "text-success" : "text-muted-foreground"}`}>{ref ? `Kode valid · ${ref.owner}` : "Kode tidak valid untuk collective event ini. Pengajuan tetap bisa dikirim tanpa kode."}</p>}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="note">Catatan</label>
              <Textarea id="note" maxLength={300} rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} />
            </div>
            <Button className="w-full" disabled={!eventId || !target} onClick={submit}>Kirim pengajuan</Button>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm">Pengajuanku</h2>
        {mine.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengajuan.</p>}
        {mine.map((p) => {
          const pe = getEvent(state, p.eventId);
          return (
            <div key={p.id} className="rounded-2xl border bg-card p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.sofaId ? `Sofa ${getSofa(state, p.sofaId)?.name}` : `Grup tiket ${p.ticketPax} orang`}</p>
                  <p className="text-xs text-muted-foreground">{pe?.title} · diajukan {fmtDate(p.createdAt)}</p>
                </div>
                <span className={`tag ${statusStyle[p.status]}`}>{p.status}</span>
              </div>
              {p.reason && <p className="mt-2 text-xs text-destructive">Alasan: {p.reason}</p>}
              {p.groupId && <Link to="/grup/$id" params={{ id: p.groupId }} className="mt-2 inline-block text-xs text-primary">Buka grup</Link>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
