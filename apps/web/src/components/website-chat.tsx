"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type WebsiteMessage = {
  id: string;
  senderType: "client" | "operator" | "system";
  senderName: string | null;
  body: string;
  status: string;
  readAt: string | null;
  createdAt: string;
};

type ChatResponse = {
  conversationId: string | null;
  authenticated: boolean;
  unreadCount: number;
  messages: WebsiteMessage[];
  profile?: { name: string; contact: string };
};

const VISITOR_STORAGE_KEY = "judilen-chat-visitor";

function visitorToken() {
  const stored = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (stored && /^[A-Za-z0-9_-]{32,200}$/.test(stored)) return stored;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  window.localStorage.setItem(VISITOR_STORAGE_KEY, token);
  return token;
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function WebsiteChat({
  isOpen,
  greeting = "Здравствуйте! Чем мы можем помочь?",
  variant = "widget",
  onUnreadChange
}: {
  isOpen: boolean;
  greeting?: string | null;
  variant?: "widget" | "account";
  onUnreadChange?: (count: number) => void;
}) {
  const [messages, setMessages] = useState<WebsiteMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const visitorRef = useRef("");
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!visitorRef.current) visitorRef.current = visitorToken();
    try {
      const response = await fetch(`/api/public/contact-widget-chat?markRead=${isOpen ? "1" : "0"}`, {
        cache: "no-store",
        headers: { "X-Chat-Visitor": visitorRef.current }
      });
      if (!response.ok) {
        if (response.status !== 503) setError("Не удалось загрузить историю чата.");
        setLoading(false);
        return;
      }
      const data = await response.json() as ChatResponse;
      setConversationId(data.conversationId);
      setAuthenticated(data.authenticated);
      setMessages(data.messages ?? []);
      if (data.profile) {
        setName((value) => value || data.profile!.name);
        setContact((value) => value || data.profile!.contact);
      }
      onUnreadChange?.(data.unreadCount ?? 0);
      setError("");
      setLoading(false);
    } catch {
      setError("Нет связи с сервером. Проверьте интернет и попробуйте снова.");
      setLoading(false);
    } finally {
      loadingRef.current = false;
    }
  }, [isOpen, onUnreadChange]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 4_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => {
      if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    });
  }, [isOpen, messages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || sending) return;
    if (!visitorRef.current) visitorRef.current = visitorToken();
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/public/contact-widget-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Chat-Visitor": visitorRef.current
        },
        body: JSON.stringify({ name: name || undefined, contact: contact || undefined, message: body, consent, website: "" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.detail ?? data.title ?? "Не удалось отправить сообщение.");
        return;
      }
      setBody("");
      setConversationId(data.conversationId ?? conversationId);
      if (Array.isArray(data.messages)) setMessages(data.messages);
      onUnreadChange?.(0);
    } catch {
      setError("Не удалось отправить сообщение. Проверьте интернет и повторите попытку.");
    } finally {
      setSending(false);
    }
  }

  const needsProfile = !authenticated && !conversationId;
  return <div className={`website-chat website-chat-${variant}`}>
    <div className="website-chat-messages" ref={messageListRef} aria-live="polite">
      {loading && !messages.length ? <p className="website-chat-placeholder">Загружаем переписку…</p> : <>
        {!messages.length && <p className="contact-chat-greeting">{greeting}</p>}
        {messages.map((message) => <article className={`website-chat-message is-${message.senderType}`} key={message.id}>
          {message.senderType === "operator" && message.senderName && <small>{message.senderName}</small>}
          <p>{message.body}</p>
          <time>{formatMessageTime(message.createdAt)}</time>
        </article>)}
      </>}
    </div>
    <form className="website-chat-composer" onSubmit={send}>
      {needsProfile && <div className="website-chat-profile">
        <div className="field"><label htmlFor={`website-chat-name-${variant}`}>Ваше имя</label><input id={`website-chat-name-${variant}`} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></div>
        <div className="field"><label htmlFor={`website-chat-contact-${variant}`}>Телефон или email</label><input id={`website-chat-contact-${variant}`} value={contact} onChange={(event) => setContact(event.target.value)} autoComplete="email" minLength={5} maxLength={254} required /></div>
      </div>}
      <div className="website-chat-input-row">
        <label className="visually-hidden" htmlFor={`website-chat-message-${variant}`}>Сообщение</label>
        <textarea id={`website-chat-message-${variant}`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={2} placeholder="Напишите сообщение…" required />
        <button className="button button-primary" type="submit" disabled={sending || !body.trim()} aria-label="Отправить сообщение"><Send size={19} /></button>
      </div>
      {!authenticated && <label className="website-chat-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /> <span>Согласен с <Link href="/privacy" target="_blank">политикой конфиденциальности</Link></span></label>}
      {sending && <small className="website-chat-sending">Отправляется…</small>}
      {error && <p className="notice error website-chat-error" role="alert">{error}</p>}
    </form>
  </div>;
}
