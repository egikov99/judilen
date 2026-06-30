import type { Metadata } from "next";
import Link from "next/link";
import { adminNavigationForPermissions } from "@judilen/auth";
import { LogoutButton } from "@/components/logout-button";
import { getSessionAccess } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Панель управления", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const { session } = access;
  const navigation = adminNavigationForPermissions(access.permissions);
  return <div className="admin-layout"><aside className="admin-sidebar"><Link className="brand" href="/admin">Юдилен · CRM</Link><nav className="admin-nav" aria-label="Администрирование">{navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}</nav><div className="admin-user"><strong>{session.name}</strong><div style={{ color: "rgba(255,255,255,.55)", fontSize: 12, marginBottom: 12 }}>{session.role}</div><LogoutButton /></div></aside><div className="admin-main"><header className="admin-topbar"><span>Управление усадьбой</span><Link className="text-link" href="/" target="_blank">Открыть сайт ↗</Link></header>{children}</div></div>;
}
