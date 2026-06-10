// Shows the underlying API endpoint(s) and settings key(s) a section is built
// from, so a developer can see how to achieve the same thing directly.
export function SourceInfo({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="space-y-1 rounded-md border border-dashed bg-muted/40 p-2 text-xs">
      {items.map((it) => (
        <div key={it.label} className="flex gap-2">
          <span className="w-20 shrink-0 font-medium text-muted-foreground">{it.label}</span>
          <code className="break-all">{it.value}</code>
        </div>
      ))}
    </div>
  );
}
