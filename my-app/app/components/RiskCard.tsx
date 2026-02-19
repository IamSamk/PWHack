"use client";

import {
  Shield,
  ShieldAlert,
  ShieldX,
  ShieldOff,
  ShieldQuestion,
  ChevronDown,
  Dna,
} from "lucide-react";
import { useState } from "react";
import type { DrugAnalysisResult } from "../lib/types";

interface RiskCardProps {
  result: DrugAnalysisResult;
}

const RISK_CONFIG: Record<string, { color: string; bg: string; icon: typeof Shield }> = {
  safe: { color: "text-safe", bg: "bg-[rgba(34,197,94,0.1)] border-safe/30", icon: Shield },
  "adjust dosage": { color: "text-warn", bg: "bg-[rgba(234,179,8,0.1)] border-warn/30", icon: ShieldAlert },
  toxic: { color: "text-danger", bg: "bg-[rgba(239,68,68,0.1)] border-danger/30", icon: ShieldX },
  ineffective: { color: "text-danger", bg: "bg-[rgba(239,68,68,0.1)] border-danger/30", icon: ShieldOff },
  unknown: { color: "text-muted", bg: "bg-[rgba(100,116,139,0.1)] border-muted/30", icon: ShieldQuestion },
};

function getRiskConfig(label: string) {
  const key = label.toLowerCase();
  return RISK_CONFIG[key] || RISK_CONFIG["unknown"];
}

export default function RiskCard({ result }: RiskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const risk = result.risk_assessment;
  const pgx = result.pharmacogenomic_profile;
  const rec = result.clinical_recommendation;
  const config = getRiskConfig(risk.risk_label);
  const Icon = config.icon;

  return (
    <div
      className={`
        border rounded-xl overflow-hidden transition-all duration-300
        animate-fade-slide-up ${config.bg}
      `}
    >
      {/* Header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Icon className={`w-7 h-7 ${config.color}`} />
            <div>
              <h3 className="text-lg font-bold">{result.drug}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`
                    inline-block px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wide
                    ${config.color} ${config.bg}
                  `}
                >
                  {risk.risk_label}
                </span>
                <span className="text-xs text-muted">
                  {risk.severity} severity
                </span>
              </div>
            </div>
          </div>

          {/* Confidence gauge */}
          <div className="flex flex-col items-center">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="currentColor" strokeWidth="4"
                  className="text-card-border"
                />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="currentColor" strokeWidth="4"
                  className={config.color}
                  strokeLinecap="round"
                  strokeDasharray={`${risk.confidence_score * 138.2} 138.2`}
                  style={{ transition: "stroke-dasharray 1s ease-out" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {Math.round(risk.confidence_score * 100)}%
              </span>
            </div>
            <span className="text-[10px] text-muted mt-0.5">Confidence</span>
          </div>
        </div>

        {/* Gene info row */}
        <div className="flex flex-wrap gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Dna className="w-3.5 h-3.5 text-accent" />
            <span className="text-muted">Gene:</span>
            <span className="font-mono font-medium">{pgx.primary_gene}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Diplotype:</span>
            <span className="font-mono font-medium">{pgx.diplotype}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Phenotype:</span>
            <span className="font-medium">{pgx.phenotype}</span>
          </div>
        </div>
      </div>

      {/* Expandable recommendation */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs border-t border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
      >
        <span className="font-medium text-muted">Clinical Recommendation</span>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-4 animate-fade-slide-up">
          <p className="text-sm leading-relaxed text-foreground/80">
            {rec.recommendation}
          </p>
          <p className="text-xs text-muted mt-2">
            Source: {rec.guideline_source}
          </p>

          {/* Detected variants */}
          {pgx.detected_variants.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted mb-1.5">Detected Variants</p>
              <div className="space-y-1">
                {pgx.detected_variants.map((v, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs font-mono bg-[rgba(255,255,255,0.03)] px-2.5 py-1.5 rounded-lg"
                  >
                    <span className="text-accent">{v.rsid}</span>
                    <span className="text-muted">→</span>
                    <span>{v.genotype}</span>
                    {v.star_allele_1 && (
                      <>
                        <span className="text-muted">•</span>
                        <span className="text-warn">{v.star_allele_1}/{v.star_allele_2}</span>
                      </>
                    )}
                    <span className="text-muted ml-auto text-[10px]">{v.impact}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Counterfactual removed — single endpoint design */}
        </div>
      )}
    </div>
  );
}
