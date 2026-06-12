"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatLabel } from "@/lib/k8s/utils";

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      <div className="font-mono text-sm font-semibold truncate">{value ?? "—"}</div>
    </div>
  );
}

export function NetworkingTab({ pod }) {
  if (!pod) return null;
  const spec = pod.spec ?? {};
  const status = pod.status ?? {};

  const ports = (spec.containers ?? []).flatMap((c) =>
    (c.ports ?? []).map((p) => ({ container: c.name, ...p }))
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pod IP" value={status.podIP} />
        <StatCard label="Host IP" value={status.hostIP} />
        <StatCard label="Service Account" value={spec.serviceAccountName} />
        <StatCard label="DNS Policy" value={spec.dnsPolicy ? formatLabel(spec.dnsPolicy) : "—"} />
      </div>

      <Card className="p-0 gap-0">
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
          <div>
            <CardTitle className="text-[13.5px] font-semibold">Ports</CardTitle>
            <p className="text-[10.5px] font-mono text-muted-foreground mt-0.5">{ports.length} port{ports.length !== 1 ? "s" : ""}</p>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {ports.length === 0 ? (
            <span className="text-xs text-muted-foreground">No ports exposed</span>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[360px]">
                <div className="grid gap-x-3 mb-2" style={{ gridTemplateColumns: "1fr 80px 80px 80px" }}>
                  {["Container", "Port", "Protocol", "Host Port"].map((h) => (
                    <span key={h} className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">{h}</span>
                  ))}
                </div>
                {ports.map((p, i) => (
                  <div key={i} className="grid gap-x-3 py-2 border-t border-border" style={{ gridTemplateColumns: "1fr 80px 80px 80px" }}>
                    <span className="text-sm truncate">{p.container}</span>
                    <span className="font-mono text-sm">{p.containerPort}</span>
                    <span className="font-mono text-sm text-muted-foreground">{p.protocol ?? "TCP"}</span>
                    <span className="font-mono text-sm text-muted-foreground">{p.hostPort ?? "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
