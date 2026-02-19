"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, FileCheck, FileX, X, Dna } from "lucide-react";

interface VCFUploadProps {
  onFileAccepted: (file: File) => void;
  disabled?: boolean;
  currentFile?: File | null;
  onClear?: () => void;
}

export default function VCFUpload({
  onFileAccepted,
  disabled,
  currentFile,
  onClear,
}: VCFUploadProps) {
  const [dragState, setDragState] = useState<"idle" | "over" | "rejected">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

  const validate = useCallback(
    (file: File): string | null => {
      if (!file.name.toLowerCase().endsWith(".vcf")) {
        return "Only .vcf files are accepted.";
      }
      if (file.size > MAX_SIZE) {
        return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`;
      }
      return null;
    },
    [MAX_SIZE]
  );

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file);
      if (err) {
        setError(err);
        setDragState("rejected");
        setTimeout(() => setDragState("idle"), 1500);
        return;
      }
      setError(null);
      setDragState("idle");
      onFileAccepted(file);
    },
    [validate, onFileAccepted]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragState("idle");
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragState("over");
    },
    [disabled]
  );

  const onDragLeave = useCallback(() => setDragState("idle"), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile]
  );

  const borderColor =
    dragState === "over"
      ? "border-accent"
      : dragState === "rejected"
      ? "border-danger"
      : currentFile
      ? "border-safe"
      : "border-card-border";

  const bgColor =
    dragState === "over"
      ? "bg-[rgba(6,182,212,0.05)]"
      : dragState === "rejected"
      ? "bg-[rgba(239,68,68,0.05)]"
      : currentFile
      ? "bg-[rgba(34,197,94,0.05)]"
      : "bg-card";

  return (
    <div className="w-full">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && !currentFile && inputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center
          transition-all duration-300 cursor-pointer
          ${borderColor} ${bgColor}
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-accent/50"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".vcf"
          onChange={onInputChange}
          className="hidden"
          disabled={disabled}
        />

        {currentFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileCheck className="w-6 h-6 text-safe" />
            <div className="text-left">
              <p className="text-sm font-medium text-safe">{currentFile.name}</p>
              <p className="text-xs text-muted">
                {(currentFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {onClear && !disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="ml-3 p-1.5 rounded-lg hover:bg-[rgba(239,68,68,0.1)] transition-colors"
              >
                <X className="w-4 h-4 text-danger" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-[rgba(6,182,212,0.1)]">
              {dragState === "rejected" ? (
                <FileX className="w-8 h-8 text-danger" />
              ) : dragState === "over" ? (
                <Dna className="w-8 h-8 text-accent animate-pulse" />
              ) : (
                <Upload className="w-8 h-8 text-accent" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                {dragState === "over"
                  ? "Drop VCF file here"
                  : "Drag & drop VCF file or click to browse"}
              </p>
              <p className="text-xs text-muted mt-1">.vcf files only • Max 5 MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-center gap-2 text-xs text-danger animate-fade-slide-up">
          <FileX className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
