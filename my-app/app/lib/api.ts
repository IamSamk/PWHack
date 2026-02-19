// ── PharmaGuard API Client ──

import type { BatchAnalysisResult } from "./types";

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
 * Analyze one or more drugs against a VCF file in one request.
 * VCF is parsed once server-side; all drugs run in parallel.
 *
 * Sends file + repeated `drugs` form fields to POST /analyze.
 */
export async function analyzeMultipleDrugs(
  file: File,
  drugs: string[]
): Promise<BatchAnalysisResult> {
  const form = new FormData();
  form.append("file", file);
  // Repeated fields — FastAPI receives List[str]
  drugs.forEach((d) => form.append("drugs", d.toUpperCase()));
  return request<BatchAnalysisResult>("/analyze", {
    method: "POST",
    body: form,
  });
}
