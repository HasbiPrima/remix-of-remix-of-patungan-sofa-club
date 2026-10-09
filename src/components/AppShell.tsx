import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Building2, CalendarHeart, Shield, User as UserIcon } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/store";
import { fmtDate, roleLabel } from "@/lib/rules";
import type { Role } from "@/lib/types";
import { DevPanel } from "./DevPanel";

export function AppShell({ children }: { children: ReactNode }) {
  const { state, me, run } = useApp();
  const unread = state.notifs.filter((n) => n.userId === me.id && !n.read).length;
  const roles: Role[] = ["user", "host_collective", "host_venue", "admin"];

  const nav = [
    { to: "/", label: "Event", icon: CalendarHeart, show: true },
    { to: "/host", label: "Host", icon: Building2, show: me.role === "host_collective" || me.role === "host_venue" },
    { to: "/admin", label: "Admin", icon: Shield, show: me.role === "admin" },
    { to: "/notifikasi", label: "Notif", icon: Bell, show: true, badge: unread },
    { to: "/akun", label: "Akun", icon: UserIcon, show: true },
  ] as const;

  return (
    <div className="min-h-screen bg-glow pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="font-display text-lg">sofa<span className="text-primary">mates</span></Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(state.now)}</span>
          <div className="ml-auto w-44">
            <Select value={me.id} onValueChange={(v) => run(null, `Masuk sebagai ${state.users.find((u) => u.id === v)?.name}`, (d) => { d.currentUserId = v; })}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectGroup key={r}>
                    <SelectLabel>{roleLabel[r]}</SelectLabel>
                    {state.users.filter((u) => u.role === r).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-2 text-[11px] text-muted-foreground sm:hidden">
          Demo · {roleLabel[me.role]} · {fmtDate(state.now)}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur md:static md:mx-auto md:mt-6 md:max-w-3xl md:rounded-2xl md:border">
        <div className="mx-auto flex max-w-3xl justify-around py-2">
          {nav.filter((n) => n.show).map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/" }}
              className="relative flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] text-muted-foreground"
              activeProps={{ className: "text-primary" }}>
              <n.icon className="h-5 w-5" />
              {n.label}
              {"badge" in n && n.badge > 0 && (
                <span className="absolute -top-0.5 right-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">{n.badge}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
      <DevPanel />
    </div>
  );
}
