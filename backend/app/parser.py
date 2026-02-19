"""
PharmaGuard VCF Parser — Robust, scalable pharmacogenomic VCF parser.

Handles any valid VCF v4.x file.
Extracts variants relevant to the 6 core pharmacogenes.
Maps rsIDs → star alleles → diplotypes → phenotypes.

NO hardcoded VCF assumptions — structure is parsed dynamically.
"""

import json
import os
import re
from pathlib import Path
from typing import Any

# --- Constants ---

MAX_VCF_SIZE_MB = 5
MAX_VCF_SIZE_BYTES = MAX_VCF_SIZE_MB * 1024 * 1024

# The 6 core pharmacogenes
CORE_GENES = {"CYP2D6", "CYP2C19", "CYP2C9", "SLCO1B1", "TPMT", "DPYD"}

# --- Star Allele Definitions ---
# Maps rsID → {alt_allele: star_allele_name}
# Each gene has its defining variants with activity scores.

STAR_ALLELE_DEFINITIONS: dict[str, dict] = {
    "CYP2D6": {
        "defining_variants": {
            "rs3892097":  {"allele_map": {"A": "*4",  "G": "*1", "T": "*4", "C": "*1"}, "ref": "G", "impact": "splice defect — nonfunctional"},
            "rs5030655":  {"allele_map": {"T": "*6",  "A": "*1"}, "ref": "A", "impact": "frameshift — nonfunctional"},
            "rs1065852":  {"allele_map": {"A": "*10", "G": "*1", "T": "*10", "C": "*1"}, "ref": "G", "impact": "P34S — decreased function"},
            "rs16947":    {"allele_map": {"A": "*2",  "G": "*1"}, "ref": "G", "impact": "R296C — normal function"},
            "rs28371725": {"allele_map": {"A": "*41", "G": "*1"}, "ref": "G", "impact": "splicing defect — decreased function"},
            "rs35742686": {"allele_map": {"T": "*3",  "TT": "*1"}, "ref": "TT", "impact": "frameshift — nonfunctional"},
            "rs5030656":  {"allele_map": {"T": "*9",  "AGA": "*1"}, "ref": "AGA", "impact": "K281del — decreased function"},
            "rs1135840":  {"allele_map": {"G": "*2B", "C": "*1"}, "ref": "C", "impact": "S486T — normal function"},
            "rs28371706": {"allele_map": {"T": "*17", "C": "*1"}, "ref": "C", "impact": "T107I — decreased function"},
            "rs59421388": {"allele_map": {"T": "*29", "C": "*1"}, "ref": "C", "impact": "V136I — decreased function"},
        },
        "activity_scores": {
            "*1": 1.0, "*2": 1.0, "*2B": 1.0,
            "*9": 0.5, "*10": 0.25, "*17": 0.5, "*29": 0.5, "*41": 0.5,
            "*3": 0.0, "*4": 0.0, "*5": 0.0, "*6": 0.0,
        },
        "default_star": "*1"
    },
    "CYP2C19": {
        "defining_variants": {
            "rs4244285":  {"allele_map": {"A": "*2",  "G": "*1"}, "ref": "G", "impact": "splicing defect — nonfunctional"},
            "rs4986893":  {"allele_map": {"A": "*3",  "G": "*1"}, "ref": "G", "impact": "premature stop — nonfunctional"},
            "rs28399504": {"allele_map": {"G": "*4",  "A": "*1"}, "ref": "A", "impact": "A276P — nonfunctional"},
            "rs12248560": {"allele_map": {"T": "*17", "C": "*1"}, "ref": "C", "impact": "promoter variant — increased function"},
            "rs72552267": {"allele_map": {"C": "*6",  "G": "*1"}, "ref": "G", "impact": "R132Q — nonfunctional"},
            "rs55752064": {"allele_map": {"T": "*8",  "C": "*1"}, "ref": "C", "impact": "W120R — nonfunctional"},
            "rs56337013": {"allele_map": {"T": "*5",  "C": "*1"}, "ref": "C", "impact": "R433W — nonfunctional"},
        },
        "activity_scores": {
            "*1": 1.0, "*17": 1.5,
            "*2": 0.0, "*3": 0.0, "*4": 0.0, "*5": 0.0, "*6": 0.0, "*8": 0.0,
        },
        "default_star": "*1"
    },
    "CYP2C9": {
        "defining_variants": {
            "rs1799853":  {"allele_map": {"T": "*2",  "C": "*1"}, "ref": "C", "impact": "R144C — decreased function"},
            "rs1057910":  {"allele_map": {"C": "*3",  "A": "*1"}, "ref": "A", "impact": "I359L — decreased function"},
            "rs28371686": {"allele_map": {"G": "*5",  "C": "*1"}, "ref": "C", "impact": "D360E — decreased function"},
            "rs9332131":  {"allele_map": {"A": "*6",  "AA": "*1"}, "ref": "AA", "impact": "frameshift — nonfunctional"},
            "rs7900194":  {"allele_map": {"G": "*8",  "A": "*1"}, "ref": "A", "impact": "R150H — decreased function"},
            "rs2256871":  {"allele_map": {"A": "*9",  "G": "*1"}, "ref": "G", "impact": "H251R — decreased function"},
            "rs28371685": {"allele_map": {"G": "*11", "A": "*1"}, "ref": "A", "impact": "R335W — decreased function"},
        },
        "activity_scores": {
            "*1": 1.0,
            "*2": 0.5, "*3": 0.25, "*5": 0.5,
            "*6": 0.0, "*8": 0.5, "*9": 0.5, "*11": 0.5,
        },
        "default_star": "*1"
    },
    "SLCO1B1": {
        "defining_variants": {
            "rs4149056":  {"allele_map": {"C": "*5",  "T": "*1a"}, "ref": "T", "impact": "V174A — decreased function"},
            "rs2306283":  {"allele_map": {"G": "*1b", "A": "*1a"}, "ref": "A", "impact": "N130D — normal function"},
            "rs4149015":  {"allele_map": {"A": "*15", "G": "*1a"}, "ref": "G", "impact": "decreased transporter function"},
            "rs11045819": {"allele_map": {"C": "*14", "A": "*1a"}, "ref": "A", "impact": "P155T — decreased function"},
        },
        "activity_scores": {
            "*1a": 1.0, "*1b": 1.0,
            "*5": 0.0, "*14": 0.5, "*15": 0.0,
        },
        "default_star": "*1a"
    },
    "TPMT": {
        "defining_variants": {
            "rs1800462":  {"allele_map": {"G": "*2",  "C": "*1"}, "ref": "C", "impact": "A80P — nonfunctional"},
            "rs1800460":  {"allele_map": {"T": "*3B", "C": "*1", "A": "*3B", "G": "*1"}, "ref": "C", "impact": "A154T — nonfunctional"},
            "rs1142345":  {"allele_map": {"C": "*3C", "T": "*1"}, "ref": "T", "impact": "Y240C — nonfunctional"},
            "rs1800584":  {"allele_map": {"A": "*4",  "G": "*1"}, "ref": "G", "impact": "splice site — nonfunctional"},
        },
        "activity_scores": {
            "*1": 1.0,
            "*2": 0.0, "*3A": 0.0, "*3B": 0.0, "*3C": 0.0, "*4": 0.0,
        },
        "default_star": "*1"
    },
    "DPYD": {
        "defining_variants": {
            "rs3918290":  {"allele_map": {"T": "*2A", "A": "*2A", "G": "*1", "C": "*1"}, "ref": "G", "impact": "IVS14+1G>A — nonfunctional (exon 14 skipping)"},
            "rs55886062": {"allele_map": {"A": "*13", "C": "*1"}, "ref": "C", "impact": "I560S — nonfunctional"},
            "rs67376798": {"allele_map": {"A": "D949V","T": "*1"}, "ref": "T", "impact": "D949V — decreased function"},
            "rs75017182": {"allele_map": {"G": "HapB3","C": "*1"}, "ref": "C", "impact": "intronic — decreased function (haplotype B3)"},
        },
        "activity_scores": {
            "*1": 1.0, "normal": 1.0,
            "*2A": 0.0, "*13": 0.0,
            "D949V": 0.5, "HapB3": 0.5,
        },
        "default_star": "*1"
    }
}

# Build a flat rsID → gene+variant info lookup for fast parsing
_RSID_INDEX: dict[str, dict] = {}
for _gene, _gene_data in STAR_ALLELE_DEFINITIONS.items():
    for _rsid, _var_info in _gene_data["defining_variants"].items():
        _RSID_INDEX[_rsid] = {**_var_info, "gene": _gene}

# Phenotype classification thresholds (activity score based)
# CPIC: NM = activity score 1.25–2.25, RM = 2.25–2.75, URM > 2.75
PHENOTYPE_THRESHOLDS = [
    # (max_score, phenotype_label)
    (0.0,   "PM"),     # Poor Metabolizer
    (0.75,  "IM"),     # Intermediate Metabolizer
    (2.25,  "NM"),     # Normal Metabolizer
    (2.75,  "RM"),     # Rapid Metabolizer
    (999,   "URM"),    # Ultrarapid Metabolizer
]


class VCFParseError(Exception):
    """Raised when VCF parsing fails."""
    pass


class VCFFileTooLargeError(VCFParseError):
    """Raised when VCF file exceeds size limit."""
    pass


def validate_vcf_size(filepath: str) -> None:
    """Check that VCF file is within size limit."""
    size = os.path.getsize(filepath)
    if size > MAX_VCF_SIZE_BYTES:
        raise VCFFileTooLargeError(
            f"VCF file is {size / (1024*1024):.1f}MB, exceeds {MAX_VCF_SIZE_MB}MB limit. "
            f"Please provide a targeted pharmacogene panel VCF."
        )


def validate_vcf_size_bytes(data: bytes) -> None:
    """Check that raw VCF data is within size limit."""
    if len(data) > MAX_VCF_SIZE_BYTES:
        raise VCFFileTooLargeError(
            f"VCF data is {len(data) / (1024*1024):.1f}MB, exceeds {MAX_VCF_SIZE_MB}MB limit."
        )


def parse_vcf_content(content: str) -> dict[str, Any]:
    """
    Parse VCF content string and extract pharmacogenomic variants.

    Returns a dict with:
    - meta: VCF metadata
    - variants: list of all parsed variant records
    - pharmacogene_variants: dict of gene → list of relevant variants
    - sample_ids: list of sample/patient IDs from header
    """
    lines = content.strip().split('\n')

    meta: dict[str, Any] = {
        "fileformat": None,
        "info_fields": {},
        "format_fields": {},
        "contigs": [],
        "filters": [],
        "other": []
    }
    header_columns: list[str] = []
    sample_ids: list[str] = []
    variant_records: list[dict] = []
    pharmacogene_variants: dict[str, list[dict]] = {gene: [] for gene in CORE_GENES}

    header_found = False

    for line_num, raw_line in enumerate(lines, 1):
        line = raw_line.strip()
        if not line:
            continue

        # Skip comment lines that aren't VCF meta/header
        if line.startswith("#") and not line.startswith("##") and not line.upper().startswith("#CHROM"):
            continue

        # --- META lines ---
        if line.startswith("##"):
            _parse_meta_line(line, meta)
            continue

        # --- HEADER line ---
        if line.upper().startswith("#CHROM"):
            header_columns = line.lstrip('#').split('\t')
            # Sample IDs are columns after FORMAT (index 8+)
            if len(header_columns) > 9:
                sample_ids = header_columns[9:]
            header_found = True
            continue

        # --- DATA lines ---
        if not header_found:
            # Try to parse even without proper header (flexible)
            header_columns = ["CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO"]
            header_found = True

        fields = line.split('\t')
        if len(fields) < 8:
            # Try space-separated as fallback
            fields = line.split()
        if len(fields) < 5:
            continue  # skip malformed lines

        record = _parse_variant_record(fields, header_columns, sample_ids, line_num)
        if record:
            variant_records.append(record)
            # Check if this variant is pharmacogenomically relevant
            _classify_variant(record, pharmacogene_variants)

    # Validate we got something
    if not header_found and not variant_records:
        raise VCFParseError("No valid VCF header or variant records found.")

    # Validate file format
    if meta["fileformat"] and "vcf" not in meta["fileformat"].lower():
        raise VCFParseError(f"Unexpected file format: {meta['fileformat']}. Expected VCFv4.x")

    return {
        "meta": meta,
        "sample_ids": sample_ids,
        "total_variants": len(variant_records),
        "variants": variant_records,
        "pharmacogene_variants": pharmacogene_variants,
    }


def _parse_meta_line(line: str, meta: dict) -> None:
    """Parse a VCF ## meta line."""
    if line.startswith("##fileformat="):
        meta["fileformat"] = line.split("=", 1)[1]
    elif line.startswith("##INFO="):
        match = re.search(r'ID=(\w+)', line)
        if match:
            meta["info_fields"][match.group(1)] = line
    elif line.startswith("##FORMAT="):
        match = re.search(r'ID=(\w+)', line)
        if match:
            meta["format_fields"][match.group(1)] = line
    elif line.startswith("##contig="):
        meta["contigs"].append(line)
    elif line.startswith("##FILTER="):
        meta["filters"].append(line)
    else:
        meta["other"].append(line)


def _parse_variant_record(
    fields: list[str], header: list[str], sample_ids: list[str], line_num: int
) -> dict | None:
    """Parse one VCF data line into a structured record."""
    try:
        chrom = fields[0]
        pos = fields[1]
        var_id = fields[2] if len(fields) > 2 else "."
        ref = fields[3] if len(fields) > 3 else "."
        alt = fields[4] if len(fields) > 4 else "."
        qual = fields[5] if len(fields) > 5 else "."
        filt = fields[6] if len(fields) > 6 else "."
        info = fields[7] if len(fields) > 7 else "."
        fmt = fields[8] if len(fields) > 8 else ""

        # Parse INFO field into dict
        info_dict: dict[str, Any] = {}
        if info and info != ".":
            for entry in info.split(";"):
                if "=" in entry:
                    k, v = entry.split("=", 1)
                    info_dict[k] = v
                else:
                    info_dict[entry] = True

        # Parse sample genotypes
        genotypes: dict[str, dict] = {}
        if fmt and len(fields) > 9:
            fmt_keys = fmt.split(":")
            for i, sample_field in enumerate(fields[9:]):
                sample_name = sample_ids[i] if i < len(sample_ids) else f"SAMPLE_{i}"
                sample_values = sample_field.split(":")
                gt_dict = {}
                for j, key in enumerate(fmt_keys):
                    gt_dict[key] = sample_values[j] if j < len(sample_values) else "."
                genotypes[sample_name] = gt_dict

        # Parse rsIDs (can be multiple, semicolon-separated)
        rsids = []
        if var_id and var_id != ".":
            rsids = [
                x.strip() for x in var_id.replace(",", ";").split(";")
                if x.strip().startswith("rs")
            ]

        # Parse ALT alleles (can be multiple)
        alt_alleles = [a.strip() for a in alt.split(",") if a.strip() != "."]

        return {
            "chrom": chrom,
            "pos": int(pos) if pos.isdigit() else pos,
            "id": var_id,
            "rsids": rsids,
            "ref": ref,
            "alt": alt,
            "alt_alleles": alt_alleles,
            "qual": qual,
            "filter": filt,
            "info": info_dict,
            "format": fmt,
            "genotypes": genotypes,
            "line_num": line_num,
        }
    except Exception:
        return None


def _classify_variant(record: dict, pharmacogene_variants: dict) -> None:
    """Check if a variant record matches any known pharmacogene rsID."""
    for rsid in record.get("rsids", []):
        if rsid in _RSID_INDEX:
            var_info = _RSID_INDEX[rsid]
            gene = var_info["gene"]
            if gene in pharmacogene_variants:
                pharmacogene_variants[gene].append({
                    "rsid": rsid,
                    "record": record,
                    "var_info": var_info,
                })


def _resolve_genotype_alleles(record: dict) -> tuple[str, str]:
    """
    Resolve the two alleles from a VCF genotype record.
    Returns (allele1, allele2) as actual nucleotide strings.
    """
    # Get the first sample's GT
    gt_str = None
    for sample_name, gt_data in record.get("genotypes", {}).items():
        gt_str = gt_data.get("GT", None)
        if gt_str:
            break

    if not gt_str:
        # No genotype info — assume homozygous alt (variant was called)
        ref = record.get("ref", ".")
        alts = record.get("alt_alleles", [])
        alt = alts[0] if alts else ref
        return (alt, alt)

    # Parse GT field: "0/1", "1/1", "0|1", etc.
    separator = '|' if '|' in gt_str else '/'
    parts = gt_str.split(separator)

    allele_options = [record["ref"]] + record.get("alt_alleles", [])

    alleles = []
    for p in parts[:2]:  # diploid
        p = p.strip()
        if p == "." or p == "":
            alleles.append(record["ref"])
        else:
            try:
                idx = int(p)
                alleles.append(
                    allele_options[idx] if idx < len(allele_options) else record["ref"]
                )
            except ValueError:
                alleles.append(record["ref"])

    while len(alleles) < 2:
        alleles.append(record["ref"])

    return (alleles[0], alleles[1])


def infer_star_alleles_for_gene(gene: str, gene_variants: list[dict]) -> dict:
    """
    Given a gene name and its detected variants, infer star alleles for each haplotype.
    """
    gene_def = STAR_ALLELE_DEFINITIONS.get(gene)
    if not gene_def:
        return {"error": f"No star allele definitions for {gene}"}

    default_star = gene_def.get("default_star", "*1")
    activity_scores = gene_def.get("activity_scores", {})

    detected = []
    hap1_stars: list[str] = []
    hap2_stars: list[str] = []

    for var_entry in gene_variants:
        rsid = var_entry["rsid"]
        record = var_entry["record"]
        var_info = var_entry["var_info"]
        allele_map = var_info.get("allele_map", {})

        allele1, allele2 = _resolve_genotype_alleles(record)

        star1 = allele_map.get(allele1, default_star)
        star2 = allele_map.get(allele2, default_star)

        detected.append({
            "rsid": rsid,
            "ref": record["ref"],
            "alt": record["alt"],
            "genotype_alleles": (allele1, allele2),
            "star_1": star1,
            "star_2": star2,
            "impact": var_info.get("impact", "unknown"),
        })

        if star1 != default_star:
            hap1_stars.append(star1)
        if star2 != default_star:
            hap2_stars.append(star2)

    # Determine the representative star allele for each haplotype
    # Priority: pick the allele with lowest activity score (most impactful)
    def pick_representative(stars: list[str], default: str) -> str:
        if not stars:
            return default
        scored = [(s, activity_scores.get(s, 1.0)) for s in stars]
        scored.sort(key=lambda x: x[1])
        return scored[0][0]

    star1 = pick_representative(hap1_stars, default_star)
    star2 = pick_representative(hap2_stars, default_star)

    # Sort diplotype for canonical representation
    sorted_stars = sorted([star1, star2], key=lambda s: activity_scores.get(s, 1.0))
    diplotype = f"{sorted_stars[0]}/{sorted_stars[1]}"

    return {
        "gene": gene,
        "detected_variants": detected,
        "star_allele_1": sorted_stars[0],
        "star_allele_2": sorted_stars[1],
        "diplotype": diplotype,
    }


def compute_activity_score(gene: str, star1: str, star2: str) -> float:
    """Compute the total activity score for a diplotype."""
    gene_def = STAR_ALLELE_DEFINITIONS.get(gene, {})
    scores = gene_def.get("activity_scores", {})
    s1 = scores.get(star1, 1.0)
    s2 = scores.get(star2, 1.0)
    return round(s1 + s2, 2)


def classify_phenotype(activity_score: float) -> str:
    """Classify activity score into metabolizer phenotype."""
    for threshold, label in PHENOTYPE_THRESHOLDS:
        if activity_score <= threshold:
            return label
    return "URM"


def build_genomic_profile(parsed_vcf: dict) -> dict[str, Any]:
    """
    Build the complete pharmacogenomic profile from parsed VCF data.

    Returns a dict keyed by gene, with diplotype, phenotype, activity score,
    and detected variants for each of the 6 core genes.
    """
    profile = {}

    for gene in CORE_GENES:
        gene_variants = parsed_vcf["pharmacogene_variants"].get(gene, [])

        if not gene_variants:
            # No variants detected — assume wildtype
            gene_def = STAR_ALLELE_DEFINITIONS.get(gene, {})
            default_star = gene_def.get("default_star", "*1")
            activity = compute_activity_score(gene, default_star, default_star)
            phenotype = classify_phenotype(activity)

            profile[gene] = {
                "diplotype": f"{default_star}/{default_star}",
                "star_allele_1": default_star,
                "star_allele_2": default_star,
                "activity_score": activity,
                "phenotype": phenotype,
                "detected_variants": [],
                "variants_found": 0,
                "interpretation": (
                    f"No pharmacogenomic variants detected in {gene}. "
                    f"Assumed wildtype ({default_star}/{default_star})."
                )
            }
        else:
            star_result = infer_star_alleles_for_gene(gene, gene_variants)
            s1 = star_result["star_allele_1"]
            s2 = star_result["star_allele_2"]
            activity = compute_activity_score(gene, s1, s2)
            phenotype = classify_phenotype(activity)

            profile[gene] = {
                "diplotype": star_result["diplotype"],
                "star_allele_1": s1,
                "star_allele_2": s2,
                "activity_score": activity,
                "phenotype": phenotype,
                "detected_variants": star_result["detected_variants"],
                "variants_found": len(star_result["detected_variants"]),
                "interpretation": (
                    f"{gene} diplotype {star_result['diplotype']} → "
                    f"activity score {activity} → {phenotype}. "
                    f"Based on {len(star_result['detected_variants'])} detected variant(s)."
                )
            }

    return profile


def parse_vcf_file(filepath: str) -> dict[str, Any]:
    """
    Full pipeline: validate → parse → build pharmacogenomic profile.

    Args:
        filepath: Path to VCF file.

    Returns:
        Complete pharmacogenomic analysis result.
    """
    validate_vcf_size(filepath)

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    parsed = parse_vcf_content(content)
    profile = build_genomic_profile(parsed)

    return {
        "source_file": os.path.basename(filepath),
        "vcf_format": parsed["meta"]["fileformat"],
        "sample_ids": parsed["sample_ids"],
        "total_variants_in_file": parsed["total_variants"],
        "pharmacogene_variants_detected": sum(
            len(v) for v in parsed["pharmacogene_variants"].values()
        ),
        "genomic_profile": profile,
    }


def parse_vcf_bytes(data: bytes, filename: str = "upload.vcf") -> dict[str, Any]:
    """
    Parse VCF from raw bytes (for file upload handling).

    Args:
        data: Raw bytes of VCF file content.
        filename: Original filename for metadata.

    Returns:
        Complete pharmacogenomic analysis result.
    """
    validate_vcf_size_bytes(data)

    # Try UTF-8, fall back to latin-1
    try:
        content = data.decode('utf-8')
    except UnicodeDecodeError:
        content = data.decode('latin-1')

    parsed = parse_vcf_content(content)
    profile = build_genomic_profile(parsed)

    return {
        "source_file": filename,
        "vcf_format": parsed["meta"]["fileformat"],
        "sample_ids": parsed["sample_ids"],
        "total_variants_in_file": parsed["total_variants"],
        "pharmacogene_variants_detected": sum(
            len(v) for v in parsed["pharmacogene_variants"].values()
        ),
        "genomic_profile": profile,
    }


# --- Utility for testing ---
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python parser.py <path_to_vcf>")
        sys.exit(1)

    result = parse_vcf_file(sys.argv[1])
    print(json.dumps(result, indent=2, default=str))
