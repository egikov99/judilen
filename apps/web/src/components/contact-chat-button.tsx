"use client";

import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

const EVENT_NAME = "judilen:open-contact-chat";

export function ContactChatButton({ children, className, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(EVENT_NAME))}
      {...props}
    >
      {children}
    </button>
  );
}
