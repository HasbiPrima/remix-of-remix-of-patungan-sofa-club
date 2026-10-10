import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/lib/store";
import { roleLabel } from "@/lib/rules";
import type { Role } from "@/lib/types";

const roles: Role[] = ["user", "host_collective", "host_venue", "admin"];

/** Ganti akun demo (pengganti login sampai metode login diputuskan). */
export function AccountSwitcher({ className }: { className?: string }) {
  const { state, me, switchUser } = useApp();
  return (
    <Select value={me.id} onValueChange={switchUser}>
      <SelectTrigger className={className} aria-label="Ganti akun demo"><SelectValue /></SelectTrigger>
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
  );
}
