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
    <div className="overflow-x-auto py-3 px-1">
      <div className="flex items-start gap-0 min-w-max">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-start">
            {/* Node */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15, duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-1.5 w-[90px]"
            >
              {/* Shape */}
              <ShapeIcon shape={step.shape} color={step.color} size={36} />

              {/* Label */}
              <p
                className="text-[10px] font-bold text-center leading-tight w-full px-1"
                style={{ color: step.color }}
              >
                {step.label}
              </p>

              {/* Detail */}
              <p className="text-[9px] text-muted text-center leading-tight w-full px-1 line-clamp-2">
                {step.detail.length > 48 ? step.detail.slice(0, 48) + "…" : step.detail}
              </p>
            </motion.div>

            {/* Arrow connector */}
            {i < steps.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ delay: i * 0.15 + 0.1, duration: 0.3 }}
                className="flex items-center mt-[14px] mx-1"
                style={{ transformOrigin: "left" }}
              >
                <svg width="28" height="14" viewBox="0 0 28 14">
                  <defs>
                    <linearGradient id={`arr-${i}`} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={step.color} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={steps[i + 1].color} stopOpacity="0.6" />
                    </linearGradient>
                  </defs>
                  <line
                    x1="0" y1="7" x2="20" y2="7"
                    stroke={`url(#arr-${i})`}
                    strokeWidth="1.5"
                  />
                  <polyline
                    points="16,3 22,7 16,11"
                    fill="none"
                    stroke={steps[i + 1].color}
                    strokeWidth="1.5"
                    strokeOpacity="0.7"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShapeIcon({ shape, color, size }: { shape: string; color: string; size: number }) {
  const s = size;
  const half = s / 2;
  const fill = `${color}20`;

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
        <circle cx={half} cy={half} r={half - 3} fill={fill} stroke={color} strokeWidth="1.5" />
      )}
      {shape === "rectangle" && (
        <rect x="3" y="7" width={s - 6} height={s - 14} rx="5" fill={fill} stroke={color} strokeWidth="1.5" />
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

