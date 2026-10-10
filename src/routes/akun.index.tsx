import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actions, useApp } from "@/lib/store";
import { ageAt, fmtDate, getCollective, getEvent, getVenue, roleLabel, rupiah, txKindLabel, txStatusLabel } from "@/lib/rules";

export const Route = createFileRoute("/akun/")({
  head: () => ({
    meta: [
      { title: "Akun Saya — Sofamates" },
      { name: "description", content: "Profil, verifikasi, nomor WhatsApp, dan riwayat transaksi serta refund kamu." },
      { property: "og:title", content: "Akun Saya — Sofamates" },
      { property: "og:description", content: "Kelola akun Sofamates kamu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

const verifyText = { belum: "Belum lengkap", menunggu: "Menunggu ditinjau admin", terverifikasi: "Terverifikasi", ditolak: "Ditolak" };

function AccountPage() {
  const { state, me, run } = useApp();
  const [name, setName] = useState(me.name);
  const [wa, setWa] = useState(me.whatsapp ?? "");
  const txs = state.txs.filter((t) => t.userId === me.id);
  const age = ageAt(me.birthDate, state.now);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">{roleLabel[me.role]}{!me.active && " · nonaktif"}</p>
        <h1 className="text-2xl">{me.name}</h1>
        <p className="text-sm text-muted-foreground">{me.email}</p>
        {me.collectiveId && <p className="text-sm">Collective: {getCollective(state, me.collectiveId)?.name}</p>}
        {me.venueId && <p className="text-sm">Venue: {getVenue(state, me.venueId)?.name}</p>}
        {me.role === "user" && (
          <div className="mt-3 space-y-1 rounded-xl bg-muted p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>Verifikasi: <b>{verifyText[me.verify]}</b></span>
              {(me.verify === "belum" || me.verify === "ditolak") && (
                <Button size="sm" asChild><Link to="/akun/verifikasi">{me.verify === "ditolak" ? "Kirim ulang" : "Lengkapi"}</Link></Button>
              )}
            </div>
            {me.verifyReason && <p className="text-xs text-destructive">Alasan: {me.verifyReason}</p>}
            {me.verify === "terverifikasi" && age !== undefined && (
              <p className="text-xs text-muted-foreground">Umur {age} tahun · {age >= 21 ? "boleh bergabung dan menjadi ketua" : "boleh bergabung, belum bisa menjadi ketua (21+)"}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-4 text-sm">
        <h2 className="mb-3 text-sm">Profil</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="name">Nama tampilan</label>
            <Input id="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="wa">Nomor WhatsApp aktif</label>
            <Input id="wa" inputMode="numeric" placeholder="081234567890" maxLength={16} value={wa} onChange={(e) => setWa(e.target.value.replace(/[^\d+]/g, ""))} />
            <p className="mt-1 text-xs text-muted-foreground">Dipakai untuk notifikasi dan grup WA. Wajib sebelum bergabung ke grup (AKN-07). Disimpan dalam format 62.</p>
          </div>
          <Button className="w-full" onClick={() => run("profile.update", "Profil tersimpan", (d, u) => actions.updateProfile(d, u, { name, whatsapp: wa }))}>Simpan profil</Button>
        </div>
      </section>

      {me.role === "user" && (
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-2 text-sm">Riwayat transaksi & refund</h2>
          {txs.length === 0 && <p className="text-muted-foreground">Belum ada transaksi.</p>}
          <ul className="divide-y">
            {txs.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-2 py-2">
                <span>
                  {txKindLabel[t.kind]} · {getEvent(state, t.eventId)?.title}
                  <span className="block text-xs text-muted-foreground">{fmtDate(t.paidAt ?? t.createdAt)} · {t.gatewayRef}</span>
                </span>
                <span className="text-right">
                  <b className={t.kind === "refund" ? "text-success" : ""}>{t.kind === "refund" ? "+" : ""}{rupiah(t.amount)}</b>
                  <span className="block text-xs text-muted-foreground">{t.kind === "refund" && t.status === "pending" ? "Diproses admin" : txStatusLabel[t.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
