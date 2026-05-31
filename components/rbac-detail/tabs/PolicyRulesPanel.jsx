"use client";

import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";

const DESTRUCTIVE_VERBS = ["delete", "deletecollection", "patch", "update", "create"];

function VerbBadge({ verb }) {
  const tone = verb === "*" ? "err" : DESTRUCTIVE_VERBS.includes(verb) ? "warn" : "ok";
  return <KLBadge tone={tone}>{verb}</KLBadge>;
}

export function PolicyRulesPanel({ rules }) {
  if (!rules?.length) return (
    <Panel title="Policy Rules">
      <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No rules defined.</div>
    </Panel>
  );
  return (
    <Panel title="Policy Rules" subtitle={`${rules.length} rule${rules.length !== 1 ? "s" : ""}`}>
      <div className="flex flex-col gap-4">
        {rules.map((rule, i) => (
          <div key={i} style={{ paddingBottom: i < rules.length - 1 ? 14 : 0, borderBottom: i < rules.length - 1 ? "1px solid var(--kl-border)" : "none" }}>
            <div className="grid gap-y-2" style={{ gridTemplateColumns: "80px 1fr", fontSize: 12 }}>
              <span style={{ color: "var(--kl-text-muted)", paddingTop: 2 }}>Resources</span>
              <div className="flex flex-wrap gap-1">
                {(rule.resources ?? ["*"]).map((r) => <KLBadge key={r} tone={r === "*" ? "err" : "accent"}>{r}</KLBadge>)}
                {(rule.resourceNames ?? []).map((rn) => <KLBadge key={rn} tone="neutral">name: {rn}</KLBadge>)}
              </div>
              <span style={{ color: "var(--kl-text-muted)", paddingTop: 2 }}>Verbs</span>
              <div className="flex flex-wrap gap-1">
                {(rule.verbs ?? ["*"]).map((v) => <VerbBadge key={v} verb={v} />)}
              </div>
              {(rule.apiGroups ?? []).some((g) => g !== "") && (
                <>
                  <span style={{ color: "var(--kl-text-muted)", paddingTop: 2 }}>API Groups</span>
                  <div className="flex flex-wrap gap-1">
                    {rule.apiGroups.map((g) => <KLBadge key={g || "core"} tone="neutral">{g === "" ? "(core)" : g}</KLBadge>)}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
