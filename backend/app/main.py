"""
PharmaGuard API

POST /analyze        -> Single drug analysis (backward-compatible)
POST /analyze/batch  -> Multiple drugs in one request (comma-separated or list)
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
    title="PharmaGuard API",
    description="Precision Pharmacogenomic Risk Engine — CPIC-aligned drug safety analysis from VCF data.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    drug: str = Form(...),
):
    """
    Single drug analysis.  Upload VCF + one drug name.
    Returns the canonical hackathon JSON schema.
    """
    # ── Validate + parse file ──
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

    result = await _analyze_drug_from_profile(drug, genomic_profile)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


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
        "pathway": pathway,
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
    except Exception as e:
        explanation = {
            "summary": (
                f"Patient carries {pgx.get('diplotype', 'unknown')} in "
                f"{pgx.get('primary_gene', 'unknown')}, classified as "
                f"{pgx.get('phenotype', 'unknown')} phenotype. "
                f"Risk: {risk.get('risk_label', 'unknown')}. "
                f"[LLM unavailable: {e}]"
            ),
            "variant_citations": [],
            "model": "llama-3.3-70b-versatile",
            "disclaimer": "Fallback explanation due to LLM error.",
        }

    return _build_response(engine_result=engine_result, pathway=pathway, explanation=explanation)


# ── /analyze/batch ─────────────────────────────────────────────────────────────


@app.post("/analyze/batch")
async def analyze_batch(
    file: UploadFile = File(...),
    drugs: List[str] = Form(...),
):
    """
    Batch endpoint: Upload VCF once + list of drug names.
    Accepts repeated form fields OR a single comma-separated value.
    Runs all drugs in parallel; returns array of results.

    Body (multipart/form-data):
      file  — VCF or VCF.GZ
      drugs — one field per drug, e.g. drugs=CODEINE&drugs=WARFARIN
               OR single comma-separated: drugs=CODEINE,WARFARIN

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
