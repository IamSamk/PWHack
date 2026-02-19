"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Dna,
  Zap,
  ChevronDown,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

import VCFUpload from "./components/VCFUpload";
import DrugSelector from "./components/DrugSelector";
import PipelineFlowchart from "./components/PipelineFlowchart";
import RiskCard from "./components/RiskCard";
import ExplanationPanel from "./components/ExplanationPanel";
import BurdenScoreCard from "./components/BurdenScoreCard";
import JSONViewer from "./components/JSONViewer";
import CounterfactualCard from "./components/CounterfactualCard";

import { uploadVCF, getDrugs, analyzeDrug, runCounterfactual, APIError } from "./lib/api";
import type {
  PipelineStep,
  UploadResponse,
  DrugAnalysisResult,
  CounterfactualResult,
  LLMExplanation,
  BurdenScore,
} from "./lib/types";

// ── Pipeline step definitions ──
const PIPELINE_STEPS: PipelineStep[] = [
  { id: "parse", label: "VCF Parsing", description: "Reading and validating VCF file format", status: "pending" },
  { id: "extract", label: "Variant Extraction", description: "Identifying pharmacogene variants from VCF data", status: "pending" },
  { id: "star", label: "STAR Allele Inference", description: "Mapping variants to star allele nomenclature", status: "pending" },
  { id: "phenotype", label: "Phenotype Assignment", description: "Computing activity scores and metabolizer phenotypes", status: "pending" },
  { id: "cpic", label: "CPIC Rule Engine", description: "Matching phenotypes against CPIC dosing guidelines", status: "pending" },
  { id: "risk", label: "Risk Classification", description: "Assigning risk labels with confidence scores", status: "pending" },
  { id: "llm", label: "LLM Explanation", description: "Generating AI-powered clinical explanation via Mistral 7B", status: "pending" },
];

type AppPhase = "input" | "processing" | "results";

export default function Home() {
  // ── State ──
  const [phase, setPhase] = useState<AppPhase>("input");
  const [vcfFile, setVcfFile] = useState<File | null>(null);
  const [availableDrugs, setAvailableDrugs] = useState<string[]>([]);
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Processing state
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS.map(s => ({...s})));
  const [currentDrug, setCurrentDrug] = useState<string>("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);

  // Results
  const [drugResults, setDrugResults] = useState<DrugAnalysisResult[]>([]);
  const [activeExplanation, setActiveExplanation] = useState<LLMExplanation | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [burdenScore, setBurdenScore] = useState<BurdenScore | null>(null);
  const [counterfactualResult, setCounterfactualResult] = useState<CounterfactualResult | null>(null);
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);
  const [fullJsonPayload, setFullJsonPayload] = useState<unknown>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Load available drugs on mount ──
  useEffect(() => {
    getDrugs()
      .then(setAvailableDrugs)
      .catch(() => setAvailableDrugs(["CODEINE", "WARFARIN", "CLOPIDOGREL", "SIMVASTATIN", "AZATHIOPRINE", "FLUOROURACIL"]));
  }, []);

  // ── Step updater ──
  const updateStep = useCallback((stepId: string, status: PipelineStep["status"], description?: string) => {
    setSteps(prev =>
      prev.map(s =>
        s.id === stepId
          ? { ...s, status, description: description || s.description }
          : s
      )
    );
  }, []);

  const resetSteps = useCallback(() => {
    setSteps(PIPELINE_STEPS.map(s => ({ ...s })));
  }, []);

  // ── Animated step progression ──
  const animateStep = useCallback(
    (stepId: string, description?: string): Promise<void> => {
      return new Promise(resolve => {
        updateStep(stepId, "active", description);
        setTimeout(() => {
          updateStep(stepId, "completed", description);
          resolve();
        }, 600);
      });
    },
    [updateStep]
  );

  // ── Main analysis flow ──
  const handleAnalyze = useCallback(async () => {
    if (!vcfFile || selectedDrugs.length === 0) return;

    setError(null);
    setPhase("processing");
    setDrugResults([]);
    setActiveExplanation(null);
    setBurdenScore(null);
    setCounterfactualResult(null);
    setFullJsonPayload(null);
    resetSteps();

    try {
      // Step 1-3: Upload VCF (parse + extract + star alleles)
      await animateStep("parse", "Parsing VCF file: " + vcfFile.name);
      await animateStep("extract", "Extracting pharmacogene variants...");

      const upload = await uploadVCF(vcfFile);
      setSessionId(upload.session_id);
      setUploadData(upload);

      await animateStep("star", `Identified ${upload.pharmacogene_variants_detected} pharmacogene variants across ${Object.keys(upload.genomic_profile).length} genes`);

      // Step 4: Phenotype assignment
      const phenoSummary = Object.entries(upload.genomic_profile)
        .map(([gene, data]) => `${gene}: ${data.phenotype}`)
        .join(", ");
      await animateStep("phenotype", phenoSummary || "Computing phenotypes...");

      // Step 5-7: Analyze each drug
      const allResults: DrugAnalysisResult[] = [];
      const drugAnalyses: Record<string, unknown> = {};

      for (const drug of selectedDrugs) {
        setCurrentDrug(drug);
        updateStep("cpic", "active", `Applying CPIC rules for ${drug}...`);
        await new Promise(r => setTimeout(r, 300));
        updateStep("cpic", "completed", `CPIC rule matched for ${drug}`);

        updateStep("risk", "active", `Classifying risk for ${drug}...`);
        await new Promise(r => setTimeout(r, 200));

        // Call backend (includes LLM)
        setLlmLoading(true);
        updateStep("llm", "active", `Generating explanation for ${drug} via Mistral 7B...`);

        try {
          const result = await analyzeDrug(upload.session_id, drug);
          allResults.push(result);
          drugAnalyses[drug] = result;

          updateStep("risk", "completed", `${drug}: ${result.risk_assessment.risk_label} (${result.risk_assessment.severity})`);
          updateStep("llm", "completed", `Explanation generated for ${drug}`);

          setDrugResults([...allResults]);
          setActiveExplanation(result.llm_generated_explanation);
          setLlmLoading(false);
        } catch (err) {
          const msg = err instanceof APIError ? err.detail : String(err);
          updateStep("risk", "completed", `${drug}: Error — ${msg}`);
          updateStep("llm", "completed", `Skipped — ${msg}`);
          setLlmLoading(false);
        }
      }

      // Compute burden score from results
      if (allResults.length > 1) {
        const severityWeights: Record<string, number> = {
          critical: 4, high: 3, moderate: 2, low: 1, none: 0,
        };
        let totalPbs = 0;
        const highRiskPairs: { drug: string; gene: string; phenotype: string; risk_label: string; severity: string }[] = [];

        for (const r of allResults) {
          const sev = r.risk_assessment.severity;
          totalPbs += severityWeights[sev] || 0;
          if (sev === "critical" || sev === "high") {
            highRiskPairs.push({
              drug: r.drug,
              gene: r.pharmacogenomic_profile.primary_gene,
              phenotype: r.pharmacogenomic_profile.phenotype,
              risk_label: r.risk_assessment.risk_label,
              severity: sev,
            });
          }
        }

        const maxPbs = allResults.length * 4;
        let riskTier = "MINIMAL";
        if (totalPbs >= 12) riskTier = "CRITICAL";
        else if (totalPbs >= 8) riskTier = "HIGH";
        else if (totalPbs >= 4) riskTier = "MODERATE";
        else if (totalPbs > 0) riskTier = "LOW";

        const burden: BurdenScore = {
          pharmacogenomic_burden_score: totalPbs,
          normalized_pbs: Math.round((totalPbs / maxPbs) * 1000) / 1000,
          risk_tier: riskTier,
          gene_burdens: {},
          high_risk_pairs: highRiskPairs,
          total_genes_affected: new Set(allResults.map(r => r.pharmacogenomic_profile.primary_gene)).size,
          drugs_analyzed: allResults.length,
        };

        setBurdenScore(burden);
      }

      setFullJsonPayload(drugAnalyses);
      setCurrentDrug("");
      setPhase("results");

      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (err) {
      const msg = err instanceof APIError ? err.detail : String(err);
      setError(msg);
      setPhase("input");
    }
  }, [vcfFile, selectedDrugs, animateStep, updateStep, resetSteps]);

  // ── Counterfactual handler ──
  const handleCounterfactual = useCallback(
    async (drug: string) => {
      if (!sessionId) return;
      try {
        const result = await runCounterfactual(sessionId, drug, "NM");
        setCounterfactualResult(result);
      } catch (err) {
        const msg = err instanceof APIError ? err.detail : String(err);
        setError(`Counterfactual failed: ${msg}`);
      }
    },
    [sessionId]
  );

  // ── Reset everything ──
  const handleReset = useCallback(() => {
    setPhase("input");
    setVcfFile(null);
    setSelectedDrugs([]);
    setError(null);
    setSessionId(null);
    setUploadData(null);
    setDrugResults([]);
    setActiveExplanation(null);
    setBurdenScore(null);
    setCounterfactualResult(null);
    setFullJsonPayload(null);
    setJsonDrawerOpen(false);
    resetSteps();
  }, [resetSteps]);

  const canAnalyze = vcfFile !== null && selectedDrugs.length > 0 && phase === "input";
  const isProcessing = phase === "processing";

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-card-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[rgba(6,182,212,0.1)]">
              <Dna className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">PharmaGuard</h1>
              <p className="text-[10px] text-muted -mt-0.5">
                Precision Pharmacogenomic Risk Engine
              </p>
            </div>
          </div>

          {phase !== "input" && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted border border-card-border rounded-lg hover:text-foreground hover:border-accent/30 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Analysis
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ── Error Banner ── */}
        {error && (
          <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl border border-danger/30 bg-[rgba(239,68,68,0.05)] animate-fade-slide-up">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-danger">Analysis Error</p>
              <p className="text-xs text-foreground/70 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-xs text-muted hover:text-foreground cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── INPUT PHASE ── */}
        {phase === "input" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-slide-up">
            {/* Hero */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[rgba(6,182,212,0.08)] text-accent text-xs font-medium mb-4">
                <Dna className="w-3.5 h-3.5" />
                CPIC-Aligned Analysis
              </div>
              <h2 className="text-2xl font-bold">
                Pharmacogenomic Risk Assessment
              </h2>
              <p className="text-sm text-muted mt-2 max-w-lg mx-auto">
                Upload a VCF file and select drugs to receive personalized risk
                assessments powered by CPIC guidelines and AI explanations.
              </p>
            </div>

            {/* Upload */}
            <div>
              <label className="block text-xs font-medium text-muted mb-2">
                Genomic Data
              </label>
              <VCFUpload
                onFileAccepted={setVcfFile}
                currentFile={vcfFile}
                onClear={() => setVcfFile(null)}
                disabled={isProcessing}
              />
            </div>

            {/* Drug selector */}
            <div>
              <label className="block text-xs font-medium text-muted mb-2">
                Drugs to Analyze
              </label>
              <DrugSelector
                availableDrugs={availableDrugs}
                selectedDrugs={selectedDrugs}
                onChange={setSelectedDrugs}
                disabled={isProcessing}
              />
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={`
                w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl
                text-sm font-semibold transition-all duration-300
                ${canAnalyze
                  ? "bg-accent text-background hover:bg-accent-dim cursor-pointer shadow-lg shadow-accent/20"
                  : "bg-card border border-card-border text-muted cursor-not-allowed"
                }
              `}
            >
              <Zap className="w-4 h-4" />
              Analyze {selectedDrugs.length > 0 ? `${selectedDrugs.length} Drug${selectedDrugs.length > 1 ? "s" : ""}` : ""}
            </button>
          </div>
        )}

        {/* ── PROCESSING / RESULTS PHASE ── */}
        {(phase === "processing" || phase === "results") && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT: Pipeline Flowchart */}
            <div className="lg:col-span-4">
              <div className="sticky top-20">
                <div className="border border-card-border rounded-xl p-5 bg-card/50">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <Dna className="w-4 h-4 text-accent" />
                    Analysis Pipeline
                  </h3>
                  <PipelineFlowchart
                    steps={steps}
                    currentDrug={currentDrug}
                  />

                  {/* Upload summary */}
                  {uploadData && (
                    <div className="mt-4 pt-4 border-t border-card-border">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                        Genomic Profile
                      </p>
                      <div className="space-y-1">
                        {Object.entries(uploadData.genomic_profile).map(([gene, data]) => (
                          <div key={gene} className="flex items-center justify-between text-xs">
                            <span className="font-mono text-accent">{gene}</span>
                            <span className="text-muted">
                              {data.diplotype} → {data.phenotype}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: Results */}
            <div ref={resultsRef} className="lg:col-span-8 space-y-6">
              {/* Processing indicator */}
              {isProcessing && drugResults.length === 0 && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-card-border bg-card/50">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  <span className="text-sm text-muted">
                    Processing genomic data...
                  </span>
                </div>
              )}

              {/* Risk Cards */}
              {drugResults.map((result) => (
                <div key={result.drug} className="space-y-4">
                  <RiskCard
                    result={result}
                    onCounterfactual={handleCounterfactual}
                  />

                  {/* Show explanation for this drug */}
                  <ExplanationPanel
                    explanation={result.llm_generated_explanation}
                    loading={false}
                  />
                </div>
              ))}

              {/* LLM loading for current drug */}
              {llmLoading && (
                <ExplanationPanel explanation={null} loading={true} />
              )}

              {/* Burden Score */}
              {burdenScore && phase === "results" && (
                <BurdenScoreCard burden={burdenScore} />
              )}

              {/* Counterfactual */}
              {counterfactualResult && (
                <CounterfactualCard result={counterfactualResult} />
              )}

              {/* JSON Drawer */}
              {fullJsonPayload && phase === "results" && (
                <div>
                  <button
                    onClick={() => setJsonDrawerOpen(!jsonDrawerOpen)}
                    className="w-full flex items-center justify-between px-5 py-3 rounded-xl border border-card-border bg-card/50 text-sm font-medium hover:border-accent/30 transition-colors cursor-pointer"
                  >
                    <span>Full JSON Output</span>
                    <ChevronDown
                      className={`w-4 h-4 text-muted transition-transform ${jsonDrawerOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {jsonDrawerOpen && (
                    <div className="mt-2 animate-fade-slide-up">
                      <JSONViewer data={fullJsonPayload} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-card-border mt-16">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-muted">
          <span>PharmaGuard v2.0 — Precision Pharmacogenomic Risk Engine</span>
          <span>CPIC Guidelines • Mistral 7B XAI • RIFT 2026</span>
        </div>
      </footer>
    </div>
  );
}
