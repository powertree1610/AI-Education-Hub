import { PortalShell } from "@/components/portal-shell";
import { requireSafeguardingLead } from "@/lib/guard";

/** The restricted safeguarding module — flagged lead only, any role. */
export default async function SafeguardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSafeguardingLead();
  return (
    <PortalShell
      title="Safeguarding"
      user={user}
      nav={[
        { href: "/safeguarding", label: "Cases" },
        { href: "/safeguarding/events", label: "Safety Events" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
