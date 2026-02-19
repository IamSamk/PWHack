from app.parser import parse_vcf
from app.engine import get_risk_assessment

# Path to your demo VCF file
vcf_path = "backend/data/demo_patient_multi_gene.vcf"

# Step 1: Extract variants from the VCF
variants = parse_vcf(vcf_path)
print("Extracted variants:", variants)

# Step 2: Run risk assessment for a drug (example: clopidogrel)
assessment = get_risk_assessment("clopidogrel", variants)
print("Risk assessment for clopidogrel:", assessment)

# Step 3: Run risk assessment for another drug (example: codeine)
assessment2 = get_risk_assessment("codeine", variants)
print("Risk assessment for codeine:", assessment2)
