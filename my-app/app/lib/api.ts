// ── PharmaGuard API Client ──

import type { DrugAnalysisResult, BatchAnalysisResult } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class APIError extends Error {
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
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        ...(options?.headers || {}),
      },
    });
  } catch (err) {
    // Network-level failure (backend not running, blocked by firewall, etc.)
    throw new APIError(
      0,
      `Cannot reach the PharmaGuard backend at ${API_BASE}. Make sure it is running (uvicorn app.main:app --reload from the backend/ folder).`
    );
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new APIError(res.status, body.detail || res.statusText);
  }
  return res.json();
}

/**
 * Analyze a single drug against a VCF file.
 * Sends file + drug as multipart form to POST /analyze.
 */
export async function analyzeDrug(
  file: File,
  drug: string
): Promise<DrugAnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("drug", drug.toUpperCase());
  return request<DrugAnalysisResult>("/analyze", {
    method: "POST",
    body: form,
  });
}

/**
 * Analyze multiple drugs against a VCF file in one request.
 * Sends file + comma-separated drug list to POST /analyze/batch.
 * The VCF is parsed once server-side; all drugs run in parallel.
 */
export async function analyzeMultipleDrugs(
  file: File,
  drugs: string[]
): Promise<BatchAnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  // Send each drug as a separate form field so FastAPI receives List[str]
  drugs.forEach((d) => form.append("drugs", d.toUpperCase()));
  return request<BatchAnalysisResult>("/analyze/batch", {
    method: "POST",
    body: form,
  });
}
