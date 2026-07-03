"use client";

import Image, { type ImageProps } from "next/image";

type PublicImageProps = Omit<ImageProps, "src"> & {
  src: string;
  context: string;
};

export function PublicImage({ src, context, alt, onError, unoptimized, ...props }: PublicImageProps) {
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      unoptimized={unoptimized ?? (src.startsWith("/uploads/") || /^https?:\/\//i.test(src))}
      onError={(event) => {
        console.error("Public image failed to load", { src, context });
        onError?.(event);
      }}
    />
  );
}
