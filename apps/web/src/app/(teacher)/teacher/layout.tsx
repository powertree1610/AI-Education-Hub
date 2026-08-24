import { PortalShell } from "@/components/portal-shell";
import { requireRoleOrRedirect } from "@/lib/guard";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRoleOrRedirect("teacher", "admin");
  return (
    <PortalShell
      title="Teacher"
      user={user}
      nav={[
        { href: "/teacher", label: "My Students" },
        { href: "/teacher/chat", label: "AI Chat" },
        { href: "/teacher/review", label: "Review Queue" },
        { href: "/teacher/sessions", label: "Kiosk Sessions" },
      ]}
    >
      {children}
    </PortalShell>
  );
}
