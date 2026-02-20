"use client";

import { useState } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldX,
  ShieldOff,
  ShieldQuestion,
  ChevronDown,
  Dna,
} from "lucide-react";
import type { DrugAnalysisResult } from "../lib/types";
import DoctorAvatar from "./DoctorAvatar";

interface DrugReportCardProps {
  result: DrugAnalysisResult;
}

const RISK_CONFIG: Record<string, { color: string; bg: string; ring: string; icon: typeof Shield }> = {
  safe: { color: "text-safe", bg: "bg-[rgba(34,197,94,0.06)]", ring: "border-safe/25", icon: Shield },
  "adjust dosage": { color: "text-warn", bg: "bg-[rgba(234,179,8,0.06)]", ring: "border-warn/25", icon: ShieldAlert },
  toxic: { color: "text-danger", bg: "bg-[rgba(239,68,68,0.06)]", ring: "border-danger/25", icon: ShieldX },
  ineffective: { color: "text-danger", bg: "bg-[rgba(239,68,68,0.06)]", ring: "border-danger/25", icon: ShieldOff },
  unknown: { color: "text-muted", bg: "bg-[rgba(100,116,139,0.06)]", ring: "border-muted/25", icon: ShieldQuestion },
};

function getRiskConfig(label: string) {
  return RISK_CONFIG[label.toLowerCase()] || RISK_CONFIG["unknown"];
}

export default function DrugReportCard({ result }: DrugReportCardProps) {
  const [recExpanded, setRecExpanded] = useState(false);

  const risk = result.risk_assessment;
  const pgx = result.pharmacogenomic_profile;
  const rec = result.clinical_recommendation;
  const explanation = result.llm_generated_explanation;
  const config = getRiskConfig(risk.risk_label);
  const Icon = config.icon;

  return (
    <div className={`border rounded-2xl overflow-hidden ${config.bg} ${config.ring}`}>

      {/* ── Header ── */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-wrap items-start gap-3 sm:gap-4">
        <Icon className={`w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0 mt-0.5 ${config.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg sm:text-xl font-bold tracking-tight">{result.drug}</h3>
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-widest ${config.color} ${config.bg} border ${config.ring}`}>
              {risk.risk_label}
            </span>
            <span className="text-xs text-muted">{risk.severity} severity</span>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-5 mt-2 text-xs">
            <span className="flex items-center gap-1.5">
              <Dna className="w-3.5 h-3.5 text-accent" />
              <span className="text-muted">Gene</span>
              <span className="font-mono font-semibold">{pgx.primary_gene}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted">Diplotype</span>
              <span className="font-mono font-semibold">{pgx.diplotype}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted">Phenotype</span>
              <span className="font-semibold">{pgx.phenotype} Metabolizer</span>
            </span>
          </div>
        </div>

        {/* Confidence ring — pushed to its own row on very small screens */}
        <div className="flex flex-col items-center flex-shrink-0 ml-auto sm:ml-0">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="21" fill="none" stroke="currentColor" strokeWidth="4" className="text-card-border" />
              <circle
                cx="28" cy="28" r="21" fill="none" stroke="currentColor" strokeWidth="4"
                className={config.color} strokeLinecap="round"
                strokeDasharray={`${risk.confidence_score * 131.9} 131.9`}
                style={{ transition: "stroke-dasharray 1.2s ease-out" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {Math.round(risk.confidence_score * 100)}%
            </span>
          </div>
          <span className="text-[10px] text-muted mt-1">Confidence</span>
        </div>
      </div>

      {/* ── Doctor + AI Explanation ── */}
      <div className="border-t border-[rgba(255,255,255,0.05)] px-6 py-5">
        <DoctorAvatar
          riskLabel={risk.risk_label}
          explanation={explanation.summary}
          modelName={explanation.model}
        />
      </div>

      {/* ── Clinical Recommendation (collapsible) ── */}
      <button
        onClick={() => setRecExpanded(!recExpanded)}
        className="w-full flex items-center justify-between px-6 py-3.5 text-sm border-t border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
      >
        <span className="font-medium text-muted">
          Clinical Recommendation
          {pgx.detected_variants.length > 0
            ? ` & ${pgx.detected_variants.length} Variant${pgx.detected_variants.length > 1 ? "s" : ""}`
            : ""}
        </span>
        <ChevronDown className={`w-4 h-4 text-muted transition-transform ${recExpanded ? "rotate-180" : ""}`} />
      </button>

      {recExpanded && (
        <div className="px-6 pb-5 space-y-3 border-t border-[rgba(255,255,255,0.04)]">
          <p className="text-sm leading-relaxed text-foreground/80 pt-3">{rec.recommendation}</p>
          <p className="text-xs text-muted">Source: {rec.guideline_source}</p>

          {pgx.detected_variants.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {pgx.detected_variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2.5 text-xs font-mono bg-[rgba(255,255,255,0.03)] px-3 py-2 rounded-lg">
                  <span className="text-accent">{v.rsid}</span>
                  <span className="text-muted">→</span>
                  <span>{v.genotype}</span>
                  {v.star_allele_1 && (
                    <>
                      <span className="text-muted">·</span>
                      <span className="text-warn">{v.star_allele_1}/{v.star_allele_2}</span>
                    </>
                  )}
                  <span className="text-muted ml-auto text-[10px]">{v.impact}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
