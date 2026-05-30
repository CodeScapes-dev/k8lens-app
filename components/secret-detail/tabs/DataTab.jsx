"use client";

import React from "react";
import { EyeIcon, EyeOffIcon, CopyIcon, CheckIcon } from "lucide-react";
import { Panel } from "@/components/kl/Panel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function decodeBase64(value) {
  try {
    return atob(value);
  } catch {
    return value;
  }
}

function CopyButton({ value }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={copy}>
          {copied ? <CheckIcon className="size-3 text-green-500" /> : <CopyIcon className="size-3" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="text-xs">{copied ? "Copied!" : "Copy value"}</TooltipContent>
    </Tooltip>
  );
}

export function DataTab({ secret }) {
  const secretData = secret?.data ?? {};
  const keys = Object.keys(secretData);
  const [revealed, setRevealed] = React.useState({});

  const allRevealed = keys.length > 0 && keys.every((k) => revealed[k]);

  const toggleAll = () => {
    if (allRevealed) {
      setRevealed({});
    } else {
      setRevealed(Object.fromEntries(keys.map((k) => [k, true])));
    }
  };

  const toggle = (k) => setRevealed((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <Panel
      title="Keys"
      subtitle="Values are base64-encoded"
      rowAction={
        keys.length > 0 ? (
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-normal" onClick={toggleAll}>
            {allRevealed ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}
            {allRevealed ? "Hide all" : "Reveal all"}
          </Button>
        ) : null
      }
    >
      {keys.length === 0 ? (
        <span style={{ fontSize: 12, color: "var(--kl-text-muted)" }}>No data keys.</span>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[220px]">Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => {
              const raw = secretData[k] ?? "";
              const isRevealed = !!revealed[k];
              const decoded = decodeBase64(raw);

              return (
                <TableRow key={k}>
                  <TableCell className="font-mono text-xs font-medium align-top pt-3 break-all">{k}</TableCell>
                  <TableCell className="align-top pt-3">
                    {isRevealed ? (
                      <pre className="font-mono text-xs whitespace-pre-wrap break-all m-0 text-foreground">{decoded || <span className="text-muted-foreground italic">empty</span>}</pre>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground tracking-widest select-none">
                        {raw ? "••••••••••••" : <span className="italic">empty</span>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right align-top pt-1.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => toggle(k)}>
                            {isRevealed ? <EyeOffIcon className="size-3" /> : <EyeIcon className="size-3" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">{isRevealed ? "Hide" : "Reveal"}</TooltipContent>
                      </Tooltip>
                      <CopyButton value={decoded} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
