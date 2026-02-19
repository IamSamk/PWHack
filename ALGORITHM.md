# PharmaGuard Algorithm — Technical Reference

## Overview

PharmaGuard is a four-layer pharmacogenomic decision support system built for the RIFT 2026 Hackathon. It transforms raw genomic variant data (VCF format) into drug-specific risk assessments by traversing a pipeline of parsing, variant extraction, star allele inference, phenotype assignment, CPIC rule matching, and LLM-generated explanation.

---

## 1. Biological Foundation

### 1.1 What is Pharmacogenomics?

Pharmacogenomics studies how genetic variation affects drug response. The central premise is that enzymes responsible for drug metabolism — primarily cytochrome P450 (CYP) proteins plus transporters and other enzymes — have polymorphic genes. Patients carrying non-functional or reduced-function alleles metabolize drugs differently, leading to toxicity (drug accumulates) or inefficacy (drug is converted too quickly or too slowly to its active form).

### 1.2 Pharmacogenes Covered

| Drug | Primary Gene | Biological Role | Pathway |
|---|---|---|---|
| CODEINE | CYP2D6 | Converts codeine (prodrug) → morphine via O-demethylation | Opioid analgesia |
| WARFARIN | CYP2C9 + VKORC1 | CYP2C9 hydroxylates S-warfarin (major route); VKORC1 is the target enzyme | Anticoagulation |
| CLOPIDOGREL | CYP2C19 | Two-step bioactivation via CYP2C19 → active thiol metabolite | Antiplatelet therapy |
| SIMVASTATIN | SLCO1B1 | OATP1B1 transporter controls hepatic uptake (not CYP2 metabolism) | Statin myopathy risk |
| AZATHIOPRINE | TPMT | Thiopurine methyltransferase inactivates toxic thioguanine nucleotides | Immunosuppression |
| FLUOROURACIL | DPYD | Dihydropyrimidine dehydrogenase catabolizes 5-FU before it reaches target | Chemotherapy toxicity |

### 1.3 CYP2D6 (CODEINE)

CYP2D6 is highly polymorphic with over 100 star alleles. The gene sits on chromosome 22q13.2 and exhibits:
- **Copy Number Variation (CNV)**: gene duplications yield ultra-rapid metabolizers (URM)
- **Complete deletions**: *5 allele causes poor metabolizer (PM)
- **Splice defects**: *3 (2549delA frameshift), *4 (1846G>A splice site)
- **Missense variants**: *10 (100C>T, Pro34Ser – reduced stability), *17 (1023C>T, Thr107Ile – reduced activity)

**Biology**: Codeine itself is pharmacologically inert. CYP2D6–mediated O-demethylation at the 3-position generates morphine, which binds µ-opioid receptors to produce analgesia. PMs cannot produce morphine → therapeutic failure. URMs produce excess morphine rapidly → respiratory depression, death (documented in neonates of URM nursing mothers).

**Weakness**: CYP2D6 is the most polymorphic pharmacogene. The current implementation infers diplotype from VCF SNPs but does not handle:
- Short tandem repeats affecting copy number
- Rare structural variants not in the CPIC-curated SNP panel
- Combinations where both alleles have partial function without a clear star allele match (intermediate star alleles)
- Phase ambiguity: SNPs on unknown haplotypes may be attributed to the wrong allele

### 1.4 CYP2C9 + VKORC1 (WARFARIN)

Warfarin maintenance dose can vary 20-fold between patients. Two genes are critical:

**CYP2C9** (chromosome 10q24):
- *2 (430C>T, Arg144Cys): 30% of normal CYP2C9 activity
- *3 (1075A>C, Ile359Leu): 5% of normal activity — critical variant
- *5, *6, *8, *11: predominantly in African populations; frequently missed in algorithms trained on European cohorts

**VKORC1** (chromosome 16p11.2):
- *3 (−1639G>A promoter SNP, rs9923231): reduces VKORC1 expression → greater warfarin sensitivity at lower doses
- Haplotype A (low expression) vs Haplotype B (normal expression)

**Weakness**: VKORC1 is coded in our system but the diplotype inference does not factor VKORC1 into a combined recommendation. The CPIC warfarin guideline uses a dose-prediction algorithm combining CYP2C9 + VKORC1 + CYP4F2 + patient weight/age. Our system simplifies to CYP2C9 phenotype → risk label without this multi-gene pharmacokinetic model. This is a deliberate simplification but reduces precision.

### 1.5 CYP2C19 (CLOPIDOGREL)

CYP2C19 converts clopidogrel to its active thiol metabolite in a two-step process:
1. **Step 1**: Intestinal/hepatic CYP2C19 oxidizes clopidogrel to 2-oxo-clopidogrel
2. **Step 2**: Further oxidation yields the active antiplatelet compound

Key alleles:
- **Loss-of-function (LOF)**: *2 (681G>A, splice defect — most common), *3 (rare, ~East Asian). PMs carry two LOF alleles → no active metabolite → stent thrombosis risk
- **Gain-of-function (GOF)**: *17 (−806C>T promoter, increased transcription) → rapid metabolizer → higher bleeding risk
- **Intermediate**: one LOF + one normal allele

**Biology**: Roughly 30% of East Asians and 2-15% of Europeans carry *2 in homozygous form. The FDA issued a boxed warning for clopidogrel in CYP2C19 PMs.

**Weakness**: The *17 GOF phenotype (rapid metabolizer) is important but infrequently discussed. We do assign RM correctly but the clinical recommendation does not differentiate between *17/*17 (URM) vs *1/*17 (RM) in terms of bleeding risk stratification.

### 1.6 SLCO1B1 (SIMVASTATIN)

SLCO1B1 encodes OATP1B1 (Organic Anion Transporting Polypeptide 1B1), a hepatic uptake transporter. Unlike the drugs above, the issue here is not CYP-mediated metabolism but impaired hepatic clearance of statins:

- **rs4149056 (c.521T>C, Val174Ala, *5 allele)**: Reduces OATP1B1 transport activity → simvastatin acid accumulates in plasma → myopathy risk (including rhabdomyolysis)
- **Haplotype *15** carries both rs4149056 and rs2306283: further reduced function

**Biology**: Patients carrying *5 (or *15) on one or both alleles have plasma simvastatin acid AUC 2-4× higher than normal, strongly associated with statin-induced myopathy/rhabdomyolysis documented in the SEARCH trial (homozygous *5: 18× risk vs normal).

**Weakness**: SLCO1B1 is not in the CYP family, meaning:
- Its diplotype is not a "star allele" system in the same sense; CPIC assigns function based on specific variant combinations
- Our star allele inference logic was primarily designed for CYP genes; SLCO1B1 requires rs4149056 lookup specifically
- The gene does not cover rosuvastatin (ABCG2), atorvastatin (no major transporter gene currently), or pravastatin

### 1.7 TPMT (AZATHIOPRINE)

Thiopurine methyltransferase inactivates 6-mercaptopurine (6-MP), an active metabolite of azathioprine, by converting it to 6-methylmercaptopurine (6-MMP). Without adequate TPMT activity, 6-MP accumulates into cytotoxic 6-thioguanine nucleotides (6-TGN):

- **TPMT*2** (238G>C, Ala80Pro): nonfunctional
- **TPMT*3A** (460G>A + 719A>G): most common low-activity allele in Europeans (~4%)
- **TPMT*3C** (719A>G only): most common in Asian/African individuals

**Biology**: PMs receiving standard-dose azathioprine develop severe/life-threatening myelosuppression (bone marrow failure). IMs require dose reduction (30-70%). NMs with adequate TPMT activity may still accumulate 6-TGN at therapeutic doses.

**Note on NUDT15**: The CPIC 2022 update added NUDT15 as a second gene influencing thiopurine toxicity, especially in East Asian populations. NUDT15*2 (rs116855232, Arg139Cys) causes 6-TGN accumulation independently of TPMT. Our implementation does not yet cover NUDT15. This is a significant gap for Asian patient populations.

### 1.8 DPYD (FLUOROURACIL / CAPECITABINE)

Dihydropyrimidine dehydrogenase (DPD) is the rate-limiting enzyme in the catabolism of 5-fluorouracil (5-FU):

- **DPYD*2A** (IVS14+1G>A, intron 14 splice donor): Completely abolishes DPD activity. Heterozygous: severe/life-threatening toxicity at standard doses. Homozygous: is generally incompatible with 5-FU therapy
- **DPYD*13** (1679T>G, Ile560Ser): Nonfunctional
- **rs67376798** (c.2846A>T, Asp949Val): ~50% reduction in activity

**Biology**: 5-FU catabolism via DPD normally accounts for 80-85% of administered 5-FU clearance. Without DPD, plasma half-life of 5-FU extends dramatically → gastrointestinal mucositis, neutropenia, and neurotoxicity. DPYD deficiency is found in ~3-5% of the European population.

**Weakness**:
- Two additional important variants (HapB3: c.1129-5923C>G, rs75017182 + c.1236G>A, rs56038477) are low-evidence but included in European DPYD recommendations
- Capecitabine is a prodrug of 5-FU and shares the same DPYD pharmacogenomics, but is not separately listed as a drug in our current system
- The algorithm cannot detect 5-FU-associated cardiotoxicity (which involves a different mechanism entirely and is not pharmacogenomics-predictable through germline DNA)

---

## 2. VCF Parsing Pipeline

The parser reads VCF 4.1–4.3 format files. Key steps:

### 2.1 File Validation and Header Parsing

- The `#CHROM` line is parsed to identify sample columns. Multi-sample VCFs use only the first sample column.
- `FORMAT` fields are checked for `GT` (genotype). Only records with `GT` are processed.
- Reference genome: **GRCh37/hg19** (default, where rs IDs in our SNP catalog are mapped). GRCh38 positions are not yet remapped automatically — this is a **known limitation**.

### 2.2 Variant Extraction

For each VCF data row:
1. `CHROM`, `POS`, `REF`, `ALT`, and `FORMAT/GT` are extracted
2. Genotype is normalized to allele indices (0 = REF, 1 = first ALT, etc.)
3. The record is classified by:
   - **rsID** lookup (if ID column has `rs[0-9]+`)
   - **Position-based** lookup against our pharmvar_snps.json catalog (chromosome + position)
4. Matched variants are stored with their allele calls

### 2.3 Quality Filtering

- `FILTER` column: variants with status other than `PASS` or `.` are excluded
- Minimum allele frequency (MAF) threshold is not applied — all genotyped variants are trusted as called by the upstream caller
- Missing genotype (`./.`) is treated as wild-type at that position (a conservative assumption that may underestimate variant burden)

---

## 3. Star Allele Inference

### 3.1 What is a Star Allele?

The Human Cytochrome P450 (CYP) Allele Nomenclature Committee defines "star alleles" — named haplotypes of a gene, e.g., CYP2D6*4 — each specifying a combination of variants that are inherited together. An individual has two alleles (diplotype), one from each parent.

### 3.2 Inference Algorithm

For each pharmacogene, the system:

1. Loads the sorted list of star alleles and their defining variants from `cpic_rules.json`
2. For each known star allele, checks how many defining variants are present in the patient's VCF
3. Scores alleles by match completeness: a star allele with more defining variants matched scores higher
4. Assigns the two highest-scoring star alleles as the diplotype (greedy match — not phased)

**Example for CYP2D6**:
- Patient has rs1065852 (C>T) in heterozygous form and rs3892097 (G>A) in heterozygous form
- rs3892097 defines *4; rs1065852 defines *10
- System assigns diplotype *4/*10
- Activity scores: *4 = 0.0, *10 = 0.25 → total = 0.25 (IM)

### 3.3 Activity Scores

Each CYP2D6 allele has an CPIC-assigned activity value:

| Category | Activity | Diplotype example |
|---|---|---|
| Non-functional (NF) | 0.0 | *4, *5 (deletion) |
| Decreased (D) | 0.25 | *10, *17, *41 |
| Normal (N) | 1.0 | *1, *2 |
| Increased (for duplications) | 2.0+ | *1×N (gene duplication) |

**Activity Score → Phenotype**:

| Activity Score | Phenotype | Clinical Meaning |
|---|---|---|
| 0 | PM (Poor Metabolizer) | No enzyme function |
| 0.25–0.75 | IM (Intermediate Metabolizer) | Reduced function |
| 1.0–2.0 | NM (Normal Metabolizer) | Standard function |
| >2.25 | RM/URM (Rapid/Ultra-rapid) | Elevated function |

**Note**: CYP2C19, CYP2C9, and TPMT use analogous activity score systems. SLCO1B1 and DPYD use a simplified decreased/normal/nonfunctional function classification rather than a numeric score.

### 3.4 Phase Ambiguity (Known Weakness)

VCF files contain unphased genotypes by default. If a patient is heterozygous at two positions that could be consistent with multiple star allele combinations (*4/*10 vs *1/*X where X is unconventional), the greedy allele matching cannot resolve which variants are on the same chromosome.

**Consequence**: A patient could be misassigned e.g. *4/*10 when they actually have *1/*14, yielding the wrong phenotype. True haplotype resolution requires long-read sequencing, trio data, or dedicated phasing software (e.g., WhatsHap). This is the most significant analytical limitation of the current system.

---

## 4. CPIC Rule Matching

### 4.1 Rule Structure

Each drug entry in `cpic_rules.json` contains:

```json
{
  "CODEINE": {
    "primary_gene": "CYP2D6",
    "phenotype_rules": {
      "PM": {
        "risk_label": "Ineffective",
        "severity": "high",
        "recommendation": "..."
      },
      "IM": { ... },
      "NM": { ... },
      "RM": { ... },
      "URM": { ... }
    }
  }
}
```

Rules are extracted from official CPIC guideline PDFs by `extractor.py` (LLM-assisted extraction using Groq Llama 3.3).

### 4.2 Phenotype Fallback

If an exact phenotype match is not found (e.g., "xNM" or a novel token), the engine falls back to the NM rule — the safest default. This prevents missing recommendations from crashing the system but may produce conservative "safe" classifications for edge phenotypes.

---

## 5. Dynamic Confidence Scoring

### 5.1 Formula

```
confidence = base(n_variants) + activity_adj(activity_score) + impact_bonus(variants)
```

Where:

**base(n)** — variant count to base confidence:
```
n = 0 → 0.55
n = 1 → 0.67
n = 2 → 0.76
n = 3 → 0.84
n = 4 → 0.89
n ≥ 5 → min(0.94, 0.89 + 0.012 × (n - 4))
```

**activity_adj(a)** — activity score clarity adjustment:
```
a = 0.0         → +0.06  (PM unambiguous — complete loss)
a ≤ 0.25        → +0.04
a ≥ 2.5         → +0.04  (URM unambiguous — clear duplication)
a ≥ 2.0         → +0.03  (RM — clear)
0.75 < a < 1.25 → -0.05  (IM borderline — ambiguous classification)
a ≤ 0.5         → +0.02
else            →  0.00
```

**impact_bonus** — high-impact variant density:
```
high = count of variants with impact ∈ {nonfunctional, frameshift, stop, splice}
impact_bonus = min(0.05, high × 0.025)
```

**Final**: `clamp(base + adj + bonus, 0.50, 0.99)`

### 5.2 Rationale

- A patient with 0 detected variants still reaches 0.55 confidence because the wild-type assumption is probabilistic (VCF may not have called every position)
- Activity score in the "intermediate" zone (0.75–1.25) is penalised because phenotype classification is genuinely harder in that band
- High-impact variants (frameshift, splice, stop) are inherently more informative than missense alone

### 5.3 Weakness

- The formula is heuristic and not calibrated against clinical outcome data (no training set used)
- Activity score thresholds were manually chosen based on CPIC phenotype boundaries; they are not statistically derived
- Confidence score here represents internal algorithmic certainty, not a validated clinical risk probability

---

## 6. LLM Integration

### 6.1 Architecture

The LLM layer uses **Groq API** (OpenAI-compatible) with the **Llama 3.3 70B Versatile** model. The prompt is constructed as:

```
SYSTEM: You are a clinical pharmacogenomics expert...
USER: Drug: {drug}
Gene: {gene}
Diplotype: {diplotype}
Phenotype: {phenotype}
Activity Score: {activity_score}
Risk Label: {risk_label}
Detected Variants: {variant_list}

Generate a clear, clinically accurate explanation of:
1. How {gene} affects {drug} metabolism at a molecular level
2. What {phenotype} means for this patient's drug response
3. Why the risk label is {risk_label}
4. Key clinical actions...
```

### 6.2 Output Structure

The LLM returns a structured JSON with:
- `summary`: 3–5 sentences suitable for display in the speech bubble
- `variant_citations`: list of cited RSIDs with genotypes
- `model`: model identifier
- `disclaimer`: clinical disclaimer

### 6.3 Fallback

If the API call fails (timeout, authentication, rate limit), `llm_service.py` returns a static fallback message derived from the CPIC rule recommendation. The system remains functional without the LLM.

---

## 7. Coverage Gaps and Known Limitations

### 7.1 Missing Genes

| Gene | Relevant Drug | Gap Reason |
|---|---|---|
| CYP2C19 | Proton pump inhibitors (omeprazole) | Not in current drug list |
| CYP3A4/5 | Tacrolimus, fentanyl, midazolam | Most polymorphic; no definitive star allele system |
| HLA-B | Abacavir (HIV), carbamazepine | HLA typing requires different genotyping approach |
| G6PD | Dapsone, rasburicase, chloroquine | X-linked; requires CNV-aware analysis |
| NAT2 | Isoniazid, hydralazine | Slow vs fast acetylator; not in CYP family |
| NUDT15 | Azathioprine (Asian populations) | Partially covers TPMT gap |
| VKORC1 | Warfarin (combined model) | Included in rules but not in combined dose prediction |

### 7.2 Genome Build Mismatch

VCF files generated on GRCh38 will have coordinate mismatches with our hg19-based SNP catalog. No automated liftover is performed. This may cause all variants to be missed for a GRCh38 VCF, leading to false "no variants detected" and a high NM classification.

### 7.3 Star Allele Coverage

The implementation covers major star alleles for each gene. However:
- CYP2D6 has >100 named star alleles; we cover the top ~25 (>95% frequency explanatory power in European populations, but lower in African/South Asian cohorts)
- CYP2C9 African-specific alleles (*5, *6, *8, *11) may be under-detected
- TPMT *3B and *3D (combinations) are not separately enumerated

### 7.4 Multi-Gene Drugs

Warfarin is influenced by CYP2C9 (metabolism), VKORC1 (target enzyme sensitivity), and CYP4F2 (vitamin K metabolism). Only CYP2C9 is assessed. The full CPIC warfarin dose-prediction model requires all three.

Similarly, fluorouracil toxicity can involve TYMS polymorphisms (thymidylate synthase gene amplification) in addition to DPYD. TYMS is not currently assessed.

### 7.5 Somatic vs Germline

VCF files from tumor-normal analysis may include somatic variants. The system does not distinguish germline from somatic variants. Somatic pharmacogene variants in tumor tissue are pharmacogenomically distinct from germline mutations and should not be used for germline-based drug dosing decisions.

### 7.6 Clinical Disclaimer

PharmaGuard is a research demonstration tool built for RIFT 2026. It is **not validated for clinical use**. Risk labels and confidence scores are derived from a simplified CPIC rule engine and a generative AI model. No clinical decisions should be made based solely on this output without review by a board-certified clinical pharmacogenomicist or pharmacist.

---

## 8. Data Sources

| Component | Source |
|---|---|
| CPIC Guidelines | CPIC Guideline Database (PharmGKB) — extracted via LLM |
| Star Allele Definitions | PharmVar Database |
| SNP Catalog | ClinVar + PharmGKB variant annotations |
| Activity Scores | CPIC Gene-specific allele function tables |

---

## 9. Architecture Summary

```
VCF File
    │
    ▼
[ VCF Parser ]          ← reads genotypes, rsIDs, positions
    │
    ▼
[ Variant Extractor ]   ← maps to pharmvar catalog, identifies star allele candidates
    │
    ▼
[ Star Allele Engine ]  ← greedy diplotype assignment per gene
    │
    ▼
[ Activity Scorer ]     ← sum of per-allele activity values → phenotype category
    │
    ▼
[ CPIC Rule Engine ]    ← phenotype + drug → risk_label, severity, recommendation
    │
    ▼
[ Confidence Engine ]   ← dynamic score from variant evidence weight
    │
    ▼
[ Pathway Generator ]   ← storyboard (gene → variant → phenotype → metabolism → outcome)
    │
    ▼
[ LLM Explanation ]     ← Groq Llama 3.3 70B explains in clinical language
    │
    ▼
[ JSON Response ]       ← structured result served to Next.js frontend
```
