import { PortalShell } from "@/components/portal-shell";
import { isSafeguardingLead, requireRoleOrRedirect } from "@/lib/guard";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  const lead = await isSafeguardingLead(user.id);
  return (
    <PortalShell
      title="Teacher"
      user={user}
      nav={[
        { href: "/teacher", label: "My Students" },
        { href: "/teacher/chat", label: "AI Chat" },
        { href: "/teacher/review", label: "Review Queue" },
        { href: "/teacher/sessions", label: "Kiosk Sessions" },
        ...(lead ? [{ href: "/safeguarding", label: "Safeguarding" }] : []),
      ]}
    >
      {children}
    </PortalShell>
  );
}
