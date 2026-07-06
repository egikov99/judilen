"use client";

import { Camera, MessageCircle, MessagesSquare, Phone, Send, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { WebsiteChat } from "@/components/website-chat";
import type { ContactWidgetChannelType } from "@/lib/contact-widget";

type PublicChannel = {
  type: ContactWidgetChannelType;
  displayName: string;
  subtitle: string;
  url: string | null;
  greeting: string | null;
  icon: string;
};

const icons = {
  telegram: Send,
  viber: MessagesSquare,
  whatsapp: Phone,
  instagram: Camera,
  website: MessageCircle
} satisfies Record<ContactWidgetChannelType, typeof MessageCircle>;
const iconsByName: Record<string, typeof MessageCircle> = {
  telegram: Send,
  viber: MessagesSquare,
  whatsapp: Phone,
  instagram: Camera,
  "message-circle": MessageCircle,
  phone: Phone
};

export function FloatingContactWidget() {
  const [channels, setChannels] = useState<PublicChannel[]>([]);
  const [open, setOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const updateUnread = useCallback((count: number) => setUnread(count), []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/contact-widget-settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Widget settings unavailable");
        return response.json();
      })
      .then((body) => setChannels(Array.isArray(body.channels) ? body.channels : []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!open && !chatOpen) return;
    function outside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setChatOpen(false);
      }
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setChatOpen(false);
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", keyboard);
    };
  }, [open, chatOpen]);

  useEffect(() => {
    const handler = () => {
      if (website) {
        setOpen(false);
        setChatOpen(true);
      } else {
        setOpen(true);
      }
    };

    window.addEventListener("judilen:open-contact-chat", handler);
    return () => window.removeEventListener("judilen:open-contact-chat", handler);
  }, [website]);

  if (!channels.length) return null;
  const website = channels.find((channel) => channel.type === "website");

  return <div className="floating-contact-widget" ref={rootRef}>
    {open && <div className="contact-widget-menu" role="menu" aria-label="Каналы связи">
      {channels.map((channel) => {
        const Icon = iconsByName[channel.icon] ?? icons[channel.type];
        const content = <><span className={`contact-channel-icon contact-channel-${channel.type}`}><Icon size={20} /></span><span><strong>{channel.displayName}</strong><small>{channel.subtitle}</small></span></>;
        return channel.type === "website"
          ? <button type="button" role="menuitem" key={channel.type} onClick={() => { setOpen(false); setChatOpen(true); }}>{content}</button>
          : <a role="menuitem" key={channel.type} href={channel.url!} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{content}</a>;
      })}
    </div>}

    {website && <section className="contact-chat-window" role="dialog" aria-modal="true" aria-label={website.displayName} hidden={!chatOpen}>
      <header><div><strong>{website.displayName}</strong><small>{website.subtitle}</small></div><button type="button" aria-label="Закрыть чат" onClick={() => setChatOpen(false)}><X size={20} /></button></header>
      <div className="contact-chat-body">
        <WebsiteChat isOpen={chatOpen} greeting={website.greeting} onUnreadChange={updateUnread} />
      </div>
    </section>}

    <button className="contact-widget-toggle" type="button" aria-label={open || chatOpen ? "Закрыть виджет связи" : "Открыть виджет связи"} aria-expanded={open || chatOpen} onClick={() => {
      if (chatOpen) setChatOpen(false);
      else setOpen((value) => !value);
    }}>{open || chatOpen ? <X size={26} /> : <MessageCircle size={27} />}{unread > 0 && !chatOpen && <span className="contact-widget-unread">{unread > 99 ? "99+" : unread}</span>}</button>
  </div>;
}
