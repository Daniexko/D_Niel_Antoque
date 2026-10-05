import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "../lib/utils";

interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  label?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];
    onChange(newSelected);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full" ref={dropdownRef}>
      {label && <label className="text-xs font-semibold text-slate-600 ml-1">{label}</label>}
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center justify-between min-h-[42px] px-3 py-2 bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl cursor-pointer hover:bg-white transition-all shadow-sm",
            isOpen && "ring-2 ring-blue-500/20 border-blue-400"
          )}
        >
          <div className="flex flex-wrap gap-1 items-center max-w-[calc(100%-24px)]">
            {selected.length === 0 ? (
              <span className="text-slate-400 text-sm">{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {selected.slice(0, 2).map((val, idx) => (
                  <span
                    key={`${val}-${idx}`}
                    className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg text-xs font-medium"
                  >
                    {val}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-blue-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOption(val);
                      }}
                    />
                  </span>
                ))}
                {selected.length > 2 && (
                  <span className="text-xs text-slate-500 font-medium ml-1">
                    +{selected.length - 2} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selected.length > 0 && (
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" onClick={clearAll} />
            )}
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
          </div>
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-[100] animate-in fade-in zoom-in duration-200">
            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
              {options.length === 0 ? (
                <div className="px-3 py-4 text-center text-slate-400 text-sm italic">No options found</div>
              ) : (
                options.map((option, idx) => (
                  <div
                    key={`${option}-${idx}`}
                    onClick={() => toggleOption(option)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                      selected.includes(option) ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <span>{option}</span>
                    {selected.includes(option) && <Check className="w-4 h-4" />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
