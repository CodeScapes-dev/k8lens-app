import { Panel } from "@/components/kl/Panel";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

export function ResourcesTab({ containers }) {
  return (
    <div className="flex flex-col gap-4">
      {containers.length > 0 && (
        <Panel title="Container Template" subtitle="Container specifications for jobs created by this CronJob" style={{ overflow: "hidden" }}>
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
                  <TableCell className="font-mono text-xs">{c.ports?.map((p) => `${p.containerPort}/${p.protocol ?? "TCP"}`).join(", ") || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.resources?.requests ? Object.entries(c.resources.requests).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.resources?.limits ? Object.entries(c.resources.limits).map(([k, v]) => `${k}: ${v}`).join(", ") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
      {containers.length === 0 && (
        <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No container template found.</span>
      )}
    </div>
  );
}
