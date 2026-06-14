"use client";

import { Panel } from "@/components/kl/Panel";
import { KLBadge } from "@/components/kl/Badge";
import { parseK8sResourceValue, formatMemory } from "@/lib/k8s/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function fmtMemory(raw) {
  if (!raw) return "—";
  return formatMemory(parseK8sResourceValue(raw, "memory"));
}

function ContainersTable({ containers, title }) {
  if (!containers.length) return null;
  return (
    <Panel title={title} subtitle={`${containers.length} container${containers.length !== 1 ? "s" : ""}`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Container</TableHead>
              <TableHead>Image</TableHead>
              <TableHead>CPU Req</TableHead>
              <TableHead>CPU Limit</TableHead>
              <TableHead>Mem Req</TableHead>
              <TableHead>Mem Limit</TableHead>
              <TableHead>Ports</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {containers.map((c) => {
              const res = c.resources ?? {};
              return (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {c.image ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{res.requests?.cpu ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{res.limits?.cpu ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{fmtMemory(res.requests?.memory)}</TableCell>
                  <TableCell className="font-mono text-xs">{fmtMemory(res.limits?.memory)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {c.ports?.length > 0
                        ? c.ports.map((p, i) => (
                            <KLBadge key={i} tone="neutral">{p.containerPort}/{p.protocol ?? "TCP"}</KLBadge>
                          ))
                        : <span className="text-xs text-muted-foreground">—</span>
                      }
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

function EnvTable({ containers }) {
  return containers.filter((c) => c.env?.length > 0).map((c) => (
    <Panel key={c.name} title={`Environment · ${c.name}`} subtitle={`${c.env.length} variable${c.env.length !== 1 ? "s" : ""}`}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {c.env.map((e, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs font-medium w-[220px]">{e.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground max-w-[400px] truncate">
                  {e.value ?? (e.valueFrom ? "<from ref>" : "—")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  ));
}

export function ResourcesTab({ containers = [], sts }) {
  const allContainers = containers.length
    ? containers
    : (sts?.spec?.template?.spec?.containers ?? []);
  const initContainers = sts?.spec?.template?.spec?.initContainers ?? [];
  const volumes = sts?.spec?.template?.spec?.volumes ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ContainersTable containers={allContainers} title="Containers" />
      <ContainersTable containers={initContainers} title="Init Containers" />
      <EnvTable containers={[...allContainers, ...initContainers]} />

      {volumes.length > 0 && (
        <Panel title="Volumes" subtitle={`${volumes.length} volume${volumes.length !== 1 ? "s" : ""}`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumes.map((v) => {
                  const type = Object.keys(v).find((k) => k !== "name") ?? "unknown";
                  return (
                    <TableRow key={v.name}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell><KLBadge tone="neutral">{type}</KLBadge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
      )}
    </div>
  );
}
