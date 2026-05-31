"use client";

import React from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServerIcon, ChevronDownIcon, CheckIcon, LayersIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function NamespaceMultiSelect({ namespaces, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const selectedSet = new Set(selected);

  const toggle = (ns) => {
    const next = new Set(selectedSet);
    if (next.has(ns)) {
      next.delete(ns);
    } else {
      next.add(ns);
    }
    onChange(Array.from(next));
  };

  const label =
    selected.length === 0
      ? "All namespaces"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} namespaces selected`;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal h-8 text-sm"
        >
          <span className={cn(selected.length === 0 && "text-muted-foreground")}>
            {label}
          </span>
          <ChevronDownIcon className="size-4 ml-2 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[--radix-dropdown-menu-trigger-width] max-h-56 overflow-y-auto"
        align="start"
      >
        <button
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm cursor-pointer"
          onClick={() => onChange([])}
        >
          <CheckIcon
            className={cn("size-3.5 shrink-0", selected.length === 0 ? "opacity-100" : "opacity-0")}
          />
          <span className="text-muted-foreground">All namespaces</span>
        </button>
        <div className="h-px bg-border my-1" />
        {namespaces.map((ns) => (
          <button
            key={ns}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-accent rounded-sm cursor-pointer"
            onClick={() => toggle(ns)}
          >
            <CheckIcon
              className={cn("size-3.5 shrink-0", selectedSet.has(ns) ? "opacity-100" : "opacity-0")}
            />
            <span className="font-mono">{ns}</span>
          </button>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NamespacesTab() {
  const { clusters, preferences, setPreference } = useClusterStore();

  const setClusterNs = (contextName, arr) => {
    setPreference({
      defaultNamespaces: {
        ...(preferences.defaultNamespaces ?? {}),
        [contextName]: arr,
      },
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold mb-0.5">Namespaces</h3>
        <p className="text-sm text-muted-foreground">
          Pin default namespaces per cluster. Leave empty to show all.
        </p>
      </div>

      <Separator />

      {clusters.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
            <ServerIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Connect a cluster to configure namespace defaults.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {clusters.map((cluster) => {
            const selected = (preferences.defaultNamespaces ?? {})[cluster.contextName] ?? [];
            return (
              <div key={cluster.contextName} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <LayersIcon className="size-3.5 text-muted-foreground" />
                  <Tooltip delayDuration={600}>
                    <TooltipTrigger asChild>
                      <Label className="text-sm font-medium font-mono cursor-help">
                        {cluster.contextName}
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">
                      {cluster.namespaces?.length ?? 0} namespaces available &bull; {cluster.server}
                    </TooltipContent>
                  </Tooltip>
                  {selected.length > 0 && (
                    <span className="text-xs text-muted-foreground">({selected.length} pinned)</span>
                  )}
                </div>
                <NamespaceMultiSelect
                  namespaces={cluster.namespaces ?? []}
                  selected={selected}
                  onChange={(arr) => setClusterNs(cluster.contextName, arr)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
