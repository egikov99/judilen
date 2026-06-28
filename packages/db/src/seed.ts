import { hash } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import { db, houseImages, houses, permissions, rolePermissions, roles, users, sqlClient } from "./index";

const permissionRows = [
  ["dashboard.read", "Просмотр панели"],
  ["bookings.read", "Просмотр бронирований"],
  ["bookings.write", "Изменение бронирований"],
  ["customers.read", "Просмотр клиентов"],
  ["customers.write", "Изменение клиентов"],
  ["houses.read", "Просмотр домиков"],
  ["houses.write", "Изменение домиков"],
  ["content.write", "Изменение контента и SEO"],
  ["reports.read", "Просмотр отчетов"],
  ["users.manage", "Управление пользователями"],
  ["integrations.manage", "Управление интеграциями"],
  ["settings.manage", "Системные настройки"]
] as const;

const roleLabels = {
  client: "Клиент",
  admin: "Администратор",
  content_manager: "Контент-менеджер",
  manager: "Менеджер"
} as const;

const grants: Record<keyof typeof roleLabels, string[]> = {
  client: [],
  admin: permissionRows.map(([key]) => key),
  content_manager: ["dashboard.read", "houses.read", "houses.write", "content.write"],
  manager: ["dashboard.read", "bookings.read", "bookings.write", "customers.read", "customers.write"]
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
  for (const permission of allPermissions.filter((item) => grants[role.name].includes(item.key))) {
    await db.insert(rolePermissions).values({ roleId: role.id, permissionId: permission.id }).onConflictDoNothing();
  }
}

const adminRole = allRoles.find((role) => role.name === "admin");
if (!adminRole) throw new Error("Admin role was not created");
const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@judilen.local").toLowerCase().trim();
const existingAdmin = await db.select({ id: users.id }).from(users).where(eq(users.email, adminEmail)).limit(1);
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
if (!existingAdmin.length) {
  await db.insert(users).values({
    email: adminEmail,
    passwordHash: await hash(adminPassword),
    roleId: adminRole.id,
    firstName: "Администратор"
  });
  console.log(`Created administrator ${adminEmail}`);
} else if (process.env.SEED_ADMIN_RESET_PASSWORD === "true") {
  await db.update(users).set({
    passwordHash: await hash(adminPassword),
    roleId: adminRole.id,
    isActive: true,
    updatedAt: new Date()
  }).where(eq(users.id, existingAdmin[0].id));
  console.log(`Reset password for administrator ${adminEmail}`);
} else {
  console.log(`Administrator ${adminEmail} already exists; password was not changed`);
}

await db.insert(houses).values([
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12301",
    slug: "kedr",
    name: "Люкс «Кедр»",
    shortDescription: "Просторный дом с панорамными окнами и собственной сауной.",
    description: "Тишина хвойного леса, натуральные материалы и продуманный комфорт для спокойного отдыха.",
    guests: 4,
    rooms: 2,
    amenities: ["Сауна", "Камин", "Wi‑Fi", "Кухня", "Терраса"],
    basePrice: "14500",
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
    amenities: ["Мангал", "Wi‑Fi", "Кухня", "Детская кроватка"],
    basePrice: "12000",
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
    amenities: ["Терраса", "Wi‑Fi", "Мини-кухня", "Вид на лес"],
    basePrice: "8900",
    rules: "Заезд после 15:00, выезд до 12:00.",
    seoTitle: "Студия «Берёза» — отдых для двоих",
    seoDescription: "Камерный дом для двоих с террасой и видом на лес.",
    isPublished: true
  }
]).onConflictDoNothing();

await db.insert(houseImages).values([
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", url: "/images/stitch/asset-021.png", alt: "Люкс «Кедр» в хвойном лесу", position: 0 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", url: "/images/stitch/asset-028.png", alt: "Интерьер дома «Кедр»", position: 1 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", url: "/images/stitch/asset-023.png", alt: "Гостиная дома «Кедр»", position: 2 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302", url: "/images/stitch/asset-008.png", alt: "Дом «Сосна»", position: 0 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12302", url: "/images/stitch/asset-017.png", alt: "Интерьер дома «Сосна»", position: 1 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12303", url: "/images/stitch/asset-014.png", alt: "Студия «Берёза»", position: 0 },
  { houseId: "8fc5f68a-330f-4f50-b6e4-dcb260b12303", url: "/images/stitch/asset-015.png", alt: "Интерьер студии «Берёза»", position: 1 }
]).onConflictDoNothing();

await sqlClient.end();
