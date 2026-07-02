"use client";

import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setItems(data.items);
    setUnreadCount(data.unreadCount);
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("button, a")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      trigger?.focus();
    };
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function markAllRead() {
    await fetch("/api/admin/notifications/read-all", { method: "POST" });
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  return <div className="notification-center">
    <button ref={triggerRef} className="topbar-icon-button" type="button" aria-label="Уведомления" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <Bell size={20} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <>
      <button className="notification-scrim" aria-label="Закрыть уведомления" onClick={() => setOpen(false)} />
      <aside ref={panelRef} className="notification-panel" role="dialog" aria-modal="true" aria-label="Центр уведомлений">
        <header>
          <div><strong>Уведомления</strong><small>{unreadCount ? `${unreadCount} непрочитанных` : "Новых нет"}</small></div>
          <button className="icon-button" type="button" aria-label="Закрыть" onClick={() => setOpen(false)}><X size={20} /></button>
        </header>
        {unreadCount > 0 && <button className="notification-read-all" type="button" onClick={markAllRead}><CheckCheck size={17} /> Отметить все прочитанными</button>}
        <div className="notification-list">
          {items.map((item) => {
            const content = <><strong>{item.title}</strong><time>{new Date(item.createdAt).toLocaleString("ru-RU")}</time></>;
            return item.href
              ? <Link className={item.readAt ? "" : "is-unread"} href={item.href} key={item.id} onClick={() => { markRead(item.id); setOpen(false); }}>{content}</Link>
              : <button className={item.readAt ? "" : "is-unread"} type="button" key={item.id} onClick={() => markRead(item.id)}>{content}</button>;
          })}
          {!items.length && <p className="notification-empty">Уведомлений пока нет.</p>}
        </div>
      </aside>
    </>}
  </div>;
}
