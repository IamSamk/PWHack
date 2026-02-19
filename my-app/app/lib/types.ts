// ── PharmaGuard Type Definitions ──

export interface UploadResponse {
  session_id: string;
  message: string;
  total_variants: number;
  pharmacogene_variants_detected: number;
  genomic_profile: Record<string, GeneProfile>;
}

export interface GeneProfile {
  diplotype: string;
  phenotype: string;
  activity_score: number;
  detected_variants: DetectedVariant[];
}

export interface DetectedVariant {
  rsid: string;
  impact: string;
  genotype: string;
  star_allele_1?: string;
  star_allele_2?: string;
  genotype_alleles?: string[];
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
  evidence_level: string;
}

export interface PharmacogenomicProfile {
  primary_gene: string;
  diplotype: string;
  phenotype: string;
  activity_score: number;
  detected_variants: {
    rsid: string;
    impact: string;
    genotype: string;
    star_allele_1?: string;
    star_allele_2?: string;
  }[];
  variants_count: number;
}

export interface ClinicalRecommendation {
  recommendation: string;
  guideline_source: string;
  drug: string;
  gene: string;
}

export interface QualityMetrics {
  vcf_parsing_success: boolean;
  variants_detected: number;
  rule_match_found: boolean;
  llm_explanation_generated: boolean;
  guideline_source: string;
}

export interface DrugAnalysisResult {
  drug: string;
  patient_id: string;
  timestamp: string;
  risk_assessment: RiskAssessment;
  pharmacogenomic_profile: PharmacogenomicProfile;
  clinical_recommendation: ClinicalRecommendation;
  llm_generated_explanation: LLMExplanation;
  quality_metrics: QualityMetrics;
}

export interface BurdenScore {
  pharmacogenomic_burden_score: number;
  normalized_pbs: number;
  risk_tier: string;
  gene_burdens: Record<string, GeneBurden>;
  high_risk_pairs: HighRiskPair[];
  total_genes_affected: number;
  drugs_analyzed: number;
}

export interface GeneBurden {
  phenotype: string;
  activity_score: number;
  max_severity_weight: number;
  affected_drugs: {
    drug: string;
    risk_label: string;
    severity: string;
    weight: number;
  }[];
}

export interface HighRiskPair {
  drug: string;
  gene: string;
  phenotype: string;
  risk_label: string;
  severity: string;
}

export interface BatchAnalysisResult {
  drug_assessments: Record<string, DrugAnalysisResult>;
  burden_score: BurdenScore;
  total_drugs_assessed: number;
  patient_id: string;
  timestamp: string;
}

export interface CounterfactualResult {
  drug: string;
  primary_gene: string;
  actual: {
    phenotype: string;
    risk_assessment: RiskAssessment;
    recommendation: string;
  };
  counterfactual: {
    simulated_phenotype: string;
    risk_assessment: RiskAssessment;
    recommendation: string;
  };
  risk_changed: boolean;
  patient_id: string;
}

// Pipeline step states for the animated flowchart
export type StepStatus = "pending" | "active" | "completed";

export interface PipelineStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
}
