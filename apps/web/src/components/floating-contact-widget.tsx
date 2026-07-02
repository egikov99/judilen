"use client";

import { Camera, MessageCircle, MessagesSquare, Phone, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

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

  if (!channels.length) return null;
  const website = channels.find((channel) => channel.type === "website");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/public/contact-widget-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const body = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) return setError(body.detail ?? body.title ?? "Не удалось отправить сообщение");
    setSent(true);
    event.currentTarget.reset();
  }

  return <div className="floating-contact-widget" ref={rootRef}>
    {open && <div className="contact-widget-menu" role="menu" aria-label="Каналы связи">
      {channels.map((channel) => {
        const Icon = iconsByName[channel.icon] ?? icons[channel.type];
        const content = <><span className={`contact-channel-icon contact-channel-${channel.type}`}><Icon size={20} /></span><span><strong>{channel.displayName}</strong><small>{channel.subtitle}</small></span></>;
        return channel.type === "website"
          ? <button type="button" role="menuitem" key={channel.type} onClick={() => { setOpen(false); setChatOpen(true); setSent(false); setError(""); }}>{content}</button>
          : <a role="menuitem" key={channel.type} href={channel.url!} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{content}</a>;
      })}
    </div>}

    {chatOpen && website && <section className="contact-chat-window" role="dialog" aria-modal="true" aria-label={website.displayName}>
      <header><div><strong>{website.displayName}</strong><small>{website.subtitle}</small></div><button type="button" aria-label="Закрыть чат" onClick={() => setChatOpen(false)}><X size={20} /></button></header>
      <div className="contact-chat-body">
        {sent ? <div className="contact-chat-success"><MessageCircle size={34} /><strong>Спасибо, мы скоро ответим.</strong><button className="button button-ghost" type="button" onClick={() => setChatOpen(false)}>Закрыть</button></div> : <>
          <p className="contact-chat-greeting">{website.greeting}</p>
          <form className="form-stack" onSubmit={submit}>
            <div className="field"><label htmlFor="widget-name">Ваше имя</label><input id="widget-name" name="name" autoComplete="name" required minLength={2} /></div>
            <div className="field"><label htmlFor="widget-contact">Телефон или email</label><input id="widget-contact" name="contact" autoComplete="email" required minLength={5} /></div>
            <div className="field"><label htmlFor="widget-message">Сообщение</label><textarea id="widget-message" name="message" required minLength={2} /></div>
            <input className="contact-widget-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button className="button button-primary" disabled={sending}>{sending ? "Отправляем…" : "Отправить"}</button>
            {error && <p className="notice error" role="alert">{error}</p>}
          </form>
        </>}
      </div>
    </section>}

    <button className="contact-widget-toggle" type="button" aria-label={open || chatOpen ? "Закрыть виджет связи" : "Открыть виджет связи"} aria-expanded={open || chatOpen} onClick={() => {
      if (chatOpen) setChatOpen(false);
      else setOpen((value) => !value);
    }}>{open || chatOpen ? <X size={26} /> : <MessageCircle size={27} />}</button>
  </div>;
}
