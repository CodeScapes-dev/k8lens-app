"use client";

import { useState } from "react";
import { useClusterStore } from "@/stores/clusterStore";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { navigation } from "@/data/navigation";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function VisibilityTab() {
  const { preferences, setPreference } = useClusterStore();
  const hiddenSections = new Set(preferences.hiddenSections ?? []);
  const hiddenResources = preferences.hiddenResources ?? {};
  const [expanded, setExpanded] = useState({});

  const toggleSection = (label) => {
    const next = new Set(hiddenSections);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    const nextHr = { ...hiddenResources };
    if (next.has(label)) delete nextHr[label];
    setPreference({ hiddenSections: Array.from(next), hiddenResources: nextHr });
  };

  const toggleResource = (sectionLabel, itemLabel) => {
    const currentHidden = new Set(hiddenResources[sectionLabel] ?? []);
    if (currentHidden.has(itemLabel)) {
      currentHidden.delete(itemLabel);
    } else {
      currentHidden.add(itemLabel);
    }
    setPreference({
      hiddenResources: {
        ...hiddenResources,
        [sectionLabel]: Array.from(currentHidden),
      },
    });
  };

  const toggleExpand = (label) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold mb-0.5">Resource Visibility</h3>
        <p className="text-sm text-muted-foreground">
          Show or hide entire sections or individual resource types in the sidebar.
          Expand a section to control per-resource visibility.
        </p>
      </div>

      <Separator />

      <div className="flex flex-col gap-0.5">
        {navigation.map((section) => {
          const sectionHidden = hiddenSections.has(section.label);
          const sectionHiddenItems = new Set(hiddenResources[section.label] ?? []);
          const isExpanded = expanded[section.label];
          const visibleCount = section.items.length - sectionHiddenItems.size;

          return (
            <div key={section.label}>
              {/* Section row */}
              <div className="flex items-center rounded-lg hover:bg-accent">
                <Tooltip delayDuration={600}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => toggleExpand(section.label)}
                      className="flex items-center gap-1.5 flex-1 px-2 py-2 text-sm font-medium text-left"
                    >
                      <ChevronRightIcon
                        className={cn(
                          "size-3.5 text-muted-foreground transition-transform shrink-0",
                          isExpanded && "rotate-90"
                        )}
                      />
                      <span>{section.label}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                        {sectionHidden ? "hidden" : `${visibleCount} / ${section.items.length}`}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">
                    {sectionHidden
                      ? `${section.label} is hidden from sidebar`
                      : `${visibleCount} of ${section.items.length} resources visible`}
                  </TooltipContent>
                </Tooltip>

                <Tooltip delayDuration={600}>
                  <TooltipTrigger asChild>
                    <input
                      type="checkbox"
                      checked={!sectionHidden}
                      onChange={() => toggleSection(section.label)}
                      className="mr-3 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs">
                    {sectionHidden
                      ? `Show ${section.label} in sidebar`
                      : `Hide entire ${section.label} section`}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Individual resource rows */}
              {isExpanded && !sectionHidden && (
                <div className="ml-6 mb-1 flex flex-col gap-0">
                  {section.items.map((item) => {
                    const isHidden = sectionHiddenItems.has(item.label);
                    return (
                      <Tooltip key={item.href} delayDuration={600}>
                        <TooltipTrigger asChild>
                          <label className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer">
                            <span
                              className={cn(
                                "text-sm",
                                isHidden ? "text-muted-foreground line-through" : "text-foreground"
                              )}
                            >
                              {item.label}
                            </span>
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => toggleResource(section.label, item.label)}
                              className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                            />
                          </label>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {isHidden
                            ? `Show ${item.label} in ${section.label}`
                            : `Hide ${item.label} from sidebar`}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
