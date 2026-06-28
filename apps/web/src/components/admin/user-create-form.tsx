"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UserCreateForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    if (!response.ok) return setError(body.title ?? "Не удалось создать пользователя");
    event.currentTarget.reset();
    setError("");
    router.refresh();
  }
  return <form className="form-stack" onSubmit={submit}>{error && <div className="notice error">{error}</div>}<div className="form-grid"><div className="field"><label>Имя</label><input name="firstName" required /></div><div className="field"><label>Фамилия</label><input name="lastName" /></div></div><div className="form-grid"><div className="field"><label>Email</label><input name="email" type="email" required /></div><div className="field"><label>Временный пароль</label><input name="password" type="password" minLength={10} required /></div></div><div className="field"><label>Роль</label><select name="role"><option value="manager">Менеджер</option><option value="content_manager">Контент-менеджер</option><option value="admin">Администратор</option></select></div><button className="button button-primary">Создать пользователя</button></form>;
}

