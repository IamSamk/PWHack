# PharmaGuard – Pharmacogenomic Risk Prediction System

**RIFT 2026 Hackathon Submission**  
Track: *Pharmacogenomics / Explainable AI*

PharmaGuard is a clinical-grade pharmacogenomic risk prediction system that interprets patient VCF files and generates CPIC-aligned drug dosing recommendations with explainable AI reasoning. The system transforms raw genomic variant data into structured clinical guidance suitable for precision medicine workflows.

---

# 1. Project Overview

PharmaGuard enables personalized medication recommendations by:

- Parsing **VCF v4.2 genomic files**
- Extracting pharmacogenomic variants
- Mapping **Diplotype → Phenotype → CPIC-aligned dosing**
- Generating structured JSON output
- Producing explainable clinical reasoning using LLMs
- Reporting quality validation metrics

Supported Genes:

- CYP2D6
- CYP2C19
- CYP2C9
- SLCO1B1
- TPMT
- DPYD

Supported Drugs:

- CODEINE
- WARFARIN
- CLOPIDOGREL
- SIMVASTATIN
- AZATHIOPRINE
- FLUOROURACIL

---

# 2. Problem Statement & Clinical Background

Adverse drug reactions (ADRs) are a leading cause of hospitalization and mortality. Many ADRs are directly linked to genetic variability in drug metabolism enzymes.

Examples:

- **CYP2D6 Poor Metabolizer + Codeine → Ineffective analgesia**
- **CYP2C9 + VKORC1 variants → Warfarin bleeding risk**
- **DPYD deficiency → Severe Fluorouracil toxicity**

Despite CPIC guidelines, clinical integration remains limited due to:

- Raw genomic complexity
- Lack of explainability
- Non-standardized outputs
- Integration challenges with EHR systems

PharmaGuard bridges this gap using structured rule engines and explainable AI.

---

# 3. Solution Overview

PharmaGuard implements a hybrid pipeline:

1. VCF ingestion & validation
2. Variant extraction for 6 target genes
3. Diplotype inference
4. Phenotype classification
5. CPIC rule matching
6. LLM-powered clinical explanation
7. Structured JSON generation
8. Quality scoring

The system ensures:

- Deterministic rule mapping
- Transparent explainability
- Clinical alignment with CPIC standards
- API-ready structured output

---

# 4. Key Features

- VCF v4.2 compliant parser
- CPIC-aligned dosing logic
- Multi-gene support
- Explainable AI reasoning engine
- Decision Trace Engine
- Clinical Confidence Index
- Structured JSON schema output
- Parsing validation metrics
- Frontend visualization dashboard
- Counterfactual explanation generation

---

# 5. System Architecture

## High-Level Architecture

[ Next.js Frontend ]
|
v
[ FastAPI Backend ]
|
|-- VCF Parser
|-- Diplotype Engine
|-- CPIC Rule Engine
|-- LLM Explanation Service
|-- Confidence Scorer
|
v
[ JSON Output Response ]


---

## Backend Components (FastAPI)

| Component | Description |
|------------|-------------|
| parser.py | Parses VCF file and extracts gene variants |
| engine.py | Diplotype → phenotype → recommendation mapping |
| llm_service.py | Generates explainable clinical reasoning |
| cpic_rules.json | CPIC guideline logic |
| guidelines.json | Structured rule definitions |
| extractor.py | Variant filtering utilities |

---

## Frontend (Next.js)

Components:

- `VCFUpload.tsx` – File uploader
- `DrugSelector.tsx` – Drug selection interface
- `RiskCard.tsx` – Displays recommendation
- `ExplanationPanel.tsx` – LLM reasoning output
- `JSONViewer.tsx` – Raw structured output
- `PipelineFlowchart.tsx` – System visualization
- `BurdenScoreCard.tsx` – Clinical burden scoring
- `CounterfactualCard.tsx` – What-if analysis

---

# 6. Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js (TypeScript, React) |
| Backend | FastAPI (Python) |
| Data Storage | JSON-based rules (No DB required) |
| LLM | OpenAI API |
| Deployment | Vercel (Frontend) + Render (Backend) |
| Testing | Pytest |

---

# 7. Installation Instructions (Local Setup)

## Clone Repository

bash
git clone https://github.com/your-repo/pharmaguard.git
cd PWHack-main

# 8. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 9. Start backend
uvicorn app.main:app --reload

# 10. Backend runs at 
http://127.0.0.1:8000

# 11. Frontend Setup
cd ../my-app
npm install
npm run dev

# 12. Frontend runs at
http://localhost:3000

# 13. Evironment variable
Create .env file in backend:
OPENAI_API_KEY=your_openai_api_key
MODEL_NAME=gpt-4
CONFIDENCE_THRESHOLD=0.75

# 14. API Documentation
Base URL
http://localhost:8000

# 15. JSON Output Schema (Hackathon Required Format)
{
  "patient_id": "string",
  "drug": "string",
  "gene": "string",
  "diplotype": "string",
  "phenotype": "string",
  "recommendation": "string",
  "cpic_guideline_reference": "string",
  "clinical_explanation": "string",
  "confidence_score": "float",
  "quality_metrics": {
    "vcf_valid": "boolean",
    "genes_detected": "integer",
    "coverage_quality": "string"
  }
}

# 16. fileformat=VCFv4.2
##source=PharmaGuardDemo
#CHROM POS ID REF ALT QUAL FILTER INFO FORMAT SAMPLE
10 96702032 rs3892097 C T . PASS . GT 1/1
22 42128945 rs9923231 C T . PASS . GT 0/1

# 17. Deployment Instructions
Backend (Render)
Create new Web Service
Connect GitHub repo
Set build command: pip install -r requirements.txt
Start command: uvicorn app.main:app --host 0.0.0.0 --port 10000

Frontend (vercel)
Set backend API URL in:
app/lib/api.ts

# 18. Demo Instructions
Open frontend
Upload demo VCF:
  sample_patient.vcf
  demo_patient_multi_gene.vcf
Select drug
  View:
  Risk card
  LLM explanation
  JSON output
  Clinical confidence index

# 19. Live Application

Frontend:
https://pharmaguard.vercel.app

Backend API:
https://pharmaguard-api.onrender.com

# 20. LinkedIn Demo Video

Video Walkthrough:
https://linkedin.com/in/your-profile/demo-video-link

# 21. Ethics & Safety
In-memory genomic processing only
No permanent storage
CPIC-aligned deterministic logic
Explainability-first system design
Clinical decision support — not replacement

# 22. Future Work
Expanded gene coverage
Multi-drug interaction modeling
Pharmacogenomic Passport export





