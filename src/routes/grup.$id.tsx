import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PaymentDialog } from "@/components/PaymentDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { SofaSlots } from "@/components/SofaMap";
import { filledSlots, memberSlotCount, memberSlotList } from "@/lib/sofa-selection";
import { actions, useApp } from "@/lib/store";
import {
  dpDeadline, fmtDate, getEvent, getSofa, getUser, lunasCount, lunasDeadline, ratingEnd, ratingStart, rupiah, voteDeadline,
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

type Pay = { kind: "join" | "lunas" | "empty"; amount: number; title: string } | null;

function GroupPage() {
  const { id } = Route.useParams();
  const { state, me, run } = useApp();
  const [pay, setPay] = useState<Pay>(null);
  const [selectedSlot, setSelectedSlot] = useState<number[]>([]);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const g = state.groups.find((x) => x.id === id);
  if (!g) return <p>Grup tidak ditemukan. <Link to="/" className="text-primary">Kembali</Link></p>;
  const e = getEvent(state, g.eventId);
  const s = getSofa(state, g.sofaId);
  if (!e || !s) return <p>Data event atau sofa tidak ditemukan.</p>;
  const mine = g.members.find((m) => m.userId === me.id);
  const isLeader = g.leaderId === me.id;
  const empty = g.slots - filledSlots(g);
  const active = g.status === "DP_BOOKING" || g.status === "PELUNASAN";
  const canJoin = me.role === "user" && !mine && empty > 0 && active && !e.cancelled && state.now <= (g.status === "DP_BOOKING" ? dpDeadline(e) : lunasDeadline(e));
  const joinAmount = g.leaderPaidAllDp ? 0 : g.dpPerSlot * Math.max(selectedSlot.length, 1);
  const myLunas = mine ? g.lunasPerSlot * memberSlotCount(mine) : g.lunasPerSlot;
  const voteOpen = mine && (g.status === "PELUNASAN" || g.status === "LUNAS") && state.now <= voteDeadline(e);
  const rateOpen = mine && g.status === "SELESAI" && state.now >= ratingStart(e) && state.now <= ratingEnd(e) && !g.ratings[me.id];
  const tally = Object.values(g.votes).reduce<Record<string, number>>((a, v) => ({ ...a, [v]: (a[v] ?? 0) + 1 }), {});

  const doPay = () => {
    if (!pay) return;
    if (pay.kind === "join") run("group.join", "Bergabung ke grup", (d, u) => actions.join(d, u, g.id, selectedSlot));
    if (pay.kind === "lunas") run("group.pay", "Pelunasan berhasil", (d, u) => actions.payLunas(d, u, g.id));
    if (pay.kind === "empty") run("group.pay", "Slot kosong dilunasi", (d, u) => actions.payEmptySlots(d, u, g.id));
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
            <h1 className="mt-1 text-2xl">{s.name}</h1>
            <p className="text-sm text-muted-foreground">Ketua: {getUser(state, g.leaderId)?.name}</p>
          </div>
          <StatusBadge status={g.status} />
        </div>
        {g.status === "BATAL" && <p className="mt-3 rounded-lg bg-destructive/15 p-2 text-sm text-destructive">Batal: {g.cancelReason}</p>}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-muted p-2">Slot terisi<br /><b className="text-sm">{filledSlots(g)}/{g.slots}</b></div>
          <div className="rounded-lg bg-muted p-2">DP/slot<br /><b className="text-sm">{rupiah(g.dpPerSlot)}</b></div>
          <div className="rounded-lg bg-muted p-2">Lunas/slot<br /><b className="text-sm">{rupiah(g.lunasPerSlot)}</b></div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 text-sm">Tahapan</h2>
        <ol className="space-y-2">
          {step("DP penuh", g.status !== "DP_BOOKING" && g.status !== "BATAL", dpDeadline(e))}
          {step(`Pelunasan (${lunasCount(g)}/${g.slots})`, g.status === "LUNAS" || g.status === "SELESAI", lunasDeadline(e))}
          {step("Vote minuman ditutup", state.now > voteDeadline(e), voteDeadline(e))}
          {step("Event selesai & rating", g.status === "SELESAI", ratingEnd(e))}
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="mb-3 text-sm">Slot sofa</h2>
        <SofaSlots capacity={g.slots} group={g} selected={selectedSlot} onSelect={setSelectedSlot} disabled={!canJoin} />
        {canJoin && (
          <Button className="w-full" disabled={selectedSlot.length === 0 || selectedSlot.length > empty} onClick={() => setPay({ kind: "join", amount: joinAmount, title: `DP slot ${selectedSlot.join(", ")} · ${s.name}` })}>
            {joinAmount ? `Gabung & bayar DP ${selectedSlot.length || 1} slot · ${rupiah(joinAmount)}` : "Gabung (DP sudah ditanggung ketua)"}
          </Button>
        )}
        {mine && g.status === "PELUNASAN" && !mine.lunasPaid && (
          <Button className="w-full" onClick={() => setPay({ kind: "lunas", amount: myLunas, title: `Pelunasan ${s.name}` })}>
            Bayar pelunasan {rupiah(myLunas)}
          </Button>
        )}
        {isLeader && g.status === "PELUNASAN" && empty > 0 && g.emptyLunasPaid === 0 && (
          <Button variant="secondary" className="w-full"
            onClick={() => setPay({ kind: "empty", amount: g.lunasPerSlot * empty, title: `Pelunasan ${empty} slot kosong` })}>
            Lunasi {empty} slot kosong ({rupiah(g.lunasPerSlot * empty)})
          </Button>
        )}
        {mine && g.status === "PELUNASAN" && mine.lunasPaid && (
          <p className="rounded-xl bg-muted p-3 text-center text-sm">Kamu sudah lunas. Menunggu anggota lain{isLeader && empty > 0 ? " atau lunasi slot kosong" : ""}.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm">Anggota</h2>
        <ul className="divide-y text-sm">
          {g.members.map((m, index) => (
            <li key={m.userId} className="flex justify-between py-2">
              <span>{getUser(state, m.userId)?.name}{m.userId === g.leaderId && " · ketua"}<span className="block text-xs text-muted-foreground">Slot {memberSlotList(g)[index]?.join(", ")}</span></span>
              <span className="text-xs text-muted-foreground">
                {m.lunasPaid ? "Lunas" : m.dpCoveredByLeader ? "DP ditanggung ketua" : "DP"}
              </span>
            </li>
          ))}
          {Array.from({ length: empty }).map((_, i) => (
            <li key={i} className="py-2 text-muted-foreground">Slot kosong{g.emptyLunasPaid > 0 && " · dilunasi ketua"}</li>
          ))}
        </ul>
      </section>

      {mine && e.drinks.length > 0 && g.status !== "BATAL" && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 text-sm">Vote minuman</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {voteOpen ? `Dibuka setelah DP penuh, ditutup ${fmtDate(voteDeadline(e))}.` : g.status === "DP_BOOKING" ? "Dibuka setelah DP penuh." : "Vote ditutup."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {e.drinks.map((dr) => (
              <Button key={dr} size="sm" disabled={!voteOpen} variant={g.votes[me.id] === dr ? "default" : "outline"}
                onClick={() => run("vote", `Vote: ${dr}`, (d, u) => actions.vote(d, u, g.id, dr))}>
                {dr} {tally[dr] ? `(${tally[dr]})` : ""}
              </Button>
            ))}
          </div>
        </section>
      )}

      {mine && g.status === "SELESAI" && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 text-sm">Rating event</h2>
          {g.ratings[me.id] ? (
            <p className="text-sm">Terima kasih! Kamu memberi {g.ratings[me.id]?.stars} bintang.</p>
          ) : rateOpen ? (
            <div className="space-y-2">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} aria-label={`${n} bintang`} onClick={() => setStars(n)}>
                    <Star className={`h-6 w-6 ${n <= stars ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea maxLength={300} placeholder="Ceritakan pengalamanmu (opsional)" value={comment} onChange={(ev) => setComment(ev.target.value)} />
              <Button className="w-full" onClick={() => run("rate", "Rating terkirim", (d, u) => actions.rate(d, u, g.id, stars, comment))}>Kirim rating</Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Rating dibuka {fmtDate(ratingStart(e))} sampai {fmtDate(ratingEnd(e))}.</p>
          )}
        </section>
      )}

      <PaymentDialog open={!!pay} onOpenChange={(o) => !o && setPay(null)} title={pay?.title ?? ""} amount={pay?.amount ?? 0} onPaid={doPay}
        sofaSelection={pay?.kind === "join" && selectedSlot.length ? { name: s.name, slots: selectedSlot } : undefined} />
    </div>
  );
}
