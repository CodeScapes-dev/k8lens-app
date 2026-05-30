"use client";

import React from "react";
import { Panel } from "@/components/kl/Panel";

function toYamlLike(obj, indent = 0) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj !== "object") return String(obj);
  const pad = "  ".repeat(indent);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    return obj.map((v) => `${pad}- ${toYamlLike(v, indent + 1)}`).join("\n");
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  return entries.map(([k, v]) => {
    if (typeof v === "object" && v !== null) {
      return `${pad}${k}:\n${toYamlLike(v, indent + 1)}`;
    }
    return `${pad}${k}: ${v}`;
  }).join("\n");
}

function computeDiff(oldStr, newStr) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  const dp = Array.from({ length: oldLines.length + 1 }, () => new Array(newLines.length + 1).fill(0));
  for (let i = oldLines.length - 1; i >= 0; i--) {
    for (let j = newLines.length - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) dp[i][j] = 1 + dp[i + 1][j + 1];
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result = [];
  let i = 0, j = 0;
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      result.push({ type: "unchanged", text: oldLines[i] });
      i++; j++;
    } else if (j < newLines.length && (i >= oldLines.length || dp[i + 1]?.[j] <= dp[i]?.[j + 1])) {
      result.push({ type: "added", text: newLines[j] });
      j++;
    } else {
      result.push({ type: "removed", text: oldLines[i] });
      i++;
    }
  }
  return result;
}

function DiffLine({ type, text, lineNum }) {
  const styles = {
    unchanged: { color: "var(--kl-text-muted)", prefix: " " },
    added: { color: "var(--kl-ok)", background: "var(--kl-ok)10", borderLeft: "3px solid var(--kl-ok)", prefix: "+" },
    removed: { color: "var(--kl-err)", background: "var(--kl-err)10", borderLeft: "3px solid var(--kl-err)", prefix: "−" },
  };
  const s = styles[type];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", ...s }}>
      <span style={{ flexShrink: 0, width: 32, textAlign: "right", paddingRight: 8, fontSize: 10, color: "var(--kl-text-muted)", userSelect: "none", paddingTop: 1 }}>
        {lineNum}
      </span>
      <span style={{ flexShrink: 0, width: 14, color: s.color, fontWeight: 700 }}>{s.prefix}</span>
      <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-all", color: s.color }}>{text}</span>
    </div>
  );
}

function CollapsedSection({ count, onExpand }) {
  return (
    <button
      onClick={onExpand}
      style={{
        width: "100%", textAlign: "left", background: "none", border: "none",
        cursor: "pointer", padding: "4px 14px", fontSize: 11,
        color: "var(--kl-accent)", borderLeft: "3px solid var(--kl-border)",
      }}
    >
      ↕ Show {count} unchanged line{count !== 1 ? "s" : ""}
    </button>
  );
}

const CONTEXT_LINES = 3;

function DiffView({ diff }) {
  const [expanded, setExpanded] = React.useState(new Set());

  const groups = [];
  let i = 0;
  while (i < diff.length) {
    if (diff[i].type !== "unchanged") {
      const start = Math.max(0, i - CONTEXT_LINES);
      const end = Math.min(diff.length, i + CONTEXT_LINES + 1);
      groups.push({ type: "context", start, end });
      i = end;
    } else {
      const start = i;
      while (i < diff.length && diff[i].type === "unchanged") i++;
      groups.push({ type: "unchanged", start, end: i });
    }
  }

  const rendered = [];
  let lineNum = 1;
  groups.forEach((group, gi) => {
    if (group.type === "context") {
      for (let idx = group.start; idx < group.end; idx++) {
        rendered.push(
          <DiffLine key={`${gi}-${idx}`} type={diff[idx].type} text={diff[idx].text} lineNum={lineNum++} />,
        );
      }
    } else {
      const count = group.end - group.start;
      if (count <= CONTEXT_LINES * 2 || expanded.has(gi)) {
        for (let idx = group.start; idx < group.end; idx++) {
          rendered.push(<DiffLine key={`${gi}-${idx}`} type="unchanged" text={diff[idx].text} lineNum={lineNum++} />);
        }
      } else {
        lineNum += count;
        rendered.push(
          <CollapsedSection key={`collapsed-${gi}`} count={count} onExpand={() => setExpanded((s) => new Set([...s, gi]))} />,
        );
      }
    }
  });

  return (
    <div style={{ fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.7, padding: "8px 0" }}>
      {rendered}
    </div>
  );
}

function snapshotKey(resourceType, namespace, name) {
  return `kulens-snapshot-${resourceType}-${namespace ?? "_"}-${name}`;
}

export function ChangesTab({ resourceType, resource }) {
  const [viewMode, setViewMode] = React.useState("unified");
  const namespace = resource?.metadata?.namespace;
  const name = resource?.metadata?.name;

  const currentYaml = React.useMemo(() => {
    if (!resource) return "";
    const obj = { ...resource };
    delete obj.metadata?.managedFields;
    return toYamlLike(obj);
  }, [resource]);

  const previousYaml = React.useMemo(() => {
    // Source 1: last-applied annotation
    const lastApplied = resource?.metadata?.annotations?.["kubectl.kubernetes.io/last-applied-configuration"];
    if (lastApplied) {
      try { return toYamlLike(JSON.parse(lastApplied)); } catch {}
    }
    // Source 2: localStorage snapshot
    try {
      const key = snapshotKey(resourceType, namespace, name);
      const snap = localStorage.getItem(key);
      if (snap) return snap;
    } catch {}
    return null;
  }, [resource, resourceType, namespace, name]);

  // Save current state as snapshot for next visit
  React.useEffect(() => {
    if (!currentYaml || !name) return;
    try {
      localStorage.setItem(snapshotKey(resourceType, namespace, name), currentYaml);
    } catch {}
  }, [currentYaml, resourceType, namespace, name]);

  if (!previousYaml) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13 }}>
        No previous version available. A diff will appear here after the resource is updated, or when a last-applied annotation is present.
      </div>
    );
  }

  const diff = computeDiff(previousYaml, currentYaml);
  const hasChanges = diff.some((d) => d.type !== "unchanged");

  const addedCount = diff.filter((d) => d.type === "added").length;
  const removedCount = diff.filter((d) => d.type === "removed").length;

  return (
    <Panel
      title="Changes"
      subtitle={hasChanges ? `+${addedCount} −${removedCount}` : "No changes detected"}
      rowAction={
        <div style={{ display: "flex", gap: 4 }}>
          {["unified", "side-by-side"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "4px 10px", borderRadius: 5, fontSize: 11,
                border: "1px solid var(--kl-border)",
                background: viewMode === mode ? "var(--kl-accent)" : "var(--kl-surface-2)",
                color: viewMode === mode ? "#fff" : "var(--kl-text-muted)",
                cursor: "pointer",
              }}
            >
              {mode === "unified" ? "Unified" : "Side by side"}
            </button>
          ))}
        </div>
      }
    >
      {!hasChanges ? (
        <div style={{ textAlign: "center", color: "var(--kl-text-muted)", fontSize: 13, padding: "16px 0" }}>
          The resource is identical to the previous version.
        </div>
      ) : viewMode === "unified" ? (
        <div style={{ overflowX: "auto" }}>
          <DiffView diff={diff} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, overflowX: "auto" }}>
          <div style={{ borderRight: "1px solid var(--kl-border)", fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.7, padding: "8px 0" }}>
            <div style={{ fontSize: 10, color: "var(--kl-text-muted)", padding: "4px 14px", borderBottom: "1px solid var(--kl-border)", marginBottom: 4 }}>Previous</div>
            {previousYaml.split("\n").map((line, i) => (
              <div key={i} style={{ padding: "0 14px", color: "var(--kl-text-muted)", whiteSpace: "pre-wrap" }}>{line || " "}</div>
            ))}
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 11.5, lineHeight: 1.7, padding: "8px 0" }}>
            <div style={{ fontSize: 10, color: "var(--kl-text-muted)", padding: "4px 14px", borderBottom: "1px solid var(--kl-border)", marginBottom: 4 }}>Current</div>
            {currentYaml.split("\n").map((line, i) => (
              <div key={i} style={{ padding: "0 14px", color: "var(--kl-text)", whiteSpace: "pre-wrap" }}>{line || " "}</div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
