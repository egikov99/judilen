"use client";

import { ArrowLeft, BellRing, BellOff, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { communicationProviderDefinitions, type CommunicationProvider } from "@/lib/communication-types";

type Conversation = {
  id: string;
  provider: CommunicationProvider;
  displayName: string;
  avatarUrl: string | null;
  isGroup: boolean;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound" | "system";
  senderName: string | null;
  body: string;
  status: "received" | "pending" | "sent" | "failed";
  createdAt: string;
};

type SelectedChat = {
  id: string;
  provider: CommunicationProvider;
  displayName: string;
  isGroup: boolean;
};

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function ChatInbox({ initialConversationId, canWrite }: {
  initialConversationId: string | null;
  canWrite: boolean;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState(initialConversationId);
  const [selected, setSelected] = useState<SelectedChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const previousUnread = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const messageList = useRef<HTMLDivElement>(null);

  const playSound = useCallback((force = false) => {
    if (!soundEnabled && !force) return;
    try {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      if (context.state === "suspended") context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 720;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
    } catch {
      // Browsers may block sound until the first user interaction.
    }
  }, [soundEnabled]);

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/admin/chats", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { items: Conversation[]; totalUnread: number };
    if (previousUnread.current !== null && data.totalUnread > previousUnread.current) playSound();
    previousUnread.current = data.totalUnread;
    setConversations(data.items);
    window.dispatchEvent(new CustomEvent("chat-unread-updated", { detail: data.totalUnread }));
  }, [playSound]);

  const loadConversation = useCallback(async (id: string, markRead = false) => {
    const response = await fetch(`/api/admin/chats/${id}`, { cache: "no-store" });
    if (!response.ok) {
      setNotice("Не удалось загрузить чат.");
      return;
    }
    const data = await response.json() as { conversation: SelectedChat; messages: Message[] };
    setSelected(data.conversation);
    setMessages(data.messages);
    window.requestAnimationFrame(() => {
      if (messageList.current) messageList.current.scrollTop = messageList.current.scrollHeight;
    });
    if (markRead) {
      await fetch(`/api/admin/chats/${id}`, { method: "PATCH" });
      await loadConversations();
    }
  }, [loadConversations]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      const stored = window.localStorage.getItem("admin-chat-sound");
      if (stored !== null) setSoundEnabled(stored === "true");
      loadConversations();
    }, 0);
    const timer = window.setInterval(loadConversations, 8_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    const initial = window.setTimeout(() => loadConversation(selectedId, true), 0);
    const timer = window.setInterval(() => loadConversation(selectedId), 5_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadConversation, selectedId]);

  function openConversation(id: string) {
    setSelectedId(id);
    setNotice("");
    window.history.replaceState(null, "", `/admin/chats?conversation=${id}`);
  }

  function closeConversation() {
    setSelectedId(null);
    setSelected(null);
    setMessages([]);
    window.history.replaceState(null, "", "/admin/chats");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !body.trim()) return;
    setBusy(true);
    setNotice("");
    const response = await fetch(`/api/admin/chats/${selectedId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setNotice(data.title ?? "Не удалось отправить сообщение.");
      await loadConversation(selectedId);
      return;
    }
    setBody("");
    await Promise.all([loadConversation(selectedId), loadConversations()]);
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem("admin-chat-sound", String(next));
    if (next) window.setTimeout(() => playSound(true), 0);
  }

  return <section className={`chat-inbox ${selectedId ? "has-selection" : ""}`}>
    <aside className="chat-list-panel" aria-label="Список чатов">
      <header>
        <strong>Все сообщения</strong>
        <button className="icon-button" type="button" aria-label={soundEnabled ? "Выключить звук" : "Включить звук"} onClick={toggleSound}>
          {soundEnabled ? <BellRing size={19} /> : <BellOff size={19} />}
        </button>
      </header>
      <div className="chat-list">
        {conversations.map((conversation) => <button
          className={`chat-list-item ${selectedId === conversation.id ? "is-active" : ""}`}
          type="button"
          key={conversation.id}
          onClick={() => openConversation(conversation.id)}
        >
          <span className={`chat-channel-mark channel-${conversation.provider}`}>
            {communicationProviderDefinitions[conversation.provider].label.slice(0, 2)}
          </span>
          <span className="chat-list-copy">
            <span><strong>{conversation.displayName}</strong><time>{formatTime(conversation.lastMessageAt)}</time></span>
            <span>{conversation.lastMessagePreview || "Нет сообщений"}</span>
          </span>
          {conversation.unreadCount > 0 && <span className="chat-unread-count">{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>}
        </button>)}
        {!conversations.length && <div className="chat-empty"><strong>Сообщений пока нет</strong><span>Подключите каналы во вкладке «Интеграции».</span></div>}
      </div>
    </aside>

    <div className="chat-dialog-panel">
      {selected ? <>
        <header className="chat-dialog-header">
          <button className="icon-button chat-back-button" type="button" aria-label="Назад к чатам" onClick={closeConversation}><ArrowLeft size={20} /></button>
          <div><strong>{selected.displayName}</strong><span>{communicationProviderDefinitions[selected.provider].label}{selected.isGroup ? " · группа" : ""}</span></div>
        </header>
        <div className="chat-messages" ref={messageList}>
          {messages.map((message) => <article className={`chat-message is-${message.direction}`} key={message.id}>
            {message.senderName && message.direction === "inbound" && <small>{message.senderName}</small>}
            <p>{message.body}</p>
            <footer><time>{formatTime(message.createdAt)}</time>{message.status === "failed" && <span>Не отправлено</span>}{message.status === "pending" && <span>Отправляется</span>}</footer>
          </article>)}
        </div>
        {notice && <div className="notice error chat-notice" role="status">{notice}</div>}
        {canWrite
          ? <form className="chat-composer" onSubmit={send}>
              <label className="visually-hidden" htmlFor="chat-message">Сообщение</label>
              <textarea id="chat-message" value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} placeholder="Напишите сообщение…" rows={2} required />
              <button className="button button-primary" type="submit" disabled={busy || !body.trim()}><Send size={18} /><span>Отправить</span></button>
            </form>
          : <p className="notice chat-notice">Доступен только просмотр сообщений.</p>}
      </> : <div className="chat-empty chat-dialog-empty"><strong>Выберите чат</strong><span>Переписка откроется здесь.</span></div>}
    </div>
  </section>;
}
