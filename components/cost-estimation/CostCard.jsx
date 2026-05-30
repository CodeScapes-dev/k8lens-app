"use client";

import React from "react";
import { Panel } from "@/components/kl/Panel";
import { parseK8sResourceValue } from "@/lib/k8s/utils";
import { AlertTriangleIcon, SettingsIcon } from "lucide-react";

const DEFAULT_CONFIG = { enabled: true, cpuPerCoreHour: 0.048, memPerGbHour: 0.006, currency: "USD" };

function loadConfig() {
  try {
    const raw = localStorage.getItem("K8Lens-cost-config");
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch { return DEFAULT_CONFIG; }
}

function formatCost(amount, currency) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(amount);
}

export function CostCard({ containers = [], replicas = 1 }) {
  const [config, setConfig] = React.useState(loadConfig);

  React.useEffect(() => { setConfig(loadConfig()); }, []);

  if (!config?.enabled) return null;

  const missingRequests = containers.some(
    (c) => !c.resources?.requests?.cpu && !c.resources?.requests?.memory,
  );

  const totalCpuCores = containers.reduce((sum, c) => {
    return sum + parseK8sResourceValue(c.resources?.requests?.cpu ?? "0", "cpu");
  }, 0);

  const totalMemBytes = containers.reduce((sum, c) => {
    return sum + parseK8sResourceValue(c.resources?.requests?.memory ?? "0", "memory");
  }, 0);

  const totalMemGb = totalMemBytes / 1024 ** 3;

  const cpuHourCost = config ? totalCpuCores * config.cpuPerCoreHour * replicas : 0;
  const memHourCost = config ? totalMemGb * config.memPerGbHour * replicas : 0;
  const totalHour = cpuHourCost + memHourCost;
  const totalMonth = totalHour * 730;

  const currency = config?.currency ?? "USD";

  const cpuDisplay = totalCpuCores >= 1
    ? `${totalCpuCores.toFixed(2)} cores`
    : `${Math.round(totalCpuCores * 1000)}m`;

  const memDisplay = totalMemGb >= 0.1
    ? `${totalMemGb.toFixed(2)} Gi`
    : `${Math.round(totalMemGb * 1024)} Mi`;

  return (
    <Panel title="Cost Estimate" subtitle={`across ${replicas} replica${replicas !== 1 ? "s" : ""}`}>
      {!config ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--kl-text-muted)" }}>
          <SettingsIcon size={13} />
          <span>Configure pricing in Settings to see cost estimates.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {missingRequests && (
            <div style={{ display: "flex", gap: 6, fontSize: 11.5, color: "var(--kl-warn)", alignItems: "center" }}>
              <AlertTriangleIcon size={12} />
              Cost estimate is unreliable — some containers have no resource requests configured.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--kl-surface-2)", border: "1px solid var(--kl-border)", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--kl-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Per Hour</div>
              <div className="kl-mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--kl-text)" }}>{formatCost(totalHour, currency)}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 8, background: "var(--kl-surface-2)", border: "1px solid var(--kl-border)", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--kl-text-muted)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Per Month</div>
              <div className="kl-mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--kl-text)" }}>{formatCost(totalMonth, currency)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: "1px solid var(--kl-border)", borderRadius: 8, overflow: "hidden" }}>
            {[
              { label: "CPU Requests", value: cpuDisplay },
              { label: "Memory Requests", value: memDisplay },
              { label: "CPU Cost/hr", value: formatCost(cpuHourCost, currency) },
            ].map(({ label, value }, i) => (
              <div key={i} style={{ padding: "8px 12px", borderRight: i < 2 ? "1px solid var(--kl-border)" : "none", textAlign: "center" }}>
                <div style={{ fontSize: 10.5, color: "var(--kl-text-muted)", marginBottom: 2 }}>{label}</div>
                <div className="kl-mono" style={{ fontSize: 12, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
