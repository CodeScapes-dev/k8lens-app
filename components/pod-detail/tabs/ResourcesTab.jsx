"use client";

import { KLBadge } from "@/components/kl/Badge";
import { parseK8sResourceValue, formatMemory } from "@/lib/k8s/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Panel } from "@/components/kl/Panel";

function stateLabel(cs) {
  if (!cs?.state) return "—";
  return Object.keys(cs.state)[0];
}

function stateTone(cs) {
  const key = Object.keys(cs?.state ?? {})[0];
  if (key === "running") return "ok";
  if (key === "waiting") return "warn";
  if (key === "terminated")
    return cs.state.terminated?.exitCode === 0 ? "neutral" : "err";
  return "neutral";
}

function fmtMemory(raw) {
  if (!raw) return "—";
  return formatMemory(parseK8sResourceValue(raw, "memory"));
}

export function ResourcesTab({ pod }) {
  if (!pod) return null;
  const spec = pod.spec ?? {};
  const status = pod.status ?? {};
  const containerStatuses = status.containerStatuses ?? [];
  const containers = spec.containers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="Container Resources">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Container</TableHead>
                <TableHead>State</TableHead>
                <TableHead>CPU Req</TableHead>
                <TableHead>CPU Limit</TableHead>
                <TableHead>Mem Req</TableHead>
                <TableHead>Mem Limit</TableHead>
                <TableHead className="text-right">Restarts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((c) => {
                const cs = containerStatuses.find((s) => s.name === c.name);
                const res = c.resources ?? {};
                return (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <KLBadge tone={stateTone(cs)}>{stateLabel(cs)}</KLBadge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {res.requests?.cpu ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {res.limits?.cpu ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtMemory(res.requests?.memory)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtMemory(res.limits?.memory)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {cs?.restartCount ?? 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {containers.map((c) => {
        const envVars = c.env ?? [];
        if (envVars.length === 0) return null;
        return (
          <Panel
            key={c.name}
            title={`Environment · ${c.name}`}
            subtitle={`${envVars.length} variable${envVars.length !== 1 ? "s" : ""}`}
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {envVars.map((e, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs font-medium w-[220px]">
                        {e.name}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs text-muted-foreground max-w-[400px] truncate"
                      >
                        {e.value ?? (e.valueFrom ? "<from ref>" : "—")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
