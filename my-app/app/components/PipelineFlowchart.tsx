"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { PipelineStep } from "../lib/types";

interface PipelineFlowchartProps {
  steps: PipelineStep[];
  onStepClick?: (stepId: string) => void;
  currentDrug?: string;
}

export default function PipelineFlowchart({
  steps,
  onStepClick,
  currentDrug,
}: PipelineFlowchartProps) {
  return (
    <div className="flex flex-col gap-0">
      {currentDrug && (
        <div className="mb-4 px-3 py-1.5 text-xs font-mono text-accent bg-[rgba(6,182,212,0.08)] rounded-lg self-start">
          Analyzing: {currentDrug}
        </div>
      )}

      {steps.map((step, i) => {
        const isActive = step.status === "active";
        const isCompleted = step.status === "completed";
        const isPending = step.status === "pending";

        return (
          <div key={step.id}>
            {/* Connector line */}
            {i > 0 && (
              <div className="flex items-center ml-[19px]">
                <div
                  className={`
                    w-0.5 h-5 transition-all duration-500
                    ${isCompleted || isActive ? "bg-accent" : "bg-card-border"}
                  `}
                />
              </div>
            )}

            {/* Step node */}
            <button
              onClick={() => onStepClick?.(step.id)}
              className={`
                w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left
                transition-all duration-300 cursor-pointer
                ${isActive ? "bg-[rgba(6,182,212,0.08)] animate-pulse-glow" : ""}
                ${isCompleted ? "bg-[rgba(34,197,94,0.05)]" : ""}
                ${isPending ? "opacity-40" : ""}
                hover:bg-[rgba(255,255,255,0.03)]
              `}
            >
              {/* Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-safe" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-muted/40" />
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium leading-tight ${
                    isActive ? "text-accent" : isCompleted ? "text-safe" : "text-muted"
                  }`}
                >
                  {step.label}
                </p>
                {(isActive || isCompleted) && (
                  <p className="text-xs text-muted mt-0.5 animate-fade-slide-up">
                    {step.description}
                  </p>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
