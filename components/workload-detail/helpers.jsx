export function QuickStat({ label, value }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">{label}</span>
      <span className="font-mono text-sm font-bold leading-none">{value}</span>
    </div>
  );
}

export function replicaStatusColor(desired, ready) {
  if (desired === 0 || ready === desired) return "bg-green-500";
  if (ready === 0) return "bg-destructive";
  return "bg-yellow-500";
}
