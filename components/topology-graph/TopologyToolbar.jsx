"use client";

import React from "react";
import { useReactFlow } from "@xyflow/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { KIND_COLOR } from "@/lib/k8s/kind-config";

export const KIND_GROUPS = [
  { label: "Workloads", kinds: ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Job", "CronJob", "Pod"] },
  { label: "Network",   kinds: ["Service", "Ingress"] },
  { label: "Config",    kinds: ["ConfigMap", "Secret"] },
  { label: "Storage",   kinds: ["PersistentVolumeClaim"] },
  { label: "Scaling",   kinds: ["HorizontalPodAutoscaler"] },
];

export const ALL_KINDS = KIND_GROUPS.flatMap((g) => g.kinds);

function useClickOutside(ref, handler) {
  const handlerRef = React.useRef(handler);
  React.useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    const onDown = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return;
      handlerRef.current();
    };
    // Capture phase so React Flow's stopPropagation on the canvas doesn't block us
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [ref]);
}

// ── Namespace single-select dropdown ──────────────────────────────────────
function NamespaceDropdown({ namespaces, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((s) => !s)}
        style={{
          height: 28,
          padding: "0 10px",
          borderRadius: 6,
          border: "1px solid var(--kl-border)",
          background: "var(--kl-surface-2)",
          color: "var(--kl-text)",
          fontSize: 11.5,
          fontFamily: "monospace",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--kl-text-muted)" }}>ns:</span>
        <span style={{ fontWeight: 600 }}>{selected ?? "—"}</span>
        <span style={{ fontSize: 9, color: "var(--kl-text-muted)", marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 200,
            background: "var(--kl-surface)",
            border: "1px solid var(--kl-border)",
            borderRadius: 8,
            padding: "4px 0",
            minWidth: 180,
            maxHeight: 280,
            overflowY: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
          }}
        >
          {namespaces.length === 0 && (
            <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--kl-text-muted)" }}>
              No namespaces found
            </div>
          )}
          {namespaces.map((ns) => (
            <button
              key={ns}
              onClick={() => { onChange(ns); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 12px",
                textAlign: "left",
                background: ns === selected ? "color-mix(in srgb, #6366f1 12%, transparent)" : "transparent",
                color: ns === selected ? "var(--kl-text)" : "var(--kl-text-muted)",
                fontWeight: ns === selected ? 600 : 400,
                fontSize: 11.5,
                fontFamily: "monospace",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {ns === selected ? "● " : "  "}{ns}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resource-kind multi-select dropdown ───────────────────────────────────
function KindDropdown({ selectedKinds, onToggleKind, onSelectAllKinds, onClearAllKinds }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const noneSelected = selectedKinds.size === 0;
  const allSelected = selectedKinds.size >= ALL_KINDS.length;
  const isPartial = !noneSelected && !allSelected;

  const label = noneSelected
    ? "No resources"
    : allSelected
    ? "All resources"
    : selectedKinds.size === 1
    ? [...selectedKinds][0]
    : `${selectedKinds.size} types`;

  const accent = noneSelected ? "#ef4444" : isPartial ? "#6366f1" : undefined;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((s) => !s)}
        style={{
          height: 28,
          padding: "0 10px",
          borderRadius: 6,
          border: `1px solid ${accent ?? "var(--kl-border)"}`,
          background: accent
            ? `color-mix(in srgb, ${accent} 10%, transparent)`
            : "var(--kl-surface-2)",
          color: "var(--kl-text)",
          fontSize: 11.5,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 10, color: "var(--kl-text-muted)" }}>show:</span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 9, color: "var(--kl-text-muted)", marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 200,
            background: "var(--kl-surface)",
            border: "1px solid var(--kl-border)",
            borderRadius: 8,
            minWidth: 210,
            maxHeight: 360,
            overflowY: "auto",
            boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
          }}
        >
          {/* Select all / Select none row — always visible */}
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "7px 12px",
              borderBottom: "1px solid var(--kl-border)",
            }}
          >
            <button
              onClick={onSelectAllKinds}
              disabled={allSelected}
              style={{
                height: 22,
                padding: "0 9px",
                fontSize: 10.5,
                borderRadius: 4,
                border: "1px solid var(--kl-border)",
                background: "transparent",
                color: allSelected ? "var(--kl-text-faint, var(--kl-text-muted))" : "#6366f1",
                cursor: allSelected ? "default" : "pointer",
                fontWeight: 600,
                opacity: allSelected ? 0.45 : 1,
              }}
            >
              Select all
            </button>
            <button
              onClick={onClearAllKinds}
              disabled={noneSelected}
              style={{
                height: 22,
                padding: "0 9px",
                fontSize: 10.5,
                borderRadius: 4,
                border: "1px solid var(--kl-border)",
                background: "transparent",
                color: noneSelected ? "var(--kl-text-faint, var(--kl-text-muted))" : "#ef4444",
                cursor: noneSelected ? "default" : "pointer",
                fontWeight: 600,
                opacity: noneSelected ? 0.45 : 1,
              }}
            >
              Select none
            </button>
          </div>

          {KIND_GROUPS.map((group) => (
            <div key={group.label} style={{ padding: "6px 0 2px" }}>
              <div
                style={{
                  padding: "0 12px 4px",
                  fontSize: 9.5,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  color: "var(--kl-text-faint, var(--kl-text-muted))",
                  fontWeight: 600,
                }}
              >
                {group.label}
              </div>
              {group.kinds.map((kind) => {
                const checked = selectedKinds.has(kind);
                const color = KIND_COLOR[kind] ?? "#94a3b8";
                return (
                  <label
                    key={kind}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      color: checked ? "var(--kl-text)" : "var(--kl-text-muted)",
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleKind(kind)}
                      style={{ accentColor: color, width: 13, height: 13, flexShrink: 0 }}
                    />
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                        opacity: checked ? 1 : 0.3,
                      }}
                    />
                    {kind}
                  </label>
                );
              })}
            </div>
          ))}
          <div style={{ height: 6 }} />
        </div>
      )}
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────
export function TopologyToolbar({
  search,
  onSearch,
  namespaces,
  selectedNamespace,
  onSelectNamespace,
  selectedKinds,
  onToggleKind,
  onSelectAllKinds,
  onClearAllKinds,
  showConnectedCluster,
  onToggleConnectedCluster,
  nodeCount,
  edgeCount,
  onRefresh,
  loading,
}) {
  const { fitView } = useReactFlow();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "8px 12px",
        background: "var(--kl-surface)",
      }}
    >
      <Input
        placeholder="Search resources…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{ width: 180, height: 28, fontSize: 11.5 }}
      />

      <div style={{ width: 1, height: 20, background: "var(--kl-border)", flexShrink: 0 }} />

      <NamespaceDropdown
        namespaces={namespaces}
        selected={selectedNamespace}
        onChange={onSelectNamespace}
      />

      <KindDropdown
        selectedKinds={selectedKinds}
        onToggleKind={onToggleKind}
        onSelectAllKinds={onSelectAllKinds}
        onClearAllKinds={onClearAllKinds}
      />

      <div style={{ width: 1, height: 20, background: "var(--kl-border)", flexShrink: 0 }} />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          fontSize: 11,
          color: showConnectedCluster ? "var(--kl-text)" : "var(--kl-text-muted)",
          cursor: "pointer",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <input
          type="checkbox"
          checked={showConnectedCluster}
          onChange={onToggleConnectedCluster}
          style={{ width: 13, height: 13, accentColor: "#6366f1" }}
        />
        Connected cluster resources
      </label>

      <div style={{ flex: 1 }} />

      <span style={{ fontSize: 10, color: "var(--kl-text-muted)", whiteSpace: "nowrap" }}>
        {nodeCount} nodes · {edgeCount} edges
      </span>

      <Button
        size="sm"
        variant="outline"
        style={{ height: 28, fontSize: 11 }}
        onClick={() => fitView({ padding: 0.06, duration: 400 })}
      >
        Fit View
      </Button>

      <Button
        size="sm"
        variant="outline"
        style={{ height: 28, fontSize: 11 }}
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? "Loading…" : "Refresh"}
      </Button>
    </div>
  );
}
