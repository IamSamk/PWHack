"use client";

import { BarChart3, AlertTriangle, TrendingUp } from "lucide-react";
import type { BurdenScore } from "../lib/types";

interface BurdenScoreCardProps {
  burden: BurdenScore;
}

const TIER_COLORS: Record<string, string> = {
  CRITICAL: "text-danger",
  HIGH: "text-danger",
  MODERATE: "text-warn",
  LOW: "text-safe",
  MINIMAL: "text-safe",
};

const TIER_BG: Record<string, string> = {
  CRITICAL: "bg-[rgba(239,68,68,0.1)]",
  HIGH: "bg-[rgba(239,68,68,0.08)]",
  MODERATE: "bg-[rgba(234,179,8,0.08)]",
  LOW: "bg-[rgba(34,197,94,0.08)]",
  MINIMAL: "bg-[rgba(34,197,94,0.05)]",
};

export default function BurdenScoreCard({ burden }: BurdenScoreCardProps) {
  const tierColor = TIER_COLORS[burden.risk_tier] || "text-muted";
  const tierBg = TIER_BG[burden.risk_tier] || "";

  return (
    <div className="border border-card-border rounded-xl overflow-hidden animate-fade-slide-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-card-border">
        <BarChart3 className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium">Pharmacogenomic Burden Score</span>
      </div>

      {/* Score display */}
      <div className="px-5 py-4 flex items-center gap-6">
        <div className="text-center">
          <div className={`text-3xl font-bold font-mono ${tierColor}`}>
            {burden.pharmacogenomic_burden_score}
          </div>
          <div className="text-xs text-muted mt-0.5">Raw PBS</div>
        </div>

        <div className="h-12 w-px bg-card-border" />

        <div className="text-center">
          <div className="text-xl font-bold font-mono text-foreground">
            {(burden.normalized_pbs * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-muted mt-0.5">Normalized</div>
        </div>

        <div className="h-12 w-px bg-card-border" />

        <div className="text-center">
          <div
            className={`
              inline-block px-3 py-1 text-sm font-bold rounded-full uppercase
              ${tierColor} ${tierBg}
            `}
          >
            {burden.risk_tier}
          </div>
          <div className="text-xs text-muted mt-1">Risk Tier</div>
        </div>

        <div className="ml-auto text-right">
          <div className="flex items-center gap-1 text-xs text-muted">
            <TrendingUp className="w-3 h-3" />
            {burden.total_genes_affected} gene{burden.total_genes_affected !== 1 ? "s" : ""} affected
          </div>
          <div className="text-xs text-muted">
            {burden.drugs_analyzed} drugs analyzed
          </div>
        </div>
      </div>

      {/* High-risk pairs */}
      {burden.high_risk_pairs.length > 0 && (
        <div className="px-5 py-3 border-t border-card-border bg-[rgba(239,68,68,0.03)]">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-danger" />
            <span className="text-xs font-semibold text-danger">
              High-Risk Drug–Gene Pairs
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {burden.high_risk_pairs.map((pair, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-[rgba(239,68,68,0.08)] text-danger rounded-lg"
              >
                {pair.drug}–{pair.gene} ({pair.phenotype}: {pair.risk_label})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
