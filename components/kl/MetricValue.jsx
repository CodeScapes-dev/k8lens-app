"use client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function MetricValue({ display, hover, className }) {
  if (!hover || hover === display) {
    return <span className={className}>{display}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 ${className ?? ""}`}>
          {display}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-xs">{hover}</p>
      </TooltipContent>
    </Tooltip>
  );
}
