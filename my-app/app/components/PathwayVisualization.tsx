"use client";

import { motion } from "framer-motion";

interface PathwayStep {
  id: string;
  label: string;
  detail: string;
  shape: string;
  color: string;
}

interface PathwayVisualizationProps {
  steps: PathwayStep[];
}

export default function PathwayVisualization({ steps }: PathwayVisualizationProps) {
  return (
    <div className="relative py-2">
      {steps.map((step, i) => (
        <div key={step.id}>
          {/* Connecting gradient line */}
          {i > 0 && (
            <motion.div
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: i * 0.4 - 0.2, duration: 0.3 }}
              className="flex justify-start ml-[19px]"
              style={{ transformOrigin: "top" }}
            >
              <div
                className="w-0.5 h-6 rounded-full"
                style={{
                  background: `linear-gradient(to bottom, ${steps[i - 1].color}, ${step.color})`,
                }}
              />
            </motion.div>
          )}

          {/* Node */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.4, duration: 0.5, ease: "easeOut" }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[rgba(255,255,255,0.02)]"
          >
            {/* Shape indicator */}
            <div className="flex-shrink-0">
              <ShapeIcon shape={step.shape} color={step.color} size={38} />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight" style={{ color: step.color }}>
                {step.label}
              </p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                {step.detail}
              </p>
            </div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

function ShapeIcon({ shape, color, size }: { shape: string; color: string; size: number }) {
  const s = size;
  const half = s / 2;
  const fill = `${color}18`;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {shape === "hexagon" && (
        <polygon
          points={`${half},2 ${s - 4},${half * 0.5 + 2} ${s - 4},${half * 1.5 - 2} ${half},${s - 2} 4,${half * 1.5 - 2} 4,${half * 0.5 + 2}`}
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      )}
      {shape === "diamond" && (
        <polygon
          points={`${half},3 ${s - 3},${half} ${half},${s - 3} 3,${half}`}
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      )}
      {shape === "circle" && (
        <circle
          cx={half}
          cy={half}
          r={half - 3}
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      )}
      {shape === "rectangle" && (
        <rect
          x="3"
          y="7"
          width={s - 6}
          height={s - 14}
          rx="5"
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      )}
      {shape === "shield" && (
        <path
          d={`M${half},3 L${s - 5},${half * 0.55 + 2} L${s - 5},${half * 1.15} C${s - 5},${s - 6} ${half},${s - 2} ${half},${s - 2} C${half},${s - 2} 5,${s - 6} 5,${half * 1.15} L5,${half * 0.55 + 2} Z`}
          fill={fill}
          stroke={color}
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
