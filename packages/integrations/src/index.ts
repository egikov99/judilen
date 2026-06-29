export interface ExternalBooking {
  externalId: string;
  title: string;
  checkIn: string;
  checkOut: string;
  source: string;
  rawPayload?: string;
}

export interface CalendarAdapter {
  readonly kind: string;
  importCalendar(payload: string): Promise<ExternalBooking[]>;
  exportCalendar(bookings: ExternalBooking[]): Promise<string>;
}

function unfoldIcal(input: string) {
  return input.replace(/\r?\n[ \t]/g, "");
}

function parseIcalDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) throw new Error(`Invalid iCal date: ${value}`);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function escapeIcal(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n");
}

function formatIcalDate(value: string) {
  return value.replaceAll("-", "");
}

export class IcalAdapter implements CalendarAdapter {
  readonly kind = "ical";

  async importCalendar(payload: string): Promise<ExternalBooking[]> {
    const blocks = unfoldIcal(payload).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];
    const events = blocks.map((block) => {
      const fields = new Map<string, string>();
      for (const line of block.split(/\r?\n/).slice(1, -1)) {
        const separator = line.indexOf(":");
        if (separator === -1) continue;
        fields.set(line.slice(0, separator).split(";")[0], line.slice(separator + 1));
      }
      const uid = fields.get("UID");
      const start = fields.get("DTSTART");
      const end = fields.get("DTEND");
      if (!uid || !start || !end) throw new Error("iCal event must have UID, DTSTART and DTEND");
      return {
        externalId: uid,
        title: fields.get("SUMMARY") ?? "Внешнее бронирование",
        checkIn: parseIcalDate(start),
        checkOut: parseIcalDate(end),
        source: "ical",
        rawPayload: block
      };
    });
    return [...new Map(events.map((event) => [event.externalId, event])).values()];
  }

  async exportCalendar(bookings: ExternalBooking[]): Promise<string> {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Judilen//Booking Calendar//RU",
      "CALSCALE:GREGORIAN"
    ];
    for (const booking of bookings) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcal(booking.externalId)}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
        `DTSTART;VALUE=DATE:${formatIcalDate(booking.checkIn)}`,
        `DTEND;VALUE=DATE:${formatIcalDate(booking.checkOut)}`,
        `SUMMARY:${escapeIcal(booking.title)}`,
        "STATUS:CONFIRMED",
        "END:VEVENT"
      );
    }
    lines.push("END:VCALENDAR");
    return `${lines.join("\r\n")}\r\n`;
  }
}

export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && bStart < aEnd;
}

export interface ExistingExternalBooking {
  externalId: string;
  title: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

export function reconcileExternalEvents(existing: ExistingExternalBooking[], incoming: ExternalBooking[]) {
  const existingById = new Map(existing.map((event) => [event.externalId, event]));
  const incomingById = new Map(incoming.map((event) => [event.externalId, event]));
  return {
    create: incoming.filter((event) => !existingById.has(event.externalId)),
    update: incoming.filter((event) => {
      const current = existingById.get(event.externalId);
      return current && (
        current.title !== event.title ||
        current.checkIn !== event.checkIn ||
        current.checkOut !== event.checkOut ||
        current.status === "import_removed" ||
        current.status === "cancelled"
      );
    }),
    remove: existing.filter((event) => !incomingById.has(event.externalId))
  };
}

export interface CreatePaymentInput {
  idempotenceKey: string;
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
}

export interface CreatedPayment {
  providerPaymentId: string;
  confirmationUrl: string;
  status: "pending" | "paid";
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
}

class DisabledPaymentProvider implements PaymentProvider {
  readonly name = "disabled";
  async createPayment(): Promise<CreatedPayment> {
    throw new Error("Payment provider is not configured");
  }
}

class DevelopmentMockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  async createPayment(input: CreatePaymentInput): Promise<CreatedPayment> {
    if (process.env.NODE_ENV === "production") throw new Error("Mock payments are disabled in production");
    return {
      providerPaymentId: `mock_${crypto.randomUUID()}`,
      confirmationUrl: input.returnUrl,
      status: "paid"
    };
  }
}

export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER): PaymentProvider {
  if (name === "mock") return new DevelopmentMockPaymentProvider();
  return new DisabledPaymentProvider();
}
