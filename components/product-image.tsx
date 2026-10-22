"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
// Local photo when we have one, otherwise the source's CDN image; graceful fallback either way.
export default function ProductImage({
  src,
  alt,
  className = "",
  iconSize = 32,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className={`grid place-items-center text-stone-300 ${className}`} aria-hidden>
        <ImageOff size={iconSize} strokeWidth={1.5} />
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-contain ${className}`}
    />
  );
}
