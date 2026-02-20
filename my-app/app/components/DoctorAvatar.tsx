"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import TextReveal from "./TextReveal";

interface DoctorAvatarProps {
  riskLabel: string;
  explanation: string;
  modelName: string;
}

type RiskKey = "safe" | "adjust dosage" | "toxic" | "ineffective" | "unknown";

const RISK_CONFIG: Record<
  RiskKey,
  {
    color: string;
    glow: string;
    mouth: string;
    eyeType: string;
    armOffset: number;
  }
> = {
  safe: {
    color: "#22c55e",
    glow: "rgba(34,197,94,0.12)",
    mouth: "M 33 24 Q 38 29 43 24",
    eyeType: "happy",
    armOffset: 18,
  },
  "adjust dosage": {
    color: "#eab308",
    glow: "rgba(234,179,8,0.12)",
    mouth: "M 33 25 L 43 25",
    eyeType: "neutral",
    armOffset: 0,
  },
  toxic: {
    color: "#ef4444",
    glow: "rgba(239,68,68,0.12)",
    mouth: "M 33 27 Q 38 22 43 27",
    eyeType: "alarmed",
    armOffset: -25,
  },
  ineffective: {
    color: "#ef4444",
    glow: "rgba(239,68,68,0.12)",
    mouth: "M 33 24 Q 36 28 38 24 Q 40 20 43 24",
    eyeType: "confused",
    armOffset: -18,
  },
  unknown: {
    color: "#64748b",
    glow: "rgba(100,116,139,0.12)",
    mouth: "M 33 25 L 43 25",
    eyeType: "neutral",
    armOffset: 10,
  },
};

function Eye({ cx, cy, type, c }: { cx: number; cy: number; type: string; c: string }) {
  if (type === "happy")
    return (
      <path
        d={`M ${cx - 3} ${cy + 1} Q ${cx} ${cy - 3} ${cx + 3} ${cy + 1}`}
        fill="none"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    );
  if (type === "alarmed")
    return (
      <g>
        <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} stroke={c} strokeWidth="1.6" strokeLinecap="round" />
        <line x1={cx + 3} y1={cy - 3} x2={cx - 3} y2={cy + 3} stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    );
  if (type === "confused")
    return (
      <>
        <ellipse cx={cx} cy={cy} rx="3" ry="2.5" fill={c} fillOpacity="0.7" />
        <line x1={cx - 4} y1={cy - 5} x2={cx + 1} y2={cy - 3} stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      </>
    );
  return <ellipse cx={cx} cy={cy} rx="3" ry="3" fill={c} fillOpacity="0.8" />;
}

export default function DoctorAvatar({ riskLabel, explanation, modelName }: DoctorAvatarProps) {
  const key = (riskLabel.toLowerCase() in RISK_CONFIG
    ? riskLabel.toLowerCase()
    : "unknown") as RiskKey;
  const cfg = RISK_CONFIG[key];

  const [revealText, setRevealText] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  useEffect(() => {
    setRevealText(false);
    setRevealKey((k) => k + 1);
    const t = setTimeout(() => setRevealText(true), 500);
    return () => clearTimeout(t);
  }, [explanation]);

  // Arm endpoint geometry (pivoting at shoulder)
  const rad = ((cfg.armOffset + 35) * Math.PI) / 180;
  const lx = 20 - Math.cos(rad) * 18;
  const ly = 50 + Math.sin(rad) * 18;
  const rx = 60 + Math.cos(rad) * 18;
  const ry = 50 + Math.sin(rad) * 18;

  return (
    <div className="flex gap-4 items-start">
      {/* ── Doctor SVG ── */}
      <div className="flex-shrink-0 flex flex-col items-center">
        <svg width="84" height="124" viewBox="0 0 80 120" className="overflow-visible">
          {/* Body glow */}
          <circle cx="40" cy="58" r="34" fill={cfg.glow} />

          {/* Coat */}
          <motion.rect
            x="18" y="42" width="44" height="34" rx="4"
            fill="#111827"
            stroke={cfg.color}
            strokeWidth="0.8"
            strokeOpacity="0.35"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            style={{ transformOrigin: "40px 42px" }}
            transition={{ delay: 0.15, duration: 0.45 }}
          />

          {/* Lapels */}
          <motion.path
            d="M 36 42 L 31 52 L 40 49 L 49 52 L 44 42"
            fill="#0b1120"
            stroke={cfg.color}
            strokeWidth="0.5"
            strokeOpacity="0.25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          />

          {/* Stethoscope */}
          <motion.path
            d="M 28 46 Q 22 38 30 34 Q 38 30 46 34 Q 54 38 52 46"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.2"
            strokeOpacity="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          />
          <circle cx="40" cy="33" r="1.8" fill="#94a3b8" fillOpacity="0.55" />

          {/* Left arm */}
          <motion.line
            x1="18" y1="48" x2={lx} y2={ly}
            stroke={cfg.color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeOpacity="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: "spring", stiffness: 160 }}
          />
          <motion.circle cx={lx} cy={ly} r="3" fill={cfg.color} fillOpacity="0.4"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.55 }}
          />

          {/* Right arm */}
          <motion.line
            x1="62" y1="48" x2={rx} y2={ry}
            stroke={cfg.color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeOpacity="0.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.4, duration: 0.5, type: "spring", stiffness: 160 }}
          />
          <motion.circle cx={rx} cy={ry} r="3" fill={cfg.color} fillOpacity="0.4"
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.55 }}
          />

          {/* Left leg */}
          <motion.line x1="30" y1="76" x2="26" y2="98"
            stroke="#1e293b" strokeWidth="5" strokeLinecap="round"
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            style={{ transformOrigin: "30px 76px" }}
            transition={{ delay: 0.3, duration: 0.4 }}
          />
          {/* Right leg */}
          <motion.line x1="50" y1="76" x2="54" y2="98"
            stroke="#1e293b" strokeWidth="5" strokeLinecap="round"
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            style={{ transformOrigin: "50px 76px" }}
            transition={{ delay: 0.35, duration: 0.4 }}
          />
          {/* Shoes */}
          <line x1="22" y1="98" x2="30" y2="98" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="98" x2="58" y2="98" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />

          {/* Neck */}
          <line x1="40" y1="34" x2="40" y2="42" stroke="#c9a87c" strokeWidth="6" strokeLinecap="round" />

          {/* Head */}
          <motion.circle
            cx="40" cy="20" r="16"
            fill="#c9a87c"
            stroke={cfg.color}
            strokeWidth="1.2"
            strokeOpacity="0.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.05, duration: 0.5, type: "spring", stiffness: 260 }}
          />

          {/* Hair */}
          <path
            d="M 24 17 Q 26 7 40 7 Q 54 7 56 17 Q 56 9 40 9 Q 24 9 24 17"
            fill="#1e293b"
            fillOpacity="0.85"
          />

          {/* Eyes (animated expression change) */}
          <AnimatePresence mode="wait">
            <motion.g
              key={`eye-${key}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              <Eye cx={34} cy={19} type={cfg.eyeType} c="#1e293b" />
              <Eye cx={46} cy={19} type={cfg.eyeType} c="#1e293b" />
            </motion.g>
          </AnimatePresence>

          {/* Mouth */}
          <AnimatePresence mode="wait">
            <motion.path
              key={`mouth-${key}`}
              d={cfg.mouth}
              fill="none"
              stroke="#1e293b"
              strokeWidth="1.8"
              strokeLinecap="round"
              initial={{ opacity: 0, pathLength: 0 }}
              animate={{ opacity: 1, pathLength: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.12, duration: 0.4 }}
            />
          </AnimatePresence>
        </svg>

        <p className="text-[10px] font-bold uppercase tracking-widest mt-1" style={{ color: cfg.color }}>
          {riskLabel.toUpperCase()}
        </p>
      </div>

      {/* ── Speech Bubble ── */}
      <div className="flex-1 relative min-w-0 pt-1">
        {/* Pointer triangle */}
        <div
          className="absolute left-0 top-7 -translate-x-2"
          style={{
            width: 0, height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderRight: `9px solid ${cfg.color}22`,
          }}
        />

        <div
          className="rounded-xl p-4"
          style={{
            background: `${cfg.color}08`,
            border: `1px solid ${cfg.color}22`,
          }}
        >
          <div className="text-sm leading-relaxed text-foreground/85 min-h-[3.5rem]">
            {revealText ? (
              <TextReveal key={revealKey} text={explanation} />
            ) : (
              <div className="space-y-2">
                {[92, 80, 65].map((w, i) => (
                  <div
                    key={i}
                    className="h-3.5 rounded-md animate-shimmer"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] font-mono text-muted/50 mt-3 border-t border-[rgba(255,255,255,0.04)] pt-2">
            {modelName}
          </p>
        </div>
      </div>
    </div>
  );
}
