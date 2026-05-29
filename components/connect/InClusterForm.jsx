import { ServerIcon } from "lucide-react";

export function InClusterForm() {
  return (
    <div className="mb-5 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <ServerIcon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="mb-1 text-sm font-medium">Detect from environment</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Reads <code className="rounded bg-muted px-1 py-0.5 font-mono">~/.kube/config</code> or{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono">KUBECONFIG</code>. All contexts will be imported.
          </p>
        </div>
      </div>
    </div>
  );
}
