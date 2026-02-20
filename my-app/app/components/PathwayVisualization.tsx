"use client";

import { useId } from "react";
import { motion } from "framer-motion";

interface PathwayStep {
  id: string;
  label: string;
  detail: string;
  shape: string;
  color: string;
}

const NODE_R = 26;
const SPACING = 114;
const CY = 42;
const SVG_H = 108;

export default function PathwayVisualization({ steps }: { steps: PathwayStep[] }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const N = steps.length;
  const SVG_W = N * SPACING;
  const xs = steps.map((_, i) => SPACING / 2 + i * SPACING);

  return (
    <div className="w-full overflow-x-auto py-1 px-2">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", minWidth: `${SVG_W}px`, height: `${SVG_H}px` }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {steps.slice(0, -1).map((step, i) => (
            <linearGradient key={i} id={`${uid}lg${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={step.color} stopOpacity="0.8" />
              <stop offset="100%" stopColor={steps[i + 1].color} stopOpacity="0.8" />
            </linearGradient>
          ))}
          {steps.map((step, i) => (
            <radialGradient key={i} id={`${uid}rg${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={step.color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={step.color} stopOpacity="0" />
            </radialGradient>
          ))}
          <filter id={`${uid}glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Connections ── */}
        {steps.slice(0, -1).map((step, i) => {
          const x1 = xs[i] + NODE_R + 3;
          const x2 = xs[i + 1] - NODE_R - 3;
          return (
            <g key={i}>
              {/* Glow blur line */}
              <motion.line
                x1={x1} y1={CY} x2={x2} y2={CY}
                stroke={`url(#${uid}lg${i})`}
                strokeWidth="7"
                strokeLinecap="round"
                filter={`url(#${uid}glow)`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.35 }}
                transition={{ delay: i * 0.18 + 0.55, duration: 0.5 }}
              />

              {/* Animated dashed line */}
              <motion.line
                x1={x1} y1={CY} x2={x2} y2={CY}
                stroke={`url(#${uid}lg${i})`}
                strokeWidth="1.8"
                strokeDasharray="7 4"
                strokeLinecap="round"
                initial={{ strokeDashoffset: 60, opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: 1 }}
                transition={{ delay: i * 0.18 + 0.62, duration: 0.65, ease: "easeOut" }}
              />

              {/* Arrowhead */}
              <motion.path
                d={`M ${x2 - 6} ${CY - 4.5} L ${x2 + 1} ${CY} L ${x2 - 6} ${CY + 4.5}`}
                fill="none"
                stroke={steps[i + 1].color}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: i * 0.18 + 0.9, duration: 0.3 }}
              />
            </g>
          );
        })}

        {/* ── Nodes ── */}
        {steps.map((step, i) => (
          <g key={step.id}>
            {/* Halo */}
            <motion.circle
              cx={xs[i]} cy={CY} r={NODE_R * 2.1}
              fill={`url(#${uid}rg${i})`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.17, duration: 0.55 }}
            />

            {/* Outer ring */}
            <motion.circle
              cx={xs[i]} cy={CY} r={NODE_R}
              fill={step.color}
              fillOpacity="0.08"
              stroke={step.color}
              strokeWidth="1.8"
              strokeOpacity="0.7"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: i * 0.17,
                duration: 0.55,
                type: "spring",
                stiffness: 260,
                damping: 18,
              }}
            />

            {/* Inner filled disc */}
            <motion.circle
              cx={xs[i]} cy={CY} r={NODE_R * 0.52}
              fill={step.color}
              fillOpacity="0.22"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.17 + 0.12, duration: 0.4 }}
            />

            {/* Step number */}
            <motion.text
              x={xs[i]} y={CY + 4}
              textAnchor="middle"
              fill={step.color}
              fontSize="12"
              fontWeight="800"
              fontFamily="ui-monospace, monospace"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.17 + 0.28 }}
            >
              {String(i + 1).padStart(2, "0")}
            </motion.text>

            {/* Label */}
            <motion.text
              x={xs[i]}
              y={CY + NODE_R + 13}
              textAnchor="middle"
              fill={step.color}
              fontSize="9"
              fontWeight="700"
              initial={{ opacity: 0, y: CY + NODE_R + 17 }}
              animate={{ opacity: 1, y: CY + NODE_R + 13 }}
              transition={{ delay: i * 0.17 + 0.3, duration: 0.4 }}
            >
              {step.label}
            </motion.text>

            {/* Detail */}
            <motion.text
              x={xs[i]}
              y={CY + NODE_R + 24}
              textAnchor="middle"
              fill="#64748b"
              fontSize="6.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ delay: i * 0.17 + 0.42, duration: 0.4 }}
            >
              {step.detail.length > 24 ? step.detail.slice(0, 24) + "\u2026" : step.detail}
            </motion.text>
          </g>
        ))}

        {/* Cycling pulse rings — each node pulses in sequence, one at a time */}
        {steps.map((step, i) => (
          <motion.circle
            key={`pulse-${i}`}
            cx={xs[i]} cy={CY} r={NODE_R}
            fill="none"
            stroke={step.color}
            strokeWidth="1.5"
            initial={{ scale: 1, opacity: 0.6 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1 + i * 2,
              repeatDelay: (N - 1) * 2,
            }}
          />
        ))}
      </svg>
    </div>
  );
}

