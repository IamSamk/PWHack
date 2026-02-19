from app.parser import parse_vcf
from app.engine import get_risk_assessment

# Path to the new sample VCF file
vcf_path = "backend/data/sample_patient.vcf"

# Step 1: Extract variants from the VCF
variants = parse_vcf(vcf_path)
print("Extracted variants:", variants)

# Step 2: Run risk assessment for clopidogrel
assessment = get_risk_assessment("clopidogrel", variants)
print("Risk assessment for clopidogrel:", assessment)

# Step 3: Run risk assessment for codeine
assessment2 = get_risk_assessment("codeine", variants)
print("Risk assessment for codeine:", assessment2)
