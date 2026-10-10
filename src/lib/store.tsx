import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { makeSeed } from "./seed";
import { can, type Action } from "./rules";
import type { AppState, User } from "./types";
import * as domain from "./domain";

const KEY = "sofamates-state-v3"; // v3: event dipindah ke November

type Draft = AppState;
type Ctx = {
  state: AppState;
  me: User;
  run: (action: Action | null, label: string, fn: (d: Draft, me: User) => string | void) => boolean;
  check: (action: Action) => boolean;
  reset: () => void;
  /** Ganti akun demo untuk tab ini saja. */
  switchUser: (id: string) => void;
};

// Keep one context instance across hot reloads so provider & consumers always match.
const g = globalThis as unknown as { __sofamatesCtx?: React.Context<Ctx | null> };
const AppCtx = g.__sofamatesCtx ?? (g.__sofamatesCtx = createContext<Ctx | null>(null));

export const { notify, log, runScheduler } = domain;

/** Akun yang sedang dipakai disimpan per tab, supaya tab host dan tab user tidak saling mengganti akun. */
const USER_KEY = "sofamates-current-user";

function readStored(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as AppState) : null;
    return parsed?.version === 2 ? parsed : null;
  } catch { return null; }
}
function writeStored(s: AppState) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage penuh/diblokir */ }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => makeSeed());
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStored();
    if (stored) setState(stored);
    else writeStored(state);
    try { setMeId(sessionStorage.getItem(USER_KEY)); } catch { /* ignore */ }
    // Tab lain (peran lain) mengubah data: ikut perbarui tampilan tab ini.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY && e.key !== null) return;
      const s = readStored();
      if (s) setState(s);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya saat mount
  }, []);

  const me = state.users.find((u) => u.id === (meId ?? state.currentUserId)) ?? state.users[0]!;

  const check = useCallback((action: Action) => {
    const err = can(me, action);
    if (err) toast.error(err);
    return !err;
  }, [me]);

  const run = useCallback<Ctx["run"]>((action, label, fn) => {
    // Mulai dari data tersimpan terbaru, supaya perubahan dari tab lain tidak tertimpa.
    const d: Draft = structuredClone(readStored() ?? state);
    const user = d.users.find((u) => u.id === me.id) ?? me;
    if (action) {
      const err = can(user, action);
      if (err) { toast.error(err); setState(d); return false; }
    }
    const err = fn(d, user);
    if (domain.isErr(err)) { toast.error(err); return false; }
    if (action) domain.log(d, user.id, action, label);
    writeStored(d);
    setState(d);
    toast.success(label);
    return true;
  }, [me, state]);

  const switchUser = useCallback((id: string) => {
    setMeId(id);
    try { sessionStorage.setItem(USER_KEY, id); } catch { /* ignore */ }
    toast.success(`Masuk sebagai ${state.users.find((u) => u.id === id)?.name}`);
  }, [state.users]);

  const reset = useCallback(() => {
    const s = makeSeed();
    writeStored(s);
    setState(s);
    toast.success("Data demo direset");
  }, []);

  const value = useMemo(() => ({ state, me, run, check, reset, switchUser }), [state, me, run, check, reset, switchUser]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

/** Domain actions (pure on draft). Return string error message, an id on create, or undefined. */
export const actions = domain;
