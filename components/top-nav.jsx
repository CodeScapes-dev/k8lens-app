"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckIcon, ChevronDownIcon, LayoutDashboardIcon, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navigation } from "@/data/navigation";
import { useClusterStore } from "@/stores/clusterStore";
import { NavIcon } from "@/components/nav-drawer";
import { KLLogo } from "@/components/kl/Logo";
import { cn } from "@/lib/utils";

const itemClass =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground";
const activeClass = "bg-accent text-foreground";

function ClusterMenu({ onAddCluster }) {
  const { clusters, activeContext, switchCluster } = useClusterStore();
  const current = clusters.find((c) => c.contextName === activeContext);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(itemClass, "font-mono text-xs text-foreground")}>
          <span className="flex size-5 items-center justify-center rounded bg-muted text-[10px] font-bold">
            {current?.contextName?.[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="max-w-40 truncate">{current?.contextName ?? "No cluster"}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56 rounded-lg">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connected Clusters</div>
        {clusters.map((cluster) => (
          <DropdownMenuItem key={cluster.contextName} onClick={() => switchCluster(cluster.contextName)} className="cursor-pointer gap-2 p-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-bold">
              {cluster.contextName[0]?.toUpperCase()}
            </span>
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate font-mono text-xs font-medium">{cluster.contextName}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">{cluster.server?.replace(/^https?:\/\//, "") ?? "—"}</span>
            </span>
            {activeContext === cluster.contextName && <CheckIcon className="size-3.5 shrink-0 text-green-600" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer gap-2 p-2" onClick={onAddCluster}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border">
            <PlusIcon className="size-4" />
          </span>
          <span className="font-medium text-muted-foreground">Add Cluster</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopNav({ onAddCluster }) {
  const pathname = usePathname();
  const { preferences } = useClusterStore();
  const hidden = new Set(preferences?.hiddenSections ?? []);
  const sections = navigation.filter((s) => !hidden.has(s.label));

  return (
    <nav aria-label="Main" className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-3">
      <div className="mr-1 shrink-0 pr-1">
        <KLLogo size={18} withWordmark />
      </div>
      <ClusterMenu onAddCluster={onAddCluster} />
      <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />

      <Link href="/dashboard" className={cn(itemClass, pathname === "/dashboard" && activeClass)}>
        <LayoutDashboardIcon className="size-4" />
        Dashboard
      </Link>

      {sections.map((section) => {
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <DropdownMenu key={section.label}>
            <DropdownMenuTrigger asChild>
              <button className={cn(itemClass, active && activeClass)}>
                <NavIcon name={section.icon} />
                {section.label}
                <ChevronDownIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52 rounded-lg">
              {section.items.map((item) => (
                <DropdownMenuItem key={item.href} asChild className="cursor-pointer">
                  <Link href={item.href} className={cn("gap-2", pathname === item.href && "bg-accent")}>
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
