import React from "react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

export function OverviewTab({ crd }) {
  if (!crd) return null;
  const meta = crd.metadata ?? {};
  const spec = crd.spec ?? {};
  const status = crd.status ?? {};
  const versions = spec.versions ?? [];
  const storedVersion = versions.find((v) => v.storage);
  const conditions = status.conditions ?? [];
  const established = conditions.find((c) => c.type === "Established");
  const conversion = spec.conversion ?? null;
  const storedSchema = storedVersion?.schema?.openAPIV3Schema ?? null;
  const topLevelProps = storedSchema?.properties ? Object.entries(storedSchema.properties).filter(([k]) => !["apiVersion", "kind", "metadata"].includes(k)) : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-start">
      <div className="flex flex-col gap-4">
        <Panel title="CRD Info">
          <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(100px,160px) 1fr", fontSize: 12 }}>
            {[["Group", spec.group], ["Kind", spec.names?.kind], ["List Kind", spec.names?.listKind], ["Plural", spec.names?.plural], ["Singular", spec.names?.singular], ["Scope", spec.scope], ["Stored Version", storedVersion?.name ?? "—"], ["Created", meta.creationTimestamp ? calculateAge(meta.creationTimestamp) + " ago" : "—"]].map(([l, v]) => (
              <React.Fragment key={l}>
                <span style={{ color: "var(--kl-text-muted)" }}>{l}</span>
                <span className="kl-mono break-all" style={{ color: "var(--kl-text)" }}>{v ?? "—"}</span>
              </React.Fragment>
            ))}
          </div>
          {spec.names?.shortNames?.length > 0 && (
            <div className="mt-3 flex gap-2 flex-wrap items-center" style={{ borderTop: "1px solid var(--kl-border)", paddingTop: 10 }}>
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>Short names:</span>
              {spec.names.shortNames.map((sn) => <KLBadge key={sn} tone="neutral">{sn}</KLBadge>)}
            </div>
          )}
          {spec.names?.categories?.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap items-center">
              <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>Categories:</span>
              {spec.names.categories.map((cat) => <KLBadge key={cat} tone="neutral">{cat}</KLBadge>)}
            </div>
          )}
        </Panel>
        {topLevelProps.length > 0 && (
          <Panel title="Schema Top-Level Fields" subtitle={`${topLevelProps.length} fields · ${storedVersion?.name}`}>
            <div className="flex flex-col">
              {topLevelProps.map(([prop, def]) => (
                <div key={prop} className="flex items-start gap-2 py-2" style={{ borderTop: "1px solid var(--kl-border)", fontSize: 12 }}>
                  <span className="kl-mono flex-1 break-all">{prop}</span>
                  <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                    {def.type && <KLBadge tone="neutral">{def.type}</KLBadge>}
                    {def.format && <KLBadge tone="neutral">{def.format}</KLBadge>}
                    {storedSchema?.required?.includes(prop) && <KLBadge tone="accent">required</KLBadge>}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
        {storedVersion?.additionalPrinterColumns?.length > 0 && (
          <Panel title="Printer Columns" subtitle="shown in kubectl get output">
            <div className="flex flex-col">
              {storedVersion.additionalPrinterColumns.map((col, i) => (
                <div key={i} className="py-2" style={{ borderTop: "1px solid var(--kl-border)", fontSize: 12 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="kl-mono font-medium">{col.name}</span>
                    <KLBadge tone="neutral">{col.type}</KLBadge>
                    {col.priority != null && col.priority > 0 && <KLBadge tone="warn">wide</KLBadge>}
                  </div>
                  <span className="kl-mono text-[11px] break-all" style={{ color: "var(--kl-text-muted)" }}>{col.jsonPath}</span>
                  {col.description && <p style={{ fontSize: 11, color: "var(--kl-text-faint)", margin: "2px 0 0" }}>{col.description}</p>}
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <Panel title="Status">
          <div className="flex items-center gap-2 mb-3">
            <KLStatus kind={established?.status === "True" ? "ok" : "warn"} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{established?.status === "True" ? "Established" : "Pending"}</span>
          </div>
          {conditions.map((c) => (
            <div key={c.type} className="flex items-start gap-2 py-2" style={{ borderTop: "1px solid var(--kl-border)" }}>
              <KLStatus kind={c.status === "True" ? "ok" : "warn"} dotOnly />
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span style={{ fontSize: 12, fontWeight: 500 }}>{c.type}</span>
                {c.message && <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{c.message}</span>}
              </div>
            </div>
          ))}
        </Panel>
        {conversion && (
          <Panel title="Conversion">
            <div className="grid gap-y-2 gap-x-3" style={{ gridTemplateColumns: "minmax(80px,120px) 1fr", fontSize: 12 }}>
              <span style={{ color: "var(--kl-text-muted)" }}>Strategy</span>
              <KLBadge tone="neutral">{conversion.strategy ?? "None"}</KLBadge>
              {conversion.webhook?.clientConfig?.service && (
                <>
                  <span style={{ color: "var(--kl-text-muted)" }}>Webhook</span>
                  <span className="kl-mono break-all">{conversion.webhook.clientConfig.service.namespace}/{conversion.webhook.clientConfig.service.name}</span>
                </>
              )}
              {conversion.webhook?.clientConfig?.url && (
                <>
                  <span style={{ color: "var(--kl-text-muted)" }}>URL</span>
                  <span className="kl-mono break-all text-[11px]">{conversion.webhook.clientConfig.url}</span>
                </>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
