"use client";

import React from "react";

export function PageHeader({ title, count, subtitle, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      marginBottom: 18,
    }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.6, color: "var(--kl-text)" }}>
            {title}
          </div>
          {count != null && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              height: 22, padding: "0 8px", minWidth: 28,
              background: "var(--kl-surface-2)", border: "1px solid var(--kl-border)",
              borderRadius: 999, fontSize: 11.5, fontFamily: "var(--kl-mono)",
              fontWeight: 600, color: "var(--kl-text-2)",
            }}>
              {count}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="kl-mono" style={{ fontSize: 11.5, color: "var(--kl-text-muted)", marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children && (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {children}
        </div>
      )}
    </div>
  );
}
