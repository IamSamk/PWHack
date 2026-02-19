"""
PharmaGuard — Constrained Explainable AI Layer (XAI)

The LLM does NOT classify, predict, or interpret raw VCF.
It receives fully deterministic facts from the pharmacogenomic engine and generates:
  - A human-readable summary explaining the risk finding
  - Variant-level citations linking rsIDs to star alleles and functional impact
  - Biological mechanism description
  - Clinical implication summary

Model: mistral:7b via Ollama (local, no data leaves the machine)
"""

from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate
from typing import Any

LLM_MODEL = "mistral:7b"

# Initialize ChatOllama with mistral:7b
llm = ChatOllama(model=LLM_MODEL, temperature=0.3, num_predict=512)

# ── Rich structured prompt ──────────────────────────────────────
EXPLANATION_PROMPT = PromptTemplate(
    input_variables=[
        "gene", "phenotype", "diplotype", "activity_score",
        "drug", "risk_label", "severity", "recommendation",
        "variant_details",
    ],
    template=(
        "You are a pharmacogenomics clinical advisor. You are given VERIFIED, "
        "deterministic results from a CPIC-aligned pharmacogenomic engine. "
        "Do NOT re-classify, question, or modify the results.\n\n"
        "=== DETERMINISTIC FACTS ===\n"
        "Gene: {gene}\n"
        "Diplotype: {diplotype}\n"
        "Activity Score: {activity_score}\n"
        "Phenotype: {phenotype}\n"
        "Drug: {drug}\n"
        "Risk Label: {risk_label}\n"
        "Severity: {severity}\n"
        "CPIC Recommendation: {recommendation}\n"
        "Detected Variants:\n{variant_details}\n"
        "=== END FACTS ===\n\n"
        "Using ONLY the facts above, write a concise clinical explanation (4-6 sentences) that covers:\n"
        "1. MECHANISM: How {gene} affects the metabolism or transport of {drug}.\n"
        "2. VARIANT IMPACT: How the patient's specific variants ({diplotype}) lead to the "
        "{phenotype} phenotype and activity score of {activity_score}.\n"
        "3. RISK: Why this results in a '{risk_label}' risk classification with '{severity}' severity.\n"
        "4. ACTION: Summarize the clinical recommendation in plain language.\n\n"
        "Rules:\n"
        "- Reference specific rsIDs and star alleles from the variant data.\n"
        "- Use clinical terminology but remain accessible to a non-specialist.\n"
        "- Do NOT speculate beyond the provided facts.\n"
        "- Do NOT add disclaimers or caveats — the system adds those automatically."
    ),
)


def _format_variant_details(detected_variants: list[dict]) -> str:
    """Format variant list into a readable string for the prompt."""
    if not detected_variants:
        return "  (No actionable variants detected — default wild-type assumed)"

    lines = []
    for v in detected_variants:
        rsid = v.get("rsid", "unknown")
        genotype = v.get("genotype", "unknown")
        impact = v.get("impact", "unknown")
        star1 = v.get("star_allele_1", "")
        star2 = v.get("star_allele_2", "")
        star_info = f" → {star1}/{star2}" if star1 and star2 else ""
        lines.append(f"  - {rsid}: genotype {genotype}, impact={impact}{star_info}")

    return "\n".join(lines)


def generate_explanation(
    gene: str,
    phenotype: str,
    drug: str,
    diplotype: str = "*1/*1",
    activity_score: float = 2.0,
    risk_label: str = "Normal",
    severity: str = "low",
    recommendation: str = "No specific recommendation.",
    detected_variants: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Generate a structured LLM explanation for a pharmacogenomic finding.

    Args:
        gene: Gene symbol (e.g., CYP2D6).
        phenotype: Metabolizer status (e.g., PM, IM, NM).
        drug: Drug name (e.g., CODEINE).
        diplotype: Star allele diplotype (e.g., *1/*4).
        activity_score: Numeric activity score.
        risk_label: Risk classification from engine.
        severity: Severity level from engine.
        recommendation: CPIC recommendation text.
        detected_variants: List of variant dicts from engine output.

    Returns:
        Structured dict matching the hackathon llm_generated_explanation schema:
        {
            "summary": str,
            "variant_citations": [...],
            "model": str,
            "disclaimer": str,
        }
    """
    disclaimer = (
        "AI-generated explanation based on deterministic engine outputs. "
        "Not a substitute for professional clinical judgment."
    )

    if not gene or not phenotype or not drug:
        return {
            "summary": "Insufficient data to generate clinical explanation.",
            "variant_citations": [],
            "model": LLM_MODEL,
            "disclaimer": disclaimer,
        }

    variant_list = detected_variants or []
    variant_text = _format_variant_details(variant_list)

    # Build variant citations from deterministic data (not LLM-generated)
    variant_citations = []
    for v in variant_list:
        citation = {
            "rsid": v.get("rsid", "unknown"),
            "genotype": v.get("genotype", "unknown"),
            "impact": v.get("impact", "unknown"),
            "gene": gene,
        }
        if v.get("star_allele_1"):
            citation["star_allele_1"] = v["star_allele_1"]
        if v.get("star_allele_2"):
            citation["star_allele_2"] = v["star_allele_2"]
        variant_citations.append(citation)

    try:
        prompt = EXPLANATION_PROMPT.format(
            gene=gene,
            phenotype=phenotype,
            diplotype=diplotype,
            activity_score=activity_score,
            drug=drug,
            risk_label=risk_label,
            severity=severity,
            recommendation=recommendation,
            variant_details=variant_text,
        )
        response = llm.invoke(prompt)
        summary = response.content.strip()
    except Exception as e:
        summary = (
            f"The patient carries {diplotype} in {gene}, resulting in a {phenotype} "
            f"phenotype (activity score {activity_score}). For {drug}, this corresponds "
            f"to a '{risk_label}' risk level ({severity} severity). "
            f"CPIC recommends: {recommendation} "
            f"[LLM unavailable: {str(e)}]"
        )

    return {
        "summary": summary,
        "variant_citations": variant_citations,
        "model": LLM_MODEL,
        "disclaimer": disclaimer,
    }
