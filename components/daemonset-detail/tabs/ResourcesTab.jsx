"use client";

import { useRouter } from "next/navigation";
import { calculateAge } from "@/lib/k8s/utils";
import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { KLStatus } from "@/components/kl/Status";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

function parseCpu(cpu = "0") {
  if (!cpu) return 0;
  return cpu.endsWith("m") ? parseInt(cpu) : parseInt(cpu) * 1000;
}
function parseMem(mem = "0") {
  if (!mem) return 0;
  if (mem.endsWith("Mi")) return parseFloat(mem);
  if (mem.endsWith("Gi")) return parseFloat(mem) * 1024;
  return 0;
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
                    {c.resources?.requests ? Object.entries(c.resources.requests).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.resources?.limits ? Object.entries(c.resources.limits).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}
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
                const cpuM = podContainers.reduce((s, c) => s + parseCpu(c.resources?.requests?.cpu), 0);
                const memMi = podContainers.reduce((s, c) => s + parseMem(c.resources?.requests?.memory), 0);
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{(cpuM / 1000).toFixed(2)} m</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{memMi.toFixed(1)} Mi</TableCell>
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
