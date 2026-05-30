"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KLStatus } from "@/components/kl/Status";
import { calculateAge } from "@/lib/k8s/utils";

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function Field({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-sm break-all">{value ?? "—"}</span>
    </div>
  );
}

function EventContent({ event }) {
  const reason = event.reason ?? "—";
  const namespace = event.regarding?.namespace ?? event.involvedObject?.namespace ?? event.metadata?.namespace ?? "—";
  const object = `${event.regarding?.kind ?? event.involvedObject?.kind ?? ""}/${event.regarding?.name ?? event.involvedObject?.name ?? "—"}`;
  const message = event.note ?? event.message ?? "—";
  const count = event.deprecatedCount ?? event.count ?? 1;
  const lastSeen = event.deprecatedLastTimestamp ?? event.lastTimestamp ?? event.eventTime ?? event.metadata?.creationTimestamp;
  const firstSeen = event.deprecatedFirstTimestamp ?? event.firstTimestamp ?? event.metadata?.creationTimestamp;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Event Information</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Field label="Namespace" value={namespace} />
          <Field label="Object" value={object} />
          <Field label="Reason" value={reason} />
          <Field label="Count" value={count} />
          <Field label="Last Seen" value={lastSeen ? new Date(lastSeen).toLocaleString() : "—"} />
          <Field label="Time Ago" value={lastSeen ? calculateAge(lastSeen) + " ago" : "—"} />
          {firstSeen && firstSeen !== lastSeen && (
            <Field label="First Seen" value={new Date(firstSeen).toLocaleString()} />
          )}
        </div>
      </div>
      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Message</p>
        <p className="text-sm leading-relaxed break-all">{message}</p>
      </div>
    </div>
  );
}

export function EventDetailDialog({ event, onClose }) {
  const isMobile = useIsMobile();
  if (!event) return null;

  const type = event.type ?? "Normal";
  const title = (
    <span className="flex items-center gap-2">
      Event Details
      <KLStatus kind={type === "Warning" ? "warn" : "ok"}>{type}</KLStatus>
    </span>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto px-4 pb-6">
          <SheetHeader className="pb-2">
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <EventContent event={event} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <EventContent event={event} />
      </DialogContent>
    </Dialog>
  );
}
