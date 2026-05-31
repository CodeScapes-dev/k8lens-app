"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KIND_COLOR, kindRoute } from "@/lib/k8s/kind-config";

function KV({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, color: "var(--kl-text-muted)", minWidth: 100, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 11, color: "var(--kl-text)", wordBreak: "break-all", fontFamily: "monospace" }}>{String(value)}</span>
    </div>
  );
}

function LabelChips({ labels }) {
  if (!labels || Object.keys(labels).length === 0) return <span style={{ fontSize: 11, color: "var(--kl-text-muted)" }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {Object.entries(labels).map(([k, v]) => (
        <Badge key={k} variant="secondary" style={{ fontSize: 9.5, fontFamily: "monospace" }}>{k}={v}</Badge>
      ))}
    </div>
  );
}

export function NodeDetailDrawer({ node, open, onClose }) {
  const router = useRouter();
  if (!node) return null;

  const color = KIND_COLOR[node.kind] ?? "#94a3b8";
  const route = kindRoute(node.kind, node.namespace, node.name);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" style={{ width: 380, overflowY: "auto" }}>
        <SheetHeader style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color,
                background: color + "20",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {node.kind}
            </span>
            {node.status && (
              <span style={{ fontSize: 10, color: "var(--kl-text-muted)" }}>{node.status}</span>
            )}
          </div>
          <SheetTitle style={{ fontSize: 14, fontFamily: "monospace", wordBreak: "break-all" }}>
            {node.name}
          </SheetTitle>
        </SheetHeader>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--kl-text-muted)", marginBottom: 8 }}>
              Metadata
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <KV label="Namespace" value={node.namespace ?? "—"} />
              <KV label="Scope" value={node.scope} />
              {node.replicas != null && <KV label="Replicas" value={node.replicas} />}
            </div>
          </section>

          <section>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--kl-text-muted)", marginBottom: 8 }}>
              Labels
            </div>
            <LabelChips labels={node.labels} />
          </section>

          {node.ownerRefs?.length > 0 && (
            <section>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--kl-text-muted)", marginBottom: 8 }}>
                Owner References
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {node.ownerRefs.map((ref, i) => (
                  <div key={i} style={{ fontSize: 11, fontFamily: "monospace", color: "var(--kl-text-muted)" }}>
                    {ref.kind}/{ref.name}
                  </div>
                ))}
              </div>
            </section>
          )}

          {route && (
            <Button
              size="sm"
              variant="outline"
              style={{ alignSelf: "flex-start", fontSize: 12 }}
              onClick={() => { router.push(route); onClose(); }}
            >
              Open Detail Page →
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
