import { hash } from "@node-rs/argon2";
import { eq, inArray } from "drizzle-orm";
import { db, houseImages, houses, houseWeekdayPrices, permissions, reviews, rolePermissions, roles, serviceHouses, serviceImages, serviceOptions, services, users, sqlClient } from "./index";

const permissionRows = [
  ["dashboard.read", "Просмотр панели"],
  ["bookings.read", "Просмотр бронирований"],
  ["bookings.write", "Изменение бронирований"],
  ["bookings.create", "Создание бронирований"],
  ["bookings.update", "Редактирование бронирований"],
  ["bookings.delete", "Удаление бронирований"],
  ["calendar.read", "Просмотр календаря"],
  ["customers.read", "Просмотр клиентов"],
  ["customers.write", "Изменение клиентов"],
  ["houses.read", "Просмотр домиков"],
  ["houses.write", "Изменение домиков"],
  ["houses.create", "Создание домиков"],
  ["houses.update", "Редактирование домиков"],
  ["houses.delete", "Удаление домиков"],
  ["services.read", "Просмотр услуг"],
  ["services.create", "Создание услуг"],
  ["services.update", "Изменение услуг"],
  ["services.delete", "Удаление услуг"],
  ["gazebos.read", "Просмотр беседок"],
  ["gazebos.create", "Создание беседок"],
  ["gazebos.update", "Редактирование беседок"],
  ["gazebos.delete", "Удаление беседок"],
  ["service_options.read", "Просмотр вариантов услуг"],
  ["service_options.create", "Создание вариантов услуг"],
  ["service_options.update", "Редактирование вариантов услуг"],
  ["service_options.delete", "Удаление вариантов услуг"],
  ["reviews.read", "Просмотр отзывов"],
  ["reviews.create", "Создание отзывов"],
  ["reviews.update", "Изменение отзывов"],
  ["reviews.delete", "Удаление отзывов"],
  ["house_images.read", "Просмотр фотографий домиков"],
  ["house_images.create", "Загрузка фотографий домиков"],
  ["house_images.update", "Изменение фотографий домиков"],
  ["house_images.delete", "Удаление фотографий домиков"],
  ["uploads.create", "Загрузка изображений"],
  ["content.write", "Изменение контента и SEO"],
  ["reports.read", "Просмотр отчетов"],
  ["users.manage", "Управление пользователями"],
  ["users.read", "Просмотр пользователей"],
  ["users.create", "Создание пользователей"],
  ["users.update", "Изменение пользователей"],
  ["users.delete", "Удаление пользователей"],
  ["users.reset_password", "Сброс паролей пользователей"],
  ["integrations.manage", "Управление интеграциями"],
  ["integrations.read", "Просмотр интеграций"],
  ["integrations.create", "Создание интеграций"],
  ["integrations.update", "Изменение интеграций"],
  ["integrations.delete", "Удаление интеграций"],
  ["external_calendars.read", "Просмотр внешних календарей"],
  ["external_calendars.create", "Создание внешних календарей"],
  ["external_calendars.update", "Изменение внешних календарей"],
  ["external_calendars.delete", "Удаление внешних календарей"],
  ["external_calendars.sync", "Синхронизация внешних календарей"],
  ["calendar_conflicts.read", "Просмотр конфликтов календаря"],
  ["calendar_conflicts.update", "Разрешение конфликтов календаря"],
  ["chats.read", "Просмотр чатов"],
  ["chats.write", "Ответы в чатах"],
  ["sales_channels.manage", "Управление каналами продаж"],
  ["expense_categories.manage", "Управление статьями расходов"],
  ["expenses.read", "Просмотр расходов"],
  ["expenses.write", "Изменение расходов"],
  ["client_notes.read", "Просмотр внутренних заметок клиентов"],
  ["client_notes.write", "Изменение внутренних заметок клиентов"],
  ["exports.read", "Экспорт данных CRM"],
  ["settings.manage", "Системные настройки"]
] as const;

const roleLabels = {
  client: "Клиент",
  super_admin: "Суперадминистратор",
  admin: "Администратор",
  content_manager: "Контент-менеджер",
  manager: "Менеджер",
  viewer: "Наблюдатель"
} as const;

const grants: Record<keyof typeof roleLabels, string[]> = {
  client: [],
  super_admin: permissionRows.map(([key]) => key),
  admin: permissionRows.map(([key]) => key).filter((key) => !key.startsWith("users.") && !["users.manage", "integrations.manage", "integrations.delete", "external_calendars.delete"].includes(key)),
  content_manager: ["dashboard.read", "houses.read", "houses.write", "houses.create", "houses.update", "house_images.read", "house_images.create", "house_images.update", "house_images.delete", "uploads.create", "services.read", "services.create", "services.update", "gazebos.read", "gazebos.create", "gazebos.update", "service_options.read", "service_options.create", "service_options.update", "reviews.read", "reviews.create", "reviews.update", "content.write"],
  manager: ["dashboard.read", "bookings.read", "bookings.write", "bookings.create", "bookings.update", "calendar.read", "customers.read", "customers.write", "chats.read", "chats.write", "expenses.read", "expenses.write", "client_notes.read", "client_notes.write", "exports.read"],
  viewer: ["dashboard.read", "bookings.read", "calendar.read", "customers.read", "houses.read", "services.read", "gazebos.read", "reviews.read", "house_images.read", "reports.read", "integrations.read", "external_calendars.read", "calendar_conflicts.read", "chats.read", "expenses.read", "client_notes.read", "exports.read"]
};

for (const [name, label] of Object.entries(roleLabels)) {
  await db.insert(roles).values({ name: name as keyof typeof roleLabels, label }).onConflictDoNothing();
}
for (const [key, description] of permissionRows) {
  await db.insert(permissions).values({ key, description }).onConflictDoNothing();
}

const allRoles = await db.select().from(roles);
const allPermissions = await db.select().from(permissions);
for (const role of allRoles) {
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
  for (const permission of allPermissions.filter((item) => grants[role.name].includes(item.key))) {
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id }).onConflictDoNothing();
  }
}

const adminRole = allRoles.find((role) => role.name === "super_admin");
if (!adminRole) throw new Error("Admin role was not created");
const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@judilen.local").toLowerCase().trim();
const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1);
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";
const passwordRequired = !existingAdmin.length || process.env.SEED_ADMIN_RESET_PASSWORD === "true";
if (passwordRequired && (adminPassword.length < 12 || !/[A-Za-zА-Яа-я]/.test(adminPassword) || !/\d/.test(adminPassword))) {
  throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters, letters and digits");
}
if (!existingAdmin.length) {
  await db.insert(users).values({
    email: adminEmail,
    passwordHash: await hash(adminPassword),
    roleId: adminRole.id,
    firstName: "Администратор"
  });
  console.log("Created initial administrator");
} else if (process.env.SEED_ADMIN_RESET_PASSWORD === "true") {
  await db.update(users).set({
    passwordHash: await hash(adminPassword),
    roleId: adminRole.id,
    isActive: true,
    updatedAt: new Date()
  }).where(eq(users.id, existingAdmin[0].id));
  console.log("Reset initial administrator password");
} else {
  await db.update(users).set({
    roleId: adminRole.id,
    isActive: true,
    updatedAt: new Date()
  }).where(eq(users.id, existingAdmin[0].id));
  console.log("Initial administrator already exists; password was not changed");
}

const includeDemoData = process.env.SEED_DEMO_DATA !== "false";

async function seedDemoData() {
await db.insert(houses).values([
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12301",
    slug: "kedr",
    name: "Люкс «Кедр»",
    shortDescription: "Просторный дом с панорамными окнами и собственной сауной.",
    description: "Тишина хвойного леса, натуральные материалы и продуманный комфорт для спокойного отдыха.",
    guests: 4,
    rooms: 2,
    badgeText: "Флагманский дом",
    amenities: ["Сауна", "Камин", "Wi‑Fi", "Кухня", "Терраса"],
    basePrice: "520",
    rules: "Заезд после 15:00, выезд до 12:00. Курение запрещено.",
    seoTitle: "Домик Люкс «Кедр» — аренда в усадьбе Юдилен",
    seoDescription: "Снять премиальный домик «Кедр» с сауной и панорамными окнами.",
    isPublished: true
  },
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12302",
    slug: "sosna",
    name: "Дом «Сосна»",
    shortDescription: "Уютный семейный дом рядом с озером.",
    description: "Светлый дом для семейного отдыха с видом на лес и удобной общей зоной.",
    guests: 6,
    rooms: 3,
    badgeText: "Для семьи",
    amenities: ["Мангал", "Wi‑Fi", "Кухня", "Детская кроватка"],
    basePrice: "430",
    rules: "Заезд после 15:00, выезд до 12:00.",
    seoTitle: "Дом «Сосна» — семейный отдых в усадьбе Юдилен",
    seoDescription: "Семейный дом на 6 гостей рядом с лесом и озером.",
    isPublished: true
  },
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12303",
    slug: "bereza",
    name: "Студия «Берёза»",
    shortDescription: "Камерный дом с видом на лес для спокойных выходных.",
    description: "Минималистичная студия с большой кроватью, небольшой кухней и террасой.",
    guests: 2,
    rooms: 1,
    badgeText: "Для двоих",
    amenities: ["Терраса", "Wi‑Fi", "Мини-кухня", "Вид на лес"],
    basePrice: "320",
    rules: "Заезд после 15:00, выезд до 12:00.",
    seoTitle: "Студия «Берёза» — отдых для двоих",
    seoDescription: "Камерный дом для двоих с террасой и видом на лес.",
    isPublished: true
  }
]).onConflictDoNothing();

const demoHousePrices = [
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", price: "520" },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302", price: "430" },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12303", price: "320" }
];
const demoWeekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
await db.insert(houseWeekdayPrices).values(demoHousePrices.flatMap((house) => (
  demoWeekdays.map((weekday) => ({ ...house, weekday }))
))).onConflictDoNothing();

await db.insert(houseImages).values([
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", url: "/images/stitch/asset-021.png", alt: "Люкс «Кедр» в хвойном лесу", position: 0, isMain: true },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", url: "/images/stitch/asset-028.png", alt: "Интерьер дома «Кедр»", position: 1 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", url: "/images/stitch/asset-023.png", alt: "Гостиная дома «Кедр»", position: 2 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302", url: "/images/stitch/asset-008.png", alt: "Дом «Сосна»", position: 0, isMain: true },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302", url: "/images/stitch/asset-017.png", alt: "Интерьер дома «Сосна»", position: 1 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12303", url: "/images/stitch/asset-014.png", alt: "Студия «Берёза»", position: 0, isMain: true },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12303", url: "/images/stitch/asset-015.png", alt: "Интерьер студии «Берёза»", position: 1 }
]).onConflictDoNothing();

await db.insert(services).values([
  { id: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001", title: "Аренда лодки", slug: "arenda-lodki", description: "Лодки для прогулок и рыбалки на озере.", basePrice: "50", priceUnit: "hour", isActive: true, sortOrder: 10 },
  { id: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1002", title: "Баня", slug: "banya", description: "Подготовленная баня с травяным чаем и зоной отдыха.", basePrice: "80", priceUnit: "hour", isActive: true, sortOrder: 20 },
  { id: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1003", title: "Дополнительное место", slug: "dopolnitelnoe-mesto", description: "Спальное место для гостя сверх базового размещения.", basePrice: "45", priceUnit: "person", isActive: true, sortOrder: 30 }
]).onConflictDoNothing();

await db.insert(serviceImages).values([
  { serviceId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001", url: "/images/stitch/asset-044.png", alt: "Аренда лодки", sortOrder: 0 },
  { serviceId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1002", url: "/images/stitch/asset-020.png", alt: "Баня", sortOrder: 0 },
  { serviceId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1003", url: "/images/stitch/asset-038.png", alt: "Дополнительное место", sortOrder: 0 }
]).onConflictDoNothing();

const demoServiceTitles = ["Аренда лодки", "Баня", "Дополнительное место"];
const demoServiceRows = await db
  .select({ id: services.id, title: services.title })
  .from(services)
  .where(inArray(services.title, demoServiceTitles));
const demoServiceIds = new Map(demoServiceRows.map((service) => [service.title, service.id]));
function serviceId(title: string) {
  const id = demoServiceIds.get(title);
  if (!id) throw new Error(`Demo service was not created: ${title}`);
  return id;
}

await db.insert(serviceHouses).values([
  { serviceId: serviceId("Дополнительное место"), houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301" },
  { serviceId: serviceId("Дополнительное место"), houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302" }
]).onConflictDoNothing();

await db.insert(serviceOptions).values([
  { serviceId: serviceId("Аренда лодки"), title: "Без мотора", description: "Весельная лодка", price: "50", isDefault: true, sortOrder: 10 },
  { serviceId: serviceId("Аренда лодки"), title: "С маленьким мотором", description: "Для спокойной прогулки", price: "100", sortOrder: 20 },
  { serviceId: serviceId("Аренда лодки"), title: "С большим мотором", description: "Для дальних маршрутов", price: "150", sortOrder: 30 },
  { serviceId: serviceId("Баня"), title: "2 часа", price: "80", isDefault: true, sortOrder: 10 },
  { serviceId: serviceId("Баня"), title: "4 часа", price: "150", sortOrder: 20 },
  { serviceId: serviceId("Дополнительное место"), title: "Стандарт", price: "45", isDefault: true, sortOrder: 10 }
]).onConflictDoNothing();

await db.insert(reviews).values([
  { customerName: "Анна", customerEmail: "anna@example.test", rating: 5, text: "Редкий случай, когда место вживую еще красивее. В Кедре очень тихо, а сауна после прогулки - отдельное удовольствие.", houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", isPublished: true, source: "manual" },
  { customerName: "Михаил", customerEmail: "mikhail@example.test", rating: 5, text: "Все организовано точно и без лишней суеты. Дом теплый, чистый, кухня действительно удобная.", houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302", isPublished: true, source: "manual" }
]).onConflictDoNothing();
}

if (includeDemoData) {
  await seedDemoData();
} else {
  console.log("Skipped demo houses, services, options and reviews during bootstrap");
}

await sqlClient.end();
