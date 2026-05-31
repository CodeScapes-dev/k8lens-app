"use client";

import React from "react";

export function NamespaceGroupNode({ data }) {
  const { group } = data;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1.5px solid var(--kl-border-strong)",
        borderRadius: 12,
        background: "var(--kl-surface-2)",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid var(--kl-border)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "var(--kl-surface-3)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="#6366f1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--kl-text-2)",
            letterSpacing: 0.3,
          }}
        >
          Namespace:{" "}
          <span style={{ color: "var(--kl-text)", fontFamily: "monospace" }}>
            {group.label}
          </span>
        </span>
      </div>
    </div>
  );
}

export function ClusterGroupNode({ data }) {
  const { group } = data;
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1.5px dashed var(--kl-border-strong)",
        borderRadius: 12,
        background: "var(--kl-surface-2)",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px dashed var(--kl-border)",
          display: "flex",
          alignItems: "center",
          gap: 7,
          background: "var(--kl-surface-3)",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#7c3aed" strokeWidth="2" />
          <circle cx="12" cy="12" r="3" fill="#7c3aed" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--kl-text-2)",
            letterSpacing: 0.3,
          }}
        >
          {group.label}
        </span>
      </div>
    </div>
  );
}
