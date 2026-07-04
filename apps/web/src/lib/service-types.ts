export interface PublicServiceOption {
  id: string;
  title: string;
  description: string | null;
  price: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface PublicService {
  id: string;
  title: string;
  slug: string;
  description: string;
  images: string[];
  basePrice: number;
  priceUnit: "hour" | "day" | "booking" | "person" | "item";
  sortOrder: number;
  houseIds: string[];
  options: PublicServiceOption[];
}

export const priceUnitLabels: Record<PublicService["priceUnit"], string> = {
  hour: "за час",
  day: "за день",
  booking: "за бронь",
  person: "за человека",
  item: "за штуку"
};
