import React from "react";
import { Panel } from "@/components/kl/Panel";

export function DataTab({ configMap }) {
  const [expandedKey, setExpandedKey] = React.useState(null);
  const cmData = configMap?.data ?? {};
  const keys = Object.keys(cmData);

  if (keys.length === 0) {
    return <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No data keys.</span>;
  }

  return (
    <div className="flex flex-col gap-3">
      {keys.map((k) => (
        <Panel key={k} title={k} rowAction={
          <button onClick={() => setExpandedKey(expandedKey === k ? null : k)} style={{ fontSize: 11, background: "none", border: "1px solid var(--kl-border)", borderRadius: 4, padding: "3px 8px", cursor: "pointer", color: "var(--kl-text-muted)" }}>
            {expandedKey === k ? "Collapse" : "Expand"}
          </button>
        }>
          <pre style={{ fontSize: 11.5, fontFamily: "monospace", color: "var(--kl-text)", overflow: "auto", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: expandedKey === k ? "none" : 120 }}>
            {cmData[k]}
          </pre>
        </Panel>
      ))}
    </div>
  );
}
