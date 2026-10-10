import type { ReactNode } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { Bell, Building2, CalendarHeart, ChevronLeft, FilePlus2, PartyPopper, Shield, User as UserIcon, Wrench } from "lucide-react";
import { useApp } from "@/lib/store";
import { fmtDate, roleLabel } from "@/lib/rules";
import { AccountSwitcher } from "./AccountSwitcher";
import { DevPanel } from "./DevPanel";

/** Halaman menu utama; halaman lain (detail) mendapat tombol kembali di header HP. */
const topLevel = new Set(["/", "/pengajuan", "/parties", "/host", "/admin", "/notifikasi", "/akun"]);

export function AppShell({ children }: { children: ReactNode }) {
  const { state, me } = useApp();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDetail = !topLevel.has(pathname.replace(/\/$/, "") || "/");
  const unread = state.notifs.filter((n) => n.userId === me.id && !n.read).length;
  const initials = (me.name.split(" (")[0] ?? me.name).split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const nav = [
    { to: "/", label: "Home", icon: CalendarHeart, show: true },
    { to: "/pengajuan", label: "Ajukan", icon: FilePlus2, show: me.role === "user" },
    { to: "/parties", label: "Parties", icon: PartyPopper, show: me.role === "user" },
    { to: "/host", label: "Host", icon: Building2, show: me.role === "host_collective" || me.role === "host_venue" },
    { to: "/admin", label: "Admin", icon: Shield, show: me.role === "admin" },
    { to: "/notifikasi", label: "Notif", icon: Bell, show: true, badge: unread },
    { to: "/akun", label: "Akun", icon: UserIcon, show: true },
  ] as const;

  const goBack = () => {
    if (window.history.length > 1) router.history.back();
    else router.navigate({ to: "/" });
  };

  return (
    <div className="relative isolate min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      {/* Latar berwarna yang diam di belakang semua kaca. */}
      <div aria-hidden="true" className="bg-mesh pointer-events-none fixed inset-0 -z-10" />
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/55 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgb(0_0_0/0.04)] backdrop-blur-2xl backdrop-saturate-[1.8]">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          {isDetail && (
            <button onClick={goBack} aria-label="Kembali" className="-ml-3 flex h-11 items-center justify-center pr-1 text-primary md:hidden">
              <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
            </button>
          )}
          <Link to="/" className="font-display text-xl">sofa<span className="text-primary">mates</span></Link>
          <span className="hidden text-xs text-muted-foreground md:inline">{fmtDate(state.now)}</span>

          {/* HP: satu tombol akun membuka panel demo (ganti akun & waktu). */}
          <DevPanel trigger={
            <button aria-label={`Akun demo: ${me.name}. Buka panel demo`} className="glass ml-auto flex h-11 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs md:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">{initials}</span>
              <span className="max-w-[7rem] truncate text-left leading-tight">{me.name.split(" (")[0]}<span className="block text-[10px] font-normal text-muted-foreground">{roleLabel[me.role]}</span></span>
            </button>
          } />

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <AccountSwitcher className="h-9 w-48 text-xs" />
            <DevPanel trigger={
              <button aria-label="Panel dev" className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                <Wrench className="h-4 w-4" />
              </button>
            } />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 md:py-5">{children}</main>

      {/* Tab bar kapsul melayang ala iOS 26/27 (Liquid Glass). */}
      <nav aria-label="Menu utama" className="glass fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 rounded-full md:sticky md:inset-x-auto md:bottom-4 md:mx-auto md:mt-6 md:max-w-xl">
        <div className="mx-auto flex h-16 items-stretch px-1.5 py-1.5">
          {nav.filter((n) => n.show).map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium text-foreground/80 transition-colors data-[status=active]:bg-black/[0.06] data-[status=active]:font-semibold data-[status=active]:text-primary">
              <span className="relative flex h-6 items-center justify-center">
                <n.icon className="h-5 w-5" />
                {"badge" in n && n.badge > 0 && (
                  <span className="absolute -right-3 -top-1 min-w-[18px] rounded-full bg-[#ff3b30] px-1 text-center text-[11px] font-semibold leading-[18px] text-white">{n.badge}</span>
                )}
              </span>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
