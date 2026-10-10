import type { ReactNode } from "react";

/**
 * Tombol aksi utama halaman. Di HP melayang sebagai panel kaca tepat di atas tab bar supaya selalu
 * terjangkau jempol; di layar lebar tampil biasa di dalam alur halaman.
 */
export function MobileActionBar({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="h-24 md:hidden" />
      <div className="glass fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 rounded-[1.75rem] p-2 md:static md:z-auto md:rounded-none md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
        <div className="mx-auto max-w-3xl space-y-1">
          {children}
          {hint && <p className="pb-0.5 text-center text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
    </>
  );
}
