// ── PharmaGuard API Client ──

import type {
  UploadResponse,
  DrugAnalysisResult,
  BatchAnalysisResult,
  CounterfactualResult,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class APIError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "APIError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new APIError(res.status, body.detail || res.statusText);
  }
  return res.json();
}

/** Upload a VCF file. Returns session_id + genomic profile. */
export async function uploadVCF(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResponse>("/upload-vcf", {
    method: "POST",
    body: form,
  });
}

/** Get list of available drugs. */
export async function getDrugs(): Promise<string[]> {
  const data = await request<{ available_drugs: string[]; count: number }>("/drugs");
  return data.available_drugs;
}

/** Analyze a single drug (includes LLM explanation). */
export async function analyzeDrug(
  sessionId: string,
  drug: string
): Promise<DrugAnalysisResult> {
  return request<DrugAnalysisResult>(
    `/analyze?session_id=${encodeURIComponent(sessionId)}&drug=${encodeURIComponent(drug)}`,
    { method: "POST" }
  );
}

/** Batch analyze multiple drugs. */
export async function analyzeBatch(
  sessionId: string,
  drugs?: string[]
): Promise<BatchAnalysisResult> {
  const drugsParam = drugs ? `&drugs=${drugs.join(",")}` : "";
  return request<BatchAnalysisResult>(
    `/analyze-batch?session_id=${encodeURIComponent(sessionId)}${drugsParam}`,
    { method: "POST" }
  );
}

/** Run counterfactual simulation. */
export async function runCounterfactual(
  sessionId: string,
  drug: string,
  targetPhenotype: string = "NM"
): Promise<CounterfactualResult> {
  return request<CounterfactualResult>(
    `/counterfactual?session_id=${encodeURIComponent(sessionId)}&drug=${encodeURIComponent(drug)}&target_phenotype=${encodeURIComponent(targetPhenotype)}`,
    { method: "POST" }
  );
}

export { APIError };
