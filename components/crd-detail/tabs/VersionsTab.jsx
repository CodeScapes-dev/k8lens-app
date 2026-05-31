import { TableIcon } from "lucide-react";
import { KLBadge } from "@/components/kl/Badge";

export function VersionsTab({ crd }) {
  const versions = crd?.spec?.versions ?? [];
  if (versions.length === 0) return (
    <div className="flex flex-col items-center gap-2 py-16">
      <TableIcon size={28} style={{ color: "var(--kl-text-faint)" }} />
      <span style={{ fontSize: 13, color: "var(--kl-text-muted)" }}>No versions found</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {versions.map((v) => {
        const schema = v.schema?.openAPIV3Schema;
        const props = schema?.properties ? Object.entries(schema.properties).filter(([k]) => !["apiVersion", "kind", "metadata"].includes(k)) : [];
        const printerCols = v.additionalPrinterColumns ?? [];

        // import Panel inline to avoid circular dep
        return (
          <div key={v.name} style={{ background: "var(--kl-surface)", border: "1px solid var(--kl-border)", borderRadius: 12, padding: "16px" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="kl-mono font-semibold" style={{ fontSize: 14 }}>{v.name}</span>
              {v.served && <KLBadge tone="ok">Served</KLBadge>}
              {v.storage && <KLBadge tone="accent">Storage</KLBadge>}
              {v.deprecated && <KLBadge tone="warn">Deprecated</KLBadge>}
              {!v.served && !v.deprecated && <KLBadge tone="neutral">Not Served</KLBadge>}
            </div>
            {v.deprecationWarning && (
              <p style={{ fontSize: 12, color: "var(--kl-warn)", margin: "0 0 10px", padding: "6px 10px", background: "color-mix(in srgb, var(--kl-warn) 10%, transparent)", borderRadius: 6 }}>{v.deprecationWarning}</p>
            )}
            {props.length > 0 && (
              <div style={{ borderTop: "1px solid var(--kl-border)", paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: "var(--kl-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Schema Fields ({props.length})</div>
                <div className="flex flex-col">
                  {props.map(([fname, def]) => (
                    <div key={fname} className="flex items-start gap-2 py-1.5" style={{ borderTop: "1px solid var(--kl-border)", fontSize: 12 }}>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="kl-mono break-all">{fname}</span>
                        {def.description && <span style={{ fontSize: 11, color: "var(--kl-text-faint)" }}>{def.description}</span>}
                      </div>
                      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                        {def.type && <KLBadge tone="neutral">{def.type}</KLBadge>}
                        {schema?.required?.includes(fname) && <KLBadge tone="accent">required</KLBadge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {printerCols.length > 0 && (
              <div style={{ borderTop: "1px solid var(--kl-border)", paddingTop: 10, marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "var(--kl-text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Printer Columns</div>
                <div className="flex flex-col">
                  {printerCols.map((col, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--kl-border)", fontSize: 12 }}>
                      <span className="kl-mono font-medium flex-1">{col.name}</span>
                      <KLBadge tone="neutral">{col.type}</KLBadge>
                      <span className="kl-mono text-[11px]" style={{ color: "var(--kl-text-faint)" }}>{col.jsonPath}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
