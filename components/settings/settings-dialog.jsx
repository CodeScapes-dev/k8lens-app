"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  XIcon,
  SearchIcon,
  Settings2Icon,
  PaletteIcon,
  ServerIcon,
  FolderIcon,
  EyeIcon,
  LayoutDashboardIcon,
  InfoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GeneralTab } from "./tabs/general-tab";
import { AppearanceTab } from "./tabs/appearance-tab";
import { ClustersTab } from "./tabs/clusters-tab";
import { NamespacesTab } from "./tabs/namespaces-tab";
import { VisibilityTab } from "./tabs/visibility-tab";
import { AboutTab } from "./tabs/about-tab";
import { DashboardTab } from "./tabs/dashboard-tab";
import { SETTINGS_GROUPS as GROUPS } from "@/lib/data";

const ICON_MAP = {
  Settings2: Settings2Icon,
  Palette: PaletteIcon,
  Server: ServerIcon,
  Folder: FolderIcon,
  Eye: EyeIcon,
  LayoutDashboard: LayoutDashboardIcon,
  Info: InfoIcon,
};

const TAB_CONTENT = {
  general: GeneralTab,
  appearance: AppearanceTab,
  clusters: ClustersTab,
  namespaces: NamespacesTab,
  visibility: VisibilityTab,
  dashboard: DashboardTab,
  about: AboutTab,
};

export function SettingsDialog({ open, onOpenChange, initialTab = "general" }) {
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [search, setSearch] = React.useState("");

  const handleOpenChange = (val) => {
    if (val) {
      setActiveTab(initialTab);
      setSearch("");
    }
    onOpenChange(val);
  };

  const filteredGroups = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  const ActiveContent = TAB_CONTENT[activeTab];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!max-w-3xl h-[80vh] p-0 gap-0 flex flex-col overflow-hidden !bg-muted"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your K8Lens dashboard preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* ── Left nav ── */}
          <aside className="w-56 shrink-0 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-4 pb-3 shrink-0">
              <DialogClose className="flex items-center justify-center size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0">
                <XIcon className="size-4" />
                <span className="sr-only">Close</span>
              </DialogClose>
              <span className="text-base font-semibold">Settings</span>
            </div>

            {/* Search */}
            <div className="px-3 pb-3 shrink-0">
              <div className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-xs">
                <SearchIcon className="size-3.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Search settings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
                />
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-2 pb-4">
              {filteredGroups.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                  No results
                </p>
              ) : (
                filteredGroups.map((group, gi) => (
                  <div key={group.label} className={cn(gi > 0 && "mt-4")}>
                    <p className="px-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      const Icon = ICON_MAP[item.icon];
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setSearch("");
                          }}
                          className={cn(
                            "w-full mt-0.5 flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                            isActive
                              ? "bg-background text-foreground font-semibold"
                              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                          )}
                        >
                          {Icon && <Icon className="size-4 shrink-0" />}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </nav>
          </aside>

          {/* ── Right content ── */}
          <div className="flex-1 overflow-hidden p-2 pl-0">
            <div className="h-full overflow-y-auto bg-background rounded-2xl  p-6">
              <ActiveContent />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
