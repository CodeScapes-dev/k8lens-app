"use client";

import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

export function RolloutHistoryTab({ deployment, replicaSets = [] }) {
  if (!deployment) return null;

  const currentRevision = Number(deployment.metadata?.annotations?.["deployment.kubernetes.io/revision"] ?? 0);

  const sorted = [...replicaSets]
    .map((rs) => ({
      rs,
      revision: Number(rs.metadata?.annotations?.["deployment.kubernetes.io/revision"] ?? 0),
    }))
    .sort((a, b) => b.revision - a.revision);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="Revision History" subtitle={`${replicaSets.length} revision${replicaSets.length !== 1 ? "s" : ""}`} style={{ overflow: "hidden" }}>
        {sorted.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No replica sets found</span>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">Rev</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">ReplicaSet</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Image</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">Desired</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">Ready</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[70px]">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(({ rs, revision }) => {
                const isCurrent = revision === currentRevision;
                const desired = rs.spec?.replicas ?? 0;
                const ready = rs.status?.readyReplicas ?? 0;
                const image = rs.spec?.template?.spec?.containers?.[0]?.image ?? "—";

                return (
                  <TableRow key={rs.metadata?.uid} className={isCurrent ? "" : "opacity-60"}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">#{revision}</span>
                        {isCurrent && <KLBadge tone="ok">current</KLBadge>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-[220px] truncate">{rs.metadata?.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[260px] truncate" title={image}>{image}</TableCell>
                    <TableCell className="font-mono text-xs">{desired}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <KLStatus kind={ready === desired && desired > 0 ? "ok" : ready === 0 ? "err" : "warn"} dotOnly />
                        <span className="font-mono text-xs">{ready}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rs.metadata?.creationTimestamp ? calculateAge(rs.metadata.creationTimestamp) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {sorted.length > 0 && (
        <Panel title="Container Images per Revision" subtitle={`${sorted.length} revision${sorted.length !== 1 ? "s" : ""}`}>
          <div className="flex flex-col gap-3">
            {sorted.map(({ rs, revision }) => {
              const isCurrent = revision === currentRevision;
              const containers = rs.spec?.template?.spec?.containers ?? [];
              return (
                <div
                  key={rs.metadata?.uid}
                  className={`rounded-lg border p-3 flex flex-col gap-2.5 ${isCurrent ? "border-[var(--kl-ok)] bg-[color-mix(in_srgb,var(--kl-ok)_6%,transparent)]" : "border-border bg-[var(--kl-surface-2)] opacity-70"}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-foreground">#{revision}</span>
                    {isCurrent && <KLBadge tone="ok">current</KLBadge>}
                    <span className="font-mono text-[11px] text-muted-foreground truncate min-w-0">{rs.metadata?.name}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {containers.map((c) => (
                      <div key={c.name} className="grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: "minmax(60px, 120px) 1fr" }}>
                        <span className="text-[11px] text-muted-foreground font-medium truncate self-start pt-px">{c.name}</span>
                        <span className="font-mono text-[11px] text-foreground/80 break-all leading-snug">{c.image}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
