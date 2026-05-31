"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  HomeIcon,
  Settings2Icon,
  SearchIcon,
  DownloadIcon,
  RefreshCwIcon,
  TimerIcon,
} from "lucide-react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { NavDrawer } from "@/components/nav-drawer";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { SearchDialog } from "@/components/search-dialog";
import { navigation } from "@/data/navigation";
import { useClusterStore } from "@/stores/clusterStore";
import { cn } from "@/lib/utils";

function getBreadcrumbs(pathname) {
  if (!pathname || pathname === "/") return null;

  for (const section of navigation) {
    const item = section.items.find((i) => i.href === pathname);
    if (item) return { section: section.label, item: item.label };

    const listHref = "/" + pathname.split("/").slice(1, 3).join("/");
    const listItem = section.items.find((i) => i.href === listHref);
    if (listItem) {
      const resourceName = pathname.split("/").at(-1);
      return { section: section.label, item: listItem.label, detail: resourceName };
    }
  }
  return null;
}

function HeaderBreadcrumbs({ pathname }) {
  const crumbs = getBreadcrumbs(pathname);

  if (!crumbs) {
    return (
      <span className="text-sm font-semibold tracking-tight flex-1">
        KuLens
      </span>
    );
  }

  return (
    <Breadcrumb className="flex-1 min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="hidden sm:flex">
          <BreadcrumbLink href="/" className="flex items-center gap-1">
            <HomeIcon className="size-3.5" />
            <span className="sr-only">Home</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden sm:flex" />
        <BreadcrumbItem className="hidden sm:flex">
          {crumbs.detail ? (
            <BreadcrumbLink href="#" className="text-xs">
              {crumbs.section}
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage className="text-xs font-medium text-foreground">
              {crumbs.section}
            </BreadcrumbPage>
          )}
        </BreadcrumbItem>
        {crumbs.item && (
          <>
            <BreadcrumbSeparator className="hidden sm:flex" />
            <BreadcrumbItem className="hidden sm:flex">
              {crumbs.detail ? (
                <BreadcrumbLink
                  href={"/" + pathname.split("/").slice(1, 3).join("/")}
                  className="text-xs"
                >
                  {crumbs.item}
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="text-xs font-medium text-foreground">
                  {crumbs.item}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </>
        )}
        {crumbs.detail && (
          <>
            <BreadcrumbSeparator className="hidden sm:flex" />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="text-xs font-medium text-foreground font-mono truncate max-w-[180px] sm:max-w-[320px]">
                {crumbs.detail}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function autoRefreshLabel(seconds) {
  if (!seconds || seconds === 0) return "Off";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

export function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("general");
  const [searchOpen, setSearchOpen] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  const { clusters, preferences } = useClusterStore();
  const autoRefresh = preferences?.autoRefresh ?? 0;

  useEffect(() => {
    useClusterStore.persist.rehydrate();
    setHasHydrated(true);
  }, []);

  const openSettings = (tab = "general") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  useEffect(() => {
    const crumbs = getBreadcrumbs(pathname);
    if (!crumbs) {
      document.title = "KuLens — Kubernetes Dashboard";
    } else if (crumbs.detail) {
      document.title = `${crumbs.detail} · ${crumbs.item} — KuLens`;
    } else {
      document.title = `${crumbs.item} — KuLens`;
    }
  }, [pathname]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => openSettings(e.detail?.tab ?? "general");
    window.addEventListener("kl:open-settings", handler);
    return () => window.removeEventListener("kl:open-settings", handler);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (clusters.length === 0 && pathname !== "/connect") {
      router.replace("/connect");
    }
  }, [hasHydrated, clusters.length, pathname, router]);

  // Countdown timer that stays in sync with auto-refresh
  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(0);
      return;
    }
    setCountdown(autoRefresh);
    setProgressKey((k) => k + 1);
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { setProgressKey((k) => k + 1); return autoRefresh; }
        return c - 1;
      });
    }, 1000);
    const onRefreshed = () => { setCountdown(autoRefresh); setProgressKey((k) => k + 1); };
    window.addEventListener("kl:refreshed", onRefreshed);
    return () => { clearInterval(tick); window.removeEventListener("kl:refreshed", onRefreshed); };
  }, [autoRefresh]);

  if (!hasHydrated) return null;

  if (clusters.length === 0 || pathname === "/connect") return <>{children}</>;

  const handleExportCSV = () => {
    window.dispatchEvent(new CustomEvent("kl:export-csv"));
  };

  return (
    <>
      <NavDrawer
        onAddCluster={() => router.push("/connect")}
        onOpenSettings={openSettings}
      />

      <SidebarInset>
        <style>{`@keyframes kl-progress { from { width: 100%; } to { width: 0%; } }`}</style>
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-2 shrink-0 h-[52px] rounded-t-xl" style={{ position: "relative" }}>
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <SidebarTrigger className="text-foreground" />
            </TooltipTrigger>
            <TooltipContent className="text-xs">Toggle sidebar</TooltipContent>
          </Tooltip>

          <HeaderBreadcrumbs pathname={pathname} />

          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-colors w-[200px]"
          >
            <SearchIcon className="size-3.5 shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="font-sans text-[10px] tracking-tight">⌘K</kbd>
          </button>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 shrink-0 text-foreground"
                onClick={handleExportCSV}
              >
                <DownloadIcon className="size-4" />
                <span className="sr-only">Export CSV</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Export CSV</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "shrink-0 gap-1.5 px-2 h-8 text-xs text-foreground",
                  autoRefresh > 0 && "text-foreground"
                )}
                onClick={() => openSettings("general")}
              >
                {autoRefresh > 0 ? (
                  <TimerIcon className="size-3.5" />
                ) : (
                  <RefreshCwIcon className="size-3.5" />
                )}
                <span className="hidden sm:inline">
                  {autoRefresh > 0 ? `in ${countdown}s` : "Refresh"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {autoRefresh > 0
                ? `Auto-refresh every ${autoRefreshLabel(autoRefresh)} · next in ${countdown}s · click to change`
                : "Auto-refresh off · click to configure"}
            </TooltipContent>
          </Tooltip>

          {/* Progress bar at bottom of header */}
          {autoRefresh > 0 && (
            <div
              key={progressKey}
              style={{
                position: "absolute", bottom: 0, left: 0, height: 2,
                background: "var(--kl-accent)", opacity: 0.45,
                animationName: "kl-progress",
                animationDuration: `${autoRefresh}s`,
                animationTimingFunction: "linear",
                animationFillMode: "forwards",
              }}
            />
          )}

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="size-8 p-0 shrink-0 text-foreground"
                onClick={() => openSettings("general")}
              >
                <Settings2Icon className="size-4" />
                <span className="sr-only">Settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Settings</TooltipContent>
          </Tooltip>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </SidebarInset>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialTab={settingsTab}
      />

      <Toaster position="bottom-right" richColors />
    </>
  );
}
