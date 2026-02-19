// ── PharmaGuard API Client ──

import type { DrugAnalysisResult } from "./types";

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
