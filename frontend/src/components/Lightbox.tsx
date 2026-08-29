"use client";

import { useEffect } from "react";
import Image from "next/image";

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}

export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, onClose, onIndexChange]);

  return (
    <div className="anim-fade-in fixed inset-0 z-[1000] flex flex-col bg-ink/95" role="dialog" aria-modal="true">
      <div className="flex justify-between p-4">
        <span className="text-sm text-paper/70">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="flex h-11 w-11 items-center justify-center rounded-pill border-2 border-paper/40 text-paper"
        >
          ✕
        </button>
      </div>
      <div className="relative flex-1">
        <Image src={images[index]} alt="" fill sizes="100vw" className="object-contain" />
      </div>
      {images.length > 1 && (
        <div className="flex justify-between p-4">
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-paper/40 text-paper"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % images.length)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-pill border-2 border-paper/40 text-paper"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
