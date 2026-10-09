import { useState } from "react";
import { Wrench } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { runScheduler, useApp } from "@/lib/store";
import { fmtDate } from "@/lib/rules";

export function DevPanel() {
  const { state, run, reset } = useApp();
  const [date, setDate] = useState("");
  const advance = (ms: number, label: string) =>
    run(null, label, (d) => {
      d.now += ms;
      if (d.autoScheduler) runScheduler(d);
    });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button aria-label="Panel dev" className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg md:bottom-6">
          <Wrench className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle className="font-display">Panel Dev</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-5 px-4 pb-8 text-sm">
          <div className="rounded-xl bg-muted p-3">
            <p className="text-xs text-muted-foreground">Waktu simulasi</p>
            <p className="font-semibold">{fmtDate(state.now)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => advance(3600_000, "Maju 1 jam")}>+1 jam</Button>
            <Button variant="secondary" onClick={() => advance(86400_000, "Maju 1 hari")}>+1 hari</Button>
            <Button variant="secondary" onClick={() => advance(3 * 86400_000, "Maju 3 hari")}>+3 hari</Button>
            <Button variant="secondary" onClick={() => advance(7 * 86400_000, "Maju 7 hari")}>+7 hari</Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Lompat ke tanggal (00.00 WIB)</p>
            <div className="flex gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button disabled={!date} onClick={() => {
                const [y = 0, m = 1, dd = 1] = date.split("-").map(Number);
                const target = Date.UTC(y, m - 1, dd, -7, 0);
                run(null, `Waktu diatur ke ${date}`, (d) => {
                  if (target < d.now) return "Waktu tidak bisa mundur.";
                  d.now = target;
                  if (d.autoScheduler) runScheduler(d);
                });
              }}>Set</Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <span>Jalankan penjadwal otomatis saat waktu maju</span>
            <Switch checked={state.autoScheduler} onCheckedChange={(v) => run(null, v ? "Penjadwal otomatis aktif" : "Penjadwal otomatis nonaktif", (d) => { d.autoScheduler = v; })} />
          </div>
          <Button className="w-full" onClick={() => {
            let n = 0;
            run(null, "Penjadwal dijalankan", (d) => { n = runScheduler(d); });
            setTimeout(() => console.info(`scheduler changes: ${n}`), 0);
          }}>Jalankan penjadwal sekarang</Button>
          <p className="text-xs text-muted-foreground">Penjadwal mengecek batas H-14 (DP), H-7 (pelunasan), H-3 (vote minuman) pukul 23.59 WIB, serta menandai grup selesai setelah event.</p>
          <Button variant="destructive" className="w-full" onClick={reset}>Reset data demo</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
