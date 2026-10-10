import { Checkbox } from "@/components/ui/checkbox";

/** PAY-02: S&K risiko ketua bayar seluruh DP. Isi final menunggu keputusan tim (PRD bagian 11). */
export function TermsCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-2 rounded-xl border p-3 text-xs text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>
        Saya setuju S&K: saya membayar seluruh DP sofa. Anggota yang bergabung tidak membayar DP, hanya pelunasan,
        dan penggantian DP ke saya diselesaikan di luar Sofamates (U8). Kalau ada slot yang tidak lunas dan tidak
        ditalangi sampai H-3 pukul 23.59 WIB, booking batal dan DP saya hangus ke collective.
      </span>
    </label>
  );
}
