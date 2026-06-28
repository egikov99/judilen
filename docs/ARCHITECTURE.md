# Архитектура

## Границы приложения

`apps/web` содержит три интерфейсных контура:

1. Публичный сайт — SSG/SSR, индексируемые страницы, JSON-LD и формы бронирования.
2. Личный кабинет — protected routes, поездки, оплаты и сообщения гостя.
3. CRM — protected routes с меню, отфильтрованным по роли, и повторной permission-проверкой в API.

Логика сессий вынесена в `packages/auth`, данные и миграции — в `packages/db`, внешние каналы — в `packages/integrations`.

## Роли и права

| Раздел | Клиент | Менеджер | Контент | Админ |
|---|:---:|:---:|:---:|:---:|
| Свои поездки | ✓ | — | — | ✓ |
| Бронирования и клиенты | — | R/W | — | R/W |
| Домики | — | — | R/W | R/W |
| Контент и SEO | — | — | R/W | R/W |
| Отчеты | — | — | — | R |
| Пользователи, интеграции, настройки | — | — | — | R/W |

Меню формируется из permissions. API не доверяет меню и проверяет permission повторно.

## Защита от двойного бронирования

Период считается полуоткрытым `[check_in, check_out)`, поэтому новый гость может заехать в день выезда предыдущего. PostgreSQL exclusion constraint блокирует пересечение активных статусов даже при двух одновременных транзакциях:

```sql
EXCLUDE USING gist (
  house_id WITH =,
  daterange(check_in, check_out, '[)') WITH &&
)
WHERE (status IN ('awaiting_confirmation','confirmed','awaiting_payment','paid'));
```

## Интеграции

`CalendarAdapter` задает контракт импорта и экспорта. `IcalAdapter` реализован и протестирован. API-specific каналы (Booking, Airbnb, Ostrovok, Expedia, Google Travel) добавляются отдельными адаптерами без изменения доменной модели. Уникальный индекс по `(external_source, external_id)` делает импорт идемпотентным.

Импорт разрешает только HTTPS URL, запрещает credentials, redirects и адреса private/link-local loopback сетей. Конфликты exclusion constraint записываются в integration log.

## Платежи

`PaymentProvider` отделяет доменную модель от конкретного эквайринга. Development mock физически заблокирован при `NODE_ENV=production`; до подключения реального адаптера production API возвращает `503`, а не имитирует успешную оплату. Статус страницы оплаты читается из БД и в дальнейшем обновляется только проверенным webhook провайдера.

## SEO

- статическая генерация карточек домиков;
- metadata, canonical и Open Graph;
- `sitemap.xml` и `robots.txt`;
- JSON-LD `LodgingBusiness` и `Accommodation`;
- локальные изображения через `next/image`;
- семантическая структура, alt и responsive CSS.
