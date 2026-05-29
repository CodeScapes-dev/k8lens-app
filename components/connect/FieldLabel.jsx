export function FieldLabel({ children, hint }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between">
      <span className="kl-mono text-[10.5px] font-medium tracking-[1.4px] text-muted-foreground uppercase">
        {children}
      </span>
      {hint && <span className="kl-mono text-[10px] text-muted-foreground/50">{hint}</span>}
    </div>
  );
}
