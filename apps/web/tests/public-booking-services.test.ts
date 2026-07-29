// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HouseBookingCard } from "@/components/house-booking-card";
import type { House } from "@/lib/catalog";
import type { PublicService } from "@/lib/service-types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const house: House = {
  id: "house-1",
  slug: "lesnoy",
  name: "Лесной",
  badgeText: null,
  description: "Домик",
  longDescription: "Домик в лесу",
  guests: 4,
  rooms: 2,
  price: 100,
  minPrice: 100,
  maxPrice: 100,
  weekdayPrices: { monday: 100, tuesday: 100, wednesday: 100, thursday: 100, friday: 100, saturday: 100, sunday: 100 },
  images: [],
  amenities: []
};

const service: PublicService = {
  id: "service-1",
  title: "Баня",
  slug: "banya",
  description: "Баня",
  images: [],
  basePrice: 40,
  minRentalHours: 3,
  extensionPrice: 15,
  priceUnit: "hour",
  sortOrder: 1,
  houseIds: [],
  options: []
};

describe("public booking services payload", () => {
  it("sends the selected service and hours with the booking request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ title: "Проверочный ответ" })
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(HouseBookingCard, { house, services: [service] }));

    fireEvent.click(screen.getByRole("checkbox", { name: /Баня/ }));
    fireEvent.change(screen.getByLabelText("Часы"), { target: { value: "1" } });
    expect((screen.getByLabelText("Часы") as HTMLInputElement).value).toBe("3");
    const submit = screen.getByRole("button", { name: "Отправить заявку" });
    fireEvent.submit(submit.closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(options.body));
    expect(payload.houseId).toBe("house-1");
    expect(payload.services).toEqual([{ serviceId: "service-1", serviceOptionId: null, quantity: 3 }]);
  });
});
