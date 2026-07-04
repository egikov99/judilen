"use client";
/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DetailImageGallery({ galleryId, title, images }: {
  galleryId: string;
  title: string;
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

  return <>
    <div className="detail-image-gallery">
      {images.map((image, index) => <button type="button" className="detail-image-gallery-item" onClick={() => setActiveIndex(index)} aria-label={`Открыть фото ${index + 1} из ${images.length}`} key={`${image}-${index}`}>
        <img src={image} alt={`${title}, фото ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} onError={() => console.error("Detail gallery image failed to load", { galleryId, index, src: image })} />
      </button>)}
    </div>
    {activeImage && activeIndex !== null && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`Фотографии: ${title}`} onClick={close}>
      <div className="gallery-lightbox-content" onClick={(event) => event.stopPropagation()}>
        <button ref={closeButtonRef} type="button" className="gallery-lightbox-close" aria-label="Закрыть просмотр" onClick={close}><X size={28} /></button>
        {images.length > 1 && <button type="button" className="gallery-lightbox-nav gallery-lightbox-previous" aria-label="Предыдущее фото" onClick={previous}><ChevronLeft size={34} /></button>}
        <img src={activeImage} alt={`${title}, фото ${activeIndex + 1} из ${images.length}`} onError={() => console.error("Detail lightbox image failed to load", { galleryId, index: activeIndex, src: activeImage })} />
        {images.length > 1 && <button type="button" className="gallery-lightbox-nav gallery-lightbox-next" aria-label="Следующее фото" onClick={next}><ChevronRight size={34} /></button>}
        <span className="gallery-lightbox-counter">{activeIndex + 1} / {images.length}</span>
      </div>
    </div>}
  </>;
}

export function HouseGallery({ houseId, houseName, images }: {
  houseId: string;
  houseName: string;
  images: string[];
}) {
  return <DetailImageGallery galleryId={`house:${houseId}`} title={houseName} images={images} />;
}
