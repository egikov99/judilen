import { ChatInbox } from "@/components/admin/chat-inbox";
import { requirePageAccess } from "@/lib/session";

export default async function ChatsPage({ searchParams }: { searchParams: Promise<{ conversation?: string }> }) {
  const access = await requirePageAccess("chats.read");
  const { conversation } = await searchParams;
  return <main className="admin-content admin-chat-page">
    <div className="admin-chat-heading">
      <div>
        <h1 className="admin-title">Чаты</h1>
        <p className="admin-subtitle">Сообщения клиентов из подключённых каналов.</p>
      </div>
    </div>
    <ChatInbox initialConversationId={conversation ?? null} canWrite={access.permissions.includes("chats.write")} />
  </main>;
}
