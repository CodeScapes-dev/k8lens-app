"use client";

import React from "react";
import { AlertTriangleIcon, InfoIcon, XCircleIcon, XIcon, ChevronDownIcon } from "lucide-react";

const RULES = {
  "no-resource-limits": {
    applies: ["pod"],
    severity: "Warning",
    title: "Missing resource limits",
    description: "Containers without CPU/memory limits can starve other workloads on the same node.",
    check: (data) => {
      const containers = data?.pod?.spec?.containers ?? data?.spec?.containers ?? [];
      return containers.some((c) => !c.resources?.limits?.cpu || !c.resources?.limits?.memory);
    },
  },
  "no-liveness-probe": {
    applies: ["pod"],
    severity: "Info",
    title: "No liveness probe",
    description: "Without a liveness probe, Kubernetes cannot detect and restart stuck containers.",
    check: (data) => {
      const containers = data?.pod?.spec?.containers ?? data?.spec?.containers ?? [];
      return containers.some((c) => !c.livenessProbe);
    },
  },
  "no-readiness-probe": {
    applies: ["pod"],
    severity: "Warning",
    title: "No readiness probe",
    description: "Without a readiness probe, traffic may be routed to pods that are not ready.",
    check: (data) => {
      const containers = data?.pod?.spec?.containers ?? data?.spec?.containers ?? [];
      return containers.some((c) => !c.readinessProbe);
    },
  },
  "no-pdb": {
    applies: ["deployment", "statefulset"],
    severity: "Warning",
    title: "No Pod Disruption Budget",
    description: "Without a PDB, node maintenance or cluster upgrades can take down all replicas at once.",
    check: (data) => !data?.pdb,
  },
  "stale-secret-180d": {
    applies: ["secret"],
    severity: "Warning",
    title: "Secret not rotated in 180+ days",
    description: "Long-lived secrets increase exposure if credentials are compromised.",
    check: (data) => {
      const created = data?.secret?.metadata?.creationTimestamp ?? data?.metadata?.creationTimestamp;
      if (!created) return false;
      return (Date.now() - new Date(created).getTime()) > 180 * 24 * 60 * 60 * 1000;
    },
  },
  "stale-secret-90d": {
    applies: ["secret"],
    severity: "Info",
    title: "Secret not rotated in 90+ days",
    description: "Consider rotating secrets regularly to reduce the risk of credential exposure.",
    check: (data) => {
      const created = data?.secret?.metadata?.creationTimestamp ?? data?.metadata?.creationTimestamp;
      if (!created) return false;
      const age = Date.now() - new Date(created).getTime();
      return age > 90 * 24 * 60 * 60 * 1000 && age <= 180 * 24 * 60 * 60 * 1000;
    },
  },
  "rbac-wildcard-verb": {
    applies: ["role", "clusterrole"],
    severity: "Critical",
    title: "Wildcard verb (*)",
    description: "Granting all verbs is equivalent to admin access on the targeted resources.",
    check: (data) => {
      const rules = data?.role?.rules ?? data?.clusterRole?.rules ?? data?.rules ?? [];
      return rules.some((r) => r?.verbs?.includes("*"));
    },
  },
  "rbac-wildcard-resource": {
    applies: ["role", "clusterrole"],
    severity: "Warning",
    title: "Wildcard resource (*)",
    description: "Applying rules to all resources increases blast radius if this role is misused.",
    check: (data) => {
      const rules = data?.role?.rules ?? data?.clusterRole?.rules ?? data?.rules ?? [];
      return rules.some((r) => r?.resources?.includes("*"));
    },
  },
  "ingress-no-tls": {
    applies: ["ingress"],
    severity: "Warning",
    title: "No TLS configured",
    description: "Traffic to this Ingress is not encrypted. Configure TLS to protect data in transit.",
    check: (data) => {
      const ingress = data?.ingress ?? data;
      return !(ingress?.spec?.tls?.length > 0);
    },
  },
  "service-no-endpoints": {
    applies: ["service"],
    severity: "Critical",
    title: "Zero ready endpoints",
    description: "This Service has no ready backing pods — traffic will be dropped.",
    check: (data) => {
      const endpoints = data?.endpoints;
      const readyAddresses = (endpoints?.subsets ?? []).flatMap((s) => s.addresses ?? []);
      const selector = data?.service?.spec?.selector ?? {};
      return Object.keys(selector).length > 0 && readyAddresses.length === 0;
    },
  },
};

const SEVERITY_ORDER = { Critical: 0, Warning: 1, Info: 2 };
const SEVERITY_ICON = {
  Critical: XCircleIcon,
  Warning: AlertTriangleIcon,
  Info: InfoIcon,
};
const SEVERITY_COLOR = {
  Critical: "var(--kl-err)",
  Warning: "var(--kl-warn)",
  Info: "var(--kl-text-muted)",
};
const SEVERITY_BG = {
  Critical: "var(--kl-err-tint)",
  Warning: "var(--kl-warn-tint)",
  Info: "var(--kl-surface-2)",
};
const SEVERITY_BORDER = {
  Critical: "var(--kl-err)",
  Warning: "var(--kl-warn)",
  Info: "var(--kl-border)",
};

function dismissKey(resourceType, namespace, name, ruleId) {
  return `${resourceType}/${namespace ?? "_"}/${name}/${ruleId}`;
}

function getDismissed() {
  try { return JSON.parse(localStorage.getItem("kulens-dismissed-recs") ?? "[]"); } catch { return []; }
}

function saveDismissed(list) {
  try { localStorage.setItem("kulens-dismissed-recs", JSON.stringify(list)); } catch {}
}

export function Recommendations({ resourceType, data, namespace, name }) {
  const [dismissed, setDismissed] = React.useState(() => getDismissed());
  const [showDismissed, setShowDismissed] = React.useState(false);

  const fired = Object.entries(RULES)
    .filter(([, rule]) => rule.applies.includes(resourceType))
    .filter(([, rule]) => { try { return rule.check(data); } catch { return false; } })
    .map(([id, rule]) => ({ id, ...rule }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const visible = fired.filter((r) => !dismissed.includes(dismissKey(resourceType, namespace, name, r.id)));
  const hiddenCount = fired.length - visible.length;

  const dismiss = (id) => {
    const key = dismissKey(resourceType, namespace, name, id);
    const next = [...dismissed, key];
    setDismissed(next);
    saveDismissed(next);
  };

  const restoreAll = () => {
    const keys = fired.map((r) => dismissKey(resourceType, namespace, name, r.id));
    const next = dismissed.filter((k) => !keys.includes(k));
    setDismissed(next);
    saveDismissed(next);
    setShowDismissed(false);
  };

  if (fired.length === 0) return null;
  if (visible.length === 0 && hiddenCount === 0) return null;

  return (
    <div className="px-4 sm:px-7 py-2.5 flex flex-col gap-1.5" style={{ borderBottom: "1px solid var(--kl-border)" }}>
      {visible.map((rec) => {
        const Icon = SEVERITY_ICON[rec.severity];
        const color = SEVERITY_COLOR[rec.severity];
        return (
          <div key={rec.id} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 8,
            background: SEVERITY_BG[rec.severity],
            border: `1px solid ${SEVERITY_BORDER[rec.severity]}`,
          }}>
            <Icon size={15} style={{ color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--kl-text)" }}>{rec.title}</div>
              <div style={{ fontSize: 12, color: "var(--kl-text-muted)", marginTop: 2 }}>{rec.description}</div>
            </div>
            <button
              onClick={() => dismiss(rec.id)}
              title="Dismiss"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kl-text-muted)", padding: 2, flexShrink: 0 }}
            >
              <XIcon size={13} />
            </button>
          </div>
        );
      })}

      {hiddenCount > 0 && (
        <button
          onClick={() => setShowDismissed((s) => !s)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "var(--kl-text-muted)", display: "flex", alignItems: "center", gap: 4, padding: "2px 0" }}
        >
          <ChevronDownIcon size={12} style={{ transform: showDismissed ? "rotate(180deg)" : "none" }} />
          {showDismissed ? "Hide" : `Show ${hiddenCount} dismissed`}
          {showDismissed && (
            <span
              onClick={(e) => { e.stopPropagation(); restoreAll(); }}
              style={{ marginLeft: 8, color: "var(--kl-accent)", textDecoration: "underline" }}
            >
              Restore all
            </span>
          )}
        </button>
      )}
    </div>
  );
}
