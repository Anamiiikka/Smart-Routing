import { requireAction } from "@/lib/auth-helpers";
import { can } from "@/lib/rbac";
import { getMetrics } from "@/lib/metrics";
import { DashboardClient } from "@/components/dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAction("dashboard.view");
  const initial = await getMetrics();
  return <DashboardClient initial={initial} showHealth={can(user.role, "dashboard.systemHealth")} />;
}
