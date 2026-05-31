"use client";

import { DownloadIcon, CheckIcon } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

const VERBS = ["get", "list", "watch", "create", "update", "patch", "delete", "*"];

function buildMatrix(rules = []) {
  const resourceMap = new Map();
  rules.forEach((rule) => {
    const resources = rule?.resources ?? [];
    const verbs = rule?.verbs ?? [];
    const apiGroup = (rule?.apiGroups ?? [""])[0] ?? "";
    resources.forEach((resource) => {
      if (!resourceMap.has(resource)) resourceMap.set(resource, { verbs: new Set(), grants: new Map() });
      const entry = resourceMap.get(resource);
      verbs.forEach((v) => {
        entry.verbs.add(v);
        if (!entry.grants.has(v)) entry.grants.set(v, []);
        entry.grants.get(v).push({ apiGroup, resource, verbs });
      });
    });
  });
  const entries = Array.from(resourceMap.entries());
  return [...entries.filter(([r]) => r !== "*").sort(([a], [b]) => a.localeCompare(b)), ...entries.filter(([r]) => r === "*")];
}

function exportCsv(matrix) {
  const header = ["Resource", ...VERBS].join(",");
  const rows = matrix.map(([resource, { verbs }]) =>
    [resource, ...VERBS.map((v) => (verbs.has(v) || verbs.has("*") ? "✓" : ""))].join(","),
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "rbac-matrix.csv"; a.click();
  URL.revokeObjectURL(url);
}

export function PermissionMatrixTab({ rules = [] }) {
  const matrix = buildMatrix(rules);
  if (matrix.length === 0) return (
    <div className="py-10 text-center text-sm text-muted-foreground">No rules defined for this role.</div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button onClick={() => exportCsv(matrix)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-muted/40 text-muted-foreground text-xs cursor-pointer hover:bg-muted transition-colors">
          <DownloadIcon size={12} /> Export CSV
        </button>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs uppercase tracking-wide text-muted-foreground font-semibold w-[1%] whitespace-nowrap pl-4">Resource</TableHead>
              {VERBS.map((v) => (
                <TableHead key={v} className={`text-xs uppercase tracking-wide font-semibold text-center w-16 ${v === "*" ? "text-destructive" : "text-muted-foreground"}`}>{v}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map(([resource, { verbs, grants }], i) => {
              const isWildcard = resource === "*";
              return (
                <TableRow key={resource} className={`h-11 ${isWildcard ? "bg-amber-500/5" : i % 2 !== 0 ? "bg-muted/30" : ""}`}>
                  <TableCell className={`font-mono text-xs pl-4 whitespace-nowrap py-0 ${isWildcard ? "text-amber-500 font-bold" : "text-foreground"}`}>{resource}</TableCell>
                  {VERBS.map((v) => {
                    const granted = verbs.has(v) || verbs.has("*");
                    const isWildcardVerb = v === "*" && verbs.has("*");
                    const cellRules = grants.get(v) ?? grants.get("*") ?? [];
                    const tooltip = cellRules[0] ? `API Group: ${cellRules[0].apiGroup || "core"}\nResource: ${cellRules[0].resource}\nVerbs: ${cellRules[0].verbs.join(", ")}` : "";
                    return (
                      <TableCell key={v} className={`text-center py-0 ${isWildcardVerb ? "bg-destructive/10" : ""}`}>
                        {granted && (
                          <span title={tooltip} className="inline-flex justify-center cursor-help">
                            <CheckIcon size={13} className={v === "*" ? "text-destructive" : "text-green-500"} />
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
