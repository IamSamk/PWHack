
from langchain_ollama import ChatOllama
from langchain_core.prompts import PromptTemplate

# Initialize ChatOllama with gemma3:4b model
llm = ChatOllama(model="gemma3:4b")

# Create prompt template
prompt_template = PromptTemplate(
	input_variables=["phenotype", "gene", "drug"],
	template="Explain why a {phenotype} for the {gene} gene should be careful taking {drug}. Use clinical terms but keep it brief (2-3 sentences)."
)

def generate_explanation(gene, phenotype, drug):
	try:
		# Create the prompt with the variables
		prompt = prompt_template.format(phenotype=phenotype, gene=gene, drug=drug)
		# Invoke the LLM
		response = llm.invoke(prompt)
		return response.content.strip()
	except Exception as e:
		return f"Clinical explanation unavailable. Error: {str(e)}"
