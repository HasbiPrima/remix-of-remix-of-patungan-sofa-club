import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Sofa as SofaIcon } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { useApp } from "@/lib/store";
import { eventEnd, fmtEventDate, getVenue, rupiah } from "@/lib/rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sofamates — Patungan Sofa Club di Jogja" },
      { name: "description", content: "Cari event collective di club DIY, patungan sofa bareng teman, atau beli tiket 1, 2, dan 5 orang." },
      { property: "og:title", content: "Sofamates — Patungan Sofa Club di Jogja" },
      { property: "og:description", content: "Patungan sofa dan tiket event collective di club wilayah DIY." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const areas = ["Semua", "Sleman", "Kota Yogyakarta", "Bantul", "Kulon Progo", "Gunungkidul"];

function Home() {
  const { state } = useApp();
  const [area, setArea] = useState("Semua");
  const events = state.events
    .filter((e) => area === "Semua" || getVenue(state, e.venueId)?.area === area)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl">
        <img src={hero} alt="Sofa club dengan lampu neon" width={1280} height={720} className="h-64 w-full object-cover sm:h-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 p-5">
          <span className="tag bg-primary text-primary-foreground">DIY · Jogja</span>
          <h1 className="mt-2 text-2xl leading-tight sm:text-4xl">Patungan sofa,<br />pesta tetap <span className="text-primary">mewah</span>.</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">Bagi rata harga sofa per slot, bayar DP dulu, lunasi belakangan.</p>
        </div>
      </section>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {areas.map((a) => (
          <button key={a} onClick={() => setArea(a)}
            className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", area === a ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {a}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {events.length === 0 && <p className="text-sm text-muted-foreground">Belum ada event di area ini.</p>}
        {events.map((e) => {
          const v = getVenue(state, e.venueId);
          const sofas = state.sofas.filter((s) => s.venueId === e.venueId && s.active);
          const taken = state.groups.filter((g) => g.eventId === e.id && g.status !== "BATAL").length;
          const past = state.now > eventEnd(e);
          return (
            <Link key={e.id} to="/event/$id" params={{ id: e.id }}
              className="block rounded-2xl border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-accent">{e.collective}</p>
                  <h2 className="mt-0.5 text-base">{e.title}</h2>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{v?.name} · {v?.area}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="font-semibold">{fmtEventDate(e.date)}</p>
                  {e.cancelled ? <span className="tag mt-1 bg-destructive/15 text-destructive">Batal</span>
                    : past ? <span className="tag mt-1 bg-muted text-muted-foreground">Lewat</span> : null}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><SofaIcon className="h-3.5 w-3.5" />{sofas.length - taken} dari {sofas.length} sofa tersedia</span>
                <span>Tiket mulai <b className="text-foreground">{rupiah(e.tickets.p1)}</b></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
