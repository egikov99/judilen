"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SiteBrand } from "@/components/site-brand";

const navigation = [
  { href: "/", label: "Главная" },
  { href: "/domiki", label: "Домики" },
  { href: "/uslugi", label: "Услуги" },
  { href: "/otzyvy", label: "Отзывы" },
  { href: "/kontakty", label: "Контакты" }
] as const;

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  function closeMenu(returnFocus = false) {
    setIsOpen(false);
    if (returnFocus) requestAnimationFrame(() => toggleRef.current?.focus());
  }

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <header className="site-header">
      <nav className="container nav" aria-label="Основная навигация">
        <SiteBrand priority />

        <div className="nav-links">
          {navigation.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
        </div>

        <div className="nav-actions">
          <Link className="button button-ghost" href="/login">Войти</Link>
          <Link className="button button-primary" href="/domiki">Забронировать</Link>
        </div>

        <button
          ref={toggleRef}
          className="mobile-nav mobile-menu-toggle"
          type="button"
          aria-label={isOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={isOpen}
          aria-controls="mobile-site-menu"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <button
          className={`mobile-menu-scrim${isOpen ? " is-open" : ""}`}
          type="button"
          aria-label="Закрыть меню"
          tabIndex={-1}
          onClick={() => closeMenu()}
        />

        <div id="mobile-site-menu" className={`mobile-menu-panel${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
          <div className="mobile-menu-links">
            {navigation.map((item) => <Link
              href={item.href}
              onClick={() => closeMenu()}
              tabIndex={isOpen ? 0 : -1}
              key={item.href}
            >
              {item.label}
            </Link>)}
          </div>
          <div className="mobile-menu-actions">
            <Link className="button button-ghost" href="/login" tabIndex={isOpen ? 0 : -1} onClick={() => closeMenu()}>Войти</Link>
            <Link className="button button-primary" href="/domiki" tabIndex={isOpen ? 0 : -1} onClick={() => closeMenu()}>Забронировать</Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
