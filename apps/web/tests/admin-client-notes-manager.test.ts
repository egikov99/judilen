/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientNotesManager } from "@/components/admin/client-notes-manager";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe("ClientNotesManager", () => {
  it("renders note list and disables submit when text is empty", () => {
    render(<ClientNotesManager clientId="test-client" initialNotes={[{ id: "note-1", text: "Проверка", authorName: "Админ", createdAt: "2026-07-08T10:00:00.000Z", updatedAt: "2026-07-08T10:00:00.000Z" }]} canWrite={true} />);

    expect(screen.getByText("Комментарии администратора")).toBeTruthy();
    expect(screen.getByText("Проверка")).toBeTruthy();

    const addButton = screen.getByRole("button", { name: "Добавить" });
    expect(addButton).toBeTruthy();
    expect((addButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByLabelText("Новая заметка")).toBeTruthy();
  });
});
