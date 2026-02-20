"""
PharmaGuard API

POST /analyze  -> One or more drugs in a single request (List[str] drugs form field)
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.parser import parse_vcf_bytes, VCFParseError, VCFFileTooLargeError
from app.engine import assess_drug_risk, generate_pathway_steps
from app.llm_service import generate_explanation

app = FastAPI(
    title="Pharmavex API",
    description="Precision Pharmacogenomic Risk Engine — CPIC-aligned drug safety analysis from VCF data.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _build_response(engine_result: dict, pathway: list, explanation: dict) -> dict:
    """Serialise a single drug result into the canonical hackathon JSON schema."""
    pgx = engine_result.get("pharmacogenomic_profile", {})
    risk = engine_result.get("risk_assessment", {})
    rec = engine_result.get("clinical_recommendation", {})
    return {
        "patient_id": str(uuid.uuid4()),
        "drug": engine_result["drug"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "risk_assessment": {
            "risk_label": risk.get("risk_label", "Unknown"),
            "confidence_score": risk.get("confidence_score", 0.0),
            "severity": risk.get("severity", "none"),
        },
        "pharmacogenomic_profile": {
            "primary_gene": pgx.get("primary_gene", ""),
            "diplotype": pgx.get("diplotype", "*1/*1"),
            "phenotype": pgx.get("phenotype", "Unknown"),
            "activity_score": pgx.get("activity_score", 2.0),
            "detected_variants": pgx.get("detected_variants", []),
            "quality_flags": pgx.get("quality_flags", []),
        },
        "clinical_recommendation": rec,
        "llm_generated_explanation": explanation,
        "quality_metrics": {
            "vcf_parsing_success": True,
        },
    }


async def _analyze_drug_from_profile(drug: str, genomic_profile: dict) -> dict:
    """
    Run the full engine + LLM pipeline for a single drug against an
    already-parsed genomic profile.  Used by both /analyze and /analyze/batch.
    """
    drug_upper = drug.strip().upper()
    engine_result = assess_drug_risk(drug_upper, genomic_profile)
    if "error" in engine_result:
        # Return a structured error entry instead of raising so batch doesn't abort
        return {"drug": drug_upper, "error": engine_result["error"]}

    pgx = engine_result.get("pharmacogenomic_profile", {})
    risk = engine_result.get("risk_assessment", {})
    rec = engine_result.get("clinical_recommendation", {})

    pathway = generate_pathway_steps(drug_upper, engine_result)

    try:
        explanation = generate_explanation(
            gene=pgx.get("primary_gene", ""),
            phenotype=pgx.get("phenotype", ""),
            drug=engine_result.get("drug", ""),
            diplotype=pgx.get("diplotype", "*1/*1"),
            activity_score=pgx.get("activity_score", 2.0),
            confidence_score=risk.get("confidence_score", 0.0),
            risk_label=risk.get("risk_label", "Unknown"),
            severity=risk.get("severity", "low"),
            recommendation=rec.get("recommendation", ""),
            detected_variants=pgx.get("detected_variants", []),
            quality_flags=pgx.get("quality_flags", []),
        )
    except Exception:
        gene_name = pgx.get('primary_gene', 'the relevant gene')
        diplotype_val = pgx.get('diplotype', '*1/*1')
        phenotype_val = pgx.get('phenotype', 'Unknown')
        risk_label_val = risk.get('risk_label', 'Unknown')
        cpic_rec = rec.get('recommendation', '')
        explanation = {
            "summary": (
                f"This patient carries the {diplotype_val} diplotype in {gene_name}, "
                f"corresponding to a {phenotype_val} Metabolizer phenotype. "
                f"Based on CPIC guidelines, the risk classification for this drug is '{risk_label_val}'. "
                + (cpic_rec if cpic_rec else "Consult the Clinical Recommendation section below for dosing guidance.")
            ),
            "variant_citations": [],
            "model": "llama-3.3-70b-versatile",
            "disclaimer": "AI narrative temporarily unavailable. Summary derived from CPIC deterministic data.",
        }

    return _build_response(engine_result=engine_result, pathway=pathway, explanation=explanation)


# ── /analyze/batch ─────────────────────────────────────────────────────────────


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    drugs: List[str] = Form(...),
):
    """
    Unified analysis endpoint: Upload VCF + one or more drug names.
    Accepts repeated form fields (drugs=CODEINE&drugs=WARFARIN)
    OR a single comma-separated value (drugs=CODEINE,WARFARIN).
    Runs all drugs in parallel against a single VCF parse.

    Body (multipart/form-data):
      file  — VCF or VCF.GZ
      drugs — repeated field per drug, or comma-separated string

    Response:
      { "results": [...], "total": N, "errors": [...] }
    """
    # ── Validate + parse file (once) ──
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if not file.filename.lower().endswith((".vcf", ".vcf.gz")):
        raise HTTPException(status_code=400, detail="File must be a .vcf file.")

    try:
        data = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    try:
        parsed = parse_vcf_bytes(data, filename=file.filename)
    except VCFFileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except VCFParseError as e:
        raise HTTPException(status_code=422, detail=f"VCF parse error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")

    genomic_profile = parsed["genomic_profile"]

    # ── Parse drug list ──
    # Support both repeated fields (drugs=A&drugs=B) and single comma-sep (drugs=A,B)
    drug_list: list[str] = []
    for entry in drugs:
        drug_list.extend([d.strip().upper() for d in entry.split(",") if d.strip()])
    drug_list = list(dict.fromkeys(drug_list))  # deduplicate, preserve order
    if not drug_list:
        raise HTTPException(status_code=400, detail="No drug names provided.")
    if len(drug_list) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 drugs per batch request.")

    # ── Run all drugs in parallel ──
    task_results = await asyncio.gather(
        *[_analyze_drug_from_profile(drug, genomic_profile) for drug in drug_list],
        return_exceptions=True,
    )

    results = []
    errors = []
    for drug, outcome in zip(drug_list, task_results):
        if isinstance(outcome, Exception):
            errors.append({"drug": drug, "error": str(outcome)})
        elif isinstance(outcome, dict) and "error" in outcome:
            errors.append(outcome)
        else:
            results.append(outcome)

    return {
        "results": results,
        "total": len(results),
        "errors": errors,
    }
