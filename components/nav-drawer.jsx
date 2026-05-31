"use client";

import React from "react";
import {
  ChevronRightIcon,
  HelpCircleIcon,
  Settings2Icon,
  ServerIcon,
  PlusIcon,
  ChevronsUpDownIcon,
  CheckIcon,
  LayoutDashboardIcon,
  // section icons
  BoxesIcon,
  SettingsIcon,
  NetworkIcon,
  HardDriveIcon,
  LockIcon,
  CloudIcon,
  WorkflowIcon,
  // item icons
  BoxIcon,
  LayersIcon,
  DatabaseIcon,
  CpuIcon,
  GitBranchIcon,
  RepeatIcon,
  ZapIcon,
  ClockIcon,
  FileTextIcon,
  KeyIcon,
  GaugeIcon,
  SlidersHorizontalIcon,
  GlobeIcon,
  GlobeLockIcon,
  ShieldCheckIcon,
  PlugIcon,
  FolderTreeIcon,
  UsersIcon,
  ShieldIcon,
  Link2Icon,
  LinkIcon,
  ActivityIcon,
  ScrollTextIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navigation } from "@/data/navigation";
import { useClusterStore } from "@/stores/clusterStore";
import { cn } from "@/lib/utils";
import { KLLogo } from "@/components/kl/Logo";

const ICON_MAP = {
  Boxes: BoxesIcon,
  Settings: SettingsIcon,
  Network: NetworkIcon,
  HardDrive: HardDriveIcon,
  Lock: LockIcon,
  Cloud: CloudIcon,
  Workflow: WorkflowIcon,
  Box: BoxIcon,
  Layers: LayersIcon,
  Database: DatabaseIcon,
  Cpu: CpuIcon,
  GitBranch: GitBranchIcon,
  Repeat: RepeatIcon,
  Zap: ZapIcon,
  Clock: ClockIcon,
  FileText: FileTextIcon,
  Key: KeyIcon,
  Gauge: GaugeIcon,
  SlidersHorizontal: SlidersHorizontalIcon,
  Server: ServerIcon,
  Globe: GlobeIcon,
  GlobeLock: GlobeLockIcon,
  ShieldCheck: ShieldCheckIcon,
  Plug: PlugIcon,
  FolderTree: FolderTreeIcon,
  Users: UsersIcon,
  Shield: ShieldIcon,
  Link2: Link2Icon,
  Link: LinkIcon,
  Activity: ActivityIcon,
  ScrollText: ScrollTextIcon,
};

function NavIcon({ name, className }) {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon className={cn("size-4", className)} /> : null;
}

function ClusterPicker({ onAddCluster }) {
  const { clusters, activeContext, switchCluster } = useClusterStore();
  const current = clusters.find((c) => c.contextName === activeContext);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-xs font-bold font-mono shrink-0">
                {current?.contextName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                <span className="truncate font-medium text-xs font-mono">
                  {current?.contextName ?? "No cluster selected"}
                </span>
                <span className="truncate text-xs text-muted-foreground font-mono">
                  {current?.server ? current.server.replace(/^https?:\/\//, "") : "—"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 shrink-0 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Connected Clusters
            </div>
            {clusters.map((cluster) => (
              <DropdownMenuItem
                key={cluster.contextName}
                onClick={() => switchCluster(cluster.contextName)}
                className="gap-2 p-2 cursor-pointer"
              >
                <div className="flex size-6 items-center justify-center rounded-md border text-[10px] font-bold font-mono shrink-0">
                  {cluster.contextName[0]?.toUpperCase()}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-medium font-mono text-xs">
                    {cluster.contextName}
                  </span>
                  <span className="truncate text-xs text-muted-foreground font-mono">
                    {cluster.server?.replace(/^https?:\/\//, "") ?? "—"}
                  </span>
                </div>
                {activeContext === cluster.contextName && (
                  <CheckIcon className="size-3.5 text-green-600 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="gap-2 p-2 cursor-pointer"
              onClick={onAddCluster}
            >
              <div className="flex size-6 items-center justify-center rounded-md border bg-transparent shrink-0">
                <PlusIcon className="size-4" />
              </div>
              <span className="font-medium text-muted-foreground">Add Cluster</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function NavDrawer({ onAddCluster, onOpenSettings }) {
  const router = useRouter();
  const pathname = usePathname();
  const [openSection, setOpenSection] = React.useState("Workloads");
  const { preferences } = useClusterStore();
  const hiddenSections = new Set(preferences?.hiddenSections ?? []);
  const visibleNav = navigation.filter((s) => !hiddenSections.has(s.label));

  const toggleSection = (label) => {
    setOpenSection((prev) => (prev === label ? null : label));
  };

  return (
    <Sidebar collapsible="offcanvas" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border pb-3">
        <div className="flex items-center justify-between px-1 py-1">
          <KLLogo size={18} withWordmark />
        </div>
        <ClusterPicker onAddCluster={onAddCluster} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2 py-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === "/dashboard"}
              className="font-medium"
            >
              <Link href="/dashboard">
                <LayoutDashboardIcon className="size-4" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {visibleNav.map((section) => (
            <Collapsible
              key={section.label}
              open={openSection === section.label}
              onOpenChange={() => toggleSection(section.label)}
              asChild
            >
              <SidebarMenuItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="font-medium">
                    <NavIcon name={section.icon} />
                    <span>{section.label}</span>
                    <ChevronRightIcon className="ml-auto size-3.5 transition-transform data-[state=open]:rotate-90" />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent asChild>
                  <SidebarMenuSub>
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={isActive}>
                            <Link
                              href={item.href}
                              className="flex items-center gap-2"
                            >
                              <NavIcon name={item.icon} />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      );
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-2 py-2 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push("/help")}
              className="gap-2 text-muted-foreground"
            >
              <HelpCircleIcon className="size-4" />
              <span>Help & FAQ</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => onOpenSettings?.("general")}
              className="gap-2 text-muted-foreground"
            >
              <Settings2Icon className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
