"use client";

import { useClusterStore } from "@/stores/clusterStore";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { THEMES, NAV_STYLES, DENSITIES } from "@/lib/data";

export function AppearanceTab() {
  const { preferences, setPreference } = useClusterStore();
  const { setTheme: setNextTheme } = useTheme();

  const handleThemeChange = (theme) => {
    setPreference({ theme });
    setNextTheme(theme);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold mb-0.5">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize how K8Lens looks.
        </p>
      </div>

      <Separator />

      {/* Theme */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium">Theme</Label>
        <div className="flex gap-2">
          {THEMES.map((t) => {
            const Icon = t.icon;
            const isActive = (preferences.theme ?? "system") === t.value;
            return (
              <Tooltip key={t.value} delayDuration={400}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => handleThemeChange(t.value)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-2 py-3 rounded-lg border text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="size-5" />
                    {t.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{t.tooltip}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* TODO: Table density — not yet functional, hidden until implemented
      <Separator />
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label className="text-sm font-medium">Table density</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controls row height in resource tables.
          </p>
        </div>
        <div className="flex gap-2">
          {DENSITIES.map((d) => (
            <Tooltip key={d.value} delayDuration={400}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPreference({ density: d.value })}
                  className={cn(
                    "px-3 py-1.5 rounded-md border text-sm font-medium transition-colors",
                    (preferences.density ?? "comfortable") === d.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {d.label}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">{d.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      */}

      {/* TODO: Navigation style — not yet functional, hidden until implemented
      <Separator />
      <div className="flex flex-col gap-3">
        <div>
          <Label className="text-sm font-medium">Navigation style</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose how the main navigation is displayed.
          </p>
        </div>
        <div className="flex gap-2">
          {NAV_STYLES.map((n) => {
            const Icon = n.icon;
            const isActive = (preferences.navStyle ?? "vertical") === n.value;
            return (
              <Tooltip key={n.value} delayDuration={400}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setPreference({ navStyle: n.value })}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-2 py-3 rounded-lg border text-sm font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="size-5" />
                    {n.label}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">{n.tooltip}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      */}
    </div>
  );
}
