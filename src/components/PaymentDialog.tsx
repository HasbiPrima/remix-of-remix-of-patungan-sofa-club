import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDate, rupiah, type Action } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { Armchair } from "lucide-react";
import { actions, useApp } from "@/lib/store";
import type { AppState, User } from "@/lib/types";

const methods = ["QRIS", "Virtual Account BCA", "GoPay", "OVO"];

export function PaymentDialog({
  open, onOpenChange, title, amount, onPaid, onFailed, sofaSelection, holdUntil,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; amount: number; onPaid: () => void; onFailed?: () => void;
  sofaSelection?: { name: string; slots: number[] } | undefined; holdUntil?: number | undefined;
}) {
  const [method, setMethod] = useState(methods[0]);
  const [loading, setLoading] = useState(false);
  const pay = (ok: boolean) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (ok) onPaid(); else onFailed?.();
      onOpenChange(false);
    }, 700);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Pembayaran</DialogTitle>
          <DialogDescription>{title} · simulasi payment gateway, tidak ada uang sungguhan.</DialogDescription>
        </DialogHeader>
        {sofaSelection && (
          <div className="flex items-center gap-3 rounded-lg border border-primary p-3">
            <Armchair className="h-8 w-8 text-primary" />
            <div><p className="text-sm font-semibold">{sofaSelection.name}</p><p className="text-xs text-primary">Slot {sofaSelection.slots.join(", ")} · {sofaSelection.slots.length} slot pilihanmu</p></div>
          </div>
        )}
        <div className="rounded-xl bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground">Total bayar</p>
          <p className="font-display text-2xl text-primary">{rupiah(amount)}</p>
          {holdUntil && <p className="mt-1 text-xs text-muted-foreground">Slot ditahan sampai {fmtDate(holdUntil)} (30 menit)</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {methods.map((m) => (
            <Button key={m} variant="outline" onClick={() => setMethod(m)}
              className={cn("h-auto whitespace-normal rounded-lg border p-2 text-sm transition", method === m ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
              {m}
            </Button>
          ))}
        </div>
        <Button disabled={loading} onClick={() => pay(true)} className="w-full">{loading ? "Memproses…" : `Bayar via ${method}`}</Button>
        {onFailed && <Button disabled={loading} variant="ghost" size="sm" onClick={() => pay(false)}>Simulasikan gagal</Button>}
      </DialogContent>
    </Dialog>
  );
}

type PayMeta = { title: string; sofaSelection?: { name: string; slots: number[] } | undefined };

/**
 * Alur bayar: aksi membuat transaksi pending (dan menahan slot), lalu dialog ini
 * mensimulasikan webhook payment gateway yang mengubah status (PAY-05).
 */
export function usePayment() {
  const { state, run } = useApp();
  const [p, setP] = useState<({ txId: string } & PayMeta) | null>(null);
  const tx = p ? state.txs.find((t) => t.id === p.txId) : undefined;
  const hold = tx?.groupId
    ? state.groups.find((g) => g.id === tx.groupId)?.members.find((m) => m.userId === tx.memberUserId && m.pay === "menunggu")?.holdUntil
    : undefined;

  /** Jalankan aksi; kalau hasilnya id transaksi, buka dialog bayar. */
  const start = (action: Action, label: string, fn: (d: AppState, me: User) => string | void, meta: PayMeta) => {
    let txId = "";
    const ok = run(action, label, (d, u) => {
      const r = fn(d, u);
      if (typeof r === "string" && /^tx\d+$/.test(r)) txId = r;
      return r;
    });
    if (ok && txId) setP({ txId, ...meta });
    return ok;
  };
  const resume = (txId: string, meta: PayMeta) => setP({ txId, ...meta });

  const dialog: ReactNode = (
    <PaymentDialog open={!!p && tx?.status === "pending"} onOpenChange={(o) => !o && setP(null)}
      title={p?.title ?? ""} amount={tx?.amount ?? 0} sofaSelection={p?.sofaSelection} holdUntil={hold}
      onPaid={() => p && run(null, "Pembayaran berhasil dikonfirmasi", (d) => actions.settle(d, p.txId, true))}
      onFailed={() => p && run(null, "Pembayaran gagal. Slot dilepas, boleh coba lagi.", (d) => actions.settle(d, p.txId, false))} />
  );
  return { start, resume, dialog };
}
