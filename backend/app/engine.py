"""
PharmaGuard Pharmacogenomic Engine

Takes a genomic profile + drug name → produces risk assessment.
Loads rules from cpic_rules.json — supports any drug present in that file.
Dynamic confidence scoring based on actual genomic evidence.
Generates pathway visualization data for frontend storytelling.
"""

import json
import os
from typing import Any

# --- Load CPIC Rules ---

_RULES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "cpic_rules.json")
_cpic_rules: dict[str, Any] = {}


def _load_rules() -> dict[str, Any]:
    """Load cpic_rules.json. Cached after first call."""
    global _cpic_rules
    if _cpic_rules:
        return _cpic_rules

    if not os.path.exists(_RULES_PATH):
        raise FileNotFoundError(
            f"CPIC rules file not found at {_RULES_PATH}. "
            f"Run extractor.py first or ensure cpic_rules.json exists in data/."
        )

    with open(_RULES_PATH, 'r', encoding='utf-8') as f:
        _cpic_rules = json.load(f)

    return _cpic_rules


def reload_rules() -> None:
    """Force reload of CPIC rules (e.g., after updating cpic_rules.json)."""
    global _cpic_rules
    _cpic_rules = {}
    _load_rules()


def get_available_drugs() -> list[str]:
    """Return list of all drugs that have CPIC rules loaded."""
    rules = _load_rules()
    return sorted(rules.keys())


def get_drug_info(drug: str) -> dict | None:
    """Return rule info for a specific drug, or None if not found."""
    rules = _load_rules()
    return rules.get(drug.upper())


# --- Dynamic Confidence Scoring ---

def compute_dynamic_confidence(
    severity: str,
    detected_variants: list[dict],
    activity_score: float,
    quality_flags: list[str] | None = None,
    has_unphased_het: bool = False,
    min_gq: float | None = None,
    min_dp: float | None = None,
) -> float:
    """
    Compute confidence dynamically from actual genomic evidence.

    Considers:
    - Number of confirming variants (more = stronger evidence)
    - Activity score clarity (extreme values = unambiguous phenotype)
    - Variant impact strength (loss-of-function = stronger signal)
    - Genotype quality (GQ < 20 → penalty)
    - Read depth (DP < 10 → penalty)
    - Phasing ambiguity (multiple unphased hets → penalty)
    - No-variant wildtype assumption → moderate base (not maximum)

    Returns value between 0.40 and 0.99.
    """
    n = len(detected_variants)
    flags = quality_flags or []

    # Base confidence from variant count
    if n == 0:
        base = 0.55   # wildtype assumed — moderate, not certain
    elif n == 1:
        base = 0.67
    elif n == 2:
        base = 0.76
    elif n == 3:
        base = 0.84
    elif n == 4:
        base = 0.89
    else:
        base = min(0.94, 0.89 + 0.012 * (n - 4))

    # Activity score clarity
    if activity_score == 0.0:
        adj = 0.06       # Complete loss — unambiguous
    elif activity_score <= 0.25:
        adj = 0.04
    elif activity_score >= 2.5:
        adj = 0.04       # Ultra-rapid — clear
    elif activity_score >= 2.0:
        adj = 0.03       # Normal — well-characterised
    elif 0.75 < activity_score < 1.25:
        adj = -0.05      # Intermediate — harder to classify
    elif activity_score <= 0.5:
        adj = 0.02
    else:
        adj = 0.0

    # High-impact variant bonus
    high = sum(
        1 for v in detected_variants
        if any(k in v.get("impact", "").lower()
               for k in ("nonfunctional", "frameshift", "stop", "splice"))
    )
    impact_bonus = min(0.05, high * 0.025)

    # Quality penalties
    quality_penalty = 0.0

    # Low GQ penalty
    if min_gq is not None and min_gq < 20:
        quality_penalty += 0.10 if min_gq < 10 else 0.05

    # Low DP penalty
    if min_dp is not None and min_dp < 10:
        quality_penalty += 0.10 if min_dp < 5 else 0.05

    # Phasing ambiguity penalty
    if has_unphased_het and n > 1:
        quality_penalty += 0.08

    # Conflicting functional effects (LOF + GOF together)
    has_conflict = any("conflicting functional" in f.lower() for f in flags)
    if has_conflict:
        quality_penalty += 0.10

    return round(max(0.40, min(0.99, base + adj + impact_bonus - quality_penalty)), 2)


def assess_drug_risk(drug: str, genomic_profile: dict) -> dict[str, Any]:
    """
    Assess risk for a specific drug given a patient's genomic profile.

    Args:
        drug: Drug name (case-insensitive).
        genomic_profile: Dict from parser's build_genomic_profile(), keyed by gene.

    Returns:
        Complete structured risk assessment.
    """
    rules = _load_rules()
    drug_upper = drug.upper()

    if drug_upper not in rules:
        return {
            "error": f"Drug '{drug}' not found in CPIC rules.",
            "available_drugs": get_available_drugs(),
        }

    drug_rules = rules[drug_upper]
    primary_gene = drug_rules["primary_gene"]
    phenotype_rules = drug_rules.get("phenotype_rules", {})

    # Get the patient's profile for the primary gene
    gene_profile = genomic_profile.get(primary_gene, {})
    phenotype = gene_profile.get("phenotype", "NM")
    diplotype = gene_profile.get("diplotype", "*1/*1")
    activity_score = gene_profile.get("activity_score", 2.0)
    detected_variants = gene_profile.get("detected_variants", [])
    quality_flags = gene_profile.get("quality_flags", [])
    has_unphased_het = gene_profile.get("has_unphased_het", False)
    min_gq = gene_profile.get("min_gq")
    min_dp = gene_profile.get("min_dp")

    # Look up the phenotype rule
    rule = phenotype_rules.get(phenotype, None)

    # Fallback: try "NM" as safe fallback if exact phenotype not in rules
    if not rule:
        rule = phenotype_rules.get("NM", {
            "risk_label": "Unknown",
            "severity": "low",
            "recommendation": (
                f"No specific CPIC guideline found for {phenotype} phenotype "
                f"with {drug}. Exercise clinical judgment."
            )
        })

    risk_label = rule.get("risk_label", "Unknown")
    severity = rule.get("severity", "low")
    recommendation = rule.get("recommendation", "No recommendation available.")

    confidence = compute_dynamic_confidence(
        severity,
        detected_variants,
        activity_score,
        quality_flags=quality_flags,
        has_unphased_het=has_unphased_het,
        min_gq=min_gq,
        min_dp=min_dp,
    )

    # Format detected variants for output
    variant_list = []
    for v in detected_variants:
        variant_list.append({
            "rsid": v.get("rsid"),
            "impact": v.get("impact", "unknown"),
            "genotype": (
                f"{v['genotype_alleles'][0]}/{v['genotype_alleles'][1]}"
                if "genotype_alleles" in v else "unknown"
            ),
            "star_allele_1": v.get("star_1"),
            "star_allele_2": v.get("star_2"),
        })

    return {
        "drug": drug_upper,
        "risk_assessment": {
            "risk_label": risk_label,
            "severity": severity,
            "confidence_score": confidence,
        },
        "pharmacogenomic_profile": {
            "primary_gene": primary_gene,
            "diplotype": diplotype,
            "phenotype": phenotype,
            "activity_score": activity_score,
            "detected_variants": variant_list,
            "quality_flags": quality_flags,
        },
        "clinical_recommendation": {
            "recommendation": recommendation,
            "guideline_source": "CPIC",
            "drug": drug_upper,
            "gene": primary_gene,
        },
    }



def generate_pathway_steps(drug: str, engine_result: dict) -> list[dict]:
    """
    Generate step-by-step pathway visualization data for the frontend.

    Each step has: id, label, detail, shape, color.
    Colors and descriptions are derived dynamically from actual patient data.
    """
    pgx = engine_result.get("pharmacogenomic_profile", {})
    risk = engine_result.get("risk_assessment", {})
    rec = engine_result.get("clinical_recommendation", {})

    gene = pgx.get("primary_gene", "Unknown")
    diplotype = pgx.get("diplotype", "*1/*1")
    phenotype = pgx.get("phenotype", "NM")
    activity = pgx.get("activity_score", 2.0)
    n_variants = len(pgx.get("detected_variants", []))
    risk_label = risk.get("risk_label", "Unknown")
    severity = risk.get("severity", "none")

    # Dynamic colors based on actual data
    pheno_colors = {
        "PM": "#ef4444", "IM": "#f97316", "NM": "#22c55e",
        "RM": "#06b6d4", "URM": "#8b5cf6",
    }
    severity_colors = {
        "critical": "#ef4444", "high": "#f97316",
        "moderate": "#eab308", "low": "#22c55e", "none": "#22c55e",
    }

    pheno_color = pheno_colors.get(phenotype, "#64748b")
    risk_color = severity_colors.get(severity, "#64748b")

    # Activity description
    if activity == 0.0:
        activity_desc = "No enzyme function"
    elif activity <= 0.5:
        activity_desc = "Severely reduced function"
    elif activity < 1.0:
        activity_desc = "Reduced function"
    elif activity <= 2.0:
        activity_desc = "Normal function"
    else:
        activity_desc = "Enhanced function"

    # Metabolism narrative
    if phenotype == "PM":
        metabolism_desc = f"{gene} cannot adequately process {drug}"
    elif phenotype == "IM":
        metabolism_desc = f"{gene} partially metabolizes {drug}"
    elif phenotype in ("RM", "URM"):
        metabolism_desc = f"{gene} rapidly converts {drug}"
    else:
        metabolism_desc = f"{gene} normally metabolizes {drug}"

    s = "s" if n_variants != 1 else ""

    return [
        {
            "id": "gene",
            "label": gene,
            "detail": f"Primary pharmacogene responsible for {drug} metabolism",
            "shape": "hexagon",
            "color": "#06b6d4",
        },
        {
            "id": "variants",
            "label": f"{n_variants} Variant{s}",
            "detail": (
                f"Diplotype {diplotype}"
                + (f" \u2014 {n_variants} actionable variant{s} identified"
                   if n_variants > 0
                   else " \u2014 Wild-type assumed (no actionable variants)")
            ),
            "shape": "diamond",
            "color": "#a855f7" if n_variants > 0 else "#22c55e",
        },
        {
            "id": "phenotype",
            "label": f"{phenotype} Metabolizer",
            "detail": f"Activity score {activity} \u2014 {activity_desc}",
            "shape": "circle",
            "color": pheno_color,
        },
        {
            "id": "metabolism",
            "label": f"{drug} Interaction",
            "detail": metabolism_desc,
            "shape": "rectangle",
            "color": pheno_color,
        },
        {
            "id": "effect",
            "label": risk_label,
            "detail": rec.get("recommendation", "Consult clinical guidelines")[:150],
            "shape": "shield",
            "color": risk_color,
        },
    ]
