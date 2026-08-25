import { PortalShell } from "@/components/portal-shell";
import { homePathFor, requireSafeguardingLead } from "@/lib/guard";

/** The restricted safeguarding module — flagged lead only, any role.
 *  NOTE: this guard is convenience, not the boundary — layouts do not re-run
 *  on soft navigation, so every page in this group re-guards itself. */
export default async function SafeguardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSafeguardingLead();
  return (
    <PortalShell
      title="Safeguarding"
      user={user}
      nav={[
        { href: "/safeguarding", label: "Cases" },
        { href: "/safeguarding/events", label: "Safety Events" },
        { href: homePathFor(user.role), label: "← My Portal" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
