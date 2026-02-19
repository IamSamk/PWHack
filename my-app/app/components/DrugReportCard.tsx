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
  Brain,
  AlertTriangle,
  Route,
} from "lucide-react";
import type { DrugAnalysisResult } from "../lib/types";
import PathwayVisualization from "./PathwayVisualization";

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
  const pathway = result.pathway;
  const config = getRiskConfig(risk.risk_label);
  const Icon = config.icon;

  return (
    <div className={`border rounded-xl overflow-hidden ${config.bg} ${config.ring}`}>

      {/* ── Compact Header ── */}
      <div className="px-4 py-3 flex items-center gap-3">
        <Icon className={`w-6 h-6 flex-shrink-0 ${config.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold">{result.drug}</h3>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide ${config.color} ${config.bg} border ${config.ring}`}>
              {risk.risk_label}
            </span>
            <span className="text-[10px] text-muted">{risk.severity} severity</span>
          </div>

          {/* Gene / Diplotype / Phenotype */}
          <div className="flex flex-wrap gap-3 mt-1.5 text-[11px]">
            <span className="flex items-center gap-1">
              <Dna className="w-3 h-3 text-accent" />
              <span className="text-muted">Gene:</span>
              <span className="font-mono font-medium">{pgx.primary_gene}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-muted">Diplotype:</span>
              <span className="font-mono font-medium">{pgx.diplotype}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-muted">Phenotype:</span>
              <span className="font-medium">{pgx.phenotype}</span>
            </span>
          </div>
        </div>

        {/* Confidence ring — compact */}
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="relative w-11 h-11">
            <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-card-border" />
              <circle
                cx="22" cy="22" r="17" fill="none" stroke="currentColor" strokeWidth="3.5"
                className={config.color} strokeLinecap="round"
                strokeDasharray={`${risk.confidence_score * 106.8} 106.8`}
                style={{ transition: "stroke-dasharray 1s ease-out" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
              {Math.round(risk.confidence_score * 100)}%
            </span>
          </div>
          <span className="text-[9px] text-muted mt-0.5">Confidence</span>
        </div>
      </div>

      {/* ── Horizontal Pathway ── */}
      {pathway && pathway.length > 0 && (
        <div className="border-t border-[rgba(255,255,255,0.05)]">
          <div className="flex items-center gap-1.5 px-4 pt-2 pb-0">
            <Route className="w-3 h-3 text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Pathway</span>
          </div>
          <PathwayVisualization steps={pathway} />
        </div>
      )}

      {/* ── AI Explanation ── */}
      <div className="border-t border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(6,182,212,0.03)]">
          <Brain className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold">AI Explanation</span>
          <span className="ml-auto text-[9px] font-mono text-muted">{explanation.model}</span>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed text-foreground/80">
            {explanation.summary}
          </p>

          {/* Cited variants inline */}
          {explanation.variant_citations.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {explanation.variant_citations.map((vc, i) => (
                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-[rgba(6,182,212,0.08)] text-accent rounded">
                  {vc.rsid} ({vc.genotype})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Clinical Recommendation (collapsible) ── */}
      <button
        onClick={() => setRecExpanded(!recExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-[11px] border-t border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.02)] transition-colors cursor-pointer"
      >
        <span className="font-medium text-muted">
          Clinical Recommendation
          {pgx.detected_variants.length > 0
            ? ` & ${pgx.detected_variants.length} Variant${pgx.detected_variants.length > 1 ? "s" : ""}`
            : ""}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${recExpanded ? "rotate-180" : ""}`} />
      </button>

      {recExpanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-[rgba(255,255,255,0.04)]">
          <p className="text-xs leading-relaxed text-foreground/80 pt-2">{rec.recommendation}</p>
          <p className="text-[10px] text-muted">Source: {rec.guideline_source}</p>

          {pgx.detected_variants.length > 0 && (
            <div className="space-y-1 pt-1">
              {pgx.detected_variants.map((v, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] font-mono bg-[rgba(255,255,255,0.03)] px-2 py-1 rounded">
                  <span className="text-accent">{v.rsid}</span>
                  <span className="text-muted">→</span>
                  <span>{v.genotype}</span>
                  {v.star_allele_1 && (
                    <>
                      <span className="text-muted">•</span>
                      <span className="text-warn">{v.star_allele_1}/{v.star_allele_2}</span>
                    </>
                  )}
                  <span className="text-muted ml-auto text-[9px]">{v.impact}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Disclaimer ── */}
      <div className="px-4 py-1.5 border-t border-[rgba(255,255,255,0.04)]">
        <div className="flex items-start gap-1">
          <AlertTriangle className="w-2.5 h-2.5 text-muted mt-0.5 flex-shrink-0" />
          <p className="text-[9px] text-muted/70 leading-relaxed">{explanation.disclaimer}</p>
        </div>
      </div>
    </div>
  );
}
