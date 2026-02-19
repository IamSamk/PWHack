"""
PharmaGuard API — FastAPI endpoints for pharmacogenomic analysis.

Endpoints:
  GET  /        → Service info
  GET  /drugs   → List available drugs (from CPIC rules)
  POST /analyze → Upload VCF + drug name → full risk assessment + LLM explanation
"""

import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.parser import parse_vcf_bytes, VCFParseError, VCFFileTooLargeError
from app.engine import assess_drug_risk, get_available_drugs
from app.llm_service import generate_explanation

app = FastAPI(
    title="PharmaGuard API",
    description="Precision Pharmacogenomic Risk Engine — CPIC-aligned drug safety analysis from VCF data.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "PharmaGuard",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "GET /drugs": "List available drugs",
            "POST /analyze": "Upload VCF file + drug name → risk assessment",
        },
    }


@app.get("/drugs")
def list_drugs():
    """List all drugs with CPIC rules available."""
    drugs = get_available_drugs()
    return {"available_drugs": drugs, "count": len(drugs)}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    drug: str = Form(...),
):
    """
    Single endpoint: Upload VCF file + drug name → full risk analysis.
    Returns the EXACT hackathon JSON schema:
      patient_id, drug, timestamp, risk_assessment, pharmacogenomic_profile,
      clinical_recommendation, llm_generated_explanation, quality_metrics
    """
    # ── Validate file ──
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")
    if not file.filename.lower().endswith((".vcf", ".vcf.gz")):
        raise HTTPException(status_code=400, detail="File must be a .vcf file.")

    # ── Parse VCF ──
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

    # ── Run risk engine ──
    engine_result = assess_drug_risk(drug, genomic_profile)
    if "error" in engine_result:
        raise HTTPException(status_code=404, detail=engine_result["error"])

    pgx = engine_result.get("pharmacogenomic_profile", {})
    risk = engine_result.get("risk_assessment", {})
    rec = engine_result.get("clinical_recommendation", {})

    # ── LLM explanation (mandatory) ──
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
                f"Explanation generation failed: {e}. "
                f"Patient carries {pgx.get('diplotype', 'unknown')} in "
                f"{pgx.get('primary_gene', 'unknown')}, classified as "
                f"{pgx.get('phenotype', 'unknown')} phenotype. "
                f"Risk: {risk.get('risk_label', 'unknown')}."
            ),
            "variant_citations": [],
            "model": "mistral:7b",
            "disclaimer": "Fallback explanation due to LLM error.",
        }

    # ── Build EXACT response schema ──
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
            "detected_variants": pgx.get("detected_variants", []),
        },
        "clinical_recommendation": rec,
        "llm_generated_explanation": explanation,
        "quality_metrics": {
            "vcf_parsing_success": True,
        },
    }
