"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function IntegrationSyncButton({ id }: { id: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  async function sync() {
    setStatus("Синхронизация…");
    const response = await fetch(`/api/admin/integrations/${id}/sync`, { method: "POST" });
    const payload = await response.json();
    setStatus(response.ok ? `Импорт: ${payload.imported}, конфликтов: ${payload.conflicts}` : payload.title ?? "Ошибка");
    if (response.ok) router.refresh();
  }
  return <div><button className="button button-ghost" onClick={sync}>Синхронизировать</button>{status && <small style={{ display: "block", marginTop: 5 }}>{status}</small>}</div>;
}

export function IntegrationCreateForm({ houses }: { houses: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        houseId: form.get("houseId"),
        kind: "ical",
        name: form.get("name"),
        config: { url: form.get("url") },
        isEnabled: true
      })
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.title ?? "Не удалось подключить");
    event.currentTarget.reset();
    setError("");
    router.refresh();
  }
  return <form className="form-stack" onSubmit={submit}>{error && <div className="notice error">{error}</div>}<div className="form-grid"><div className="field"><label htmlFor="name">Название</label><input id="name" name="name" required /></div><div className="field"><label htmlFor="houseId">Домик</label><select id="houseId" name="houseId" required>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></div></div><div className="field"><label htmlFor="url">HTTPS iCal URL</label><input id="url" name="url" type="url" pattern="https://.*" required /></div><button className="button button-primary">Подключить iCal</button></form>;
}

