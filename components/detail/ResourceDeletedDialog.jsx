"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DETAIL_TYPE_TO_LIST } from "@/lib/k8s/detail-list-paths";

// Shown on any of the 29 useK8sDetail-backed pages when hooks/use-k8s.js's `notFound` fires — the
// object was deleted (live, via the watch) or the URL simply doesn't point at anything real. The
// only way out is back to the list: staying on a page for an object that no longer exists has
// nothing useful left to show, so both the CTA and dismissing the dialog (Escape/backdrop) route
// there — there is deliberately no "stay here" option.
//
// Not used by the Helm release detail page: it fetches via useK8sResource("helm","releases",...)
// rather than the /api/k8s/detail endpoint this dialog's `notFound` signal comes from, and it
// already renders its own (more generic) error state — a separate follow-up if the same "deleted"
// UX is wanted there.
export function ResourceDeletedDialog({ open, type, name }) {
  const router = useRouter();
  const target = DETAIL_TYPE_TO_LIST[type];
  const label = target?.label ?? "list";
  const href = target?.href ?? "/dashboard";

  const goBack = () => router.push(href);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) goBack(); }}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>This resource no longer exists</DialogTitle>
          <DialogDescription>
            {name ? `"${name}" ` : "It "}isn&apos;t on the cluster anymore — it may have been deleted, or replaced by its owning workload.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={goBack}>Back to {label}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
