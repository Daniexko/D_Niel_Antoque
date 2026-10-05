import React, { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, History } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { ThemeConfig } from "../lib/theme";

interface HeaderSearchBoxProps {
  lotData: any[];
  activeTheme: ThemeConfig;
  onSelectLot: (id: string) => void;
}

export const HeaderSearchBox: React.FC<HeaderSearchBoxProps> = ({
  lotData,
  activeTheme,
  onSelectLot
}) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("gcr_recent_searches");
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent searches", e);
    }
  }, []);

  // Debounce the search input locally to keep typing fluid and responsive
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  // Optimize search by looking up preprocessed search string
  const searchResults = useMemo(() => {
    const query = debouncedSearch.toLowerCase().trim();
    if (!query) return [];

    return lotData.filter(lot => {
      const searchTarget = lot._searchStr || `${(lot.lotId || "").toLowerCase()} | ${(lot.ownerName || "").toLowerCase()} | ${(lot.controlNo || "").toLowerCase()} | ${(lot.affectedStructure || "").toLowerCase()} | ${(lot.pierNo || "").toLowerCase()}`;
      return searchTarget.includes(query);
    }).slice(0, 10);
  }, [debouncedSearch, lotData]);

  // Map search history IDs back to actual objects in lotData
  const recentLots = useMemo(() => {
    return recentSearches
      .map(id => lotData.find(lot => lot.id === id || lot.lotId === id))
      .filter((lot): lot is any => !!lot);
  }, [recentSearches, lotData]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (lotId: string) => {
    onSelectLot(lotId);
    setSearch("");
    setIsFocused(false);

    // Save to recent searches
    setRecentSearches(prev => {
      const updated = [lotId, ...prev.filter(id => id !== lotId)].slice(0, 5);
      try {
        localStorage.setItem("gcr_recent_searches", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save recent searches", e);
      }
      return updated;
    });
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    try {
      localStorage.removeItem("gcr_recent_searches");
    } catch (e) {
      console.error("Failed to clear recent searches", e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchResults.length > 0) {
      handleSelect(searchResults[0].lotId || searchResults[0].id);
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center w-full max-w-[120px] sm:max-w-[150px] md:max-w-[180px] lg:max-w-[200px] xl:max-w-[240px] 2xl:max-w-[320px] min-w-[80px] transition-all duration-300">
      <div className="relative w-full">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="w-3 h-3" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsFocused(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder="Search lot, owner, control..."
          className={cn(
            "w-full pl-7.5 pr-7 py-1 rounded-full border text-[9.5px] uppercase font-bold tracking-tight transition-all focus:ring-4 outline-none",
            activeTheme.isDark
              ? "bg-slate-900 border-slate-800 focus:border-indigo-505 text-slate-200 placeholder-slate-500 focus:ring-indigo-505/10"
              : "bg-slate-100/85 hover:bg-slate-100 border-slate-200 focus:bg-white focus:border-indigo-550 text-slate-800 placeholder-slate-400 focus:ring-indigo-550/10"
          )}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-850 transition-colors cursor-pointer"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* DROP DOWN SEARCH PORTAL RESULTS */}
      <AnimatePresence>
        {isFocused && (search.trim().length > 0 || recentLots.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute top-[110%] left-0 right-0 max-h-[290px] overflow-y-auto rounded-2xl border shadow-xl z-50 p-2 text-left custom-scrollbar",
              activeTheme.isDark
                ? "bg-slate-950 border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-900"
            )}
          >
            {search.trim().length > 0 ? (
              searchResults.length === 0 ? (
                <div className="py-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-455">
                  No lot matches found
                </div>
              ) : (
                searchResults.map((lot) => (
                  <button
                    key={lot.id}
                    type="button"
                    onMouseDown={() => handleSelect(lot.lotId || lot.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-[10.5px] uppercase font-bold flex flex-col gap-0.5 transition-all outline-none cursor-pointer",
                      activeTheme.isDark
                        ? "hover:bg-slate-900 text-slate-200"
                        : "hover:bg-slate-100 text-slate-800"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-indigo-600 dark:text-indigo-400">
                        {lot.lotId}
                      </span>
                      <span className="text-[8px] opacity-60 font-mono">
                        {lot.cp || "CP BLOCK"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[9.5px] leading-snug font-extrabold pr-1 gap-1 border-t border-slate-550/5 mt-1 pt-1">
                      <span className="text-slate-700 dark:text-slate-350 break-words">{lot.ownerName || "— Unregistered —"}</span>
                      <span className="opacity-55 shrink-0 font-mono text-[8px]">
                        {lot.affectedStructure && lot.affectedStructure !== "-" 
                          ? `Struct: ${lot.affectedStructure}` 
                          : lot.controlNo !== "-" && lot.controlNo 
                          ? `Control: ${lot.controlNo}` 
                          : "No Struct Data"}
                      </span>
                    </div>
                  </button>
                ))
              )
            ) : (
              <div className="flex flex-col">
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-500/10 mb-1 select-none">
                  <div className="flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-widest text-slate-400">
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Recent Searches</span>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClearRecent();
                    }}
                    className="text-[8px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-350 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                {recentLots.map((lot) => lot && (
                  <button
                    key={lot.id}
                    type="button"
                    onMouseDown={() => handleSelect(lot.lotId || lot.id)}
                    className={cn(
                      "w-full text-left px-3 py-1.5 rounded-xl text-[10.5px] uppercase font-bold flex flex-col gap-0.5 transition-all outline-none cursor-pointer",
                      activeTheme.isDark
                        ? "hover:bg-slate-900 text-slate-200"
                        : "hover:bg-slate-100 text-slate-800"
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
                    <div className="flex justify-between items-center text-[9px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                      <span className="truncate max-w-[150px]">{lot.ownerName || "— Unregistered —"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
