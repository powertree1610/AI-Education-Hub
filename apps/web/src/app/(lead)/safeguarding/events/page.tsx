import { SafetyEventsQueue } from "@/components/safety-events-queue";

export const dynamic = "force-dynamic";

/** Lead-side view of the same queue (layout already gates on the lead flag). */
export default async function LeadSafetyEventsPage() {
  return <SafetyEventsQueue backPath="/safeguarding/events" />;
}
