"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

// Skiper61 spring config
const SPRING = {
  mass: 0.1,
  damping: 10,
  stiffness: 131,
};

export default function CustomCursor() {
  const xSpring = useSpring(-100, SPRING);
  const ySpring = useSpring(-100, SPRING);
  const opacity = useMotionValue(0);
  const scale   = useSpring(0, SPRING);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      xSpring.set(e.clientX);
      ySpring.set(e.clientY);
    };
    const onEnter = () => { opacity.set(1); scale.set(1); };
    const onLeave = () => { opacity.set(0); scale.set(0); };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerenter", onEnter);
    document.documentElement.addEventListener("pointerleave", onLeave);

    // Show immediately once we have a position
    onEnter();

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerenter", onEnter);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [xSpring, ySpring, opacity, scale]);

  return (
    <motion.div
      className="pointer-events-none fixed z-[9999] rounded-full bg-cyan-400/80"
      style={{
        width: 14,
        height: 14,
        x: xSpring,
        y: ySpring,
        opacity,
        scale,
        translateX: "-50%",
        translateY: "-50%",
      }}
    />
  );
}
