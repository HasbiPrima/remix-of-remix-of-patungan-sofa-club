import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Camera, IdCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { actions, useApp } from "@/lib/store";

export const Route = createFileRoute("/akun/verifikasi")({
  head: () => ({
    meta: [
      { title: "Verifikasi KTP & Wajah — Sofamates" },
      { name: "description", content: "Unggah foto KTP dan foto wajah untuk verifikasi akun Sofamates." },
      { property: "og:title", content: "Verifikasi KTP & Wajah — Sofamates" },
      { property: "og:description", content: "Unggah foto KTP dan foto wajah untuk verifikasi akun Sofamates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

function readImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.size > 2_000_000) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function UploadBox({ label, hint, icon, value, onChange }: {
  label: string;
  hint: string;
  icon: React.ReactNode;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          onChange(file ? await readImage(file) : null);
        }}
      />
      {value ? (
        <img src={value} alt={label} className="h-44 w-full rounded-2xl border object-cover" />
      ) : (
        <span className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-muted/50 text-muted-foreground">
          {icon}
          <span className="px-4 text-center text-xs">{hint}</span>
        </span>
      )}
    </label>
  );
}

function VerifyPage() {
  const { me, run } = useApp();
  const navigate = useNavigate();
  const [ktp, setKtp] = useState<string | null>(me.ktpImage ?? null);
  const [selfie, setSelfie] = useState<string | null>(me.selfieImage ?? null);

  if (me.verify === "terverifikasi" || me.verify === "menunggu") {
    return (
      <div className="space-y-4 rounded-3xl border bg-card p-6 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="text-xl">
          {me.verify === "terverifikasi" ? "Akunmu sudah terverifikasi" : "Pengajuanmu sedang ditinjau admin"}
        </h1>
        <Button variant="outline" asChild><Link to="/akun">Kembali ke akun</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild><Link to="/akun"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <h1 className="text-2xl">Verifikasi KTP & Wajah</h1>
      </div>

      <section className="space-y-4 rounded-3xl border bg-card p-5">
        <UploadBox
          label="Foto KTP"
          hint="Ketuk untuk unggah foto KTP yang jelas dan tidak terpotong (maks 2 MB)."
          icon={<IdCard className="h-8 w-8" />}
          value={ktp}
          onChange={setKtp}
        />
        <UploadBox
          label="Foto wajah (selfie)"
          hint="Ketuk untuk unggah selfie wajah tanpa kacamata hitam atau masker (maks 2 MB)."
          icon={<Camera className="h-8 w-8" />}
          value={selfie}
          onChange={setSelfie}
        />
        <p className="text-xs text-muted-foreground">
          Foto hanya dipakai untuk verifikasi dan ditinjau oleh admin. Ini masih demo — foto tersimpan di perangkatmu saja.
        </p>
        <Button
          className="w-full"
          disabled={!ktp || !selfie}
          onClick={() =>
            run("verify.request", "Pengajuan verifikasi dikirim", (d, u) => actions.requestVerify(d, u, ktp!, selfie!)) &&
            navigate({ to: "/akun" })
          }
        >
          Kirim pengajuan verifikasi
        </Button>
      </section>
    </div>
  );
}
