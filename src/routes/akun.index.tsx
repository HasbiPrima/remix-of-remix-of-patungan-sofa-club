import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { actions, useApp } from "@/lib/store";
import { fmtDate, getEvent, getSofa, getUser, roleLabel, rupiah } from "@/lib/rules";

export const Route = createFileRoute("/akun/")({
  head: () => ({
    meta: [
      { title: "Akun Saya — Sofamates" },
      { name: "description", content: "Status verifikasi, kode referral, grup patungan, dan tiket kamu." },
      { property: "og:title", content: "Akun Saya — Sofamates" },
      { property: "og:description", content: "Kelola akun Sofamates kamu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

const verifyText = { belum: "Belum terverifikasi", menunggu: "Menunggu ditinjau admin", terverifikasi: "Terverifikasi", ditolak: "Ditolak" };

function AccountPage() {
  const { state, me, run } = useApp();
  const [code, setCode] = useState("");
  const [wa, setWa] = useState(me.whatsapp ?? "");
  const [ktpName, setKtpName] = useState(me.ktpName ?? "");
  const [ktpAddress, setKtpAddress] = useState(me.ktpAddress ?? "");
  const [gender, setGender] = useState<"pria" | "wanita" | "">(me.gender ?? "");
  const groups = state.groups.filter((g) => g.members.some((m) => m.userId === me.id));
  const tickets = state.tickets.filter((t) => t.userId === me.id);
  const invited = state.users.filter((u) => u.referredBy === me.id);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">{roleLabel[me.role]}</p>
        <h1 className="text-2xl">{me.name}</h1>
        <p className="text-sm text-muted-foreground">{me.phone}</p>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
          <span>Verifikasi: <b>{verifyText[me.verify]}</b></span>
          {(me.verify === "belum" || me.verify === "ditolak") && me.role !== "admin" && (
            <Button size="sm" asChild><Link to="/akun/verifikasi">Ajukan</Link></Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 text-sm">
        <h2 className="mb-1 text-sm">Data diri</h2>
        <p className="mb-3 text-xs text-muted-foreground">Isi sesuai KTP — dipakai untuk verifikasi akun.</p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="wa">Nomor WhatsApp</label>
            <Input id="wa" inputMode="numeric" placeholder="08xxxxxxxxxx" maxLength={14} value={wa} onChange={(e) => setWa(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="ktpName">Nama sesuai KTP</label>
            <Input id="ktpName" placeholder="Nama lengkap" maxLength={100} value={ktpName} onChange={(e) => setKtpName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="ktpAddress">Alamat sesuai KTP</label>
            <Textarea id="ktpAddress" placeholder="Alamat lengkap" maxLength={300} rows={3} value={ktpAddress} onChange={(e) => setKtpAddress(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground" htmlFor="gender">Jenis kelamin</label>
            <Select value={gender} onValueChange={(v) => setGender(v as "pria" | "wanita")}>
              <SelectTrigger id="gender"><SelectValue placeholder="Pilih jenis kelamin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pria">Pria</SelectItem>
                <SelectItem value="wanita">Wanita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() => run("profile.update", "Data diri tersimpan", (d, u) => actions.updateProfile(d, u, { whatsapp: wa, ktpName, ktpAddress, gender }))}
          >
            Simpan data diri
          </Button>
        </div>
      </section>

      {me.role === "user" && (
        <section className="rounded-2xl border bg-card p-4 text-sm">
          <h2 className="mb-2 text-sm">Referral</h2>
          <p>Kode kamu: <b className="font-display text-primary">{me.referralCode}</b> · {invited.length} teman bergabung</p>
          {me.referredBy ? (
            <p className="mt-2 text-muted-foreground">Kamu bergabung lewat kode {getUser(state, me.referredBy)?.referralCode}.</p>
          ) : (
            <div className="mt-3 flex gap-2">
              <Input placeholder="Kode referral teman" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
              <Button disabled={!code.trim()} onClick={() => run("referral.apply", "Kode referral dipakai", (d, u) => actions.applyReferral(d, u, code)) && setCode("")}>Pakai</Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Kode teman hanya bisa dipakai sekali, sebelum transaksi pertama.</p>
        </section>
      )}

      {me.role === "user" && (
        <section>
          <h2 className="mb-2 text-sm">Grup saya</h2>
          {groups.length === 0 && <p className="text-sm text-muted-foreground">Belum ikut grup. <Link to="/" className="text-primary">Cari event</Link></p>}
          <div className="space-y-2">
            {groups.map((g) => (
              <Link key={g.id} to="/grup/$id" params={{ id: g.id }} className="flex items-center justify-between rounded-2xl border bg-card p-3 text-sm">
                <span>{getSofa(state, g.sofaId)?.name}<span className="block text-xs text-muted-foreground">{getEvent(state, g.eventId)?.title}</span></span>
                <StatusBadge status={g.status} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {tickets.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm">Tiket saya</h2>
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="rounded-2xl border bg-card p-3 text-sm">
                <p className="font-semibold">{getEvent(state, t.eventId)?.title} · {t.pax} orang</p>
                <p className="text-xs text-muted-foreground">{t.code} · {rupiah(t.price)} · {fmtDate(t.at)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
