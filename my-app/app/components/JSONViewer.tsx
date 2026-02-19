"use client";

import { useState } from "react";
import { Code, Copy, Download, Check, ChevronRight } from "lucide-react";

interface JSONViewerProps {
  data: unknown;
  filename?: string;
}

export default function JSONViewer({ data, filename = "pharmaguard_result.json" }: JSONViewerProps) {
  const [tab, setTab] = useState<"summary" | "json">("summary");
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build a summary view from the data
  const summary = buildSummary(data);

  return (
    <div className="border border-card-border rounded-xl overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-card-border">
        <button
          onClick={() => setTab("summary")}
          className={`
            px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer
            ${tab === "summary" ? "text-accent border-b-2 border-accent bg-[rgba(6,182,212,0.05)]" : "text-muted hover:text-foreground"}
          `}
        >
          Summary View
        </button>
        <button
          onClick={() => setTab("json")}
          className={`
            px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer
            ${tab === "json" ? "text-accent border-b-2 border-accent bg-[rgba(6,182,212,0.05)]" : "text-muted hover:text-foreground"}
          `}
        >
          <Code className="w-3.5 h-3.5" />
          JSON Output
        </button>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 pr-2">
          <button
            onClick={copyToClipboard}
            className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer"
            title="Copy JSON"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-safe" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted" />
            )}
          </button>
          <button
            onClick={downloadJSON}
            className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer"
            title="Download JSON"
          >
            <Download className="w-3.5 h-3.5 text-muted" />
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === "summary" ? (
        <div className="p-4 max-h-96 overflow-y-auto">
          {summary.map((item, i) => (
            <div key={i} className="mb-2">
              <span className="text-xs text-muted">{item.key}:</span>{" "}
              <span className="text-xs font-mono text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 max-h-96 overflow-auto">
          <JSONTree data={data} />
        </div>
      )}
    </div>
  );
}

// ── Expandable JSON Tree ──

function JSONTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) {
    return <span className="text-muted text-xs font-mono">null</span>;
  }

  if (typeof data === "string") {
    return <span className="text-safe text-xs font-mono">&quot;{data}&quot;</span>;
  }

  if (typeof data === "number") {
    return <span className="text-accent text-xs font-mono">{data}</span>;
  }

  if (typeof data === "boolean") {
    return <span className="text-warn text-xs font-mono">{data.toString()}</span>;
  }

  if (Array.isArray(data)) {
    return <ArrayNode data={data} depth={depth} />;
  }

  if (typeof data === "object") {
    return <ObjectNode data={data as Record<string, unknown>} depth={depth} />;
  }

  return <span className="text-xs font-mono">{String(data)}</span>;
}

function ObjectNode({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const keys = Object.keys(data);

  return (
    <div className="inline">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center text-xs text-muted hover:text-foreground cursor-pointer"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <span className="font-mono">{`{${expanded ? "" : `...${keys.length} keys}`}`}</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-card-border pl-3">
          {keys.map((key) => (
            <div key={key} className="my-0.5">
              <span className="text-xs font-mono text-accent-dim">&quot;{key}&quot;</span>
              <span className="text-xs text-muted">: </span>
              <JSONTree data={data[key]} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrayNode({ data, depth }: { data: unknown[]; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div className="inline">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center text-xs text-muted hover:text-foreground cursor-pointer"
      >
        <ChevronRight
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <span className="font-mono">[{expanded ? "" : `...${data.length} items]`}</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l border-card-border pl-3">
          {data.map((item, i) => (
            <div key={i} className="my-0.5">
              <span className="text-xs text-muted font-mono">{i}: </span>
              <JSONTree data={item} depth={depth + 1} />
            </div>
          ))}
          <span className="text-xs text-muted font-mono">]</span>
        </div>
      )}
    </div>
  );
}

// ── Summary builder ──

function buildSummary(data: unknown): { key: string; value: string }[] {
  const items: { key: string; value: string }[] = [];
  if (!data || typeof data !== "object") return items;

  const obj = data as Record<string, unknown>;

  if (obj.patient_id) items.push({ key: "Patient ID", value: String(obj.patient_id).slice(0, 12) + "..." });
  if (obj.drug) items.push({ key: "Drug", value: String(obj.drug) });
  if (obj.timestamp) items.push({ key: "Timestamp", value: String(obj.timestamp) });

  const risk = obj.risk_assessment as Record<string, unknown> | undefined;
  if (risk) {
    items.push({ key: "Risk Label", value: String(risk.risk_label) });
    items.push({ key: "Severity", value: String(risk.severity) });
    items.push({ key: "Confidence", value: `${Math.round(Number(risk.confidence_score) * 100)}%` });
  }

  const pgx = obj.pharmacogenomic_profile as Record<string, unknown> | undefined;
  if (pgx) {
    items.push({ key: "Gene", value: String(pgx.primary_gene) });
    items.push({ key: "Diplotype", value: String(pgx.diplotype) });
    items.push({ key: "Phenotype", value: String(pgx.phenotype) });
    items.push({ key: "Activity Score", value: String(pgx.activity_score) });
  }

  const qm = obj.quality_metrics as Record<string, unknown> | undefined;
  if (qm) {
    items.push({ key: "VCF Parsed", value: qm.vcf_parsing_success ? "Yes" : "No" });
    items.push({ key: "LLM Generated", value: qm.llm_explanation_generated ? "Yes" : "No" });
  }

  return items;
}
