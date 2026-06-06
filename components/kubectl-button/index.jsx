"use client";

import React from "react";
import { TerminalIcon, CopyIcon, CheckIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function KubectlButton({ command }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Show kubectl command"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 6,
            border: "1px solid var(--kl-border)",
            background: "var(--kl-surface-2)",
            color: "var(--kl-text-muted)",
            cursor: "pointer",
            flexShrink: 0,
            transition: "color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--kl-accent)";
            e.currentTarget.style.background = "var(--kl-surface)";
            e.currentTarget.style.borderColor = "var(--kl-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--kl-text-muted)";
            e.currentTarget.style.background = "var(--kl-surface-2)";
            e.currentTarget.style.borderColor = "var(--kl-border)";
          }}
        >
          <TerminalIcon size={13} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="w-auto max-w-sm p-0 overflow-hidden">
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px 8px",
          borderBottom: "1px solid var(--kl-border)",
          gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TerminalIcon size={12} style={{ color: "var(--kl-accent)" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--kl-text)" }}>
              kubectl command
            </span>
          </div>
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 8px",
              borderRadius: 5,
              border: "1px solid var(--kl-border)",
              background: copied ? "var(--kl-ok-tint, rgba(34,197,94,0.1))" : "var(--kl-surface-2)",
              color: copied ? "var(--kl-ok)" : "var(--kl-text-muted)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              transition: "all 0.15s",
              flexShrink: 0,
            }}
          >
            {copied
              ? <><CheckIcon size={11} /> Copied</>
              : <><CopyIcon size={11} /> Copy</>
            }
          </button>
        </div>

        {/* Code block */}
        <div style={{ padding: "10px 12px" }}>
          <pre style={{
            margin: 0,
            padding: "8px 12px",
            borderRadius: 6,
            background: "var(--kl-surface-2)",
            border: "1px solid var(--kl-border)",
            fontFamily: "var(--kl-mono, monospace)",
            fontSize: 12,
            color: "var(--kl-text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}>
            <code>{command}</code>
          </pre>
        </div>
      </PopoverContent>
    </Popover>
  );
}
