import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/rules";
import { cn } from "@/lib/utils";
import { Armchair } from "lucide-react";

const methods = ["QRIS", "Virtual Account BCA", "GoPay", "OVO"];

export function PaymentDialog({
  open, onOpenChange, title, amount, onPaid, sofaSelection,
}: { open: boolean; onOpenChange: (o: boolean) => void; title: string; amount: number; onPaid: () => void; sofaSelection?: { name: string; slots: number[] } | undefined }) {
  const [method, setMethod] = useState(methods[0]);
  const [loading, setLoading] = useState(false);
  const pay = (ok: boolean) => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (ok) { onPaid(); onOpenChange(false); } else toast.error("Pembayaran gagal (simulasi). Coba lagi.");
    }, 700);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Pembayaran</DialogTitle>
          <DialogDescription>{title} · simulasi, tidak ada uang sungguhan.</DialogDescription>
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
        <Button disabled={loading} variant="ghost" size="sm" onClick={() => pay(false)}>Simulasikan gagal</Button>
      </DialogContent>
    </Dialog>
  );
}
