"use client";

import Link from "next/link";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { calculateAge } from "@/lib/k8s/utils";

export function subjectTone(kind) {
  return kind === "ServiceAccount" ? "accent" : kind === "User" ? "neutral" : "warn";
}

function SubjectCard({ s, defaultNamespace }) {
  const isSA = s.kind === "ServiceAccount";
  const href = isSA ? `/access-control/serviceaccounts/${s.namespace ?? defaultNamespace}/${s.name}` : null;
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--kl-border)", background: "var(--kl-surface-2)", cursor: href ? "pointer" : "default" }}>
      <KLBadge tone={subjectTone(s.kind)}>{s.kind}</KLBadge>
      <span className="kl-mono break-all" style={{ fontSize: 12, flex: 1, fontWeight: 500 }}>{s.name}</span>
      {s.namespace && s.namespace !== defaultNamespace && (
        <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>{s.namespace}</span>
      )}
    </div>
  );
  return href ? <Link href={href} className="block">{content}</Link> : <div>{content}</div>;
}

export function SubjectsTab({ subjects, defaultNamespace }) {
  if (!subjects?.length) return (
    <Panel title="Subjects">
      <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No subjects bound.</div>
    </Panel>
  );
  const byKind = subjects.reduce((acc, s) => { (acc[s.kind] = acc[s.kind] ?? []).push(s); return acc; }, {});
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(byKind).map(([kind, items]) => (
        <Panel key={kind} title={kind} subtitle={`${items.length} ${kind === "ServiceAccount" ? "service account" : kind.toLowerCase()}${items.length !== 1 ? "s" : ""}`}>
          <div className="flex flex-col gap-2">
            {items.map((s, i) => <SubjectCard key={i} s={s} defaultNamespace={defaultNamespace} />)}
          </div>
        </Panel>
      ))}
    </div>
  );
}

export function BindingSubjectsTab({ bindings, subjects, resourceKind }) {
  if (bindings.length === 0) return (
    <Panel title="Subjects">
      <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No {resourceKind === "ClusterRole" ? "cluster role bindings" : "role bindings"} reference this role.</div>
    </Panel>
  );
  return (
    <div className="flex flex-col gap-4">
      {bindings.map((binding) => {
        const bindingSubjects = subjects.filter((s) => s.bindingName === binding.metadata?.name);
        return (
          <Panel
            key={binding.metadata?.uid}
            title={binding.metadata?.name}
            subtitle={`${resourceKind === "ClusterRole" ? "ClusterRoleBinding" : "RoleBinding"} · ${bindingSubjects.length} subject${bindingSubjects.length !== 1 ? "s" : ""} · created ${binding.metadata?.creationTimestamp ? calculateAge(binding.metadata.creationTimestamp) + " ago" : "—"}`}
          >
            {bindingSubjects.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No subjects.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {bindingSubjects.map((s, i) => <SubjectCard key={i} s={s} />)}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
