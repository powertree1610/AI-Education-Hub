import { SafetyEventsQueue } from "@/components/safety-events-queue";
import { requireSafeguardingLead } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Lead-side view of the same queue admins see at /admin/safety. */
export default async function LeadSafetyEventsPage() {
  await requireSafeguardingLead();
  return <SafetyEventsQueue />;
}
