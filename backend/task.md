# PharmaGuard Backend — Implementation Task List

A modular build plan for the PharmaGuard pharmacogenomics analysis API. Follow phases in order; each phase depends on the one before it.

---

## Environment Setup

- [ ] Open terminal and run `python3.11 --version` to confirm Python 3.11 is available
- [ ] Navigate to your project root directory
- [ ] Run `python3.11 -m venv venv` to create the virtual environment
- [ ] Activate the virtual environment:
  - Mac/Linux: `source venv/bin/activate`
  - Windows: `venv\Scripts\activate`
- [ ] Confirm the venv is active (terminal prompt should show `(venv)`)
- [ ] Create a new file named `requirements.txt` in the project root
- [ ] Add the following lines to `requirements.txt`:
  ```
  fastapi
  uvicorn
  python-multipart
  pydantic
  openai
  vcfpy
  python-dotenv
  ```
- [ ] Run `pip install -r requirements.txt` and wait for all packages to install
- [ ] Create a `.env` file in the project root
- [ ] Add `OPENAI_API_KEY=sk-...` to `.env` with your actual key

---

## Project Structure

- [ ] Create a `data/` folder in the project root
- [ ] Create an `app/` folder in the project root
- [ ] Create an empty `app/__init__.py` file
- [ ] Create an empty `app/main.py` file
- [ ] Create an empty `app/parser.py` file
- [ ] Create an empty `app/engine.py` file
- [ ] Create an empty `app/llm_service.py` file
- [ ] Create an empty `data/guidelines.json` file

Final layout should look like:
```
pharmaguard-backend/
├── data/
│   └── guidelines.json
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── parser.py
│   ├── engine.py
│   └── llm_service.py
├── .env
└── requirements.txt
```

---

## Phase A — The Rulebook (`data/guidelines.json`)

> Stores CPIC gene-drug mappings. This is the source of truth for the entire pipeline.

### A1 — Gene: CYP2C19

- [ ] Open `data/guidelines.json` and create the top-level `"genes"` key as an empty object
- [ ] Add a `"CYP2C19"` key inside `"genes"`
- [ ] Inside `"CYP2C19"`, add a `"variants"` object
- [ ] Add rsID `"rs4244285"` inside `"variants"` with the following genotype-to-star-allele mappings:
  - `"GG"` → `"*1"`
  - `"AG"` → `"*2"`
  - `"AA"` → `"*2"`
- [ ] Add rsID `"rs12248560"` inside `"variants"` with:
  - `"CC"` → `"*1"`
  - `"CT"` → `"*17"`
  - `"TT"` → `"*17"`
- [ ] Inside `"CYP2C19"`, add a `"diplotypes"` object
- [ ] Add the following diplotype → phenotype mappings inside `"diplotypes"`:
  - `"*1/*1"` → `"Normal Metabolizer"`
  - `"*1/*2"` → `"Intermediate Metabolizer"`
  - `"*2/*2"` → `"Poor Metabolizer"`
  - `"*1/*17"` → `"Rapid Metabolizer"`
  - `"*17/*17"` → `"Ultrarapid Metabolizer"`

### A2 — Gene: CYP2D6

- [ ] Add a `"CYP2D6"` key inside `"genes"`
- [ ] Inside `"CYP2D6"`, add a `"variants"` object
- [ ] Add rsID `"rs3892097"` inside `"variants"` with:
  - `"GG"` → `"*1"`
  - `"AG"` → `"*4"`
  - `"AA"` → `"*4"`
- [ ] Inside `"CYP2D6"`, add a `"diplotypes"` object with:
  - `"*1/*1"` → `"Normal Metabolizer"`
  - `"*1/*4"` → `"Intermediate Metabolizer"`
  - `"*4/*4"` → `"Poor Metabolizer"`

### A3 — Drug: CLOPIDOGREL

- [ ] Add a top-level `"drug_risks"` key as an empty object
- [ ] Add `"CLOPIDOGREL"` inside `"drug_risks"`
- [ ] Add a `"Poor Metabolizer"` entry under `"CLOPIDOGREL"` with:
  - `"label"`: `"Ineffective"`
  - `"severity"`: `"high"`
  - `"rec"`: `"Use alternative antiplatelet agent such as prasugrel or ticagrelor."`
- [ ] Add an `"Intermediate Metabolizer"` entry with:
  - `"label"`: `"Reduced Efficacy"`
  - `"severity"`: `"moderate"`
  - `"rec"`: `"Consider alternative antiplatelet therapy."`
- [ ] Add a `"Normal Metabolizer"` entry with:
  - `"label"`: `"Safe"`
  - `"severity"`: `"none"`
  - `"rec"`: `"Standard dose. No adjustment required."`

### A4 — Drug: CODEINE

- [ ] Add `"CODEINE"` inside `"drug_risks"`
- [ ] Add a `"Poor Metabolizer"` entry under `"CODEINE"` with:
  - `"label"`: `"Ineffective"`
  - `"severity"`: `"high"`
  - `"rec"`: `"Avoid codeine. Use non-opioid alternatives."`
- [ ] Add an `"Ultrarapid Metabolizer"` entry with:
  - `"label"`: `"Toxic Risk"`
  - `"severity"`: `"high"`
  - `"rec"`: `"Avoid codeine. Risk of life-threatening opioid toxicity."`
- [ ] Add a `"Normal Metabolizer"` entry with:
  - `"label"`: `"Safe"`
  - `"severity"`: `"none"`
  - `"rec"`: `"Standard dose. No adjustment required."`

### A5 — Validate

- [ ] Run `python -m json.tool data/guidelines.json` and confirm no errors are printed
- [ ] Visually confirm both genes (`CYP2C19`, `CYP2D6`) appear under `"genes"`
- [ ] Visually confirm both drugs (`CLOPIDOGREL`, `CODEINE`) appear under `"drug_risks"`

---

## Phase B — The Eyes (`app/parser.py`)

> Reads a VCF file and extracts relevant variant genotypes.

### B1 — Imports & Setup

- [ ] Open `app/parser.py`
- [ ] Add `import vcfpy` at the top of the file

### B2 — Define the Function

- [ ] Define a function named `parse_vcf` that accepts one argument: `file_path`
- [ ] Inside `parse_vcf`, create a list called `target_rsids` containing:
  `"rs4244285"`, `"rs12248560"`, `"rs3892097"`
- [ ] Create an empty list called `found_variants`
- [ ] Open the VCF file using `vcfpy.Reader.from_path(file_path)`

### B3 — Iterate and Filter Records

- [ ] Write a `for` loop that iterates over each `record` in the reader
- [ ] Add an `if` condition: only process records where `record.ID` is not empty and `record.ID[0]` is in `target_rsids`
- [ ] Inside the condition, extract the raw genotype: `call = record.calls[0].data.get('GT')`
- [ ] Convert `call` to a string using `str(call)`
- [ ] Strip `/` characters from the string using `.replace("/", "")`
- [ ] Strip `|` characters from the string using `.replace("|", "")`
- [ ] Store the cleaned result in a variable called `genotype`

### B4 — Build the Output

- [ ] Append a dictionary to `found_variants` with two keys:
  - `"rsid"`: set to `record.ID[0]`
  - `"genotype"`: set to the cleaned `genotype` string
- [ ] After the loop ends, return `found_variants`

---

## Phase C — The Brain (`app/engine.py`)

> Maps detected variants to phenotypes and looks up drug risk from the rulebook.

### C1 — Imports & Setup

- [ ] Open `app/engine.py`
- [ ] Add `import json` at the top of the file

### C2 — Define the Function

- [ ] Define a function named `get_risk_assessment` that accepts two arguments: `drug_name` and `detected_variants`

### C3 — Load the Rulebook

- [ ] Inside the function, open `data/guidelines.json` using a `with open(...)` statement
- [ ] Parse the contents into a variable called `rules` using `json.load()`

### C4 — Set Defaults

- [ ] Set a variable `gene_found` to `"CYP2C19"`
- [ ] Set a variable `phenotype` to `"Normal Metabolizer"`
- [ ] Set a variable `star_allele` to `"*1"`

### C5 — Variant Mapping Loop

- [ ] Write a `for` loop that iterates over each item `v` in `detected_variants`
- [ ] Inside the loop, get the variant map for the gene: `variant_map = rules['genes'][gene_found]['variants']`
- [ ] Add an `if` check: only proceed if `v['rsid']` is a key in `variant_map`
- [ ] Look up the star allele: `star_allele = variant_map[v['rsid']].get(v['genotype'], "*1")`
- [ ] Build a diplotype string using an f-string: `diplotype = f"{star_allele}/*1"`
- [ ] Look up the phenotype: `phenotype = rules['genes'][gene_found]['diplotypes'].get(diplotype, "Normal Metabolizer")`

### C6 — Drug Risk Lookup

- [ ] Convert `drug_name` to uppercase: `drug_key = drug_name.upper()`
- [ ] Get the drug's risk table from `rules['drug_risks']` using `.get(drug_key, {})`
- [ ] Store the result in `drug_table`
- [ ] Look up the risk entry for the resolved phenotype using `.get(phenotype, {...})`
- [ ] Use the following as the fallback dict if the phenotype is not found:
  ```python
  {
      "label": "Unknown",
      "severity": "none",
      "rec": "No guideline found for this drug and phenotype."
  }
  ```
- [ ] Store the result in `risk_info`

### C7 — Return the Result

- [ ] Return a dictionary with three keys:
  - `"gene"`: set to `gene_found`
  - `"phenotype"`: set to `phenotype`
  - `"risk"`: set to `risk_info`

---

## Phase D — The Voice (`app/llm_service.py`)

> Uses OpenAI to generate a patient-readable clinical explanation.

### D1 — Imports & Client Setup

- [ ] Open `app/llm_service.py`
- [ ] Add `from openai import OpenAI` at the top
- [ ] Add `import os` at the top
- [ ] Add `from dotenv import load_dotenv` at the top
- [ ] Call `load_dotenv()` immediately after the imports so the `.env` file is read at startup
- [ ] Create the OpenAI client: `client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))`

### D2 — Define the Function

- [ ] Define a function named `generate_explanation` that accepts three arguments: `gene`, `phenotype`, `drug`

### D3 — Build the Prompt

- [ ] Inside the function, create a variable called `prompt` using an f-string:
  ```
  f"Explain why a {phenotype} for the {gene} gene should be careful taking {drug}. Use clinical terms but keep it brief (2-3 sentences)."
  ```

### D4 — Call the OpenAI API

- [ ] Call `client.chat.completions.create()` and store the result in `response`
- [ ] Set the `model` argument to `"gpt-3.5-turbo"`
- [ ] Set the `messages` argument to a list with one dict: `{"role": "user", "content": prompt}`

### D5 — Return the Output

- [ ] Extract the text from the response: `response.choices[0].message.content`
- [ ] Return that value from the function

---

## Phase E — The API (`app/main.py`)

> Wires all modules together into a single HTTP endpoint.

### E1 — Imports

- [ ] Open `app/main.py`
- [ ] Add the following imports:
  ```python
  from fastapi import FastAPI, UploadFile, File, Form
  from .parser import parse_vcf
  from .engine import get_risk_assessment
  from .llm_service import generate_explanation
  import shutil
  import os
  ```

### E2 — Initialize the App

- [ ] Create the FastAPI instance: `app = FastAPI()`

### E3 — Define the Endpoint

- [ ] Add the decorator `@app.post("/analyze")` above the function
- [ ] Define an `async` function named `analyze_vcf`
- [ ] Add two parameters to the function:
  - `drug: str = Form(...)`
  - `file: UploadFile = File(...)`

### E4 — Save the Uploaded File

- [ ] Build a temp file path string: `temp_path = f"temp_{file.filename}"`
- [ ] Open the temp file in write-binary (`"wb"`) mode using a `with open(temp_path, "wb") as buffer` block
- [ ] Inside the block, call `shutil.copyfileobj(file.file, buffer)` to write the uploaded content

### E5 — Run the Pipeline

- [ ] Call `parse_vcf(temp_path)` and store the result in `variants`
- [ ] Call `get_risk_assessment(drug, variants)` and store the result in `assessment`
- [ ] Call `generate_explanation(assessment['gene'], assessment['phenotype'], drug)` and store the result in `explanation`

### E6 — Clean Up the Temp File

- [ ] Call `os.remove(temp_path)` to delete the temporary file after the pipeline finishes

### E7 — Build and Return the Response

- [ ] Return a dictionary with the following exact structure:
  ```python
  {
      "patient_id": "PATIENT_001",
      "drug": drug.upper(),
      "risk_assessment": {
          "risk_label": assessment['risk']['label'],
          "severity": assessment['risk']['severity']
      },
      "pharmacogenomic_profile": {
          "primary_gene": assessment['gene'],
          "phenotype": assessment['phenotype']
      },
      "llm_generated_explanation": {
          "summary": explanation
      }
  }
  ```

### E8 — Start the Server

- [ ] Run from the project root: `uvicorn app.main:app --reload`
- [ ] Confirm the terminal shows `Uvicorn running on http://127.0.0.1:8000`
- [ ] Open `http://127.0.0.1:8000/docs` in a browser to verify the auto-generated Swagger UI loads

---

## Completion Checklist

| Phase | File | Done |
|---|---|---|
| A — Rulebook | `data/guidelines.json` | ☐ |
| B — Parser | `app/parser.py` | ☐ |
| C — Engine | `app/engine.py` | ☐ |
| D — LLM Service | `app/llm_service.py` | ☐ |
| E — API | `app/main.py` | ☐ |
| Server Running | `uvicorn app.main:app` | ☐ |