export function StatGrid({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="rounded-2xl border bg-card p-3">
          <p className="text-[11px] text-muted-foreground">{s.label}</p>
          <p className="font-display text-lg text-primary">{s.value}</p>
          {s.hint && <p className="text-[11px] text-muted-foreground">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}
