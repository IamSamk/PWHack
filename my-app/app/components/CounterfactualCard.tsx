"use client";

import { useState } from "react";
import { ArrowLeftRight, TrendingDown, TrendingUp, Equal } from "lucide-react";
import type { CounterfactualResult } from "../lib/types";

interface CounterfactualCardProps {
  result: CounterfactualResult;
}

export default function CounterfactualCard({ result }: CounterfactualCardProps) {
  const actual = result.actual;
  const simulated = result.counterfactual;

  return (
    <div className="border border-card-border rounded-xl overflow-hidden animate-fade-slide-up">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-card-border bg-[rgba(6,182,212,0.03)]">
        <ArrowLeftRight className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium">
          Counterfactual: {result.drug} ({result.primary_gene})
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-card-border">
        {/* Actual */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
            Actual
          </p>
          <p className="text-sm font-medium">{actual.phenotype}</p>
          <p className="text-xs mt-1">
            Risk:{" "}
            <span className="font-bold">
              {actual.risk_assessment.risk_label}
            </span>
          </p>
          <p className="text-xs text-muted mt-1">{actual.recommendation}</p>
        </div>

        {/* Simulated */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent mb-2">
            Simulated ({simulated.simulated_phenotype})
          </p>
          <p className="text-sm font-medium text-accent">
            {simulated.simulated_phenotype}
          </p>
          <p className="text-xs mt-1">
            Risk:{" "}
            <span className="font-bold text-accent">
              {simulated.risk_assessment.risk_label}
            </span>
          </p>
          <p className="text-xs text-muted mt-1">{simulated.recommendation}</p>
        </div>
      </div>

      {/* Outcome */}
      <div className="px-5 py-2.5 border-t border-card-border flex items-center gap-2">
        {result.risk_changed ? (
          <>
            <TrendingDown className="w-4 h-4 text-safe" />
            <span className="text-xs font-medium text-safe">
              Risk would change with {simulated.simulated_phenotype} phenotype
            </span>
          </>
        ) : (
          <>
            <Equal className="w-4 h-4 text-muted" />
            <span className="text-xs font-medium text-muted">
              Risk unchanged — same classification regardless of phenotype
            </span>
          </>
        )}
      </div>
    </div>
  );
}
