"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ResultCarouselProps {
  children: React.ReactNode[];
  labels: string[];
}

export default function ResultCarousel({ children, labels }: ResultCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (newIndex: number) => {
      if (newIndex < 0 || newIndex >= children.length || newIndex === current) return;
      setDirection(newIndex > current ? 1 : -1);
      setCurrent(newIndex);
    },
    [current, children.length]
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") navigate(current - 1);
      if (e.key === "ArrowRight") navigate(current + 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigate, current]);

  if (!children.length) return null;
  if (children.length === 1) return <>{children[0]}</>;

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0, scale: 0.97 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: number) => ({ x: d > 0 ? "-100%" : "100%", opacity: 0, scale: 0.97 }),
  };

  return (
    <div className="space-y-3">
      {/* Drug tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {labels.map((label, i) => (
          <motion.button
            key={label}
            onClick={() => navigate(i)}
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

      {/* Viewport */}
      <div ref={viewportRef} className="overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            drag="x"
            dragConstraints={viewportRef}
            dragElastic={0.08}
            onDragEnd={(_, info) => {
              if (info.offset.x < -90) navigate(current + 1);
              else if (info.offset.x > 90) navigate(current - 1);
            }}
            style={{ cursor: "grab" }}
            whileDrag={{ cursor: "grabbing" }}
          >
            {children[current]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation row */}
      <div className="flex items-center justify-between pt-1">
        <motion.button
          onClick={() => navigate(current - 1)}
          disabled={current === 0}
          whileTap={{ scale: 0.93 }}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-xl border border-card-border
            hover:border-accent/30 hover:text-accent disabled:opacity-20
            disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Prev
        </motion.button>

        <div className="flex items-center gap-2">
          {labels.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => navigate(i)}
              whileTap={{ scale: 0.8 }}
              animate={{ width: i === current ? 24 : 8 }}
              transition={{ duration: 0.25 }}
              className={`h-2 rounded-full cursor-pointer transition-colors ${
                i === current ? "bg-accent" : "bg-card-border hover:bg-muted"
              }`}
              style={{ width: 8 }}
            />
          ))}
        </div>

        <motion.button
          onClick={() => navigate(current + 1)}
          disabled={current === children.length - 1}
          whileTap={{ scale: 0.93 }}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-xl border border-card-border
            hover:border-accent/30 hover:text-accent disabled:opacity-20
            disabled:cursor-not-allowed cursor-pointer transition-all"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </div>
  );
}
