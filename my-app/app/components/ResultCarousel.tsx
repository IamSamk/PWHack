"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ResultCarouselProps {
  children: React.ReactNode[];
  labels: string[];
}

export default function ResultCarousel({ children, labels }: ResultCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);

  const navigate = useCallback(
    (newIndex: number) => {
      if (newIndex === current || newIndex < 0 || newIndex >= children.length) return;
      setDirection(newIndex > current ? 1 : -1);
      setCurrent(newIndex);
    },
    [current, children.length]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(current - 1);
      if (e.key === "ArrowRight") navigate(current + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, current]);

  if (children.length === 0) return null;
  if (children.length === 1) return <>{children[0]}</>;

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 400 : -400, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -400 : 400, opacity: 0 }),
  };

  return (
    <div>
      {/* Drug tabs */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => navigate(i)}
            className={`
              px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200
              cursor-pointer whitespace-nowrap
              ${i === current
                ? "bg-accent text-background shadow-lg shadow-accent/20"
                : "bg-card border border-card-border text-muted hover:text-foreground hover:border-accent/30"
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Carousel viewport */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            {children[current]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => navigate(current - 1)}
          disabled={current === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-card-border
            hover:border-accent/30 hover:text-accent disabled:opacity-25
            disabled:cursor-not-allowed cursor-pointer transition-all text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2">
          {labels.map((_, i) => (
            <button
              key={i}
              onClick={() => navigate(i)}
              className={`
                h-2 rounded-full transition-all duration-300 cursor-pointer
                ${i === current
                  ? "bg-accent w-6"
                  : "bg-card-border w-2 hover:bg-muted"
                }
              `}
            />
          ))}
        </div>

        <button
          onClick={() => navigate(current + 1)}
          disabled={current === children.length - 1}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-card-border
            hover:border-accent/30 hover:text-accent disabled:opacity-25
            disabled:cursor-not-allowed cursor-pointer transition-all text-sm"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
