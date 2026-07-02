"use client";

import Link from "next/link";
import { ExternalLink, Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { NotificationCenter } from "./notification-center";

type NavigationItem = { href: string; label: string };

export function AdminShell({ children, navigation, name, role }: {
  children: React.ReactNode;
  navigation: NavigationItem[];
  name: string;
  role: string;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const main = mainRef.current;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    main?.setAttribute("inert", "");
    main?.setAttribute("aria-hidden", "true");
    menuCloseRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      main?.removeAttribute("inert");
      main?.removeAttribute("aria-hidden");
      document.removeEventListener("keydown", handleKeyDown);
      menuButton?.focus();
    };
  }, [menuOpen]);

  return <div className="admin-layout">
    <button className={`admin-menu-scrim ${menuOpen ? "is-open" : ""}`} type="button" tabIndex={-1} aria-label="Закрыть меню" onClick={() => setMenuOpen(false)} />
    <aside className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}>
      <div className="admin-sidebar-head">
        <Link className="brand" href="/admin">Юдилен · CRM</Link>
        <button ref={menuCloseRef} className="admin-menu-close" type="button" aria-label="Закрыть меню" onClick={() => setMenuOpen(false)}><X size={22} /></button>
      </div>
      <nav className="admin-nav" aria-label="Администрирование">
        {navigation.map((item) => <Link className={pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`)) ? "is-active" : ""} href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}
      </nav>
      <div className="admin-user"><strong>{name}</strong><div>{role}</div><LogoutButton /></div>
    </aside>
    <div ref={mainRef} className="admin-main">
      <header className="admin-topbar">
        <div className="admin-topbar-start">
          <button ref={menuButtonRef} className="topbar-icon-button admin-menu-button" type="button" aria-label="Открыть меню" onClick={() => setMenuOpen(true)}><Menu size={22} /></button>
          <span>Управление усадьбой</span>
        </div>
        <div className="admin-topbar-actions">
          <NotificationCenter />
          <Link className="topbar-icon-button" href="/" target="_blank" aria-label="Открыть сайт"><ExternalLink size={20} /></Link>
        </div>
      </header>
      {children}
    </div>
  </div>;
}
