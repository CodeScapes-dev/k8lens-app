export { QuickStat } from "@/components/detail/helpers";

export function replicaStatusColor(desired, ready) {
  if (desired === 0 || ready === desired) return "bg-green-500";
  if (ready === 0) return "bg-destructive";
  return "bg-yellow-500";
}
