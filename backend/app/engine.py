import json
from pathlib import Path

def get_risk_assessment(drug_name, detected_variants):
	BASE_DIR = Path(__file__).resolve().parent.parent
	guidelines_path = BASE_DIR / "data" / "guidelines.json"
	with open(guidelines_path) as f:
		rules = json.load(f)
	gene_found = "CYP2C19"
	phenotype = "Normal Metabolizer"
	star_allele = "*1"
	for v in detected_variants:
		variant_map = rules['genes'][gene_found]['variants']
		if v['rsid'] in variant_map:
			star_allele = variant_map[v['rsid']].get(v['genotype'], "*1")
			diplotype = f"{star_allele}/*1"
			phenotype = rules['genes'][gene_found]['diplotypes'].get(diplotype, "Normal Metabolizer")
	drug_key = drug_name.upper()
	drug_table = rules['drug_risks'].get(drug_key, {})
	risk_info = drug_table.get(phenotype, {
		"label": "Unknown",
		"severity": "none",
		"rec": "No guideline found for this drug and phenotype."
	})
	return {
		"gene": gene_found,
		"phenotype": phenotype,
		"risk": risk_info
	}
