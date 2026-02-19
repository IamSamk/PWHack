"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Pill, Plus } from "lucide-react";

interface DrugSelectorProps {
  availableDrugs: string[];
  selectedDrugs: string[];
  onChange: (drugs: string[]) => void;
  disabled?: boolean;
}

export default function DrugSelector({
  availableDrugs,
  selectedDrugs,
  onChange,
  disabled,
}: DrugSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (drug: string) => {
    const upper = drug.toUpperCase();
    if (selectedDrugs.includes(upper)) {
      onChange(selectedDrugs.filter((d) => d !== upper));
    } else {
      onChange([...selectedDrugs, upper]);
    }
  };

  const addCustomDrug = () => {
    const trimmed = customInput.trim().toUpperCase();
    if (trimmed && !selectedDrugs.includes(trimmed)) {
      onChange([...selectedDrugs, trimmed]);
    }
    setCustomInput("");
    inputRef.current?.focus();
  };

  const selectAll = () => onChange([...availableDrugs]);
  const clearAll = () => onChange([]);

  // Split selected drugs into known (in availableDrugs) and custom
  const customDrugs = selectedDrugs.filter((d) => !availableDrugs.includes(d));

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-3 rounded-xl
          border-2 border-card-border bg-card text-sm
          transition-all duration-200
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-accent/50 cursor-pointer"}
          ${open ? "border-accent" : ""}
        `}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className="w-4 h-4 text-accent" />
          {selectedDrugs.length === 0 ? (
            <span className="text-muted">Select drugs or type a custom drug name...</span>
          ) : (
            selectedDrugs.map((drug) => (
              <span
                key={drug}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${
                  customDrugs.includes(drug)
                    ? "bg-[rgba(168,85,247,0.1)] text-purple-400"
                    : "bg-[rgba(6,182,212,0.1)] text-accent"
                }`}
              >
                {drug}
                {!disabled && (
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(drug);
                    }}
                  />
                )}
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border-2 border-card-border rounded-xl shadow-xl overflow-hidden animate-fade-slide-up">
          {/* Custom drug input */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-card-border">
            <input
              ref={inputRef}
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomDrug();
                }
              }}
              placeholder="Type any drug name + Enter"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
            />
            <button
              onClick={addCustomDrug}
              disabled={!customInput.trim()}
              className="p-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-30 cursor-pointer"
              title="Add custom drug"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-card-border">
            <span className="text-[10px] text-muted uppercase tracking-wider">CPIC Drugs</span>
            <div className="flex gap-3">
              <button
                onClick={selectAll}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Select all
              </button>
              <button
                onClick={clearAll}
                className="text-xs text-muted hover:text-danger cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {availableDrugs.map((drug) => {
              const selected = selectedDrugs.includes(drug);
              return (
                <button
                  key={drug}
                  onClick={() => toggle(drug)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left
                    transition-colors cursor-pointer
                    ${selected ? "bg-[rgba(6,182,212,0.08)] text-accent" : "hover:bg-[rgba(255,255,255,0.03)]"}
                  `}
                >
                  <div
                    className={`
                      w-4 h-4 rounded border-2 flex items-center justify-center text-[10px]
                      transition-all
                      ${selected ? "border-accent bg-accent text-background" : "border-muted"}
                    `}
                  >
                    {selected && "✓"}
                  </div>
                  {drug}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
