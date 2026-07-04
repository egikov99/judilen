"use client";
/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useRef, useState } from "react";

export type ImageGalleryProps = {
  images: string[];
  fallbackImage: string;
  alt: string;
  galleryId?: string;
  preserveAspectRatio?: boolean;
};

const SWIPE_DISTANCE = 45;

function reportImageError(context: unknown) {
  if (process.env.NODE_ENV !== "production") console.error("Public gallery image failed to load", context);
}

export function ImageGallery({
  images,
  fallbackImage,
  alt,
  galleryId = "detail",
  preserveAspectRatio = true
}: ImageGalleryProps) {
  const galleryImages = images.filter(Boolean).length ? images.filter(Boolean) : [fallbackImage];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const mainButtonRef = useRef<HTMLButtonElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const touchStartX = useRef<number | null>(null);
  const swipedMain = useRef(false);
  const hasMultiple = galleryImages.length > 1;

  const showPrevious = () => setSelectedIndex((index) => (index - 1 + galleryImages.length) % galleryImages.length);
  const showNext = () => setSelectedIndex((index) => (index + 1) % galleryImages.length);
  const previousLightbox = () => setLightboxIndex((index) => index === null ? null : (index - 1 + galleryImages.length) % galleryImages.length);
  const nextLightbox = () => setLightboxIndex((index) => index === null ? null : (index + 1) % galleryImages.length);

  function beginSwipe(clientX: number) {
    touchStartX.current = clientX;
  }

  function finishSwipe(clientX: number, previous: () => void, next: () => void, markMain = false) {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(distance) < SWIPE_DISTANCE || !hasMultiple) return;
    if (markMain) swipedMain.current = true;
    if (distance > 0) previous();
    else next();
  }

  function replaceWithFallback(event: SyntheticEvent<HTMLImageElement>, index: number, view: "main" | "thumbnail" | "lightbox") {
    const image = event.currentTarget;
    if (image.src.endsWith(fallbackImage)) return;
    reportImageError({ galleryId, index, view, src: galleryImages[index] });
    image.src = fallbackImage;
  }

  useEffect(() => {
    thumbnailRefs.current[selectedIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft" && hasMultiple) setLightboxIndex((index) => index === null ? null : (index - 1 + galleryImages.length) % galleryImages.length);
      if (event.key === "ArrowRight" && hasMultiple) setLightboxIndex((index) => index === null ? null : (index + 1) % galleryImages.length);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [galleryImages.length, hasMultiple, lightboxIndex]);

  function closeLightbox() {
    setLightboxIndex(null);
    requestAnimationFrame(() => mainButtonRef.current?.focus());
  }

  const selectedImage = galleryImages[selectedIndex];
  const lightboxImage = lightboxIndex === null ? null : galleryImages[lightboxIndex];

  return <div className={`image-gallery${preserveAspectRatio ? " image-gallery-contain" : ""}`}>
    <div className="image-gallery-stage">
      <button
        ref={mainButtonRef}
        type="button"
        className="image-gallery-main"
        aria-label={`Открыть увеличенное фото ${selectedIndex + 1} из ${galleryImages.length}`}
        onClick={() => {
          if (swipedMain.current) {
            swipedMain.current = false;
            return;
          }
          setLightboxIndex(selectedIndex);
        }}
        onTouchStart={(event) => beginSwipe(event.touches[0].clientX)}
        onTouchEnd={(event) => finishSwipe(event.changedTouches[0].clientX, showPrevious, showNext, true)}
      >
        <img
          src={selectedImage}
          alt={`${alt}, фото ${selectedIndex + 1}`}
          loading="eager"
          fetchPriority="high"
          onError={(event) => replaceWithFallback(event, selectedIndex, "main")}
        />
      </button>
      {hasMultiple && <span className="image-gallery-counter">{selectedIndex + 1} / {galleryImages.length}</span>}
    </div>

    {hasMultiple && <div className="image-gallery-thumbnails" role="list" aria-label="Миниатюры фотографий">
      {galleryImages.map((image, index) => <button
        ref={(element) => { thumbnailRefs.current[index] = element; }}
        type="button"
        role="listitem"
        className={`image-gallery-thumbnail${index === selectedIndex ? " is-active" : ""}`}
        aria-label={`Показать фото ${index + 1} из ${galleryImages.length}`}
        aria-current={index === selectedIndex ? "true" : undefined}
        onClick={() => setSelectedIndex(index)}
        key={`${image}-${index}`}
      >
        <img src={image} alt="" loading="lazy" onError={(event) => replaceWithFallback(event, index, "thumbnail")} />
      </button>)}
    </div>}

    {lightboxImage && lightboxIndex !== null && <div
      className="gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Фотографии: ${alt}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeLightbox();
      }}
    >
      <div
        className="gallery-lightbox-content"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeLightbox();
        }}
        onTouchStart={(event) => beginSwipe(event.touches[0].clientX)}
        onTouchEnd={(event) => finishSwipe(event.changedTouches[0].clientX, previousLightbox, nextLightbox)}
      >
        <button ref={closeButtonRef} type="button" className="gallery-lightbox-close" aria-label="Закрыть просмотр" onClick={closeLightbox}><X size={28} /></button>
        {hasMultiple && <button type="button" className="gallery-lightbox-nav gallery-lightbox-previous" aria-label="Предыдущее фото" onClick={previousLightbox}><ChevronLeft size={34} /></button>}
        <img src={lightboxImage} alt={`${alt}, фото ${lightboxIndex + 1} из ${galleryImages.length}`} onError={(event) => replaceWithFallback(event, lightboxIndex, "lightbox")} />
        {hasMultiple && <button type="button" className="gallery-lightbox-nav gallery-lightbox-next" aria-label="Следующее фото" onClick={nextLightbox}><ChevronRight size={34} /></button>}
        <span className="gallery-lightbox-counter">{lightboxIndex + 1} / {galleryImages.length}</span>
      </div>
    </div>}
  </div>;
}
