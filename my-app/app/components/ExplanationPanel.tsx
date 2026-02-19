"use client";

import { Brain, BookOpen, Stethoscope, Lightbulb, AlertTriangle } from "lucide-react";
import type { LLMExplanation } from "../lib/types";

interface ExplanationPanelProps {
  explanation: LLMExplanation | null;
  loading?: boolean;
}

export default function ExplanationPanel({
  explanation,
  loading,
}: ExplanationPanelProps) {
  if (loading) {
    return (
      <div className="border border-card-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-accent animate-pulse" />
          <span className="text-sm font-medium text-accent">
            Generating AI explanation...
          </span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 rounded animate-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (!explanation) return null;

  // Split the summary into logical sections based on content
  const summary = explanation.summary;
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean);

  // Try to categorize sentences into mechanism, impact, risk, action
  const sections: { icon: typeof Brain; title: string; text: string; color: string }[] = [];

  if (sentences.length >= 4) {
    sections.push(
      { icon: BookOpen, title: "Biological Mechanism", text: sentences.slice(0, Math.ceil(sentences.length * 0.3)).join(" "), color: "text-accent" },
      { icon: Stethoscope, title: "Clinical Impact", text: sentences.slice(Math.ceil(sentences.length * 0.3), Math.ceil(sentences.length * 0.6)).join(" "), color: "text-warn" },
      { icon: Lightbulb, title: "Recommendation Rationale", text: sentences.slice(Math.ceil(sentences.length * 0.6)).join(" "), color: "text-safe" },
    );
  } else {
    sections.push({
      icon: Brain,
      title: "Summary",
      text: summary,
      color: "text-accent",
    });
  }

  return (
    <div className="border border-card-border rounded-xl overflow-hidden animate-fade-slide-up">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-card-border bg-[rgba(6,182,212,0.03)]">
        <Brain className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium">AI-Powered Explanation</span>
        <span className="ml-auto text-[10px] font-mono text-muted">
          {explanation.model}
        </span>
      </div>

      {/* Sections */}
      <div className="divide-y divide-card-border">
        {sections.map((section, i) => {
          const SectionIcon = section.icon;
          return (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <SectionIcon className={`w-4 h-4 ${section.color}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${section.color}`}>
                  {section.title}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80">
                {section.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Variant citations */}
      {explanation.variant_citations.length > 0 && (
        <div className="px-5 py-3 border-t border-card-border bg-[rgba(255,255,255,0.01)]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
            Cited Variants
          </p>
          <div className="flex flex-wrap gap-1.5">
            {explanation.variant_citations.map((vc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-[rgba(6,182,212,0.08)] text-accent rounded"
              >
                {vc.rsid} ({vc.genotype})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-5 py-2 border-t border-card-border bg-[rgba(255,255,255,0.01)]">
        <div className="flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 text-muted mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-muted leading-relaxed">
            {explanation.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
