"use client";

import { useState, useCallback, useRef } from "react";
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
import DrugReportCard from "./components/DrugReportCard";
import ResultCarousel from "./components/ResultCarousel";
import JSONViewer from "./components/JSONViewer";
import ReportExporter from "./components/ReportExporter";

import { analyzeMultipleDrugs, APIError } from "./lib/api";
import type {
  PipelineStep,
  DrugAnalysisResult,
} from "./lib/types";

// ── Available drugs (CPIC-aligned) ──
const AVAILABLE_DRUGS = [
  "CODEINE", "WARFARIN", "CLOPIDOGREL",
  "SIMVASTATIN", "AZATHIOPRINE", "FLUOROURACIL",
];

// ── Pipeline step definitions ──
const PIPELINE_STEPS: PipelineStep[] = [
  { id: "parse", label: "VCF Parsing", description: "Reading and validating VCF file format", status: "pending" },
  { id: "extract", label: "Variant Extraction", description: "Identifying pharmacogene variants from VCF data", status: "pending" },
  { id: "star", label: "STAR Allele Inference", description: "Mapping variants to star allele nomenclature", status: "pending" },
  { id: "phenotype", label: "Phenotype Assignment", description: "Computing activity scores and metabolizer phenotypes", status: "pending" },
  { id: "cpic", label: "CPIC Rule Engine", description: "Matching phenotypes against CPIC dosing guidelines", status: "pending" },
  { id: "risk", label: "Risk Classification", description: "Deterministic CPIC rule lookup — no LLM involved", status: "pending" },
  { id: "llm", label: "LLM Explanation", description: "Generating AI-powered clinical explanation via Groq Llama 3.3", status: "pending" },
];

type AppPhase = "input" | "processing" | "results";

export default function Home() {
  // ── State ──
  const [phase, setPhase] = useState<AppPhase>("input");
  const [vcfFile, setVcfFile] = useState<File | null>(null);
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Processing state
  const [steps, setSteps] = useState<PipelineStep[]>(PIPELINE_STEPS.map(s => ({ ...s })));
  const [currentDrug, setCurrentDrug] = useState<string>("");

  // Results
  const [drugResults, setDrugResults] = useState<DrugAnalysisResult[]>([]);
  const [llmLoading, setLlmLoading] = useState(false);
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

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
    setJsonDrawerOpen(false);
    resetSteps();

    try {
      // VCF pipeline animation
      await animateStep("parse", "Parsing VCF file: " + vcfFile.name);
      await animateStep("extract", "Extracting pharmacogene variants...");
      await animateStep("star", "Inferring star alleles...");
      await animateStep("phenotype", "Assigning metabolizer phenotypes...");

      const drugLabel = selectedDrugs.join(", ");
      setCurrentDrug(drugLabel);

      updateStep("cpic", "active", `Applying CPIC rules for ${drugLabel}...`);
      await new Promise(r => setTimeout(r, 400));
      updateStep("cpic", "completed", `CPIC rules matched for ${selectedDrugs.length} drug(s)`);

      updateStep("risk", "active", `Computing risk via CPIC phenotype rules...`);
      await new Promise(r => setTimeout(r, 400));
      updateStep("risk", "completed", `Risk classified deterministically for ${selectedDrugs.length} drug(s)`);

      setLlmLoading(true);
      updateStep("llm", "active", `Generating explanations via Groq Llama 3.3...`);

      // ── Single batch request — VCF parsed once, all drugs run in parallel server-side ──
      const batch = await analyzeMultipleDrugs(vcfFile, selectedDrugs);

      updateStep("llm", "completed", `Explanations generated for ${batch.total} drug(s)`);
      setLlmLoading(false);
      setDrugResults(batch.results);

      // Surface any per-drug errors as a warning (not a fatal stop)
      if (batch.errors.length > 0) {
        const msgs = batch.errors.map(e => `${e.drug}: ${e.error}`).join(" | ");
        setError(`Some drugs were skipped: ${msgs}`);
      }

      setCurrentDrug("");
      setPhase("results");

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (err) {
      const msg = err instanceof APIError ? err.detail : String(err);
      setError(msg);
      setPhase("input");
      setLlmLoading(false);
    }
  }, [vcfFile, selectedDrugs, animateStep, updateStep, resetSteps]);

  // ── Reset everything ──
  const handleReset = useCallback(() => {
    setPhase("input");
    setVcfFile(null);
    setSelectedDrugs([]);
    setError(null);
    setDrugResults([]);
    setJsonDrawerOpen(false);
    resetSteps();
  }, [resetSteps]);

  const canAnalyze = vcfFile !== null && selectedDrugs.length > 0 && phase === "input";
  const isProcessing = phase === "processing";

  // Build JSON payload
  const jsonPayload = drugResults.length === 1 ? drugResults[0] : drugResults.length > 1 ? drugResults : null;

  return (
    <div className="min-h-screen w-full">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-card-border bg-background/80 backdrop-blur-xl">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Pharmavex" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Pharmavex</h1>
              <p className="text-xs text-muted -mt-0.5">
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

      <main className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-5">
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
          <div className="max-w-3xl mx-auto space-y-7 animate-fade-slide-up">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(6,182,212,0.08)] text-accent text-sm font-medium mb-5">
                <Dna className="w-4 h-4" />
                CPIC-Aligned Analysis
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold">
                Pharmacogenomic Risk Assessment
              </h2>
              <p className="text-base text-muted mt-3 max-w-xl mx-auto">
                Upload a VCF file and select drugs to receive personalized risk
                assessments powered by CPIC guidelines and AI explanations.
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-muted mb-2">
                Genomic Data
              </label>
              <VCFUpload
                onFileAccepted={setVcfFile}
                currentFile={vcfFile}
                onClear={() => setVcfFile(null)}
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-muted mb-2">
                Drugs to Analyze
              </label>
              <DrugSelector
                availableDrugs={AVAILABLE_DRUGS}
                selectedDrugs={selectedDrugs}
                onChange={setSelectedDrugs}
                disabled={isProcessing}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className={`
                w-full flex items-center justify-center gap-2.5 px-6 py-5 rounded-xl
                text-lg font-bold transition-all duration-300
                ${canAnalyze
                  ? "bg-accent text-background hover:bg-accent-dim cursor-pointer shadow-lg shadow-accent/20"
                  : "bg-card border border-card-border text-muted cursor-not-allowed"
                }
              `}
            >
              <Zap className="w-5 h-5" />
              Analyze {selectedDrugs.length > 0 ? `${selectedDrugs.length} Drug${selectedDrugs.length > 1 ? "s" : ""}` : ""}
            </button>
          </div>
        )}

        {/* ── PROCESSING / RESULTS PHASE ── */}
        {(phase === "processing" || phase === "results") && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Pipeline — below content on mobile, left column on desktop */}
            <div className="order-2 lg:order-1 lg:col-span-4">
              <div className="lg:sticky lg:top-20">
                <details className="lg:open" open>
                  <summary className="flex items-center gap-2 cursor-pointer list-none lg:pointer-events-none px-1 pb-3 text-sm font-semibold">
                    <Dna className="w-4 h-4 text-accent" />
                    Analysis Pipeline
                    <span className="ml-auto lg:hidden text-xs text-muted">(tap to expand)</span>
                  </summary>
                  <div className="border border-card-border rounded-xl p-5 bg-card/50">
                    <PipelineFlowchart
                      steps={steps}
                      currentDrug={currentDrug}
                    />
                  </div>
                </details>
              </div>
            </div>

            {/* Results — first on mobile */}
            <div ref={resultsRef} className="order-1 lg:order-2 lg:col-span-8 space-y-6">
              {isProcessing && drugResults.length === 0 && (
                <div className="flex items-center gap-3 px-5 py-4 rounded-xl border border-card-border bg-card/50">
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                  <span className="text-sm text-muted">Processing genomic data...</span>
                </div>
              )}

              {/* Carousel for multiple results, single card for one */}
              {drugResults.length === 1 && (
                <DrugReportCard result={drugResults[0]} />
              )}

              {drugResults.length > 1 && (
                <ResultCarousel labels={drugResults.map(r => r.drug)}>
                  {drugResults.map((result) => (
                    <DrugReportCard key={result.drug} result={result} />
                  ))}
                </ResultCarousel>
              )}

              {llmLoading && (
                <div className="border border-card-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Loader2 className="w-5 h-5 text-accent animate-spin" />
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
              )}

              {/* Export + JSON toolbar — only when analysis is complete */}
              {phase === "results" && drugResults.length > 0 && (
                <div className="flex items-center justify-between">
                  <ReportExporter results={drugResults} />
                </div>
              )}

              {/* JSON Output */}
              {jsonPayload && phase === "results" && (
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
                      <JSONViewer data={jsonPayload} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-card-border mt-16">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between text-xs text-muted">
          <span>Pharmavex v2.0 — Precision Pharmacogenomic Risk Engine</span>
          <span>CPIC Guidelines • Groq Llama 3.3 XAI • RIFT 2026</span>
        </div>
      </footer>
    </div>
  );
}
