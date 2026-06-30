"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function HouseActions({ id, canUpdate, canDelete }: { id: string; canUpdate: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function unpublish() {
    if (!window.confirm("Снять домик с публикации?")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/houses/${id}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) router.refresh();
  }
  return <div style={{ display: "flex", gap: 8 }}>{canUpdate && <Link className="button button-ghost" href={`/admin/houses/${id}`}>Редактировать</Link>}{canDelete && <button className="button button-ghost" disabled={busy} onClick={unpublish}>Скрыть</button>}</div>;
}
