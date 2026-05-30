"use client";

import { scoreColor } from "@/lib/k8s/health-score";
import { formatLabel } from "@/lib/k8s/utils";
import { XIcon } from "lucide-react";

export function HealthPanel({ score, signals, anchor, onClose }) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  const top = anchor ? anchor.bottom + 8 : 64;
  const left = anchor ? Math.min(anchor.left, window.innerWidth - 396) : 24;

  const panelContent = (
    <>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--kl-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: scoreColor(score) + "22",
            border: `1.5px solid ${scoreColor(score)}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, color: scoreColor(score),
            fontFamily: "monospace",
          }}>
            {score}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--kl-text)" }}>Health Score</div>
            <div style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>
              {signals.length === 0 ? "No issues detected" : `${signals.length} issue${signals.length !== 1 ? "s" : ""} found`}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--kl-text-muted)", padding: 4 }}>
          <XIcon size={16} />
        </button>
      </div>

      <div style={{ padding: 16, overflowY: "auto", maxHeight: isMobile ? "60vh" : "calc(80vh - 70px)" }}>
        {signals.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--kl-text-muted)", fontSize: 13 }}>
            All checks passed — this resource looks healthy.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {signals.map((sig, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 8,
                background: "var(--kl-surface-2)",
                border: "1px solid var(--kl-border)",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <div style={{
                  flexShrink: 0, width: 34, height: 20, borderRadius: 4,
                  background: penaltyColor(sig.penalty) + "22",
                  border: `1px solid ${penaltyColor(sig.penalty)}`,
                  fontSize: 10, fontWeight: 700, color: penaltyColor(sig.penalty),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "monospace",
                }}>
                  -{sig.penalty}
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--kl-text)", marginBottom: 3 }}>{formatLabel(sig.label)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--kl-text-muted)", lineHeight: 1.5 }}>{sig.explanation}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} onClick={onClose}>
        {/* Scrim */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "relative",
            background: "var(--kl-surface)",
            borderRadius: "16px 16px 0 0",
            borderTop: "1px solid var(--kl-border)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          }}
        >
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--kl-border)" }} />
          </div>
          {panelContent}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top, left,
          width: 380, maxHeight: "80vh", overflowY: "auto",
          background: "var(--kl-surface)", border: "1px solid var(--kl-border)",
          borderRadius: 12,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 16px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
      >
        {panelContent}
      </div>
    </div>
  );
}

function penaltyColor(penalty) {
  if (penalty >= 30) return "var(--kl-err)";
  if (penalty >= 15) return "var(--kl-warn)";
  return "var(--kl-text-muted)";
}
