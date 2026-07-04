import { ImageGallery } from "@/components/image-gallery";
import { DEFAULT_IMAGE_URL } from "@/lib/image-urls";

export function HouseGallery({ houseId, houseName, images }: {
  houseId: string;
  houseName: string;
  images: string[];
}) {
  return <ImageGallery
    galleryId={`house:${houseId}`}
    images={images}
    fallbackImage={DEFAULT_IMAGE_URL}
    alt={houseName}
    preserveAspectRatio
  />;
}
