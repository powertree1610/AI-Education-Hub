import { SafetyEventsQueue } from "@/components/safety-events-queue";
import { requireRoleOrRedirect } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AdminSafetyPage() {
  await requireRoleOrRedirect("admin");
  return <SafetyEventsQueue backPath="/admin/safety" />;
}
