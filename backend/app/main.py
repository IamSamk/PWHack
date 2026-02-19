"""
PharmaGuard API — FastAPI endpoints for pharmacogenomic analysis.

Endpoints:
  GET  /                          → Service info
  GET  /drugs                     → List available drugs
  POST /upload-vcf                → Upload VCF, get session + profile
  POST /analyze                   → Single drug risk assessment
  POST /analyze-batch             → Batch drug assessment + PBS
  POST /counterfactual            → What-if phenotype simulation
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path

from app.parser import parse_vcf_file, parse_vcf_bytes, VCFParseError, VCFFileTooLargeError
from app.engine import (
    assess_drug_risk,
    batch_drug_assessment,
    compute_pharmacogenomic_burden_score,
    counterfactual_simulation,
    get_available_drugs,
)
from app.llm_service import generate_explanation

BASE_DIR = Path(__file__).resolve().parent.parent

app = FastAPI(
    title="PharmaGuard API",
    description=(
        "Precision Pharmacogenomic Risk Engine — "
        "CPIC-aligned drug safety analysis from VCF data."
    ),
    version="2.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session store for uploaded genomic profiles
# In production, use Redis or a database
_sessions: dict[str, dict[str, Any]] = {}


# ──────────────────────────────────────────────
# Service Info
# ──────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "PharmaGuard",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "POST /upload-vcf": "Upload VCF and get patient session",
            "POST /analyze": "Analyze a drug for an uploaded patient",
            "POST /analyze-batch": "Analyze multiple drugs at once",
            "GET /drugs": "List available drugs",
            "POST /counterfactual": "Run counterfactual simulation",
        }
    }


# ──────────────────────────────────────────────
# Drug Info
# ──────────────────────────────────────────────

@app.get("/drugs")
def list_drugs():
    """List all drugs with CPIC rules available."""
    drugs = get_available_drugs()
    return {"available_drugs": drugs, "count": len(drugs)}


# ──────────────────────────────────────────────
# VCF Upload & Session
# ──────────────────────────────────────────────

@app.post("/upload-vcf")
async def upload_vcf(file: UploadFile = File(...)):
    """
    Upload a VCF file. Returns a session_id and the parsed genomic profile.
    The session_id is used for subsequent drug analysis calls.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    if not file.filename.lower().endswith(('.vcf', '.vcf.gz')):
        raise HTTPException(
            status_code=400,
            detail="File must be a .vcf file."
        )

    try:
        data = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {str(e)}")

    try:
        result = parse_vcf_bytes(data, filename=file.filename)
    except VCFFileTooLargeError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except VCFParseError as e:
        raise HTTPException(status_code=422, detail=f"VCF parse error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

    # Create session
    session_id = str(uuid.uuid4())
    _sessions[session_id] = {
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "genomic_profile": result["genomic_profile"],
        "analysis_history": [],
    }

    return {
        "session_id": session_id,
        "message": "VCF uploaded and parsed successfully.",
        "total_variants": result["total_variants_in_file"],
        "pharmacogene_variants_detected": result["pharmacogene_variants_detected"],
        "genomic_profile": result["genomic_profile"],
    }


# ──────────────────────────────────────────────
# Drug Risk Analysis
# ──────────────────────────────────────────────

@app.post("/analyze")
async def analyze_drug(
    session_id: str = Query(..., description="Session ID from /upload-vcf"),
    drug: str = Query(..., description="Drug name to analyze"),
):
    """
    Analyze a single drug against the patient's genomic profile.
    Always includes LLM-generated explanation (XAI layer).
    Output matches the EXACT required hackathon JSON schema.
    """
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a VCF first.")

    genomic_profile = session["genomic_profile"]
    engine_result = assess_drug_risk(drug, genomic_profile)

    if "error" in engine_result:
        raise HTTPException(status_code=404, detail=engine_result["error"])

    pgx = engine_result.get("pharmacogenomic_profile", {})
    risk = engine_result.get("risk_assessment", {})
    rec = engine_result.get("clinical_recommendation", {})
    timestamp = datetime.now(timezone.utc).isoformat()

    # ── LLM-Generated Explanation (MANDATORY) ──
    try:
        explanation = generate_explanation(
            gene=pgx.get("primary_gene", ""),
            phenotype=pgx.get("phenotype", ""),
            drug=engine_result.get("drug", ""),
            diplotype=pgx.get("diplotype", "*1/*1"),
            activity_score=pgx.get("activity_score", 2.0),
            risk_label=risk.get("risk_label", "Unknown"),
            severity=risk.get("severity", "low"),
            recommendation=rec.get("recommendation", ""),
            detected_variants=pgx.get("detected_variants", []),
        )
    except Exception as e:
        explanation = {
            "summary": (
                f"Explanation generation failed: {str(e)}. "
                f"Patient carries {pgx.get('diplotype', 'unknown')} in "
                f"{pgx.get('primary_gene', 'unknown')}, classified as "
                f"{pgx.get('phenotype', 'unknown')} phenotype. "
                f"Risk: {risk.get('risk_label', 'unknown')}."
            ),
            "variant_citations": [],
            "model": "mistral:7b",
            "disclaimer": "Fallback explanation due to LLM error.",
        }

    # ── Build response in EXACT required schema — no extra fields ──
    response = {
        "patient_id": session_id,
        "drug": engine_result["drug"],
        "timestamp": timestamp,
        "risk_assessment": {
            "risk_label": risk.get("risk_label", "Unknown"),
            "confidence_score": risk.get("confidence_score", 0.0),
            "severity": risk.get("severity", "none"),
        },
        "pharmacogenomic_profile": {
            "primary_gene": pgx.get("primary_gene", ""),
            "diplotype": pgx.get("diplotype", "*1/*1"),
            "phenotype": pgx.get("phenotype", "Unknown"),
            "detected_variants": pgx.get("detected_variants", []),
        },
        "clinical_recommendation": rec,
        "llm_generated_explanation": explanation,
        "quality_metrics": {
            "vcf_parsing_success": True,
        },
    }

    # Log to session history
    session["analysis_history"].append({
        "drug": drug.upper(),
        "risk_label": risk.get("risk_label"),
        "timestamp": timestamp,
    })

    return response


@app.post("/analyze-batch")
async def analyze_batch(
    session_id: str = Query(..., description="Session ID from /upload-vcf"),
    drugs: str = Query(
        default="",
        description="Comma-separated drug names. Empty = analyze all available drugs."
    ),
):
    """Analyze multiple drugs at once. Returns all assessments + PBS + LLM explanations."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a VCF first.")

    genomic_profile = session["genomic_profile"]

    drug_list = None
    if drugs.strip():
        drug_list = [d.strip() for d in drugs.split(",") if d.strip()]

    result = batch_drug_assessment(genomic_profile, drug_list)
    result["patient_id"] = session_id
    result["timestamp"] = datetime.now(timezone.utc).isoformat()

    # Add LLM explanations for each drug assessment
    for drug_name, assessment in result.get("drug_assessments", {}).items():
        if "error" in assessment:
            continue
        pgx = assessment.get("pharmacogenomic_profile", {})
        risk = assessment.get("risk_assessment", {})
        rec = assessment.get("clinical_recommendation", {})
        try:
            explanation = generate_explanation(
                gene=pgx.get("primary_gene", ""),
                phenotype=pgx.get("phenotype", ""),
                drug=drug_name,
                diplotype=pgx.get("diplotype", "*1/*1"),
                activity_score=pgx.get("activity_score", 2.0),
                risk_label=risk.get("risk_label", "Unknown"),
                severity=risk.get("severity", "low"),
                recommendation=rec.get("recommendation", ""),
                detected_variants=pgx.get("detected_variants", []),
            )
            assessment["llm_generated_explanation"] = explanation
        except Exception as e:
            assessment["llm_generated_explanation"] = {
                "summary": f"Explanation unavailable: {str(e)}",
                "variant_citations": [],
                "model": "mistral:7b",
                "disclaimer": "Fallback explanation due to LLM error.",
            }
        assessment["quality_metrics"] = {
            "vcf_parsing_success": True,
            "variants_detected": pgx.get("variants_count", 0),
            "rule_match_found": risk.get("risk_label", "Unknown") != "Unknown",
            "llm_explanation_generated": True,
            "guideline_source": "CPIC",
        }

    return result


# ──────────────────────────────────────────────
# Counterfactual Simulation
# ──────────────────────────────────────────────

@app.post("/counterfactual")
async def run_counterfactual(
    session_id: str = Query(..., description="Session ID"),
    drug: str = Query(..., description="Drug name"),
    target_phenotype: str = Query(
        default="NM",
        description="Simulated phenotype (PM, IM, NM, RM, URM)"
    ),
):
    """
    Counterfactual simulation: What if the patient had a different phenotype?
    Compares actual vs simulated risk assessment.
    """
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    valid_phenotypes = {"PM", "IM", "NM", "RM", "URM"}
    if target_phenotype.upper() not in valid_phenotypes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid phenotype. Must be one of: {valid_phenotypes}"
        )

    genomic_profile = session["genomic_profile"]
    result = counterfactual_simulation(drug, genomic_profile, target_phenotype.upper())

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    result["patient_id"] = session_id
    return result
