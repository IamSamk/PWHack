"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface ResultCarouselProps {
  children: React.ReactNode[];
  labels: string[];
}

export default function ResultCarousel({ children, labels }: ResultCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  // Watch which card is snapped using IntersectionObserver
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Array.from(el.children).indexOf(entry.target as HTMLElement);
            if (idx >= 0) setCurrent(idx);
          }
        });
      },
      { root: el, threshold: 0.55 }
    );
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [children.length]);

  const scrollTo = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[idx] as HTMLElement;
    child?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    setCurrent(idx);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollTo(Math.max(0, current - 1));
      if (e.key === "ArrowRight") scrollTo(Math.min(labels.length - 1, current + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, labels.length, scrollTo]);

  if (!children.length) return null;
  if (children.length === 1) return <>{children[0]}</>;

  return (
    <div className="space-y-3">
      {/* ── Drug tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {labels.map((label, i) => (
          <motion.button
            key={label}
            onClick={() => scrollTo(i)}
            whileTap={{ scale: 0.94 }}
            className={`
              px-4 py-2 text-sm font-semibold rounded-xl whitespace-nowrap flex-none
              transition-all duration-200 cursor-pointer
              ${i === current
                ? "bg-accent text-background shadow-lg shadow-accent/25"
                : "bg-card border border-card-border text-muted hover:text-foreground hover:border-accent/30"
              }
            `}
          >
            {label}
          </motion.button>
        ))}
      </div>

      {/* ── Smooth horizontal scroll track (CSS scroll-snap) ── */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 scrollbar-none"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={{ WebkitOverflowScrolling: "touch" } as any}
      >
        {children.map((child, i) => (
          <div key={i} className="snap-start flex-none w-full">
            {child}
          </div>
        ))}
      </div>

      {/* ── Animated pill dots ── */}
      <div className="flex justify-center items-center gap-2 pt-1">
        {labels.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => scrollTo(i)}
            whileTap={{ scale: 0.8 }}
            animate={{ width: i === current ? 24 : 8 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className={`
              h-1.5 rounded-full cursor-pointer transition-colors
              ${i === current ? "bg-accent" : "bg-card-border hover:bg-muted"}
            `}
            style={{ width: 8 }}
          />
        ))}
      </div>
    </div>
  );
}