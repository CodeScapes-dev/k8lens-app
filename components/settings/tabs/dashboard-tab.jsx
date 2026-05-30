"use client";

import React from "react";
import { COST_DEFAULT_CONFIG as DEFAULT_CONFIG, CURRENCIES } from "@/lib/data";

function loadConfig() {
  try {
    const raw = localStorage.getItem("K8Lens-cost-config");
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg) {
  try {
    localStorage.setItem("K8Lens-cost-config", JSON.stringify(cfg));
  } catch {}
}

function clearDismissed() {
  try {
    localStorage.removeItem("K8Lens-dismissed-recs");
  } catch {}
}

export function DashboardTab() {
  const [config, setConfig] = React.useState(loadConfig);
  const [saved, setSaved] = React.useState(false);
  const [clearedRecs, setClearedRecs] = React.useState(false);

  const update = (key, value) => setConfig((c) => ({ ...c, [key]: value }));

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearRecs = () => {
    clearDismissed();
    setClearedRecs(true);
    setTimeout(() => setClearedRecs(false), 2000);
  };

  const labelStyle = {
    fontSize: 12,
    color: "var(--kl-text-muted)",
    marginBottom: 4,
    display: "block",
  };
  const inputStyle = {
    width: "100%",
    height: 34,
    padding: "0 10px",
    borderRadius: 6,
    border: "1px solid var(--kl-border)",
    background: "var(--kl-surface-2)",
    color: "var(--kl-text)",
    fontSize: 12,
    outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Cost estimation */}
      <section>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--kl-text)",
          }}
        >
          Cost Estimation
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--kl-text-muted)",
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          Set node pricing rates for cost estimation on workload detail pages.
          Prices are stored locally in your browser.
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!!config.enabled}
            onChange={(e) => {
              const next = { ...config, enabled: e.target.checked };
              setConfig(next);
              saveConfig(next);
            }}
            style={{
              width: 15,
              height: 15,
              accentColor: "var(--kl-accent)",
              cursor: "pointer",
            }}
          />
          <span style={{ fontSize: 12.5, color: "var(--kl-text)" }}>
            Show cost estimation on workload detail pages
          </span>
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            opacity: config.enabled ? 1 : 0.4,
            pointerEvents: config.enabled ? "auto" : "none",
          }}
        >
          <div>
            <label style={labelStyle}>CPU price per core-hour</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={config.cpuPerCoreHour}
              onChange={(e) =>
                update("cpuPerCoreHour", parseFloat(e.target.value) || 0)
              }
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Memory price per GB-hour</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={config.memPerGbHour}
              onChange={(e) =>
                update("memPerGbHour", parseFloat(e.target.value) || 0)
              }
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Currency</label>
            <select
              value={config.currency}
              onChange={(e) => update("currency", e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSave}
          style={{
            marginTop: 14,
            padding: "7px 18px",
            borderRadius: 7,
            background: "var(--kl-accent)",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {saved ? "Saved ✓" : "Save pricing"}
        </button>
      </section>

      {/* Recommendations */}
      <section
        style={{ borderTop: "1px solid var(--kl-border)", paddingTop: 20 }}
      >
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            marginBottom: 12,
            color: "var(--kl-text)",
          }}
        >
          Recommendations
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--kl-text-muted)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Dismissed recommendations are stored locally. Reset them to make them
          reappear on resource pages.
        </div>
        <button
          onClick={handleClearRecs}
          style={{
            padding: "7px 18px",
            borderRadius: 7,
            background: "var(--kl-surface-2)",
            border: "1px solid var(--kl-border)",
            color: "var(--kl-text)",
            cursor: "pointer",
            fontSize: 12.5,
          }}
        >
          {clearedRecs ? "Cleared ✓" : "Reset all dismissed recommendations"}
        </button>
      </section>
    </div>
  );
}
