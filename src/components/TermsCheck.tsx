import { Checkbox } from "@/components/ui/checkbox";

export function TermsCheck({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex gap-2 rounded-xl border p-3 text-xs text-muted-foreground">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>
        Saya setuju S&K: sebagai ketua saya membayar DP untuk seluruh slot. Slot kosong tetap menjadi tanggungan saya.
        Jika pelunasan tidak lengkap hingga H-7 23.59 WIB, grup batal dan DP hangus. Jika DP tidak penuh hingga H-14, DP dikembalikan.
      </span>
    </label>
  );
}
