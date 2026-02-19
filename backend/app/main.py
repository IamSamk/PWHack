"""
PharmaGuard API — FastAPI endpoints for pharmacogenomic analysis.

Endpoints:
  GET  /                          → Service info
  GET  /drugs                     → List available drugs
  GET  /drug/{drug_name}          → Drug rule details
  POST /upload-vcf                → Upload VCF, get session + profile
  GET  /session/{session_id}      → Retrieve stored genomic profile
  POST /analyze                   → Single drug risk assessment
  POST /analyze-batch             → Batch drug assessment + PBS
  GET  /session/{sid}/burden      → Pharmacogenomic Burden Score
  POST /counterfactual            → What-if phenotype simulation
  GET  /ui                        → Legacy HTML template UI
"""

import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Any

from fastapi import FastAPI, UploadFile, File, Form, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path

from app.parser import parse_vcf_file, parse_vcf_bytes, VCFParseError, VCFFileTooLargeError
from app.engine import (
    assess_drug_risk,
    batch_drug_assessment,
    compute_pharmacogenomic_burden_score,
    counterfactual_simulation,
    get_available_drugs,
    get_drug_info,
)
from app.llm_service import generate_explanation

BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

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
            "GET /drug/{drug_name}": "Get drug rule details",
            "POST /counterfactual": "Run counterfactual simulation",
            "GET /session/{session_id}": "Get stored genomic profile",
            "GET /session/{session_id}/burden": "Get PBS for a patient",
            "GET /ui": "Legacy HTML interface",
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


@app.get("/drug/{drug_name}")
def drug_details(drug_name: str):
    """Get CPIC rule details for a specific drug."""
    info = get_drug_info(drug_name)
    if not info:
        raise HTTPException(
            status_code=404,
            detail=f"Drug '{drug_name}' not found. Use GET /drugs for available drugs."
        )
    return {
        "drug": drug_name.upper(),
        "primary_gene": info["primary_gene"],
        "phenotype_rules": info["phenotype_rules"],
    }


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
        "source_file": result["source_file"],
        "genomic_profile": result["genomic_profile"],
        "vcf_meta": {
            "format": result["vcf_format"],
            "sample_ids": result["sample_ids"],
            "total_variants": result["total_variants_in_file"],
            "pharmacogene_variants_detected": result["pharmacogene_variants_detected"],
        },
        "analysis_history": [],
    }

    return {
        "session_id": session_id,
        "message": "VCF uploaded and parsed successfully.",
        "source_file": result["source_file"],
        "total_variants": result["total_variants_in_file"],
        "pharmacogene_variants_detected": result["pharmacogene_variants_detected"],
        "genomic_profile": result["genomic_profile"],
    }


@app.get("/session/{session_id}")
def get_session(session_id: str):
    """Retrieve stored genomic profile for a session."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a VCF first.")
    return session


# ──────────────────────────────────────────────
# Drug Risk Analysis
# ──────────────────────────────────────────────

@app.post("/analyze")
async def analyze_drug(
    session_id: str = Query(..., description="Session ID from /upload-vcf"),
    drug: str = Query(..., description="Drug name to analyze"),
    include_explanation: bool = Query(default=False, description="Include LLM explanation"),
):
    """Analyze a single drug against the patient's genomic profile."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a VCF first.")

    genomic_profile = session["genomic_profile"]
    result = assess_drug_risk(drug, genomic_profile)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    result["patient_id"] = session_id
    result["analysis_timestamp"] = datetime.now(timezone.utc).isoformat()

    # Optional LLM explanation
    if include_explanation:
        try:
            pgx = result.get("pharmacogenomic_profile", {})
            explanation = generate_explanation(
                pgx.get("primary_gene", ""),
                pgx.get("phenotype", ""),
                result.get("drug", ""),
            )
            result["llm_generated_explanation"] = {
                "text": explanation,
                "model": "gemma3:4b",
                "disclaimer": "AI-generated explanation. Not a substitute for clinical judgment.",
            }
        except Exception as e:
            result["llm_generated_explanation"] = {
                "text": f"Explanation unavailable: {str(e)}",
                "model": "gemma3:4b",
                "disclaimer": "Error generating explanation.",
            }

    # Log to session history
    session["analysis_history"].append({
        "drug": drug.upper(),
        "risk_label": result.get("risk_assessment", {}).get("risk_label"),
        "timestamp": result["analysis_timestamp"],
    })

    return result


@app.post("/analyze-batch")
async def analyze_batch(
    session_id: str = Query(..., description="Session ID from /upload-vcf"),
    drugs: str = Query(
        default="",
        description="Comma-separated drug names. Empty = analyze all available drugs."
    ),
):
    """Analyze multiple drugs at once. Returns all assessments + PBS."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a VCF first.")

    genomic_profile = session["genomic_profile"]

    drug_list = None
    if drugs.strip():
        drug_list = [d.strip() for d in drugs.split(",") if d.strip()]

    result = batch_drug_assessment(genomic_profile, drug_list)
    result["patient_id"] = session_id
    result["analysis_timestamp"] = datetime.now(timezone.utc).isoformat()

    return result


# ──────────────────────────────────────────────
# Pharmacogenomic Burden Score
# ──────────────────────────────────────────────

@app.get("/session/{session_id}/burden")
def get_burden_score(
    session_id: str,
    drugs: str = Query(
        default="",
        description="Comma-separated drug names. Empty = all drugs."
    ),
):
    """Compute Pharmacogenomic Burden Score for a patient."""
    session = _sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    genomic_profile = session["genomic_profile"]

    drug_list = None
    if drugs.strip():
        drug_list = [d.strip() for d in drugs.split(",") if d.strip()]

    pbs = compute_pharmacogenomic_burden_score(genomic_profile, drug_list)
    pbs["patient_id"] = session_id

    return pbs


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


# ──────────────────────────────────────────────
# Legacy HTML UI (kept for backward compatibility)
# ──────────────────────────────────────────────

@app.api_route("/ui", methods=["GET", "POST"], response_class=HTMLResponse)
async def ui_page(request: Request):
    """Legacy HTML form UI — upload VCF + select drug → see result."""
    result = None
    if request.method == "POST":
        form = await request.form()
        drug = form.get("drug")
        file = form.get("file")
        if file and drug:
            temp_path = f"temp_{file.filename}"
            try:
                with open(temp_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
                parsed = parse_vcf_file(temp_path)
                genomic_profile = parsed["genomic_profile"]
                assessment = assess_drug_risk(str(drug), genomic_profile)

                # Get primary gene info for LLM
                pgx = assessment.get("pharmacogenomic_profile", {})
                explanation = generate_explanation(
                    pgx.get("primary_gene", ""),
                    pgx.get("phenotype", ""),
                    str(drug),
                )

                risk = assessment.get("risk_assessment", {})
                rec = assessment.get("clinical_recommendation", {})

                result = {
                    "patient_id": "PATIENT_001",
                    "drug": str(drug).upper(),
                    "risk_label": risk.get("risk_label", "Unknown"),
                    "severity": risk.get("severity", "low"),
                    "primary_gene": pgx.get("primary_gene", ""),
                    "phenotype": pgx.get("phenotype", ""),
                    "diplotype": pgx.get("diplotype", ""),
                    "activity_score": pgx.get("activity_score", 0),
                    "recommendation": rec.get("recommendation", ""),
                    "llm_explanation": explanation,
                }
            except Exception as e:
                result = {"error": str(e)}
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)

    return templates.TemplateResponse("index.html", {"request": request, "result": result})
