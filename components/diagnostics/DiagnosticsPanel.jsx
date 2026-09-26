"use client";

import { ChevronDown, CircleCheckIcon } from "lucide-react";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { diagnoseResource } from "@/lib/k8s/diagnostics";

const MAX_LISTED_PODS = 5;

function AffectedPods({ pods }) {
  const shown = pods.slice(0, MAX_LISTED_PODS).join(", ");
  const more = pods.length - MAX_LISTED_PODS;
  return (
    <div className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-muted)", marginTop: 4 }}>
      {pods.length === 1 ? "Affects pod" : `Affects ${pods.length} pods`}: {shown}
      {more > 0 ? ` +${more} more` : ""}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div
      className="kl-mono"
      style={{ fontSize: 10, color: "var(--kl-text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}
    >
      {children}
    </div>
  );
}

function DiagnosisItem({ diagnosis, showPods }) {
  const { issue, technicalName, severity, rootCause, evidence, remediation, pods } = diagnosis;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--kl-text)" }}>{issue}</span>
          <KLBadge tone={severity === "Critical" ? "err" : "warn"}>{severity}</KLBadge>
          {technicalName && <KLBadge>{technicalName}</KLBadge>}
        </div>
        {showPods && pods?.length > 0 && <AffectedPods pods={pods} />}
      </div>

      <div>
        <SectionLabel>What&apos;s wrong</SectionLabel>
        <div style={{ fontSize: 12.5, color: "var(--kl-text)", lineHeight: 1.5 }}>{rootCause}</div>
      </div>

      <div>
        <SectionLabel>How to fix it</SectionLabel>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {remediation.map((step, i) => (
            <li key={i} style={{ fontSize: 12.5, color: "var(--kl-text-2)", lineHeight: 1.5, wordBreak: "break-word" }}>
              {step}
            </li>
          ))}
        </ul>
      </div>

      {evidence.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger
            className="flex items-center gap-1.5 [&[data-state=open]>svg]:rotate-180"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--kl-text-muted)" }}
          >
            <span className="kl-mono" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>
              Technical details ({evidence.length})
            </span>
            <ChevronDown size={12} style={{ transition: "transform 0.15s" }} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {evidence.map((line, i) => (
                <li key={i} className="kl-mono" style={{ fontSize: 11, color: "var(--kl-text-2)", wordBreak: "break-word" }}>
                  {line}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Panel title="Diagnostics">
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "28px 8px", textAlign: "center" }}>
        <CircleCheckIcon size={28} style={{ color: "var(--kl-ok)" }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--kl-text)" }}>No issues detected</div>
        <div style={{ fontSize: 12.5, color: "var(--kl-text-muted)", maxWidth: 420, lineHeight: 1.5 }}>
          We checked this resource against the common problems and found nothing wrong.
        </div>
      </div>
    </Panel>
  );
}

export function DiagnosticsPanel({ resourceType, data, showEmpty = false }) {
  if (!data) return null;
  const diagnoses = diagnoseResource(resourceType, data);
  if (diagnoses.length === 0) return showEmpty ? <EmptyState /> : null;

  const showPods = resourceType !== "pod";
  return (
    <Panel title="Diagnostics" subtitle={`${diagnoses.length} issue${diagnoses.length === 1 ? "" : "s"} found`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {diagnoses.map((d, i) => (
          <div
            key={`${d.id}-${i}`}
            style={i > 0 ? { paddingTop: 16, borderTop: "1px solid var(--kl-border)" } : undefined}
          >
            <DiagnosisItem diagnosis={d} showPods={showPods} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
