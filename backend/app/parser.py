import vcfpy

def parse_vcf(file_path):
	target_rsids = ["rs4244285", "rs12248560", "rs3892097"]
	found_variants = []
	reader = vcfpy.Reader.from_path(file_path)
	for record in reader:
		if record.ID and record.ID[0] in target_rsids:
			call = record.calls[0].data.get('GT')
			genotype = str(call).replace("/", "").replace("|", "")
			found_variants.append({
				"rsid": record.ID[0],
				"genotype": genotype
			})
	return found_variants
