import { PortalShell } from "@/components/portal-shell";
import { isSafeguardingLead, requireRoleOrRedirect } from "@/lib/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleOrRedirect("admin");
  const lead = await isSafeguardingLead(user.id);
  return (
    <PortalShell
      title="Admin"
      user={user}
      nav={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/students", label: "Students" },
        { href: "/admin/schools", label: "Schools" },
        { href: "/admin/classes", label: "Classes" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/safety", label: "Safety" },
        { href: "/admin/chat", label: "AI Chat" },
        ...(lead ? [{ href: "/safeguarding", label: "Safeguarding" }] : []),
      ]}
    >
      {children}
    </PortalShell>
  );
}
