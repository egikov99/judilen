// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingServicesEditor } from "@/components/admin/booking-services-editor";
import type { BookingServiceItem } from "@/lib/booking-services";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

function bookedService(index: number, overrides: Partial<BookingServiceItem> = {}): BookingServiceItem {
  return {
    id: `line-${index}`,
    bookingId: "booking-1",
    serviceId: `service-${index}`,
    serviceOptionId: null,
    title: ["Баня", "Лодка", "Мангал", "Дрова"][index - 1],
    optionTitle: null,
    priceUnit: index === 1 || index === 2 ? "hour" : "item",
    minRentalHours: index === 1 ? 2 : null,
    extensionPrice: index === 1 ? 15 : null,
    quantity: index === 1 ? 2 : index === 2 ? 4 : 1,
    unitPrice: index === 1 ? 40 : index === 2 ? 15 : 10,
    totalPrice: index === 1 ? 80 : index === 2 ? 60 : 10,
    ...overrides
  };
}

const commonProps = {
  bookingId: "booking-1",
  publicNumber: "JD-125",
  houseId: "house-1",
  initialAccommodationAmount: 300,
  catalog: [],
  canEdit: true
};

function renderEditor(initialServices: BookingServiceItem[]) {
  return render(createElement(BookingServicesEditor, { ...commonProps, initialServices }));
}

describe("booking services editor", () => {
  it("shows an empty-state label for bookings without services", () => {
    renderEditor([]);
    expect(screen.getByRole("button", { name: "Не выбраны" })).toBeTruthy();
  });

  it("shows three service names and a remaining counter in the bookings list", () => {
    renderEditor([1, 2, 3, 4].map((index) => bookedService(index)));
    expect(screen.getByText("Баня × 2 часа")).toBeTruthy();
    expect(screen.getByText("Лодка × 4 часа")).toBeTruthy();
    expect(screen.getByText("Мангал × 1 шт.")).toBeTruthy();
    expect(screen.getByText("Ещё 1")).toBeTruthy();
    expect(screen.queryByText("Дрова × 1 шт.")).toBeNull();
  });

  it("opens the booking card with snapshot rental terms and totals", () => {
    const { container } = renderEditor([bookedService(1)]);
    fireEvent.click(screen.getByRole("button", { name: /Баня × 2 часа/ }));
    expect(screen.getByRole("heading", { name: "Дополнительные услуги" })).toBeTruthy();
    expect(screen.getByText("Минимум: 2 часа")).toBeTruthy();
    expect(container.querySelector(".booking-service-extension")?.textContent).toContain("15");
    const prices = [...container.querySelectorAll(".currency-value")].map((element) => element.textContent);
    expect(prices.some((price) => price?.startsWith("80"))).toBe(true);
    expect(prices.some((price) => price?.startsWith("380"))).toBe(true);
  });
});
