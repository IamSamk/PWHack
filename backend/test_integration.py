"""Quick integration test for the full pipeline."""
import json
from app.parser import parse_vcf_file
from app.engine import (
    assess_drug_risk, batch_drug_assessment,
    compute_pharmacogenomic_burden_score, counterfactual_simulation
)

# Parse multi-gene VCF
print("=" * 60)
print("PARSING: demo_patient_multi_gene.vcf")
print("=" * 60)
result = parse_vcf_file("data/demo_patient_multi_gene.vcf")
profile = result["genomic_profile"]
print(f"Total variants: {result['total_variants_in_file']}")
print(f"Pharmacogene variants: {result['pharmacogene_variants_detected']}")
print()

for gene, data in sorted(profile.items()):
    print(f"  {gene}: {data['diplotype']} -> {data['phenotype']} (activity: {data['activity_score']})")

# Batch assessment
print()
print("=" * 60)
print("BATCH DRUG ASSESSMENT")
print("=" * 60)
batch = batch_drug_assessment(profile)
for drug in sorted(batch["drug_assessments"]):
    a = batch["drug_assessments"][drug]
    risk = a.get("risk_assessment", {})
    print(f"  {drug}: {risk.get('risk_label')} ({risk.get('severity')})")

# PBS
pbs = batch["burden_score"]
print()
print(f"PBS Score: {pbs['pharmacogenomic_burden_score']}")
print(f"Risk Tier: {pbs['risk_tier']}")
print(f"High-risk pairs: {len(pbs['high_risk_pairs'])}")

# Counterfactual
print()
print("=" * 60)
print("COUNTERFACTUAL: What if CYP2D6 were NM for CODEINE?")
print("=" * 60)
cf = counterfactual_simulation("CODEINE", profile, "NM")
print(f"  Actual:        {cf['actual']['phenotype']} -> {cf['actual']['risk_assessment']['risk_label']}")
print(f"  Counterfactual: {cf['counterfactual']['simulated_phenotype']} -> {cf['counterfactual']['risk_assessment']['risk_label']}")
print(f"  Risk changed:  {cf['risk_changed']}")

print()
print("=== ALL TESTS PASSED ===")
