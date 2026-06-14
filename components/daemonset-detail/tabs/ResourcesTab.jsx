"use client";

import { useRouter } from "next/navigation";
import { calculateAge, parseK8sResourceValue, formatMemory } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

function fmtCpu(raw) {
  if (!raw) return "—";
  const m = parseK8sResourceValue(raw, "cpu") * 1000;
  return m >= 1000 ? `${(m / 1000).toFixed(2)}` : `${Math.round(m)}m`;
}

function fmtMem(raw) {
  if (!raw) return "—";
  const bytes = parseK8sResourceValue(raw, "memory");
  return formatMemory(bytes);
}

function fmtResources(res) {
  if (!res) return "—";
  const parts = [];
  if (res.cpu) parts.push(`CPU: ${fmtCpu(res.cpu)}`);
  if (res.memory) parts.push(`Mem: ${fmtMem(res.memory)}`);
  return parts.join("  ·  ") || "—";
}

export function ResourcesTab({ containers, pods }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-4">
      {containers.length > 0 && (
        <Panel title="Container Template" subtitle="Container specifications for pods created by this DaemonSet" style={{ overflow: "hidden" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Image</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Ports</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Requests</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Limits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {containers.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-mono text-xs font-semibold">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={c.image}>{c.image}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {c.ports?.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}`).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {fmtResources(c.resources?.requests)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {fmtResources(c.resources?.limits)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {pods.length > 0 && (
        <Panel title="Managed Pods" subtitle={`Pods controlled by this DaemonSet`} style={{ overflow: "hidden" }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-6" />
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Name</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">Restarts</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[70px]">Ready</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[90px]">Status</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[80px]">CPU</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[90px]">Memory</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[110px]">IP</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Node</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-[60px]">Age</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pods.map((pod) => {
                const phase = pod.status?.phase ?? "Unknown";
                const pkind = phase === "Running" ? "ok" : phase === "Pending" ? "warn" : "err";
                const restarts = (pod.status?.containerStatuses ?? []).reduce((s, c) => s + (c.restartCount ?? 0), 0);
                const totalC = pod.spec?.containers?.length ?? 0;
                const readyC = (pod.status?.containerStatuses ?? []).filter((c) => c.ready).length;
                const podContainers = pod.spec?.containers ?? [];
                const cpuCores = podContainers.reduce((s, c) => s + parseK8sResourceValue(c.resources?.requests?.cpu, "cpu"), 0);
                const memBytes = podContainers.reduce((s, c) => s + parseK8sResourceValue(c.resources?.requests?.memory, "memory"), 0);
                const podNode = pod.spec?.nodeName ?? "—";
                const namespace = pod.metadata?.namespace;
                return (
                  <TableRow
                    key={pod.metadata?.uid}
                    className="cursor-pointer"
                    onClick={() => router.push(`/workloads/pods/${namespace}/${pod.metadata?.name}`)}
                  >
                    <TableCell><KLStatus kind={pkind} dotOnly /></TableCell>
                    <TableCell className="font-mono text-xs text-[var(--kl-accent)] max-w-[180px] truncate">{pod.metadata?.name}</TableCell>
                    <TableCell className="font-mono text-xs">{restarts}</TableCell>
                    <TableCell className="font-mono text-xs">{readyC}/{totalC}</TableCell>
                    <TableCell><KLBadge tone={pkind}>{phase}</KLBadge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{cpuCores > 0 ? (cpuCores * 1000 >= 1000 ? `${cpuCores.toFixed(2)}` : `${Math.round(cpuCores * 1000)}m`) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{memBytes > 0 ? formatMemory(memBytes) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{pod.status?.podIP ?? "—"}</TableCell>
                    <TableCell
                      className="font-mono text-xs text-[var(--kl-accent)] truncate max-w-[120px] cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); if (podNode !== "—") router.push(`/cluster/nodes/${podNode}`); }}
                    >{podNode}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{pod.metadata?.creationTimestamp ? calculateAge(pod.metadata.creationTimestamp) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
