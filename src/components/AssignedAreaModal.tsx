import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Layers, MapPin, Sliders, ShieldCheck, Database, ChevronDown, Check, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LotData } from "../types";
import { ThemeConfig } from "../lib/theme";

interface AssignedAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (assignedArea: { cp: string[]; lgu: string[]; zone: string[] }) => void;
  lotData: LotData[];
  activeTheme: ThemeConfig;
  initialValue?: { cp: string[]; lgu: string[]; zone: string[] } | null;
}

interface MultiSelectFieldProps {
  label: string;
  icon: React.ReactNode;
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allLabel: string;
  activeTheme: ThemeConfig;
  displayTextFormat?: (val: string) => string;
  availableOptions?: string[];
}

const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  label,
  icon,
  options,
  selectedValues,
  onChange,
  allLabel,
  activeTheme,
  displayTextFormat,
  availableOptions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter options by search query
  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle single option selection
  const handleToggleOption = (option: string) => {
    if (option === "All") {
      onChange(["All"]);
    } else {
      let nextSelected = selectedValues.filter(v => v !== "All");
      if (nextSelected.includes(option)) {
        nextSelected = nextSelected.filter(v => v !== option);
      } else {
        nextSelected = [...nextSelected, option];
      }
      
      // If none selected, default to All
      if (nextSelected.length === 0) {
        onChange(["All"]);
      } else {
        // If all available options are selected individually, coalesce into All
        const allMainOptsSelected = options.every(opt => nextSelected.includes(opt));
        if (allMainOptsSelected) {
          onChange(["All"]);
        } else {
          onChange(nextSelected);
        }
      }
    }
  };

  const isAllSelected = selectedValues.includes("All");

  return (
    <div className="space-y-1.5 relative select-none" ref={containerRef}>
      <label className="text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-1.5 text-slate-400">
        {icon} {label}
      </label>
      
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full border rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition-all text-left flex items-center justify-between gap-2 cursor-pointer ${
          activeTheme.isDark 
            ? "bg-slate-950 border-slate-800 text-white hover:border-slate-700" 
            : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300"
        }`}
      >
        <span className="truncate max-w-[90%] font-bold">
          {isAllSelected 
            ? allLabel 
            : selectedValues.map(v => displayTextFormat ? displayTextFormat(v) : v).join(", ")}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform shadow-xs shrink-0 duration-200 opacity-60 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Floating Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className={`absolute left-0 right-0 mt-1 z-[11000] rounded-2xl border shadow-xl overflow-hidden max-h-60 flex flex-col ${
              activeTheme.isDark 
                ? "bg-slate-950 border-slate-800 text-white" 
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            {/* Search Input Filter */}
            {options.length > 5 && (
              <div className={`p-2 border-b flex items-center gap-2 ${
                activeTheme.isDark ? "border-slate-850 bg-slate-900" : "border-slate-100 bg-slate-50"
              }`}>
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search options..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-hidden text-xs font-semibold py-0.5 placeholder-slate-400"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
            )}

            {/* Options List */}
            <div className="overflow-y-auto overflow-x-hidden flex-1 p-1 max-h-48 custom-scrollbar">
              {/* Option "All" */}
              <button
                type="button"
                onClick={() => handleToggleOption("All")}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  isAllSelected 
                    ? "bg-indigo-500/15 text-indigo-500 dark:text-indigo-400" 
                    : activeTheme.isDark ? "hover:bg-slate-900 text-slate-300" : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span>{allLabel}</span>
                {isAllSelected && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
              </button>

              <div className={`h-px my-1 ${activeTheme.isDark ? "bg-slate-855 bg-slate-850" : "bg-slate-100"}`} />

              {filteredOptions.length === 0 ? (
                <div className="p-3 text-center text-[10px] text-slate-400 italic">
                  No matching options found
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = selectedValues.includes(opt);
                  const isAvailable = !availableOptions || availableOptions.length === 0 || availableOptions.includes(opt);
                  return (
                    <button
                      type="button"
                      key={`${opt}-${idx}`}
                      onClick={() => handleToggleOption(opt)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                        isSelected 
                          ? "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400" 
                          : activeTheme.isDark ? "hover:bg-slate-900 text-slate-300" : "hover:bg-slate-50 text-slate-700"
                      } ${!isAvailable ? "opacity-45 italic" : ""}`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {displayTextFormat ? displayTextFormat(opt) : opt}
                        {!isAvailable && (
                          <span className="text-[9px] px-1 py-0.5 rounded-md font-normal scale-90 border border-amber-500/30 text-amber-500/70 shrink-0">
                            filtered
                          </span>
                        )}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-indigo-500 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const AssignedAreaModal: React.FC<AssignedAreaModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  lotData,
  activeTheme,
  initialValue
}) => {
  const [selectedCP, setSelectedCP] = useState<string[]>(initialValue?.cp || ["All"]);
  const [selectedLGU, setSelectedLGU] = useState<string[]>(initialValue?.lgu || ["All"]);
  const [selectedZone, setSelectedZone] = useState<string[]>(initialValue?.zone || ["All"]);

  // Sync initialValue when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCP(initialValue?.cp || ["All"]);
      setSelectedLGU(initialValue?.lgu || ["All"]);
      setSelectedZone(initialValue?.zone || ["All"]);
    }
  }, [isOpen, initialValue]);

  // Get full lists from source data
  const allCPs = useMemo(() => {
    return Array.from(new Set(lotData.map(l => l.cp).filter(Boolean))).sort();
  }, [lotData]);

  const allLGUs = useMemo(() => {
    return Array.from(new Set(lotData.map(l => l.lgu).filter(Boolean))).sort();
  }, [lotData]);

  const allZones = useMemo(() => {
    return Array.from(new Set(lotData.map(l => l.zone).filter(Boolean))).sort();
  }, [lotData]);

  // Interleaved / Faceted dynamic option calculating
  const cpOptions = useMemo(() => {
    let list = lotData;
    if (!selectedLGU.includes("All")) {
      list = list.filter(l => selectedLGU.includes(l.lgu));
    }
    if (!selectedZone.includes("All")) {
      list = list.filter(l => selectedZone.includes(l.zone));
    }
    return Array.from(new Set(list.map(l => l.cp).filter(Boolean))).sort();
  }, [lotData, selectedLGU, selectedZone]);

  const lguOptions = useMemo(() => {
    let list = lotData;
    if (!selectedCP.includes("All")) {
      list = list.filter(l => selectedCP.includes(l.cp));
    }
    if (!selectedZone.includes("All")) {
      list = list.filter(l => selectedZone.includes(l.zone));
    }
    return Array.from(new Set(list.map(l => l.lgu).filter(Boolean))).sort();
  }, [lotData, selectedCP, selectedZone]);

  const zoneOptions = useMemo(() => {
    let list = lotData;
    if (!selectedCP.includes("All")) {
      list = list.filter(l => selectedCP.includes(l.cp));
    }
    if (!selectedLGU.includes("All")) {
      list = list.filter(l => selectedLGU.includes(l.lgu));
    }
    return Array.from(new Set(list.map(l => l.zone).filter(Boolean))).sort();
  }, [lotData, selectedCP, selectedLGU]);

  // Count matches in real-time based on selected fields
  const matchingLotsCount = useMemo(() => {
    return lotData.filter(lot => {
      const matchCP = selectedCP.includes("All") || selectedCP.includes(lot.cp);
      const matchLGU = selectedLGU.includes("All") || selectedLGU.includes(lot.lgu);
      const matchZone = selectedZone.includes("All") || selectedZone.includes(lot.zone);
      return matchCP && matchLGU && matchZone;
    }).length;
  }, [lotData, selectedCP, selectedLGU, selectedZone]);

  const handleConfirm = () => {
    onConfirm({
      cp: selectedCP,
      lgu: selectedLGU,
      zone: selectedZone
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md antialiased select-none">
        {/* Backdrop clickable to dismiss */}
        <div className="fixed inset-0 cursor-pointer" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className={`relative max-w-lg w-full border rounded-[2.5rem] overflow-visible shadow-2xl p-6 sm:p-8 flex flex-col gap-6 cursor-default z-10 ${
            activeTheme.isDark 
              ? "bg-slate-900 border-slate-800 text-slate-100" 
              : "bg-white border-slate-200 text-slate-800"
          }`}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className={`absolute top-5 right-5 p-2 rounded-full cursor-pointer transition-colors ${
              activeTheme.isDark ? "bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800"
            }`}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Area */}
          <div className="flex flex-col gap-1 pr-6 text-left">
            <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-505 text-indigo-500">
              <ShieldCheck className="w-3.5 h-3.5" /> GCR-SC Security Perimeter
            </span>
            <h2 className="text-lg font-black uppercase leading-tight tracking-tight">
              Reports & Planning Assignment
            </h2>
            <p className={`text-[11px] font-medium leading-relaxed ${activeTheme.isDark ? "text-slate-400" : "text-slate-500"}`}>
              Your access to total dashboard summary reports is restricted. Please configure your designated contract operational area below to continue (Multiple selections are now supported!):
            </p>
          </div>

          {/* Input Controls */}
          <div className="space-y-4 text-left">
            <MultiSelectField
              label="Contract Package Assigned"
              icon={<Layers className="w-3.5 h-3.5 text-indigo-500" />}
              options={allCPs}
              selectedValues={selectedCP}
              onChange={setSelectedCP}
              allLabel="All Packages"
              activeTheme={activeTheme}
              availableOptions={cpOptions}
            />

            <MultiSelectField
              label="LGU / Municipality Assigned"
              icon={<MapPin className="w-3.5 h-3.5 text-indigo-500" />}
              options={allLGUs}
              selectedValues={selectedLGU}
              onChange={setSelectedLGU}
              allLabel="All LGUs / Municipalities"
              activeTheme={activeTheme}
              availableOptions={lguOptions}
            />

            <MultiSelectField
              label="Zone Assigned Area"
              icon={<Sliders className="w-3.5 h-3.5 text-indigo-500" />}
              options={allZones}
              selectedValues={selectedZone}
              onChange={setSelectedZone}
              allLabel="All Zones"
              activeTheme={activeTheme}
              displayTextFormat={(val) => val === "All" ? val : `Zone ${val}`}
              availableOptions={zoneOptions}
            />
          </div>

          {/* matching preview counters box */}
          <div className={`p-4 rounded-3xl border text-left flex gap-3.5 items-center ${
            activeTheme.isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200/80"
          }`}>
            <div className={`p-2.5 rounded-xl ${activeTheme.isDark ? "bg-slate-850" : "bg-white"} shadow-2xs`}>
              <Database className="w-5 h-5 text-indigo-550 text-indigo-500" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[8.5px] uppercase font-black text-slate-400 tracking-wider">Dynamic Matching Database Coverage</span>
              <p className="text-xl font-black font-mono">
                {matchingLotsCount.toLocaleString()}{" "}
                <span className="text-xs font-extrabold text-slate-400">lots mapped</span>
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                activeTheme.isDark ? "hover:bg-slate-850 text-slate-300" : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              Cancel Access
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`px-6 py-2.5 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer ${activeTheme.primaryBg} ${activeTheme.primaryShadow}`}
            >
              Confirm Operational Area
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

