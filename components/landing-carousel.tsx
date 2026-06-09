"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const CAROUSEL_IMAGES = [
  {
    src: "https://picsum.photos/seed/haney1/800/600",
    alt: "AI conversation interface preview",
  },
  {
    src: "https://picsum.photos/seed/haney2/800/600",
    alt: "Model architecture visualization",
  },
  {
    src: "https://picsum.photos/seed/haney3/800/600",
    alt: "Streaming response demo",
  },
];

export function LandingCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
      {CAROUSEL_IMAGES.map((img, i) => (
        <div
          key={img.src}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
        >
          <Image
            src={img.src}
            alt={img.alt}
            fill
            className="object-cover"
            priority={i === 0}
          />
        </div>
      ))}
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {CAROUSEL_IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i === current
                ? "bg-white scale-110"
                : "bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
