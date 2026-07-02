import type { Metadata } from "next";
import { adminNavigationForPermissions } from "@judilen/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSessionAccess } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Панель управления",
  robots: { index: false, follow: false },
  applicationName: "Юдилен CRM",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Юдилен CRM" }
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const { session } = access;
  const navigation = adminNavigationForPermissions(access.permissions);
  return <AdminShell navigation={navigation} name={session.name} role={session.role}>{children}</AdminShell>;
}
