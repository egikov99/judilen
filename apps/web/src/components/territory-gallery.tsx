"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PublicImage } from "@/components/public-image";

interface GalleryImage {
  id: string;
  imageUrl: string;
  alt: string;
}

export function TerritoryGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const hasMultiple = images.length > 1;

  function previous() {
    setActiveIndex((index) => (index - 1 + images.length) % images.length);
  }

  function next() {
    setActiveIndex((index) => (index + 1) % images.length);
  }

  function previousLightbox() {
    setLightboxIndex((index) => index === null ? null : (index - 1 + images.length) % images.length);
  }

  function nextLightbox() {
    setLightboxIndex((index) => index === null ? null : (index + 1) % images.length);
  }

  useEffect(() => {
    if (lightboxIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxIndex(null);
      if (event.key === "ArrowLeft" && hasMultiple) {
        setLightboxIndex((index) => index === null ? null : (index - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && hasMultiple) {
        setLightboxIndex((index) => index === null ? null : (index + 1) % images.length);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasMultiple, images.length, lightboxIndex]);

  const activeImage = images[activeIndex] ?? images[0];
  const lightboxImage = lightboxIndex === null ? null : images[lightboxIndex];
  if (!activeImage) return null;

  return (
    <>
      <div className="split-image territory-gallery">
        <button className="territory-gallery-main" type="button" onClick={() => setLightboxIndex(activeIndex)} aria-label={`Открыть фотографию: ${activeImage.alt}`}>
          <PublicImage
            src={activeImage.imageUrl}
            context={`territory-gallery:${activeImage.id}`}
            alt={activeImage.alt}
            fill
            sizes="(max-width: 950px) calc(100vw - 30px), 50vw"
          />
        </button>
        {hasMultiple && (
          <>
            <button className="territory-gallery-arrow territory-gallery-previous" type="button" onClick={previous} aria-label="Предыдущее фото"><ChevronLeft size={22} /></button>
            <button className="territory-gallery-arrow territory-gallery-next" type="button" onClick={next} aria-label="Следующее фото"><ChevronRight size={22} /></button>
            <div className="territory-gallery-dots" aria-label="Выбор фотографии">
              {images.map((image, index) => (
                <button
                  className={index === activeIndex ? "is-active" : ""}
                  type="button"
                  key={image.id}
                  aria-label={`Показать фото ${index + 1}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {lightboxImage && (
        <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Увеличенный просмотр территории" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setLightboxIndex(null);
        }}>
          <div className="gallery-lightbox-content" onMouseDown={(event) => event.stopPropagation()}>
            <PublicImage
              src={lightboxImage.imageUrl}
              context={`territory-gallery-lightbox:${lightboxImage.id}`}
              alt={lightboxImage.alt}
              width={1600}
              height={1200}
              sizes="100vw"
              priority
            />
            <button ref={closeButtonRef} className="gallery-lightbox-close" type="button" onClick={() => setLightboxIndex(null)} aria-label="Закрыть"><X size={24} /></button>
            {hasMultiple && (
              <>
                <button className="gallery-lightbox-nav gallery-lightbox-previous" type="button" onClick={previousLightbox} aria-label="Предыдущее фото"><ChevronLeft size={28} /></button>
                <button className="gallery-lightbox-nav gallery-lightbox-next" type="button" onClick={nextLightbox} aria-label="Следующее фото"><ChevronRight size={28} /></button>
                <span className="gallery-lightbox-counter">{(lightboxIndex ?? 0) + 1} / {images.length}</span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
