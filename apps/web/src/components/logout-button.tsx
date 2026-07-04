"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  return <button className="button button-ghost" onClick={async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.localStorage.removeItem("judilen-chat-visitor");
    router.replace("/");
    router.refresh();
  }}>Выйти</button>;
}
