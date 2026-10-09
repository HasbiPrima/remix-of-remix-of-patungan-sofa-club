import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { fmtDate } from "@/lib/rules";

export const Route = createFileRoute("/notifikasi")({
  head: () => ({
    meta: [
      { title: "Notifikasi — Sofamates" },
      { name: "description", content: "Kabar terbaru grup patungan, pembayaran, dan event kamu." },
      { property: "og:title", content: "Notifikasi — Sofamates" },
      { property: "og:description", content: "Kabar terbaru grup patungan kamu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotifPage,
});

function NotifPage() {
  const { state, me, run } = useApp();
  const list = state.notifs.filter((n) => n.userId === me.id);
  const unread = list.some((n) => !n.read);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">Notifikasi</h1>
        {unread && <Button size="sm" variant="secondary" onClick={() => run(null, "Semua ditandai dibaca", (d) => {
          d.notifs.forEach((n) => { if (n.userId === me.id) n.read = true; });
        })}>Tandai dibaca</Button>}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">Belum ada notifikasi.</p>}
      {list.map((n) => (
        <div key={n.id} className={`rounded-2xl border p-3 text-sm ${n.read ? "bg-card" : "border-primary bg-primary/10"}`}>
          <p>{n.text}</p>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{fmtDate(n.at)}</span>
            {n.link && <Link to={n.link} className="text-primary">Lihat</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}
