import { PortalShell } from "@/components/portal-shell";
import { requireRoleOrRedirect } from "@/lib/guard";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleOrRedirect("guardian");
  return (
    <PortalShell
      title="Parent"
      user={user}
      nav={[{ href: "/parent", label: "My Children" }]}
    >
      {children}
    </PortalShell>
  );
}
