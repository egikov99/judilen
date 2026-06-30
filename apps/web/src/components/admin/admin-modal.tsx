"use client";

import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export function AdminModal({ title, onClose, children, busy = false }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeFromKeyboard = useEffectEvent(() => {
    if (!busy) onClose();
  });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (panelRef.current?.querySelector<HTMLElement>("[autofocus]") ?? panelRef.current?.querySelector<HTMLElement>(focusableSelector))?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromKeyboard();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const elements = [...panelRef.current.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.offsetParent !== null);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  return <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <div className="admin-modal-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <header className="admin-modal-header">
        <h2 id="admin-modal-title">{title}</h2>
        <button className="modal-close" type="button" aria-label="Закрыть" disabled={busy} onClick={onClose}>×</button>
      </header>
      <div className="admin-modal-body">{children}</div>
    </div>
  </div>;
}
