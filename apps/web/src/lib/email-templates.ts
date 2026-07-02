export const EMAIL_TEMPLATE_VARIABLES = [
  "customerName", "bookingNumber", "houseName", "checkInDate", "checkOutDate",
  "totalPrice", "bookingStatus", "loginUrl", "reviewUrl", "resetPasswordUrl",
  "siteName", "contactPhone"
] as const;

export type EmailTemplateKey =
  | "booking_received"
  | "admin_new_booking"
  | "booking_confirmed"
  | "booking_cancelled"
  | "password_reset"
  | "arrival_reminder"
  | "review_request"
  | "booking_changed";

type Template = { key: EmailTemplateKey; name: string; subject: string; htmlContent: string; textContent: string };

const action = (label: string, variable: string) =>
  `<p><a class="button" href="{{${variable}}}">${label}</a></p>`;

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateKey, Template> = {
  booking_received: {
    key: "booking_received", name: "Бронирование создано",
    subject: "{{siteName}}: бронирование {{bookingNumber}} получено",
    htmlContent: "<h1>Бронирование получено</h1><p>Здравствуйте, {{customerName}}! Мы получили заявку {{bookingNumber}} на домик «{{houseName}}» с {{checkInDate}} по {{checkOutDate}}.</p><p>Администратор подтвердит бронирование и при необходимости свяжется с вами. Оплата производится по приезду.</p>" + action("Перейти в личный кабинет", "loginUrl"),
    textContent: "Здравствуйте, {{customerName}}! Заявка {{bookingNumber}} на домик «{{houseName}}» получена. Администратор подтвердит бронирование. Оплата производится по приезду. {{loginUrl}}"
  },
  admin_new_booking: {
    key: "admin_new_booking", name: "Новая заявка администратору",
    subject: "Новая заявка {{bookingNumber}}",
    htmlContent: "<h1>Новая заявка</h1><p>{{customerName}} забронировал(а) «{{houseName}}» с {{checkInDate}} по {{checkOutDate}}. Сумма: {{totalPrice}}.</p>" + action("Открыть CRM", "loginUrl"),
    textContent: "Новая заявка {{bookingNumber}}: {{customerName}}, {{houseName}}, {{checkInDate}}–{{checkOutDate}}, {{totalPrice}}. {{loginUrl}}"
  },
  booking_confirmed: {
    key: "booking_confirmed", name: "Бронирование подтверждено",
    subject: "{{siteName}}: бронирование {{bookingNumber}} подтверждено",
    htmlContent: "<h1>Бронирование подтверждено</h1><p>{{customerName}}, ждём вас в домике «{{houseName}}» с {{checkInDate}} по {{checkOutDate}}. Оплата — по приезду.</p>" + action("Посмотреть бронирование", "loginUrl"),
    textContent: "Бронирование {{bookingNumber}} подтверждено. {{houseName}}, {{checkInDate}}–{{checkOutDate}}. Оплата по приезду. {{loginUrl}}"
  },
  booking_cancelled: {
    key: "booking_cancelled", name: "Бронирование отменено",
    subject: "{{siteName}}: бронирование {{bookingNumber}} отменено",
    htmlContent: "<h1>Бронирование отменено</h1><p>Бронирование {{bookingNumber}} на домик «{{houseName}}» отменено. Если это неожиданно, свяжитесь с нами: {{contactPhone}}.</p>",
    textContent: "Бронирование {{bookingNumber}} отменено. Вопросы: {{contactPhone}}."
  },
  password_reset: {
    key: "password_reset", name: "Восстановление пароля",
    subject: "{{siteName}}: восстановление доступа",
    htmlContent: "<h1>Новый пароль</h1><p>Ссылка действует 60 минут.</p>" + action("Сбросить пароль", "resetPasswordUrl"),
    textContent: "Для установки нового пароля откройте ссылку (действует 60 минут): {{resetPasswordUrl}}"
  },
  arrival_reminder: {
    key: "arrival_reminder", name: "Напоминание перед заездом",
    subject: "{{siteName}}: завтра ваш заезд",
    htmlContent: "<h1>До встречи завтра!</h1><p>{{customerName}}, напоминаем о заезде в домик «{{houseName}}» {{checkInDate}}. По вопросам звоните: {{contactPhone}}.</p>" + action("Посмотреть бронирование", "loginUrl"),
    textContent: "Напоминаем о заезде {{checkInDate}} в домик «{{houseName}}». {{loginUrl}}"
  },
  review_request: {
    key: "review_request", name: "Просьба оставить отзыв",
    subject: "{{siteName}}: расскажите о вашем отдыхе",
    htmlContent: "<h1>Спасибо, что отдыхали у нас</h1><p>{{customerName}}, расскажите, как прошёл отдых в домике «{{houseName}}».</p>" + action("Оставить отзыв", "reviewUrl"),
    textContent: "Спасибо за отдых в {{siteName}}! Оставьте отзыв: {{reviewUrl}}"
  },
  booking_changed: {
    key: "booking_changed", name: "Бронирование изменено",
    subject: "{{siteName}}: изменения в бронировании {{bookingNumber}}",
    htmlContent: "<h1>Бронирование изменено</h1><p>Актуальные даты: {{checkInDate}}–{{checkOutDate}}, домик «{{houseName}}», статус: {{bookingStatus}}.</p>" + action("Посмотреть бронирование", "loginUrl"),
    textContent: "Бронирование {{bookingNumber}} изменено. {{houseName}}, {{checkInDate}}–{{checkOutDate}}, статус: {{bookingStatus}}. {{loginUrl}}"
  }
};
