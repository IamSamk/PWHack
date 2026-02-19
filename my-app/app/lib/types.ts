// ── PharmaGuard Type Definitions ──

export interface DetectedVariant {
  rsid: string;
  impact: string;
  genotype: string;
  star_allele_1?: string;
  star_allele_2?: string;
}

export interface VariantCitation {
  rsid: string;
  genotype: string;
  impact: string;
  gene: string;
  star_allele_1?: string;
  star_allele_2?: string;
}

export interface LLMExplanation {
  summary: string;
  variant_citations: VariantCitation[];
  model: string;
  disclaimer: string;
}

export interface RiskAssessment {
  risk_label: string;
  severity: string;
  confidence_score: number;
}

export interface PharmacogenomicProfile {
  primary_gene: string;
  diplotype: string;
  phenotype: string;
  activity_score?: number;
  detected_variants: DetectedVariant[];
  quality_flags?: string[];
}

export interface ClinicalRecommendation {
  recommendation: string;
  guideline_source: string;
  drug: string;
  gene: string;
}

export interface QualityMetrics {
  vcf_parsing_success: boolean;
}

export interface PathwayStep {
  id: string;
  label: string;
  detail: string;
  shape: "hexagon" | "diamond" | "circle" | "rectangle" | "shield";
  color: string;
}

export interface DrugAnalysisResult {
  patient_id: string;
  drug: string;
  timestamp: string;
  risk_assessment: RiskAssessment;
  pharmacogenomic_profile: PharmacogenomicProfile;
  clinical_recommendation: ClinicalRecommendation;
  llm_generated_explanation: LLMExplanation;
  pathway?: PathwayStep[];
  quality_metrics: QualityMetrics;
}

export interface BatchAnalysisResult {
  results: DrugAnalysisResult[];
  total: number;
  errors: Array<{ drug: string; error: string }>;
}

// Pipeline step states for the animated flowchart
export type StepStatus = "pending" | "active" | "completed";

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
}
