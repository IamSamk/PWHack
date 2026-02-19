"use client";

import { useState } from "react";
import { Code, Copy, Download, Check, ChevronRight } from "lucide-react";

interface JSONViewerProps {
  data: unknown;
  filename?: string;
}

export default function JSONViewer({ data, filename = "pharmaguard_result.json" }: JSONViewerProps) {
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

  return (
    <div className="border border-card-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center border-b border-card-border">
        <div className="px-4 py-2.5 text-xs font-medium text-accent flex items-center gap-1.5">
          <Code className="w-3.5 h-3.5" />
          JSON Output
        </div>
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

      {/* JSON Tree */}
      <div className="p-4 max-h-[32rem] overflow-auto">
        <JSONTree data={data} />
      </div>
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
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
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
        <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
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
