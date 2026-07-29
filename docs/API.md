# REST API

Ответы об ошибках используют `application/problem+json`.

## Public

### `GET /api/health`

Проверяет приложение и соединение с PostgreSQL. Возвращает `200` или `503`.

### `POST /api/auth/login`

```json
{ "email": "admin@example.com", "password": "..." }
```

Устанавливает подписанную `HttpOnly` cookie. `POST /api/auth/logout` удаляет ее, `GET /api/auth/me` возвращает текущую сессию.

`POST /api/auth/register`, `POST /api/auth/password-reset/request` и `POST /api/auth/password-reset/confirm` реализуют регистрацию и одноразовые reset tokens с часовым TTL.

### `POST /api/bookings`

```json
{
  "houseId": "8fc5f68a-330f-4f50-b6e4-dcb260b12301",
  "checkIn": "2026-07-12",
  "checkOut": "2026-07-15",
  "guests": 2,
  "firstName": "Анна",
  "lastName": "Иванова",
  "email": "anna@example.com",
  "phone": "+79990000000",
  "consent": true,
  "services": [
    {
      "serviceId": "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001",
      "serviceOptionId": null,
      "quantity": 2
    }
  ]
}
```

Создает клиента, бронирование, снимок стоимости проживания, выбранные услуги и первую запись истории одной транзакцией. Позиция услуги сохраняет название, вариант, единицу, минимальные часы, цену и стоимость продления на момент бронирования. Ответ содержит `services`, `servicesTotal`, `accommodationAmount` и общую `totalAmount`. Конфликт дат возвращает `409`.

Элемент массива `services` имеет вид:

```json
{
  "serviceId": "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001",
  "title": "Баня",
  "optionTitle": null,
  "priceUnit": "hour",
  "minRentalHours": 2,
  "extensionPrice": 15,
  "quantity": 2,
  "unitPrice": 40,
  "totalPrice": 80
}
```

### `GET /api/calendar/:houseId`

Экспортирует активные занятые даты в iCalendar.

### `POST /api/reviews`

Принимает form data, проверяет номер бронирования и email, создает отзыв в статусе `pending`.

### Account API

- `GET|PATCH /api/account/profile`
- `GET /api/account/bookings`
- `POST /api/account/bookings/:id/cancel`
- `GET|POST /api/account/bookings/:id/messages`
- `POST /api/payments`

Все запросы проверяют сессию и принадлежность бронирования клиенту.

## CRM

### `GET /api/admin/houses`

Permission: `houses.read`.

### `POST /api/admin/houses`

Permission: `houses.write`. Создает домик после Zod-валидации.

`PATCH|DELETE /api/admin/houses/:id` редактирует или снимает домик с публикации. `POST /api/admin/uploads` принимает только PNG/JPEG/WebP, сверяет magic bytes и лимит размера.

Дополнительные CRM endpoints:

- `GET|POST /api/admin/bookings`, `GET|PATCH|PUT /api/admin/bookings/:id` — ответы содержат услуги конкретного бронирования; `PUT/PATCH` принимают `services` и пересчитывают `totalAmount` как стоимость проживания плюс услуги;
- `GET /api/admin/customers`;
- `GET|POST /api/admin/users`, `PATCH /api/admin/users/:id`;
- `GET|POST /api/admin/content`, `PATCH /api/admin/content/:id`;
- `GET|POST /api/admin/integrations`;
- `POST /api/admin/integrations/:id/sync`;
- `POST /api/cron/ical-sync` с Bearer secret.

Мутации проходят цепочку: CSRF origin check → session → permission → validation → transaction → audit event.

## Статусы бронирования

`new`, `awaiting_confirmation`, `confirmed`, `awaiting_payment`, `paid`, `cancelled`, `completed`.
