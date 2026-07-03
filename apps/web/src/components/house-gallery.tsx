"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PublicImage } from "@/components/public-image";

export function HouseGallery({ houseId, houseName, images }: {
  houseId: string;
  houseName: string;
  images: string[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeImage = activeIndex === null ? null : images[activeIndex];
  const isOpen = activeIndex !== null;

  function close() {
    setActiveIndex(null);
  }

  function previous() {
    setActiveIndex((index) => index === null ? null : (index - 1 + images.length) % images.length);
  }

  function next() {
    setActiveIndex((index) => index === null ? null : (index + 1) % images.length);
  }

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((index) => index === null ? null : (index - 1 + images.length) % images.length);
      if (event.key === "ArrowRight") setActiveIndex((index) => index === null ? null : (index + 1) % images.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [images.length, isOpen]);

  const featured = images.slice(0, 3);
  const remaining = images.slice(3);

  return <>
    <div className={`house-gallery house-gallery-count-${Math.min(featured.length, 3)}`}>
      {featured.map((image, index) => <button type="button" className="house-gallery-item" onClick={() => setActiveIndex(index)} aria-label={`Открыть фото ${index + 1} из ${images.length}`} key={`${image}-${index}`}>
        <PublicImage src={image} context={`house-gallery:${houseId}:${index}`} alt={`${houseName}, фото ${index + 1}`} width={900} height={700} priority={index === 0} loading={index === 0 ? "eager" : "lazy"} />
      </button>)}
    </div>
    {!!remaining.length && <div className="house-gallery-more">
      {remaining.map((image, offset) => {
        const index = offset + 3;
        return <button type="button" className="house-gallery-item" onClick={() => setActiveIndex(index)} aria-label={`Открыть фото ${index + 1} из ${images.length}`} key={`${image}-${index}`}>
          <PublicImage src={image} context={`house-gallery:${houseId}:${index}`} alt={`${houseName}, фото ${index + 1}`} width={600} height={450} loading="lazy" />
        </button>;
      })}
    </div>}
    {activeImage && activeIndex !== null && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Фотографии домика ${houseName}`} onClick={close}>
      <div className="gallery-lightbox-content" onClick={(event) => event.stopPropagation()}>
        <button ref={closeButtonRef} type="button" className="gallery-lightbox-close" aria-label="Закрыть просмотр" onClick={close}><X size={28} /></button>
        {images.length > 1 && <button type="button" className="gallery-lightbox-nav gallery-lightbox-previous" aria-label="Предыдущее фото" onClick={previous}><ChevronLeft size={34} /></button>}
        <PublicImage src={activeImage} context={`house-lightbox:${houseId}:${activeIndex}`} alt={`${houseName}, фото ${activeIndex + 1} из ${images.length}`} width={1600} height={1200} priority />
        {images.length > 1 && <button type="button" className="gallery-lightbox-nav gallery-lightbox-next" aria-label="Следующее фото" onClick={next}><ChevronRight size={34} /></button>}
        <span className="gallery-lightbox-counter">{activeIndex + 1} / {images.length}</span>
      </div>
    </div>}
  </>;
}
