export interface House {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  description: string;
  longDescription: string;
  guests: number;
  rooms: number;
  price: number;
  images: string[];
  amenities: string[];
}

export const houses: House[] = [
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12301",
    slug: "kedr",
    name: "Люкс «Кедр»",
    eyebrow: "Флагманский дом",
    description: "Панорамные окна, личная сауна и тишина хвойного леса.",
    longDescription: "Дом для тех, кто ценит пространство и естественный свет. Внутри — гостиная с камином, полностью оборудованная кухня, две спальни и приватная сауна. На террасе приятно встречать рассветы и слушать лес.",
    guests: 4,
    rooms: 2,
    price: 14500,
    images: ["/images/stitch/asset-021.png", "/images/stitch/asset-028.png", "/images/stitch/asset-023.png", "/images/stitch/asset-041.png"],
    amenities: ["Приватная сауна", "Камин", "Панорамная терраса", "Wi‑Fi", "Кухня", "Теплый пол"]
  },
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12302",
    slug: "sosna",
    name: "Дом «Сосна»",
    eyebrow: "Для семьи",
    description: "Светлый семейный дом рядом с озером и прогулочными тропами.",
    longDescription: "Продуманный дом для семейного отдыха: большая общая зона, три спальни, безопасная терраса и все необходимое для отдыха с детьми.",
    guests: 6,
    rooms: 3,
    price: 12000,
    images: ["/images/stitch/asset-008.png", "/images/stitch/asset-017.png", "/images/stitch/asset-026.png"],
    amenities: ["Мангал", "Терраса", "Wi‑Fi", "Кухня", "Детская кроватка"]
  },
  {
    id: "8fc5f68a-330f-4f50-b6e4-dcb260b12303",
    slug: "bereza",
    name: "Студия «Берёза»",
    eyebrow: "Для двоих",
    description: "Камерный дом с видом на лес для спокойных выходных.",
    longDescription: "Минималистичная студия с большой кроватью, небольшой кухней и террасой. Подходит для короткого перерыва от города.",
    guests: 2,
    rooms: 1,
    price: 8900,
    images: ["/images/stitch/asset-014.png", "/images/stitch/asset-015.png", "/images/stitch/asset-045.png"],
    amenities: ["Терраса", "Wi‑Fi", "Мини-кухня", "Вид на лес"]
  }
];

export const services = [
  { title: "Банный ритуал", description: "Парение с травами и отдых у огня.", image: "/images/stitch/asset-020.png", price: "от 6 500 ₽" },
  { title: "Завтрак в домик", description: "Сезонные продукты от местных фермеров.", image: "/images/stitch/asset-038.png", price: "от 1 900 ₽" },
  { title: "Лесная прогулка", description: "Маршрут с проводником по тихим тропам.", image: "/images/stitch/asset-044.png", price: "от 3 000 ₽" }
];

export const reviews = [
  { name: "Анна", date: "12 июня 2026", text: "Редкий случай, когда место вживую еще красивее. В «Кедре» очень тихо, а сауна после прогулки — отдельное удовольствие.", rating: 5 },
  { name: "Михаил", date: "28 мая 2026", text: "Все организовано точно и без лишней суеты. Дом теплый, чистый, кухня действительно удобная.", rating: 5 },
  { name: "Елена", date: "9 мая 2026", text: "Приезжали с детьми. Понравились тропы, завтраки и внимательное отношение команды.", rating: 5 }
];

export function formatPrice(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

