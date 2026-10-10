import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, MapPin, Sofa as SofaIcon } from "lucide-react";
import { useApp } from "@/lib/store";
import { eventEnd, getCollective, getVenue, rupiah } from "@/lib/rules";
import { cn } from "@/lib/utils";

/** Warna kartu poster bergantian, dipakai bila event belum punya poster. */
const ART = [
  "linear-gradient(135deg, #5e5ce6 0%, #bf5af2 55%, #ff375f 100%)",
  "linear-gradient(135deg, #0a84ff 0%, #64d2ff 100%)",
  "linear-gradient(135deg, #ff9f0a 0%, #ff375f 100%)",
  "linear-gradient(135deg, #30d158 0%, #0a84ff 100%)",
  "linear-gradient(135deg, #1c1c1e 0%, #5e5ce6 100%)",
];
const AUTOPLAY_MS = 5000;

/**
 * Carousel 3D (coverflow) event mendatang: kartu tengah besar, kartu samping mengecil dan miring.
 * Geser di HP, panah di layar lebar, ketuk kartu samping untuk memajukannya.
 */
export function EventCarousel() {
  const { state } = useApp();
  const events = state.events
    .filter((e) => e.status === "terbit" && state.now <= eventEnd(e))
    .sort((a, b) => a.date.localeCompare(b.date));
  const n = events.length;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const drag = useRef<{ x: number; dx: number } | null>(null);
  const swiped = useRef(false);

  const go = (step: number) => setActive((i) => (i + step + n) % n);

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setActive((i) => (i + 1) % n), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  if (n === 0) return null;
  const current = Math.min(active, n - 1);

  return (
    <section aria-roledescription="carousel" aria-label="Event mendatang" className="relative -mx-4 select-none"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onKeyDown={(ev) => { if (ev.key === "ArrowLeft") go(-1); if (ev.key === "ArrowRight") go(1); }}>
      <div className="relative h-[27rem] touch-pan-y overflow-hidden [perspective:1200px] [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] sm:h-[29rem]"
        onPointerDown={(ev) => { drag.current = { x: ev.clientX, dx: 0 }; setPaused(true); }}
        onPointerMove={(ev) => { if (drag.current) drag.current.dx = ev.clientX - drag.current.x; }}
        onPointerUp={() => {
          const dx = drag.current?.dx ?? 0;
          drag.current = null;
          swiped.current = Math.abs(dx) > 10;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        }}
        // Geseran tidak boleh ikut membuka event di bawah jari.
        onClickCapture={(ev) => { if (swiped.current) { ev.preventDefault(); ev.stopPropagation(); swiped.current = false; } }}
        onPointerCancel={() => { drag.current = null; }}>
        {events.map((e, i) => {
          // Jarak melingkar dari kartu aktif: -2..2 terlihat, sisanya disembunyikan.
          let off = i - current;
          if (off > n / 2) off -= n;
          if (off < -n / 2) off += n;
          const abs = Math.abs(off);
          const style: CSSProperties = {
            transform: `translateX(calc(-50% + ${off * 72}%)) scale(${abs === 0 ? 1 : abs === 1 ? 0.8 : 0.64}) rotateY(${off === 0 ? 0 : off < 0 ? 16 : -16}deg)`,
            opacity: abs === 0 ? 1 : abs === 1 ? 0.75 : abs === 2 ? 0.3 : 0,
            zIndex: 10 - abs,
            pointerEvents: abs > 1 ? "none" : undefined,
          };
          return (
            <Card key={e.id} eventId={e.id} index={i} isActive={off === 0} style={style}
              onFocusSide={() => setActive(i)} />
          );
        })}
      </div>

      {n > 1 && (
        <>
          <button aria-label="Event sebelumnya" onClick={() => go(-1)}
            className="absolute left-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgb(0_0_0/0.12)] transition active:scale-95 sm:flex">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button aria-label="Event berikutnya" onClick={() => go(1)}
            className="absolute right-4 top-1/2 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgb(0_0_0/0.12)] transition active:scale-95 sm:flex">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="mt-1 flex justify-center gap-1.5">
            {events.map((e, i) => (
              <button key={e.id} aria-label={`Event ${i + 1}`} aria-current={i === current} onClick={() => setActive(i)}
                className={cn("h-2 rounded-full transition-all", i === current ? "w-5 bg-foreground" : "w-2 bg-foreground/20")} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Card({ eventId, index, isActive, style, onFocusSide }: {
  eventId: string; index: number; isActive: boolean; style: CSSProperties; onFocusSide: () => void;
}) {
  const { state } = useApp();
  const e = state.events.find((x) => x.id === eventId)!;
  const v = getVenue(state, e.venueId);
  const sofas = state.sofas.filter((s) => s.eventId === e.id);
  const taken = state.groups.filter((g) => g.eventId === e.id && g.kind === "sofa" && g.status !== "BATAL").length;
  const free = sofas.length - taken;
  const minTicket = Math.min(...e.tickets.map((t) => t.price / t.pax));
  const d = new Date(`${e.date}T00:00:00+07:00`);
  const day = d.toLocaleDateString("id-ID", { day: "2-digit", timeZone: "Asia/Jakarta" });
  const month = d.toLocaleDateString("id-ID", { month: "short", timeZone: "Asia/Jakarta" }).replace(".", "");
  const weekday = d.toLocaleDateString("id-ID", { weekday: "long", timeZone: "Asia/Jakarta" });

  return (
    <article aria-hidden={!isActive} style={style}
      onClick={(ev) => { if (!isActive) { ev.preventDefault(); onFocusSide(); } }}
      className={cn("absolute left-1/2 top-3 flex h-[25rem] w-[74%] max-w-[19rem] flex-col rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_50px_rgb(31_38_135/0.14)] backdrop-blur-xl transition-[transform,opacity] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none sm:h-[27rem] sm:p-5",
        !isActive && "cursor-pointer")}>
      <div className="relative flex h-36 shrink-0 flex-col justify-between overflow-hidden rounded-[1.4rem] p-4 text-white sm:h-40"
        style={{ background: e.poster ? `center/cover url(${e.poster})` : ART[index % ART.length] }}>
        <span className="w-fit rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">{getCollective(state, e.collectiveId)?.name}</span>
        <div className="leading-none">
          <span className="font-display text-5xl">{day}</span>
          <span className="ml-1.5 text-lg font-semibold uppercase">{month}</span>
          <p className="mt-1 text-xs capitalize opacity-90">{weekday} · {e.time} WIB</p>
        </div>
        <SofaIcon aria-hidden className="absolute -bottom-4 -right-3 h-28 w-28 opacity-20" />
      </div>

      <h3 className="mt-4 line-clamp-2 text-lg leading-snug">{e.title}</h3>
      <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{v?.name} · {v?.area}</p>
      <p className={cn("mt-1.5 flex items-center gap-1.5 text-xs font-medium", free > 0 ? "text-success" : "text-destructive")}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {free > 0 ? `${free} dari ${sofas.length} sofa masih tersedia` : "Semua sofa sudah punya grup"}
      </p>

      <div className="mt-auto">
        {Number.isFinite(minTicket) && (
          <p className="text-xs text-muted-foreground">Tiket mulai <b className="block font-display text-2xl text-foreground">{rupiah(Math.ceil(minTicket / 1000) * 1000)}</b></p>
        )}
        <Link to="/event/$id" params={{ id: e.id }} tabIndex={isActive ? 0 : -1}
          className={cn("mt-3 flex h-12 items-center justify-center rounded-full text-sm font-semibold transition active:scale-[0.98]",
            isActive ? "bg-foreground text-background" : "bg-foreground/50 text-background")}>
          Lihat event
        </Link>
      </div>
    </article>
  );
}
