"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminModal } from "@/components/admin/admin-modal";
import { formatCurrency } from "@/components/currency";
import type { BookingServiceItem } from "@/lib/booking-services";
import { calculateServiceLineTotal } from "@/lib/service-pricing";
import type { PublicService } from "@/lib/service-types";
import { roundMoney } from "@/lib/weekday-prices";

type DraftLine = {
  key: string;
  serviceId: string;
  serviceOptionId: string | null;
  quantity: number;
  snapshot?: BookingServiceItem;
};

const quantityLabels: Record<BookingServiceItem["priceUnit"], string> = {
  hour: "Часы",
  day: "Дни",
  booking: "Количество",
  person: "Гости",
  item: "Количество"
};

function plural(value: number, one: string, few: string, many: string) {
  const lastTwo = value % 100;
  const last = value % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function quantityText(priceUnit: BookingServiceItem["priceUnit"], quantity: number) {
  if (priceUnit === "hour") return `${quantity} ${plural(quantity, "час", "часа", "часов")}`;
  if (priceUnit === "day") return `${quantity} ${plural(quantity, "день", "дня", "дней")}`;
  if (priceUnit === "person") return `${quantity} чел.`;
  if (priceUnit === "item") return `${quantity} шт.`;
  return String(quantity);
}

function unitSuffix(priceUnit: BookingServiceItem["priceUnit"]) {
  if (priceUnit === "hour") return "/час";
  if (priceUnit === "day") return "/день";
  if (priceUnit === "person") return "/чел.";
  if (priceUnit === "item") return "/шт.";
  return "";
}

function createDraft(line: BookingServiceItem): DraftLine {
  return {
    key: line.id,
    serviceId: line.serviceId,
    serviceOptionId: line.serviceOptionId,
    quantity: line.quantity,
    snapshot: line
  };
}

export function BookingServicesEditor({
  bookingId,
  publicNumber,
  houseId,
  initialAccommodationAmount,
  initialServices,
  catalog,
  canEdit
}: {
  bookingId: string;
  publicNumber: string;
  houseId: string;
  initialAccommodationAmount: number;
  initialServices: BookingServiceItem[];
  catalog: PublicService[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(() => initialServices.map(createDraft));
  const [accommodationAmount, setAccommodationAmount] = useState(initialAccommodationAmount);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const availableCatalog = useMemo(
    () => catalog.filter((service) => !service.houseIds.length || service.houseIds.includes(houseId)),
    [catalog, houseId]
  );

  function details(line: DraftLine) {
    const service = catalog.find((item) => item.id === line.serviceId);
    const option = service?.options.find((item) => item.id === line.serviceOptionId);
    const keepsSnapshot = line.snapshot?.serviceId === line.serviceId && line.snapshot.serviceOptionId === line.serviceOptionId;
    const unitPrice = keepsSnapshot ? line.snapshot!.unitPrice : option?.price ?? service?.basePrice ?? line.snapshot?.unitPrice ?? 0;
    const catalogPriceUnit = service?.priceUnit === "three_hours"
      ? "hour"
      : service?.priceUnit ?? line.snapshot?.priceUnit ?? "booking";
    const priceUnit = keepsSnapshot ? line.snapshot!.priceUnit : catalogPriceUnit;
    const minRentalHours = keepsSnapshot ? line.snapshot!.minRentalHours : service?.minRentalHours ?? null;
    const extensionPrice = keepsSnapshot ? line.snapshot!.extensionPrice : service?.extensionPrice ?? null;
    return {
      service,
      option,
      title: keepsSnapshot ? line.snapshot!.title : service?.title ?? line.snapshot?.title ?? "Удалённая услуга",
      optionTitle: keepsSnapshot ? line.snapshot!.optionTitle : option?.title ?? line.snapshot?.optionTitle ?? null,
      unitPrice,
      priceUnit,
      minRentalHours,
      extensionPrice,
      totalPrice: calculateServiceLineTotal({
        unitPrice,
        quantity: line.quantity,
        priceUnit,
        minRentalHours,
        extensionPrice
      })
    };
  }

  const servicesTotal = roundMoney(lines.reduce((sum, line) => sum + details(line).totalPrice, 0));
  const totalAmount = roundMoney(accommodationAmount + servicesTotal);
  const previewItems = lines.slice(0, 3).map((line) => ({ line, details: details(line) }));

  function addLine() {
    const service = availableCatalog.find((item) => !lines.some((line) => line.serviceId === item.id));
    if (!service) return setMessage("Все доступные услуги уже добавлены");
    const option = service.options.find((item) => item.isDefault) ?? service.options[0];
    setLines((current) => [...current, {
      key: crypto.randomUUID(),
      serviceId: service.id,
      serviceOptionId: option?.id ?? null,
      quantity: service.priceUnit === "hour" ? service.minRentalHours ?? 1 : 1
    }]);
    setMessage("");
  }

  function changeService(key: string, serviceId: string) {
    const service = availableCatalog.find((item) => item.id === serviceId);
    if (!service) return;
    const option = service.options.find((item) => item.isDefault) ?? service.options[0];
    setLines((current) => current.map((line) => line.key === key ? {
      key,
      serviceId,
      serviceOptionId: option?.id ?? null,
      quantity: service.priceUnit === "hour" ? service.minRentalHours ?? 1 : 1
    } : line));
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accommodationAmount,
        services: lines.map((line) => ({
          serviceId: line.serviceId,
          serviceOptionId: line.serviceOptionId,
          quantity: line.quantity
        }))
      })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить услуги");
    setAccommodationAmount(Number(body.item.accommodationAmount));
    setLines((body.item.services as BookingServiceItem[]).map(createDraft));
    setMessage("Услуги и стоимость бронирования сохранены");
    router.refresh();
  }

  return <>
    <button className="button button-ghost booking-services-preview-button" type="button" onClick={() => setOpen(true)}>
      {previewItems.length ? <span className="booking-services-preview">{previewItems.map(({ line, details: item }) => <span key={line.key}>{item.title} × {quantityText(item.priceUnit, line.quantity)}</span>)}{lines.length > previewItems.length && <strong>Ещё {lines.length - previewItems.length}</strong>}</span> : <span>Не выбраны</span>}
    </button>
    {open && <AdminModal title={`Бронирование ${publicNumber}`} onClose={() => setOpen(false)} busy={saving}>
      <section className="booking-services-section">
        <div className="section-heading compact-heading"><div><span className="eyebrow">Карточка бронирования</span><h3>Дополнительные услуги</h3></div>{canEdit && <button className="button button-ghost" type="button" onClick={addLine}>Добавить услугу</button>}</div>
        {message && <p className={`notice ${message.startsWith("Не удалось") ? "error" : ""}`} role="status">{message}</p>}
        {lines.length ? <div className="booking-services-table-wrap"><table className="data-table booking-services-table">
          <thead><tr><th>Название</th><th>Количество/часы</th><th>Цена за единицу</th><th>Итого</th>{canEdit && <th />}</tr></thead>
          <tbody>{lines.map((line) => {
            const item = details(line);
            const minimum = item.priceUnit === "hour" ? item.minRentalHours ?? 1 : 1;
            const selectableServices = availableCatalog.filter((service) => service.id === line.serviceId || !lines.some((current) => current.key !== line.key && current.serviceId === service.id));
            return <tr key={line.key}>
              <td data-label="Название"><div className="field"><select aria-label="Услуга" value={line.serviceId} disabled={!canEdit || !item.service} onChange={(event) => changeService(line.key, event.target.value)}>{!item.service && <option value={line.serviceId}>{item.title} (недоступна)</option>}{selectableServices.map((service) => <option key={service.id} value={service.id}>{service.id === line.serviceId ? item.title : service.title}</option>)}</select>{item.service && item.service.options.length > 0 && <select aria-label="Вариант услуги" value={line.serviceOptionId ?? ""} disabled={!canEdit} onChange={(event) => setLines((current) => current.map((currentLine) => currentLine.key === line.key ? { ...currentLine, serviceOptionId: event.target.value || null } : currentLine))}>{item.service.options.map((option) => <option key={option.id} value={option.id}>{option.id === line.serviceOptionId ? item.optionTitle ?? option.title : option.title}</option>)}</select>}{item.optionTitle && !item.service && <small>Вариант: {item.optionTitle}</small>}{item.minRentalHours && <small>Минимум: {quantityText("hour", item.minRentalHours)}</small>}</div></td>
              <td data-label={quantityLabels[item.priceUnit]}><input aria-label={quantityLabels[item.priceUnit]} type="number" min={minimum} max="100" value={line.quantity} disabled={!canEdit} onChange={(event) => setLines((current) => current.map((currentLine) => currentLine.key === line.key ? { ...currentLine, quantity: Math.max(minimum, Number(event.target.value) || minimum) } : currentLine))} /></td>
              <td data-label="Цена за единицу"><strong>{formatCurrency(item.unitPrice)}{item.priceUnit === "hour" && item.minRentalHours !== null ? ` за ${quantityText("hour", item.minRentalHours)}` : unitSuffix(item.priceUnit)}</strong>{item.extensionPrice !== null && <small className="booking-service-extension">Продление: {formatCurrency(item.extensionPrice)}/час</small>}</td>
              <td data-label="Итого"><strong>{formatCurrency(item.totalPrice)}</strong></td>
              {canEdit && <td data-label=""><button className="button button-ghost" type="button" onClick={() => setLines((current) => current.filter((currentLine) => currentLine.key !== line.key))}>Удалить</button></td>}
            </tr>;
          })}</tbody>
        </table></div> : <p className="notice">Дополнительные услуги не выбраны.</p>}
        <div className="booking-cost-summary">
          <div className="summary-row"><span>Стоимость проживания</span>{canEdit ? <input aria-label="Стоимость проживания" type="number" min="0" step="0.01" value={accommodationAmount} onChange={(event) => setAccommodationAmount(Math.max(0, Number(event.target.value) || 0))} /> : <strong>{formatCurrency(accommodationAmount)}</strong>}</div>
          <div className="summary-row"><span>Итог по услугам</span><strong>{formatCurrency(servicesTotal)}</strong></div>
          <div className="summary-row booking-grand-total"><span>Общая стоимость бронирования</span><strong>{formatCurrency(totalAmount)}</strong></div>
        </div>
        <div className="modal-actions">{canEdit && <button className="button button-primary" type="button" disabled={saving} onClick={save}>{saving ? "Сохранение…" : "Сохранить"}</button>}<button className="button button-ghost" type="button" disabled={saving} onClick={() => setOpen(false)}>Закрыть</button></div>
      </section>
    </AdminModal>}
  </>;
}
