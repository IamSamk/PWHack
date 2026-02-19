"""
PharmGKB Guideline Annotation Extractor
Scans guideline JSON files and produces a minimal cpic_rules.json
for the pharmacogenomic rule engine.
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

# --- Configuration ---

TARGET_DRUGS = {
    "CODEINE", "WARFARIN", "CLOPIDOGREL",
    "SIMVASTATIN", "AZATHIOPRINE", "FLUOROURACIL"
}

# Known primary gene for each drug (CPIC canonical)
DRUG_GENE_MAP = {
    "CODEINE": "CYP2D6",
    "WARFARIN": "CYP2C9",
    "CLOPIDOGREL": "CYP2C19",
    "SIMVASTATIN": "SLCO1B1",
    "AZATHIOPRINE": "TPMT",
    "FLUOROURACIL": "DPYD",
}

# Phenotype normalization map
PHENOTYPE_NORM: dict[str, str] = {
    "poor metabolizer": "PM",
    "intermediate metabolizer": "IM",
    "normal metabolizer": "NM",
    "extensive metabolizer": "NM",          # legacy CPIC term
    "rapid metabolizer": "RM",
    "ultrarapid metabolizer": "URM",
    "ultra-rapid metabolizer": "URM",
    "likely poor metabolizer": "PM",
    "likely intermediate metabolizer": "IM",
    # SLCO1B1 specific
    "poor function": "PM",
    "decreased function": "IM",
    "normal function": "NM",
    "increased function": "RM",
    # TPMT / DPYD specific
    "homozygous variant": "PM",
    "heterozygous": "IM",
    "normal activity": "NM",
    "no activity": "PM",
    "reduced activity": "IM",
    "possible intermediate metabolizer": "IM",
    "indeterminate": "Unknown",
}

RISK_KEYWORDS = {
    "toxic": [
        "contraindicated", "avoid", "do not use", "not recommended",
        "should not be", "toxic", "life-threatening"
    ],
    "ineffective": [
        "ineffective", "lack of efficacy", "no therapeutic effect",
        "reduced efficacy", "decreased efficacy", "unlikely to benefit",
        "insufficient response"
    ],
    "adjust": [
        "reduce", "adjust", "lower dose", "decreased dose", "dose reduction",
        "50%", "25%", "increase dose", "higher dose", "titrate",
        "reduced starting dose", "reduce dose"
    ],
    "safe": [
        "standard", "label-recommended", "label recommended",
        "no changes", "normal dose", "per label", "usual dose",
        "no dose adjustment", "initiate therapy"
    ],
}

SEVERITY_MAP = {
    "Toxic": "critical",
    "Ineffective": "high",
    "Adjust Dosage": "moderate",
    "Safe": "none",
    "Unknown": "low",
}


def normalize_phenotype(raw: str) -> str | None:
    """Normalize a phenotype string to its short code."""
    cleaned = raw.strip().lower()
    # Remove gene prefixes like "CYP2D6 "
    cleaned = re.sub(r'^[a-z0-9]+\s+', '', cleaned) if re.match(r'^[a-z0-9]+\s+(poor|intermediate|normal|extensive|rapid|ultrarapid|ultra)', cleaned) else cleaned

    for pattern, code in PHENOTYPE_NORM.items():
        if pattern in cleaned:
            return code

    # Fallback: check for key substrings
    if "poor" in cleaned:
        return "PM"
    if "intermediate" in cleaned:
        return "IM"
    if "normal" in cleaned or "extensive" in cleaned:
        return "NM"
    if "ultrarapid" in cleaned or "ultra-rapid" in cleaned or "ultra rapid" in cleaned:
        return "URM"
    if "rapid" in cleaned:
        return "RM"

    return None


def infer_risk_label(recommendation_text: str) -> str:
    """Infer risk label from recommendation text using keyword rules."""
    text_lower = recommendation_text.lower()

    # Priority order: Toxic > Ineffective > Adjust > Safe
    for keyword in RISK_KEYWORDS["toxic"]:
        if keyword in text_lower:
            return "Toxic"

    for keyword in RISK_KEYWORDS["ineffective"]:
        if keyword in text_lower:
            return "Ineffective"

    for keyword in RISK_KEYWORDS["adjust"]:
        if keyword in text_lower:
            return "Adjust Dosage"

    for keyword in RISK_KEYWORDS["safe"]:
        if keyword in text_lower:
            return "Safe"

    return "Unknown"


def extract_drug_name_from_guideline(guideline: dict) -> str | None:
    """Try multiple paths to extract the drug name from a guideline object."""
    # Path 1: guideline.name field
    name = guideline.get("name", "")
    if name:
        name_upper = name.upper()
        for drug in TARGET_DRUGS:
            if drug in name_upper:
                return drug

    # Path 2: guideline.relatedChemicals
    chemicals = guideline.get("relatedChemicals", [])
    if not chemicals:
        chemicals = guideline.get("related_chemicals", [])
    for chem in chemicals:
        chem_name = ""
        if isinstance(chem, dict):
            chem_name = chem.get("name", chem.get("objId", ""))
        elif isinstance(chem, str):
            chem_name = chem
        chem_upper = chem_name.upper()
        for drug in TARGET_DRUGS:
            if drug in chem_upper:
                return drug

    # Path 3: check textHtml or summaryHtml fields for drug mentions
    for field in ["textHtml", "summaryHtml", "summary", "textMarkdown", "summaryMarkdown"]:
        text = guideline.get(field, "")
        if isinstance(text, dict):
            text = text.get("html", text.get("text", ""))
        if text and isinstance(text, str):
            text_upper = text.upper()
            for drug in TARGET_DRUGS:
                if drug in text_upper:
                    return drug

    return None


def extract_gene_from_guideline(guideline: dict, drug: str) -> str:
    """Extract primary gene from guideline or fall back to known map."""
    # Path 1: relatedGenes
    genes = guideline.get("relatedGenes", [])
    if not genes:
        genes = guideline.get("related_genes", [])
    for gene in genes:
        gene_name = ""
        if isinstance(gene, dict):
            gene_name = gene.get("symbol", gene.get("name", gene.get("objId", "")))
        elif isinstance(gene, str):
            gene_name = gene
        gene_upper = gene_name.upper()
        if gene_upper in {"CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"}:
            return gene_upper

    # Path 2: check guideline name for gene mention
    name = guideline.get("name", "")
    for g in ["CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"]:
        if g.lower() in name.lower() or g in name:
            return g

    # Fallback to known map
    return DRUG_GENE_MAP.get(drug, "UNKNOWN")


def extract_phenotype_recommendations(guideline: dict) -> list[dict]:
    """
    Extract phenotype → recommendation pairs from various guideline structures.
    Returns list of dicts: {phenotype_raw, recommendation}
    """
    results = []

    # Path 1: guideline.recommendations (most common in PharmGKB exports)
    recs = guideline.get("recommendations", [])
    for rec in recs:
        if isinstance(rec, dict):
            # Get phenotype
            phenotype_raw = ""
            # Check classification / population
            population = rec.get("population", "")
            classification = rec.get("classification", "")
            phenotype_raw = population or classification

            # Some have nested lookupKey with phenotype
            lookup = rec.get("lookupKey", {})
            if isinstance(lookup, dict):
                for key, val in lookup.items():
                    if "phenotype" in key.lower() or "metabolizer" in str(val).lower():
                        phenotype_raw = str(val) if not phenotype_raw else phenotype_raw

            # Check groups
            groups = rec.get("groups", [])
            for group in groups:
                if isinstance(group, dict):
                    group_name = group.get("name", "")
                    if "metabolizer" in group_name.lower() or "function" in group_name.lower():
                        phenotype_raw = group_name if not phenotype_raw else phenotype_raw

            # Get recommendation text
            rec_text = ""
            for field in ["drugRecommendation", "recommendation", "textHtml",
                          "text", "implications", "content", "comments",
                          "textMarkdown", "summaryMarkdown"]:
                val = rec.get(field, "")
                if isinstance(val, dict):
                    val = val.get("html", val.get("text", ""))
                if val and isinstance(val, str) and len(val) > 10:
                    rec_text = val
                    break

            if phenotype_raw and rec_text:
                results.append({
                    "phenotype_raw": phenotype_raw,
                    "recommendation": re.sub(r'<[^>]+>', '', rec_text).strip()
                })

    # Path 2: guideline.groups or guideline.dosingInformation
    for path_key in ["groups", "dosingInformation", "annotations", "guidelineAnnotations"]:
        items = guideline.get(path_key, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            phenotype_raw = ""
            rec_text = ""

            for pkey in ["name", "phenotype", "metabolizerStatus", "genePhenotype", "population"]:
                if item.get(pkey):
                    phenotype_raw = str(item[pkey])
                    break

            for rkey in ["drugRecommendation", "recommendation", "therapeuticRecommendation",
                         "dosageRecommendation", "text", "implications",
                         "textMarkdown", "summaryMarkdown"]:
                rval = item.get(rkey, "")
                if isinstance(rval, dict):
                    rval = rval.get("html", rval.get("text", ""))
                if rval and isinstance(rval, str) and len(rval) > 5:
                    rec_text = re.sub(r'<[^>]+>', '', rval).strip()
                    break

            if phenotype_raw and rec_text:
                results.append({
                    "phenotype_raw": phenotype_raw,
                    "recommendation": rec_text
                })

    # Path 3: Scan textHtml/summaryHtml for structured tables (heuristic fallback)
    if not results:
        for text_field in ["textHtml", "summaryHtml", "textMarkdown", "summaryMarkdown"]:
            html_text = guideline.get(text_field, "")
            if isinstance(html_text, dict):
                html_text = html_text.get("html", html_text.get("text", ""))
            if not html_text or not isinstance(html_text, str):
                continue
            # Strip HTML
            plain = re.sub(r'<[^>]+>', ' ', html_text)
            # Look for phenotype mentions with nearby recommendation text
            for pheno_pattern in ["poor metabolizer", "intermediate metabolizer",
                                   "normal metabolizer", "extensive metabolizer",
                                   "rapid metabolizer", "ultrarapid metabolizer",
                                   "decreased function", "normal function",
                                   "poor function", "no activity", "reduced activity"]:
                idx = plain.lower().find(pheno_pattern)
                if idx != -1:
                    # Grab surrounding text as rough recommendation
                    context = plain[max(0, idx - 50):idx + 300].strip()
                    context = re.sub(r'\s+', ' ', context)
                    results.append({
                        "phenotype_raw": pheno_pattern,
                        "recommendation": context
                    })

    return results


def process_guideline_file(filepath: str) -> dict | None:
    """Process a single guideline JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"  [WARN] Could not parse {filepath}: {e}")
        return None

    # Handle both top-level structures
    guideline = data
    if "guideline" in data and isinstance(data["guideline"], dict):
        guideline = data["guideline"]

    # Sometimes it's a list
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                guideline = item.get("guideline", item)
                break

    drug = extract_drug_name_from_guideline(guideline)
    if not drug:
        return None

    gene = extract_gene_from_guideline(guideline, drug)
    pheno_recs = extract_phenotype_recommendations(guideline)

    if not pheno_recs:
        print(f"  [INFO] Found {drug} guideline but no extractable phenotype rules in {filepath}")
        return None

    phenotype_rules = {}
    for pr in pheno_recs:
        code = normalize_phenotype(pr["phenotype_raw"])
        if not code or code == "Unknown":
            continue
        risk = infer_risk_label(pr["recommendation"])
        severity = SEVERITY_MAP.get(risk, "low")

        # If we already have this phenotype, prefer the one with more specific risk
        if code in phenotype_rules:
            existing_risk = phenotype_rules[code]["risk_label"]
            # Keep higher-severity finding
            priority = {"Toxic": 4, "Ineffective": 3, "Adjust Dosage": 2, "Safe": 1, "Unknown": 0}
            if priority.get(risk, 0) <= priority.get(existing_risk, 0):
                continue

        phenotype_rules[code] = {
            "risk_label": risk,
            "severity": severity,
            "recommendation": pr["recommendation"][:500]  # Cap length
        }

    if not phenotype_rules:
        return None

    return {
        "drug": drug,
        "primary_gene": gene,
        "phenotype_rules": phenotype_rules
    }


def scan_directory(directory: str) -> dict:
    """Scan all JSON files in directory and build cpic_rules."""
    cpic_rules: dict[str, Any] = {}
    dir_path = Path(directory)

    if not dir_path.exists():
        print(f"ERROR: Directory {directory} does not exist.")
        sys.exit(1)

    json_files = list(dir_path.rglob("*.json"))
    print(f"Found {len(json_files)} JSON files in {directory}")

    for filepath in json_files:
        result = process_guideline_file(str(filepath))
        if result:
            drug = result["drug"]
            if drug not in cpic_rules:
                cpic_rules[drug] = {
                    "primary_gene": result["primary_gene"],
                    "phenotype_rules": {}
                }
            # Merge phenotype rules (don't overwrite existing with lower priority)
            for code, rule in result["phenotype_rules"].items():
                if code not in cpic_rules[drug]["phenotype_rules"]:
                    cpic_rules[drug]["phenotype_rules"][code] = rule
                else:
                    existing = cpic_rules[drug]["phenotype_rules"][code]
                    priority_map = {"Toxic": 4, "Ineffective": 3, "Adjust Dosage": 2, "Safe": 1, "Unknown": 0}
                    if priority_map.get(rule["risk_label"], 0) > priority_map.get(existing["risk_label"], 0):
                        cpic_rules[drug]["phenotype_rules"][code] = rule

            print(f"  [OK] Extracted rules for {drug} ({result['primary_gene']}) — "
                  f"{len(result['phenotype_rules'])} phenotype rules")

    return cpic_rules


def add_fallback_rules(cpic_rules: dict) -> dict:
    """
    Ensure all 6 drugs have at least baseline CPIC rules.
    These are canonical fallbacks based on published CPIC guidelines.
    Only fills in gaps — does NOT overwrite extracted data.
    """
    FALLBACK = {
        "CODEINE": {
            "primary_gene": "CYP2D6",
            "phenotype_rules": {
                "URM": {
                    "risk_label": "Toxic",
                    "severity": "critical",
                    "recommendation": "Avoid codeine. CYP2D6 ultrarapid metabolizers convert codeine to morphine at greatly increased rates, risking fatal respiratory depression. Use non-opioid analgesic."
                },
                "RM": {
                    "risk_label": "Adjust Dosage",
                    "severity": "moderate",
                    "recommendation": "Use codeine with caution. Rapid metabolizers may have increased morphine formation. Consider lower dose or alternative analgesic. Monitor for adverse effects."
                },
                "NM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "Use codeine per standard label dosing. Normal CYP2D6 metabolism expected."
                },
                "IM": {
                    "risk_label": "Ineffective",
                    "severity": "high",
                    "recommendation": "Codeine may have reduced efficacy due to decreased morphine formation. Consider alternative analgesic if inadequate pain relief."
                },
                "PM": {
                    "risk_label": "Ineffective",
                    "severity": "high",
                    "recommendation": "Avoid codeine. CYP2D6 poor metabolizers cannot convert codeine to morphine. Drug will be ineffective for pain relief. Use alternative analgesic."
                }
            }
        },
        "CLOPIDOGREL": {
            "primary_gene": "CYP2C19",
            "phenotype_rules": {
                "URM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "CYP2C19 ultrarapid metabolizer. Enhanced activation of clopidogrel. Standard dosing appropriate. May have slightly increased bleeding risk."
                },
                "RM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "CYP2C19 rapid metabolizer. Adequate clopidogrel activation expected. Use standard dosing."
                },
                "NM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "Use clopidogrel per standard label dosing. Normal CYP2C19 metabolism expected."
                },
                "IM": {
                    "risk_label": "Adjust Dosage",
                    "severity": "moderate",
                    "recommendation": "Reduced clopidogrel activation. Consider alternative antiplatelet therapy (prasugrel, ticagrelor) if no contraindication, or consider increased clopidogrel dose with platelet function testing."
                },
                "PM": {
                    "risk_label": "Ineffective",
                    "severity": "high",
                    "recommendation": "Avoid clopidogrel. CYP2C19 poor metabolizers have significantly reduced active metabolite formation. High residual platelet reactivity and increased thrombotic risk. Use prasugrel or ticagrelor."
                }
            }
        },
        "WARFARIN": {
            "primary_gene": "CYP2C9",
            "phenotype_rules": {
                "NM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "Use warfarin with standard dosing algorithm. Normal CYP2C9 metabolism. Adjust dose based on INR monitoring."
                },
                "IM": {
                    "risk_label": "Adjust Dosage",
                    "severity": "moderate",
                    "recommendation": "Reduced warfarin clearance. Reduce initial dose by 25-50%. Increased bleeding risk. More frequent INR monitoring required during dose stabilization."
                },
                "PM": {
                    "risk_label": "Toxic",
                    "severity": "critical",
                    "recommendation": "Significantly reduced warfarin metabolism. Reduce initial dose by 50-80%. High risk of supratherapeutic INR and major bleeding. Consider alternative anticoagulant or very low starting dose with intensive INR monitoring."
                }
            }
        },
        "SIMVASTATIN": {
            "primary_gene": "SLCO1B1",
            "phenotype_rules": {
                "NM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "Normal SLCO1B1 transporter function. Use simvastatin per standard dosing. Standard myopathy risk."
                },
                "IM": {
                    "risk_label": "Adjust Dosage",
                    "severity": "moderate",
                    "recommendation": "Decreased SLCO1B1 function. Increased simvastatin plasma levels. Use lower dose (max 20mg) or consider alternative statin (rosuvastatin, pravastatin). Monitor for myopathy."
                },
                "PM": {
                    "risk_label": "Toxic",
                    "severity": "critical",
                    "recommendation": "Poor SLCO1B1 function. High risk of simvastatin-induced myopathy/rhabdomyolysis. Avoid simvastatin or use lowest dose. Prescribe alternative statin (rosuvastatin, pravastatin) instead."
                }
            }
        },
        "AZATHIOPRINE": {
            "primary_gene": "TPMT",
            "phenotype_rules": {
                "NM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "Normal TPMT activity. Use azathioprine per standard dosing. Monitor blood counts as per standard practice."
                },
                "IM": {
                    "risk_label": "Adjust Dosage",
                    "severity": "moderate",
                    "recommendation": "Intermediate TPMT activity. Reduce azathioprine dose by 30-70%. Increased risk of myelosuppression. Monitor CBC more frequently."
                },
                "PM": {
                    "risk_label": "Toxic",
                    "severity": "critical",
                    "recommendation": "Absent TPMT activity. Drastically reduce azathioprine dose (reduce to 10% of standard) or avoid entirely. Life-threatening myelosuppression risk. Consider alternative immunosuppressant."
                }
            }
        },
        "FLUOROURACIL": {
            "primary_gene": "DPYD",
            "phenotype_rules": {
                "NM": {
                    "risk_label": "Safe",
                    "severity": "none",
                    "recommendation": "Normal DPD activity. Use fluorouracil per standard dosing and protocol."
                },
                "IM": {
                    "risk_label": "Adjust Dosage",
                    "severity": "moderate",
                    "recommendation": "Reduced DPD activity. Reduce fluorouracil dose by 25-50%. Increased risk of severe toxicity (mucositis, neutropenia, hand-foot syndrome). Monitor closely."
                },
                "PM": {
                    "risk_label": "Toxic",
                    "severity": "critical",
                    "recommendation": "Absent or near-absent DPD activity. Avoid fluorouracil and other fluoropyrimidines (capecitabine). Life-threatening toxicity risk including fatal neutropenia and sepsis."
                }
            }
        }
    }

    for drug, fallback_data in FALLBACK.items():
        if drug not in cpic_rules:
            cpic_rules[drug] = fallback_data
            print(f"  [FALLBACK] Added complete fallback rules for {drug}")
        else:
            # Fill in missing phenotypes only
            for pheno, rule in fallback_data["phenotype_rules"].items():
                if pheno not in cpic_rules[drug]["phenotype_rules"]:
                    cpic_rules[drug]["phenotype_rules"][pheno] = rule
                    print(f"  [FALLBACK] Added missing {pheno} rule for {drug}")

    return cpic_rules


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_cpic_rules.py <path_to_guideline_json_dir> [output_path]")
        print("Example: python extract_cpic_rules.py ../data/guidelineAnnotations ../data/cpic_rules.json")
        sys.exit(1)

    input_dir = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "data", "cpic_rules.json"
    )

    print(f"Scanning: {input_dir}")
    print(f"Output:   {output_path}")
    print("-" * 60)

    cpic_rules = scan_directory(input_dir)

    print("-" * 60)
    print(f"Extracted rules for {len(cpic_rules)} drugs from PharmGKB data")

    # Add fallbacks for any missing drugs/phenotypes
    cpic_rules = add_fallback_rules(cpic_rules)

    print("-" * 60)
    print(f"Final rules cover {len(cpic_rules)} drugs:")
    for drug, data in sorted(cpic_rules.items()):
        phenotypes = list(data["phenotype_rules"].keys())
        print(f"  {drug} ({data['primary_gene']}): {phenotypes}")

    # Write output
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(cpic_rules, f, indent=2, ensure_ascii=False)

    print(f"\nWritten to {output_path}")


if __name__ == "__main__":
    main()