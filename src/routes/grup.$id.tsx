import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Check, Clock, MessageCircle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MobileActionBar } from "@/components/MobileActionBar";
import { usePayment } from "@/components/PaymentDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { SofaSlots } from "@/components/SofaMap";
import { TermsCheck } from "@/components/TermsCheck";
import { filledSlots, memberSlotList } from "@/lib/sofa-selection";
import { actions, useApp } from "@/lib/store";
import {
  activeMembers, countdown, dayStart, dpDeadline, fmtDate, getEvent, getSofa, getUser, groupName, isMember, lunasCount, lunasDeadline,
  memberSlotCount, nextDeadline, ownsEvent, payLabel, ratingEnd, ratingStart, rupiah, voteDeadline,
} from "@/lib/rules";

export const Route = createFileRoute("/grup/$id")({
  head: () => ({
    meta: [
      { title: "Grup Patungan — Sofamates" },
      { name: "description", content: "Pantau anggota, DP, pelunasan, vote minuman, dan rating grup sofa kamu." },
      { property: "og:title", content: "Grup Patungan — Sofamates" },
      { property: "og:description", content: "Patungan sofa bareng teman di event club Jogja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { id } = Route.useParams();
  const { state, me, run, check } = useApp();
  const payment = usePayment();
  const [selectedSlot, setSelectedSlot] = useState<number[]>([]);
  const [code, setCode] = useState("");
  const [terms, setTerms] = useState(false);
  const [wa, setWa] = useState<string | null>(null);
  const g = state.groups.find((x) => x.id === id);
  if (!g) return <p>Grup tidak ditemukan. <Link to="/" className="text-primary">Kembali</Link></p>;
  const e = getEvent(state, g.eventId);
  if (!e) return <p>Data event tidak ditemukan.</p>;
  const s = getSofa(state, g.sofaId);
  const name = groupName(state, g);
  const members = activeMembers(g);
  const slotsOf = memberSlotList(g);
  const mine = members.find((m) => m.userId === me.id);
  const isLeader = g.leaderId === me.id;
  const isHost = ownsEvent(me, e);
  const empty = g.slots - filledSlots(g);
  const js = actions.joinState(state, g);
  const canJoin = me.role === "user" && !mine && js.open;
  const joinAmount = js.free ? 0 : (g.kind === "tiket" ? g.lunasPerSlot : g.dpPerSlot) * Math.max(selectedSlot.length, 1);
  const myPending = state.txs.find((t) => t.groupId === g.id && t.userId === me.id && t.status === "pending");
  const nd = nextDeadline(e, g);
  const ref = code.trim() ? actions.findReferral(state, g.eventId, code) : undefined;
  const payAllErr = actions.canPayAllDp(state, g, me.id);
  const vote = actions.voteResult(g);
  const voteOpen = !!mine && mine.pay !== "menunggu" && g.kind === "sofa" && g.status !== "BATAL" && g.status !== "SELESAI" && state.now <= voteDeadline(e);
  const rateOpen = !!mine && g.status === "SELESAI" && state.now >= ratingStart(e) && state.now <= ratingEnd(e);
  const emptyToCover = g.slots - filledSlots(g) - g.emptyLunasPaid;

  // Satu aksi utama per keadaan, ditaruh di bilah bawah supaya mudah dijangkau di HP.
  const primary = myPending ? (
    <Button className="w-full" onClick={() => payment.resume(myPending.id, { title: `Lanjutkan pembayaran · ${name}` })}>
      Lanjutkan pembayaran {rupiah(myPending.amount)}
    </Button>
  ) : canJoin ? (
    <Button className="w-full" disabled={selectedSlot.length === 0 || selectedSlot.length > empty} onClick={() => startJoin()}>
      {selectedSlot.length === 0 ? "Pilih slot dulu"
        : joinAmount ? `Gabung & bayar ${g.kind === "tiket" ? "" : "DP "}${selectedSlot.length} slot · ${rupiah(joinAmount)}` : "Gabung (DP sudah ditanggung ketua)"}
    </Button>
  ) : mine?.pay === "menunggu" && (g.kind === "tiket" || !g.leaderPaidAllDp) ? (
    <Button className="w-full" onClick={() => payment.start("group.pay", "Menunggu pembayaran", (d, u) => actions.payOwnShare(d, u, g.id), { title: `Bagian slotmu · ${name}` })}>
      Bayar {g.kind === "tiket" ? "bagianmu" : "DP slotmu"} · {rupiah((g.kind === "tiket" ? g.lunasPerSlot : g.dpPerSlot) * memberSlotCount(mine))}
    </Button>
  ) : mine && g.kind === "sofa" && g.status === "PELUNASAN" && (mine.pay === "dp" || mine.pay === "belum_bayar") && state.now <= lunasDeadline(e) ? (
    <Button className="w-full" onClick={() => payment.start("group.pay", "Menunggu pembayaran pelunasan", (d, u) => actions.payLunas(d, u, g.id), { title: `Pelunasan ${name}` })}>
      Bayar pelunasan {rupiah(g.lunasPerSlot * memberSlotCount(mine))}
    </Button>
  ) : null;
  const primaryHint = myPending || canJoin ? "Slot ditahan 30 menit selama pembayaran (U2)." : nd ? `${nd.label}: ${countdown(state.now, nd.at)} lagi` : undefined;

  const startJoin = () => {
    if (!check("group.join")) return;
    if (code.trim() && !ref) toast("Kode referral tidak valid untuk collective ini — lanjut tanpa kode (REF-02).");
    payment.start("group.join", js.free ? "Bergabung ke grup" : "Slot ditahan 30 menit, selesaikan pembayaran",
      (d, u) => actions.join(d, u, g.id, selectedSlot, ref ? code : ""),
      { title: `${g.kind === "tiket" ? "Tiket" : "DP"} slot ${selectedSlot.join(", ")} · ${name}`, sofaSelection: { name, slots: selectedSlot } });
    setSelectedSlot([]);
  };

  const step = (label: string, done: boolean, at: number) => (
    <li className="flex items-center gap-2 text-sm">
      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? "bg-primary text-primary-foreground" : "border"}`}>
        {done && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted-foreground">{fmtDate(at, false)}</span>
    </li>
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-card p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to="/event/$id" params={{ id: e.id }} className="text-xs font-semibold text-accent">{e.title}</Link>
            <h1 className="mt-1 text-2xl">{name}</h1>
            <p className="text-sm text-muted-foreground">Ketua: {getUser(state, g.leaderId)?.name ?? "belum ada (anggota 21+ pertama jadi ketua)"}</p>
          </div>
          <StatusBadge status={g.status} />
        </div>
        {g.status === "BATAL" && <p className="mt-3 rounded-lg bg-destructive/15 p-2 text-sm text-destructive">Batal: {g.cancelReason}</p>}
        {g.leaderPaidAllDp && g.status !== "BATAL" && <p className="mt-3 rounded-lg bg-primary/10 p-2 text-xs">DP sudah dibayar penuh oleh ketua. Anggota baru bergabung tanpa DP dan cukup bayar pelunasan (U8).</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted p-2">Slot terisi<br /><b className="text-sm">{filledSlots(g)}/{g.slots}</b></div>
          {g.kind === "sofa" ? <>
            <div className="rounded-lg bg-muted p-2">DP/slot<br /><b className="text-sm">{rupiah(g.dpPerSlot)}</b></div>
            <div className="rounded-lg bg-muted p-2">Lunas/slot<br /><b className="text-sm">{rupiah(g.lunasPerSlot)}</b></div>
          </> : <div className="col-span-2 rounded-lg bg-muted p-2">Bayar penuh per orang<br /><b className="text-sm">{rupiah(g.lunasPerSlot)}</b></div>}
        </div>
        {nd && <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{nd.label}: {countdown(state.now, nd.at)} lagi ({fmtDate(nd.at)})</p>}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 text-sm">Tahapan</h2>
        <ol className="space-y-2">
          {g.kind === "sofa" ? <>
            {step("DP lengkap (cek H-7)", !["DP_BOOKING", "BATAL"].includes(g.status), dpDeadline(e))}
            {step(`Pelunasan ${lunasCount(g)}/${g.slots} (cek H-3)`, g.status === "LUNAS" || g.status === "SELESAI", lunasDeadline(e))}
          </> : step(`Grup penuh & lunas ${lunasCount(g)}/${g.slots} (sebelum H-3)`, g.status === "LUNAS" || g.status === "SELESAI", lunasDeadline(e))}
          {step("Hari H", state.now > dayStart(e.date, 0) && g.status !== "BATAL", dayStart(e.date, 0))}
          {g.kind === "sofa" && step("Rating H+1 s/d H+3", g.status === "SELESAI" && state.now > ratingEnd(e), ratingEnd(e))}
        </ol>
      </section>

      {(mine || isHost) && g.status !== "BATAL" && (
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm"><MessageCircle className="h-4 w-4" />Grup WhatsApp</h2>
          {g.waLink ? <a href={g.waLink} target="_blank" rel="noreferrer" className="break-all text-primary">{g.waLink}</a>
            : <p className="text-muted-foreground">Link belum diisi ketua atau host.</p>}
          {(isLeader || isHost) && (
            wa === null
              ? <Button size="sm" variant="outline" className="mt-2" onClick={() => setWa(g.waLink ?? "")}>{g.waLink ? "Ubah link" : "Isi link"}</Button>
              : <div className="mt-2 flex gap-2">
                <Input value={wa} placeholder="https://chat.whatsapp.com/…" onChange={(ev) => setWa(ev.target.value)} />
                <Button size="sm" onClick={() => run(null, "Link WA disimpan", (d, u) => actions.setWaLink(d, u, g.id, wa)) && setWa(null)}>Simpan</Button>
              </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Hanya terlihat oleh anggota grup (GRP-08).</p>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="mb-3 text-sm">Slot</h2>
        <SofaSlots capacity={g.slots} group={g} selected={selectedSlot} onSelect={setSelectedSlot} disabled={!canJoin} />
        {canJoin && (
          <div className="space-y-2">
            <Input placeholder="Kode referral (opsional)" maxLength={30} value={code} onChange={(ev) => setCode(ev.target.value)} />
            {code.trim() && <p className={`text-xs ${ref ? "text-success" : "text-muted-foreground"}`}>{ref ? `Kode valid · ${ref.owner}` : "Kode tidak dikenal untuk collective ini. Kamu tetap bisa gabung tanpa kode."}</p>}
          </div>
        )}
        {!mine && !js.open && me.role === "user" && g.status !== "SELESAI" && <p className="rounded-xl bg-muted p-3 text-center text-sm">{js.why}</p>}
        {isLeader && !payAllErr && s && (
          <div className="space-y-2 rounded-2xl border p-3">
            <p className="text-sm font-semibold">Bayar seluruh DP sofa ({rupiah(s.dp)})</p>
            <TermsCheck checked={terms} onChange={setTerms} />
            <Button variant="secondary" className="w-full" disabled={!terms}
              onClick={() => payment.start("group.payAllDp", "Menunggu pembayaran DP penuh", (d, u) => actions.payAllDp(d, u, g.id, terms), { title: `Seluruh DP · ${name}` })}>
              Bayar seluruh DP
            </Button>
          </div>
        )}
        {mine && g.kind === "sofa" && g.status === "DP_BOOKING" && mine.pay !== "menunggu" && (
          <p className="rounded-xl bg-muted p-3 text-center text-xs">Tombol pelunasan muncul setelah DP lengkap dicek di H-7 (PAY-03).</p>
        )}
        {mine && g.kind === "sofa" && g.status === "PELUNASAN" && emptyToCover > 0 && g.leaderPaidAllDp && (
          <Button variant="secondary" className="w-full"
            onClick={() => payment.start("group.pay", "Menunggu pembayaran talangan", (d, u) => actions.payEmptySlots(d, u, g.id), { title: `Talangi ${emptyToCover} slot kosong` })}>
            Talangi {emptyToCover} slot kosong ({rupiah(g.lunasPerSlot * emptyToCover)})
          </Button>
        )}
        {mine && (g.status === "DP_BOOKING" || g.status === "PELUNASAN") && (
          <Button variant="ghost" size="sm" className="w-full text-destructive"
            onClick={() => confirm(mine.pay === "dp" || mine.pay === "lunas"
              ? "Kamu sudah membayar. Kalau keluar, uangmu hangus dan tidak di-refund (U11). Lanjut keluar?"
              : "Keluar dari grup ini?") && run("group.leave", "Keluar dari grup", (d, u) => actions.leave(d, u, g.id))}>
            Keluar dari grup
          </Button>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm">Anggota</h2>
        <ul className="divide-y text-sm">
          {members.map((m, index) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
              <span>{getUser(state, m.userId)?.name}{m.userId === g.leaderId && " · ketua"}<span className="block text-xs text-muted-foreground">Slot {slotsOf[index]?.join(", ")}</span></span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {payLabel[m.pay]}
                {mine && m.userId !== me.id && g.kind === "sofa" && g.status === "PELUNASAN" && (m.pay === "dp" || m.pay === "belum_bayar") && state.now <= lunasDeadline(e) && (
                  <Button size="sm" variant="outline"
                    onClick={() => payment.start("group.pay", "Menunggu pembayaran talangan", (d, u) => actions.payLunas(d, u, g.id, m.userId), { title: `Talangi pelunasan ${getUser(state, m.userId)?.name}` })}>
                    Talangi
                  </Button>
                )}
              </span>
            </li>
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <li key={i} className="py-2 text-muted-foreground">Slot kosong{i < g.emptyLunasPaid && " · sudah ditalangi"}</li>
          ))}
          {g.members.filter((m) => m.leftAt || m.pay === "hangus" || m.pay === "refund").map((m) => (
            <li key={`x-${m.userId}`} className="flex justify-between py-2 text-xs text-muted-foreground">
              <span>{getUser(state, m.userId)?.name}{m.leftAt ? " · keluar" : ""}</span><span>{payLabel[m.pay]}</span>
            </li>
          ))}
        </ul>
      </section>

      {g.kind === "sofa" && s && s.drinks.length > 0 && (mine || isHost) && g.status !== "BATAL" && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 text-sm">Vote minuman</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {voteOpen ? `Satu suara per anggota, bisa diubah sampai ${fmtDate(voteDeadline(e))}.` : state.now > voteDeadline(e) ? "Vote ditutup." : "Hanya anggota yang sudah bergabung yang bisa vote."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {s.drinks.map((dr) => (
              <Button key={dr} size="sm" disabled={!voteOpen} variant={g.votes[me.id] === dr ? "default" : "outline"}
                onClick={() => run("vote", `Vote: ${dr}`, (d, u) => actions.vote(d, u, g.id, dr))}>
                {dr} ({vote.tally[dr] ?? 0})
              </Button>
            ))}
          </div>
          {state.now > voteDeadline(e) && (
            <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
              {vote.final ? <>Hasil final: <b>{vote.final}</b>{g.drinkPick && " (diputuskan ketua)"}</>
                : vote.tie ? <>
                  Hasil seri: {vote.top.join(" vs ")}. {isLeader ? "Pilih salah satu (U12):" : "Menunggu keputusan ketua (U12)."}
                  {isLeader && <div className="mt-2 flex flex-wrap gap-2">{vote.top.map((dr) => (
                    <Button key={dr} size="sm" onClick={() => run(null, `Ketua memilih ${dr}`, (d, u) => actions.pickDrink(d, u, g.id, dr))}>{dr}</Button>
                  ))}</div>}
                </> : "Belum ada suara."}
            </div>
          )}
        </section>
      )}

      {mine && g.kind === "sofa" && g.status === "SELESAI" && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 text-sm">Rating anggota</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {rateOpen ? `Dibuka sampai ${fmtDate(ratingEnd(e))}. Nilai dan catatan hanya dilihat host collective dan admin (RAT-03).` : `Rating dibuka ${fmtDate(ratingStart(e))} sampai ${fmtDate(ratingEnd(e))}.`}
          </p>
          <div className="space-y-3">
            {members.filter((m) => m.userId !== me.id).map((m) => (
              <RateRow key={m.userId} name={getUser(state, m.userId)?.name ?? "-"} done={g.ratings.find((r) => r.from === me.id && r.to === m.userId)?.stars}
                open={rateOpen && isMember(g, me.id)}
                onSubmit={(stars, note) => run("rate", "Rating terkirim", (d, u) => actions.rate(d, u, g.id, m.userId, stars, note))} />
            ))}
          </div>
        </section>
      )}
      {primary && <MobileActionBar hint={primaryHint}>{primary}</MobileActionBar>}
      {payment.dialog}
    </div>
  );
}

function RateRow({ name, done, open, onSubmit }: { name: string; done?: number | undefined; open: boolean; onSubmit: (stars: number, note: string) => boolean }) {
  const [stars, setStars] = useState(5);
  const [note, setNote] = useState("");
  if (done) return <p className="text-sm">{name}: kamu memberi {done} bintang.</p>;
  if (!open) return <p className="text-sm text-muted-foreground">{name}</p>;
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{name}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-label={`${n} bintang`} onClick={() => setStars(n)}>
              <Star className={`h-5 w-5 ${n <= stars ? "fill-accent text-accent" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
      </div>
      <Textarea maxLength={300} rows={2} placeholder="Catatan singkat (opsional)" value={note} onChange={(ev) => setNote(ev.target.value)} />
      <Button size="sm" className="w-full" onClick={() => onSubmit(stars, note)}>Kirim rating</Button>
    </div>
  );
}
