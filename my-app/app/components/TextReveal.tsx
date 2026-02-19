"use client";

import { motion } from "framer-motion";

interface TextRevealProps {
  text: string;
  delay?: number;
  className?: string;
}

export default function TextReveal({ text, delay = 0, className = "" }: TextRevealProps) {
  const words = text.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{
            delay: delay + i * 0.022,
            duration: 0.28,
            ease: "easeOut",
          }}
        >
          {word}
          {i < words.length - 1 ? "\u00A0" : ""}
        </motion.span>
      ))}
    </span>
  );
}
