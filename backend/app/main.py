

from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from .parser import parse_vcf
from .engine import get_risk_assessment
from .llm_service import generate_explanation
import shutil
import os
from pathlib import Path

# Get the templates directory relative to this file
BASE_DIR = Path(__file__).resolve().parent.parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))


app = FastAPI()


# Serve a single page for both upload and result
@app.api_route("/", methods=["GET", "POST"], response_class=HTMLResponse)
async def index(request: Request):
	result = None
	if request.method == "POST":
		form = await request.form()
		drug = form.get("drug")
		file = form.get("file")
		if file and drug:
			temp_path = f"temp_{file.filename}"
			with open(temp_path, "wb") as buffer:
				shutil.copyfileobj(file.file, buffer)
			variants = parse_vcf(temp_path)
			assessment = get_risk_assessment(drug, variants)
			explanation = generate_explanation(assessment['gene'], assessment['phenotype'], drug)
			os.remove(temp_path)
			result = {
				"patient_id": "PATIENT_001",
				"drug": drug.upper(),
				"risk_label": assessment['risk']['label'],
				"severity": assessment['risk']['severity'],
				"primary_gene": assessment['gene'],
				"phenotype": assessment['phenotype'],
				"recommendation": assessment['risk']['rec'],
				"llm_explanation": explanation
			}
	return templates.TemplateResponse("index.html", {"request": request, "result": result})
