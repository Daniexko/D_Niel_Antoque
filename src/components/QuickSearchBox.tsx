import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { ThemeConfig } from "../lib/theme";

interface QuickSearchBoxProps {
  preprocessedAll: any[];
  onSelectLot: (lot: any) => void;
  activeTheme: ThemeConfig;
}

export const QuickSearchBox: React.FC<QuickSearchBoxProps> = ({
  preprocessedAll,
  onSelectLot,
  activeTheme
}) => {
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Highly optimized local search filtering
  const quickSearchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    
    // Highly optimized search using pre-lowercased search string to prevent typing lag
    const results = [];
    for (let i = 0; i < preprocessedAll.length; i++) {
      const d = preprocessedAll[i];
      const target = d._searchStr || "";
      if (target.includes(query)) {
        results.push(d);
        if (results.length >= 10) break; // Limit to top 10 for super fast performance
      }
    }
    return results;
  }, [search, preprocessedAll]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRetrieveFirstMatch = () => {
    if (quickSearchResults.length > 0) {
      handleSelect(quickSearchResults[0]);
    }
  };

  const handleSelect = (lot: any) => {
    onSelectLot(lot);
    setSearch("");
    setIsFocused(false);
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-64 shrink-0 z-30">
      <div className="relative w-full">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="w-3.5 h-3.5" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsFocused(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleRetrieveFirstMatch();
            }
          }}
          onFocus={() => setIsFocused(true)}
          placeholder="Quick Lot ID Find..."
          className={cn(
            "w-full pl-9 pr-9 py-2 rounded-full outline-none transition-all font-mono font-bold text-[11px] focus:ring-4 focus:ring-indigo-505/10",
            activeTheme.isDark 
              ? "bg-slate-950 text-slate-100 border border-slate-850 focus:border-indigo-505 focus:bg-slate-950" 
              : "bg-white text-stone-850 border border-stone-250 focus:border-indigo-550 focus:bg-white"
          )}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Suggestion Dropdown */}
      <AnimatePresence>
        {isFocused && search.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className={cn(
              "absolute top-[110%] right-0 w-full sm:w-[260px] max-h-[300px] overflow-y-auto rounded-2xl border shadow-xl z-50 p-2 text-left custom-scrollbar",
              activeTheme.isDark
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-white border-stone-200 text-slate-900"
            )}
          >
            {quickSearchResults.length === 0 ? (
              <div className="py-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                No matches found
              </div>
            ) : (
              quickSearchResults.map((lot) => (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => handleSelect(lot)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-xl text-[10px] uppercase font-bold flex flex-col gap-0.5 transition-all outline-none cursor-pointer",
                    activeTheme.isDark
                      ? "hover:bg-slate-905 text-slate-200"
                      : "hover:bg-slate-100 text-slate-850"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {lot.lotId}
                    </span>
                    <span className="text-[8px] opacity-60 font-mono">
                      {lot.cp || "CP BLOCK"}
                    </span>
                  </div>
                  <div className="flex flex-col text-[8.5px] leading-snug font-extrabold pr-1 gap-1 border-t border-slate-500/10 mt-1 pt-1">
                    <span className="text-slate-650 dark:text-slate-350 break-words">{lot.ownerName || "— UnregisteredOwner —"}</span>
                    <span className="opacity-55 font-mono text-[7px]">
                      {lot.affectedStructure && lot.affectedStructure !== "-" 
                        ? `Struct: ${lot.affectedStructure}` 
                        : lot.controlNo !== "-" && lot.controlNo 
                        ? `Control: ${lot.controlNo}` 
                        : "No Struct Data"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
