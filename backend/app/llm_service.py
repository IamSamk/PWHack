"""
PharmaGuard — Constrained Explainable AI Layer (XAI)

The LLM does NOT classify, predict, or interpret raw VCF.
It receives deterministic facts and generates:
  - Mechanistic explanation
  - Biological pathway description
  - Clinical implication summary
"""

from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate

# Initialize ChatOllama with gemma3:4b model
llm = ChatOllama(model="gemma3:4b")

# Structured clinical prompt — feeds deterministic outputs, asks for explanation only
EXPLANATION_PROMPT = PromptTemplate(
    input_variables=["gene", "phenotype", "drug"],
    template=(
        "You are a pharmacogenomics clinical advisor. You are given VERIFIED "
        "deterministic results from a CPIC-aligned pharmacogenomic engine. "
        "Do NOT re-classify or question the results.\n\n"
        "FACTS:\n"
        "- Gene: {gene}\n"
        "- Patient phenotype: {phenotype}\n"
        "- Drug: {drug}\n\n"
        "Based ONLY on these facts, provide a brief (3-4 sentence) explanation that covers:\n"
        "1. The biological mechanism — how does {gene} metabolize or transport {drug}?\n"
        "2. Why the {phenotype} phenotype affects drug response.\n"
        "3. The clinical implication — what risk does the patient face?\n\n"
        "Use clinical terminology but remain accessible. Do NOT speculate beyond the facts."
    )
)


def generate_explanation(gene: str, phenotype: str, drug: str) -> str:
    """
    Generate a constrained LLM explanation for a pharmacogenomic finding.

    Args:
        gene: Gene symbol (e.g., CYP2D6)
        phenotype: Metabolizer status (e.g., Poor Metabolizer)
        drug: Drug name (e.g., CODEINE)

    Returns:
        Clinical explanation string.
    """
    if not gene or not phenotype or not drug:
        return "Insufficient data to generate clinical explanation."

    try:
        prompt = EXPLANATION_PROMPT.format(
            gene=gene, phenotype=phenotype, drug=drug
        )
        response = llm.invoke(prompt)
        return response.content.strip()
    except Exception as e:
        return f"Clinical explanation unavailable. Error: {str(e)}"
