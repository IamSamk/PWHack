"""
PharmaGuard Pharmacogenomic Engine

Takes a genomic profile + drug name → produces risk assessment.
Loads rules from cpic_rules.json — supports any drug present in that file.
Computes Pharmacogenomic Burden Score (PBS) across all genes.
Supports counterfactual simulation.
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


# --- Severity weights for PBS calculation ---
SEVERITY_WEIGHTS = {
    "critical": 4.0,
    "high": 3.0,
    "moderate": 2.0,
    "low": 1.0,
    "none": 0.0,
}

CONFIDENCE_LEVELS = {
    "critical": 0.95,
    "high": 0.90,
    "moderate": 0.85,
    "low": 0.70,
    "none": 0.95,
}

EVIDENCE_LEVELS = {
    "critical": "1A — Strong CPIC recommendation",
    "high": "1A — Strong CPIC recommendation",
    "moderate": "1B — Moderate CPIC recommendation",
    "low": "2A — Weak or limited evidence",
    "none": "1A — Standard dosing supported",
}


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

    confidence = CONFIDENCE_LEVELS.get(severity, 0.75)
    evidence_level = EVIDENCE_LEVELS.get(severity, "Unknown")

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
            "confidence": confidence,
            "evidence_level": evidence_level,
        },
        "pharmacogenomic_profile": {
            "primary_gene": primary_gene,
            "diplotype": diplotype,
            "phenotype": phenotype,
            "activity_score": activity_score,
            "detected_variants": variant_list,
            "variants_count": len(variant_list),
        },
        "clinical_recommendation": {
            "recommendation": recommendation,
            "guideline_source": "CPIC",
            "drug": drug_upper,
            "gene": primary_gene,
        },
    }


def compute_pharmacogenomic_burden_score(
    genomic_profile: dict, drugs: list[str] | None = None
) -> dict[str, Any]:
    """
    Compute the Pharmacogenomic Burden Score (PBS) across all genes.

    PBS = Σ (gene severity weight based on worst-case drug interaction)

    Optionally scoped to a specific list of drugs.
    """
    rules = _load_rules()

    if drugs is None:
        drugs = list(rules.keys())
    else:
        drugs = [d.upper() for d in drugs]

    gene_burdens: dict[str, dict] = {}
    high_risk_pairs: list[dict] = []

    for drug in drugs:
        if drug not in rules:
            continue

        drug_rules = rules[drug]
        primary_gene = drug_rules["primary_gene"]
        gene_profile = genomic_profile.get(primary_gene, {})
        phenotype = gene_profile.get("phenotype", "NM")

        pheno_rule = drug_rules.get("phenotype_rules", {}).get(phenotype)
        if not pheno_rule:
            continue

        severity = pheno_rule.get("severity", "none")
        weight = SEVERITY_WEIGHTS.get(severity, 0.0)

        if primary_gene not in gene_burdens:
            gene_burdens[primary_gene] = {
                "phenotype": phenotype,
                "activity_score": gene_profile.get("activity_score", 2.0),
                "max_severity_weight": 0.0,
                "affected_drugs": [],
            }

        gene_burdens[primary_gene]["affected_drugs"].append({
            "drug": drug,
            "risk_label": pheno_rule.get("risk_label", "Unknown"),
            "severity": severity,
            "weight": weight,
        })

        if weight > gene_burdens[primary_gene]["max_severity_weight"]:
            gene_burdens[primary_gene]["max_severity_weight"] = weight

        if severity in ("critical", "high"):
            high_risk_pairs.append({
                "drug": drug,
                "gene": primary_gene,
                "phenotype": phenotype,
                "risk_label": pheno_rule.get("risk_label"),
                "severity": severity,
            })

    # PBS = sum of max severity weights per gene
    total_pbs = sum(gb["max_severity_weight"] for gb in gene_burdens.values())
    max_possible = len(gene_burdens) * max(SEVERITY_WEIGHTS.values()) if gene_burdens else 1.0
    normalized_pbs = round(total_pbs / max_possible, 3) if max_possible > 0 else 0.0

    # Risk tier
    if total_pbs >= 12:
        risk_tier = "CRITICAL"
    elif total_pbs >= 8:
        risk_tier = "HIGH"
    elif total_pbs >= 4:
        risk_tier = "MODERATE"
    elif total_pbs > 0:
        risk_tier = "LOW"
    else:
        risk_tier = "MINIMAL"

    return {
        "pharmacogenomic_burden_score": round(total_pbs, 2),
        "normalized_pbs": normalized_pbs,
        "risk_tier": risk_tier,
        "gene_burdens": gene_burdens,
        "high_risk_pairs": high_risk_pairs,
        "total_genes_affected": len(
            [g for g in gene_burdens.values() if g["max_severity_weight"] > 0]
        ),
        "drugs_analyzed": len(drugs),
    }


def counterfactual_simulation(
    drug: str, genomic_profile: dict, target_phenotype: str = "NM"
) -> dict[str, Any]:
    """
    Simulate: 'What if this patient were a different metabolizer for the primary gene?'

    Returns both actual and counterfactual assessments for comparison.
    """
    rules = _load_rules()
    drug_upper = drug.upper()

    if drug_upper not in rules:
        return {"error": f"Drug '{drug}' not found."}

    primary_gene = rules[drug_upper]["primary_gene"]

    # Actual assessment
    actual = assess_drug_risk(drug, genomic_profile)

    # Build counterfactual profile
    counterfactual_profile = {}
    for gene, data in genomic_profile.items():
        if gene == primary_gene:
            from app.parser import STAR_ALLELE_DEFINITIONS

            gene_def = STAR_ALLELE_DEFINITIONS.get(gene, {})
            default_star = gene_def.get("default_star", "*1")

            # Simulate target phenotype activity
            phenotype_activity = {
                "PM": 0.0, "IM": 0.5, "NM": 2.0, "RM": 2.5, "URM": 3.0
            }
            sim_activity = phenotype_activity.get(target_phenotype, 2.0)

            counterfactual_profile[gene] = {
                **data,
                "phenotype": target_phenotype,
                "activity_score": sim_activity,
                "diplotype": (
                    f"{default_star}/{default_star}"
                    if target_phenotype == "NM"
                    else data["diplotype"]
                ),
            }
        else:
            counterfactual_profile[gene] = data

    # Counterfactual assessment
    counterfactual = assess_drug_risk(drug, counterfactual_profile)

    return {
        "drug": drug_upper,
        "primary_gene": primary_gene,
        "actual": {
            "phenotype": actual.get("pharmacogenomic_profile", {}).get("phenotype"),
            "risk_assessment": actual.get("risk_assessment"),
            "recommendation": actual.get("clinical_recommendation", {}).get("recommendation"),
        },
        "counterfactual": {
            "simulated_phenotype": target_phenotype,
            "risk_assessment": counterfactual.get("risk_assessment"),
            "recommendation": counterfactual.get("clinical_recommendation", {}).get(
                "recommendation"
            ),
        },
        "risk_changed": (
            actual.get("risk_assessment", {}).get("risk_label")
            != counterfactual.get("risk_assessment", {}).get("risk_label")
        ),
    }


def batch_drug_assessment(
    genomic_profile: dict, drugs: list[str] | None = None
) -> dict[str, Any]:
    """
    Assess risk for multiple drugs at once.
    If no drug list provided, assesses ALL drugs in cpic_rules.json.
    """
    rules = _load_rules()

    if drugs is None:
        drugs = list(rules.keys())
    else:
        drugs = [d.upper() for d in drugs]

    results = {}
    for drug in drugs:
        results[drug] = assess_drug_risk(drug, genomic_profile)

    pbs = compute_pharmacogenomic_burden_score(genomic_profile, drugs)

    return {
        "drug_assessments": results,
        "burden_score": pbs,
        "total_drugs_assessed": len(results),
    }
