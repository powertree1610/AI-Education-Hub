import { PortalShell } from "@/components/portal-shell";
import { requireRoleOrRedirect } from "@/lib/guard";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleOrRedirect("admin");
  return (
    <PortalShell
      title="Admin"
      user={user}
      nav={[
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/students", label: "Students" },
        { href: "/admin/classes", label: "Classes" },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/chat", label: "AI Chat" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
