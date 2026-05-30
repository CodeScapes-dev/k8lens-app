import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/workloads/deployments");
}
