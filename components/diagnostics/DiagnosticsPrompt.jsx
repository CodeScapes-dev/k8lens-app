"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KLBadge } from "@/components/kl/Badge";
import { diagnoseResource } from "@/lib/k8s/diagnostics";

const MAX_LISTED = 3;

/**
 * Opens once per resource when it is first loaded with problems, then leaves the user alone
 * (auto-refresh never re-opens it). `uid` identifies the resource so navigating to another one re-arms it.
 */
export function DiagnosticsPrompt({ resourceType, resourceLabel, data, uid, activeTab, onViewDiagnostics }) {
  const [open, setOpen] = useState(false);
  const checkedUid = useRef(null);

  useEffect(() => {
    if (!data || !uid || checkedUid.current === uid) return;
    checkedUid.current = uid;
    if (activeTab !== "Diagnostics" && diagnoseResource(resourceType, data).length > 0) setOpen(true);
  }, [data, uid, activeTab, resourceType]);

  const diagnoses = open && data ? diagnoseResource(resourceType, data) : [];
  const count = diagnoses.length;

  return (
    <Dialog open={open && count > 0} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {count === 1 ? "1 issue detected" : `${count} issues detected`}
          </DialogTitle>
          <DialogDescription>
            We found {count === 1 ? "a problem" : "problems"} with this {resourceLabel}.
          </DialogDescription>
        </DialogHeader>

        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {diagnoses.slice(0, MAX_LISTED).map((d, i) => (
            <li key={`${d.id}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{d.issue}</span>
                <KLBadge tone={d.severity === "Critical" ? "err" : "warn"}>{d.severity}</KLBadge>
              </div>
              <span style={{ fontSize: 12.5, color: "var(--kl-text-muted)", lineHeight: 1.5 }}>{d.rootCause}</span>
            </li>
          ))}
          {count > MAX_LISTED && (
            <li style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>+{count - MAX_LISTED} more</li>
          )}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              onViewDiagnostics();
            }}
          >
            View diagnostics
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
