export const notificationEventTypes = [
  "booking_created",
  "customer_message",
  "customer_updated",
  "payment_status",
  "booking_cancelled",
  "arrival_reminder",
  "integration_error"
] as const;

export type NotificationEventType = typeof notificationEventTypes[number];

export const notificationEventLabels: Record<NotificationEventType, string> = {
  booking_created: "Новые бронирования и заявки",
  customer_message: "Сообщения клиентов",
  customer_updated: "Изменения данных заявки",
  payment_status: "Оплаты и статусы платежей",
  booking_cancelled: "Отмены бронирований",
  arrival_reminder: "Напоминания о заселении",
  integration_error: "Ошибки синхронизации"
};
