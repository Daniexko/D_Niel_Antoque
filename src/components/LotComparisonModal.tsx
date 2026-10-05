import React, { useState, useMemo } from "react";
import { 
  GitCompare, 
  X, 
  Search, 
  ArrowLeftRight, 
  Check, 
  AlertTriangle, 
  FileText, 
  Coins, 
  Activity, 
  Sparkles, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Scale
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { ThemeConfig } from "../lib/theme";
import { LotData } from "../types";

interface LotComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LotData[];
  activeTheme: ThemeConfig;
  initialLotAId?: string | null;
  initialLotBId?: string | null;
  onViewLotDetails?: (lotId: string) => void;
}

export const LotComparisonModal: React.FC<LotComparisonModalProps> = ({
  isOpen,
  onClose,
  data = [],
  activeTheme,
  initialLotAId = null,
  initialLotBId = null,
  onViewLotDetails
}) => {
  // Select state for Lot A and Lot B
  const [lotAId, setLotAId] = useState<string>(initialLotAId || "");
  const [lotBId, setLotBId] = useState<string>(initialLotBId || "");

  // Search queries for select comboboxes
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");
  const [isDropdownAOpen, setIsDropdownAOpen] = useState(false);
  const [isDropdownBOpen, setIsDropdownBOpen] = useState(false);

  // Toggle to show only differences
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);

  // Swap positions of Lot A and Lot B
  const handleSwap = () => {
    const tempId = lotAId;
    setLotAId(lotBId);
    setLotBId(tempId);

    const tempSearch = searchA;
    setSearchA(searchB);
    setSearchB(tempSearch);
  };

  // Preprocessed search string search list
  const preprocessedLots = useMemo(() => {
    return data.map(lot => ({
      ...lot,
      _searchStr: `${lot.lotId} ${lot.ownerName || ""} ${lot.cp || ""}`.toLowerCase()
    }));
  }, [data]);

  // Synchronize initial selections
  React.useEffect(() => {
    if (initialLotAId) setLotAId(initialLotAId);
  }, [initialLotAId]);

  React.useEffect(() => {
    if (initialLotBId) setLotBId(initialLotBId);
  }, [initialLotBId]);

  // Filter lots based on query A and B
  const filteredLotsA = useMemo(() => {
    const query = searchA.trim().toLowerCase();
    if (!query) return preprocessedLots.slice(0, 10);
    return preprocessedLots.filter(l => l._searchStr.includes(query)).slice(0, 10);
  }, [searchA, preprocessedLots]);

  const filteredLotsB = useMemo(() => {
    const query = searchB.trim().toLowerCase();
    if (!query) return preprocessedLots.slice(0, 10);
    return preprocessedLots.filter(l => l._searchStr.includes(query)).slice(0, 10);
  }, [searchB, preprocessedLots]);

  // Selected lot structures
  const lotA = useMemo(() => {
    return data.find(l => l.id === lotAId || l.lotId === lotAId) || null;
  }, [lotAId, data]);

  const lotB = useMemo(() => {
    return data.find(l => l.id === lotBId || l.lotId === lotBId) || null;
  }, [lotBId, data]);

  // Helper formats
  const formatCurrency = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null || val === "" || val === "-") return "₱0.00";
    const num = typeof val === "number" ? val : parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return "₱0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "PHP"
    }).format(num);
  };

  const formatArea = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === "" || val === "-") return "0.00 sq.m";
    const num = typeof val === "number" ? val : parseFloat(val.toString().replace(/[^0-9.-]+/g, ""));
    if (isNaN(num)) return "0.00 sq.m";
    return `${num.toLocaleString("en-US", { minimumFractionDigits: 2 })} sq.m`;
  };

  // Helper to compare two values and see if they differ
  const hasDiff = (val1: any, val2: any, isCurrencyField = false): boolean => {
    if (!lotA || !lotB) return false;
    
    let norm1 = (val1 || "").toString().trim().toUpperCase();
    let norm2 = (val2 || "").toString().trim().toUpperCase();

    if (isCurrencyField) {
      const num1 = parseFloat((val1 || "0").toString().replace(/[^0-9.-]+/g, ""));
      const num2 = parseFloat((val2 || "0").toString().replace(/[^0-9.-]+/g, ""));
      return (isNaN(num1) ? 0 : num1) !== (isNaN(num2) ? 0 : num2);
    }

    return norm1 !== norm2;
  };

  interface ComparisonRow {
    label: string;
    valA: any;
    valB: any;
    isArea?: boolean;
    isCurrency?: boolean;
    isLink?: boolean;
    isRemarks?: boolean;
  }

  // Comparison metrics rows configuration
  const generalRows: ComparisonRow[] = [
    { label: "Lot ID", valA: lotA?.lotId, valB: lotB?.lotId },
    { label: "Contract Package (CP)", valA: lotA?.cp, valB: lotB?.cp },
    { label: "Owner Name", valA: lotA?.ownerName, valB: lotB?.ownerName },
    { label: "Ownership Class", valA: lotA?.ownerClassification, valB: lotB?.ownerClassification },
    { label: "City / LGU", valA: lotA?.lgu, valB: lotB?.lgu },
    { label: "Barangay", valA: lotA?.barangay, valB: lotB?.barangay },
    { label: "Zone", valA: lotA?.zone, valB: lotB?.zone },
    { label: "Total Area", valA: lotA?.totalArea, valB: lotB?.totalArea, isArea: true },
    { label: "Affected Area", valA: lotA?.affectedArea, valB: lotB?.affectedArea, isArea: true },
    { label: "Remaining Area", valA: lotA?.remainingArea, valB: lotB?.remainingArea, isArea: true },
    { label: "PROW Impact", valA: lotA?.prowImpact, valB: lotB?.prowImpact },
  ];

  const paymentRows: ComparisonRow[] = [
    { label: "Payment Status", valA: lotA?.paymentStatus, valB: lotB?.paymentStatus },
    { label: "Payment Date", valA: lotA?.datePaid, valB: lotB?.datePaid },
    { label: "Appraisal Year", valA: lotA?.appraisalYear, valB: lotB?.appraisalYear },
    { label: "Est. Land Cost", valA: lotA?.estimatedLandCost, valB: lotB?.estimatedLandCost, isCurrency: true },
    { label: "Est. Structure Cost", valA: lotA?.estimatedStructureCost, valB: lotB?.estimatedStructureCost, isCurrency: true },
    { label: "Total Appraisal Value", valA: lotA?.totalEstimatedCost, valB: lotB?.totalEstimatedCost, isCurrency: true },
    { label: "Actual Land Cost", valA: lotA?.actualLandCost, valB: lotB?.actualLandCost, isCurrency: true },
    { label: "Actual Structure Cost", valA: lotA?.actualStructureCost, valB: lotB?.actualStructureCost, isCurrency: true },
    { 
      label: "Total Actual Cost", 
      valA: (Number(lotA?.actualLandCost) || 0) + (Number(lotA?.actualStructureCost) || 0), 
      valB: (Number(lotB?.actualLandCost) || 0) + (Number(lotB?.actualStructureCost) || 0), 
      isCurrency: true 
    },
    { label: "Actual Crops/Trees Cost", valA: lotA?.actualCropTree, valB: lotB?.actualCropTree, isCurrency: true },
    { label: "Advance Payment Date", valA: lotA?.advancePaymentDate, valB: lotB?.advancePaymentDate },
  ];

  const milestoneRows: ComparisonRow[] = [
    { label: "NoT Status", valA: lotA?.statusNot, valB: lotB?.statusNot },
    { label: "NoT Date Issued", valA: lotA?.dateNot, valB: lotB?.dateNot },
    { label: "OTB Status", valA: lotA?.statusOtb, valB: lotB?.statusOtb },
    { label: "OTB Date Issued", valA: lotA?.dateOtb, valB: lotB?.dateOtb },
    { label: "LO Reply to OTB", valA: lotA?.otbReply, valB: lotB?.otbReply },
    { label: "LO Reply Date", valA: lotA?.otbReplyDate, valB: lotB?.otbReplyDate },
    { label: "DOAS Status", valA: lotA?.statusDoas, valB: lotB?.statusDoas },
    { label: "DOAS Date Signed", valA: lotA?.dateDoas, valB: lotB?.dateDoas },
    { label: "PTE Status", valA: lotA?.statusPte, valB: lotB?.statusPte },
    { label: "PTE Date Signed", valA: lotA?.datePte, valB: lotB?.datePte },
    { label: "CNO / MOA Status", valA: lotA?.withCnoMoa, valB: lotB?.withCnoMoa },
    { label: "Handed Over Date", valA: lotA?.handedOver, valB: lotB?.handedOver },
    { label: "Site Access Date", valA: lotA?.siteAccessDate, valB: lotB?.siteAccessDate },
  ];

  const registryRows: ComparisonRow[] = [
    { label: "Relocation Status", valA: lotA?.relocation, valB: lotB?.relocation },
    { label: "Relocation Date", valA: lotA?.relocationDate, valB: lotB?.relocationDate },
    { label: "DENR Subplan Status", valA: lotA?.denr, valB: lotB?.denr },
    { label: "Titling Status", valA: lotA?.titling, valB: lotB?.titling },
    { label: "Expropriation Status", valA: lotA?.exproStatus, valB: lotB?.exproStatus },
    { label: "Overall SAD", valA: lotA?.overallSad, valB: lotB?.overallSad },
    { label: "Documents Vault Folder", valA: lotA?.folderLink, valB: lotB?.folderLink, isLink: true },
    { label: "General Remarks", valA: lotA?.remarks, valB: lotB?.remarks, isRemarks: true },
  ];

  // Filter rows based on "Show Differences Only" toggle
  const getFilteredRows = (rows: ComparisonRow[]) => {
    if (!showDifferencesOnly) return rows;
    return rows.filter(r => hasDiff(r.valA, r.valB, r.isCurrency));
  };

  const activeGeneralRows = getFilteredRows(generalRows);
  const activePaymentRows = getFilteredRows(paymentRows);
  const activeMilestoneRows = getFilteredRows(milestoneRows);
  const activeRegistryRows = getFilteredRows(registryRows);

  const totalDifferencesCount = useMemo(() => {
    if (!lotA || !lotB) return 0;
    let count = 0;
    [...generalRows, ...paymentRows, ...milestoneRows, ...registryRows].forEach(r => {
      if (hasDiff(r.valA, r.valB, r.isCurrency)) count++;
    });
    return count;
  }, [lotA, lotB]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={cn(
          "relative w-full max-w-6xl rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden",
          activeTheme.isDark 
            ? "bg-slate-900 border-slate-800 text-slate-100" 
            : "bg-white border-stone-200 text-stone-900"
        )}
      >
        {/* Header Block */}
        <div className={cn(
          "px-6 py-4 border-b flex items-center justify-between shrink-0 select-none",
          activeTheme.isDark ? "border-slate-800 bg-slate-950/50" : "border-stone-150 bg-stone-50/50"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-2xl">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider">Lot Comparison Engine</h2>
              <p className="text-[10px] text-slate-400 font-medium">Analyze parameters, payments, and milestones side-by-side</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lotA && lotB && (
              <button
                type="button"
                onClick={() => setShowDifferencesOnly(p => !p)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                  showDifferencesOnly
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                    : activeTheme.isDark 
                      ? "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-400 hover:text-slate-200" 
                      : "bg-white hover:bg-stone-50 border-stone-200 text-stone-500 hover:text-stone-700"
                )}
              >
                {showDifferencesOnly ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showDifferencesOnly ? "Showing Differences Only" : "Show Differences Only"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-rose-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Selection Tray */}
        <div className={cn(
          "p-6 border-b grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 items-end shrink-0 relative z-50",
          activeTheme.isDark ? "border-slate-800 bg-slate-950/10" : "border-stone-150 bg-stone-50/20"
        )}>
          {/* LOT A SELECT */}
          <div className="relative">
            <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-mono">Lot Position A</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={isDropdownAOpen ? searchA : lotA ? `${lotA.lotId} - ${lotA.ownerName || "Unregistered"}` : ""}
                onChange={(e) => {
                  setSearchA(e.target.value);
                  setIsDropdownAOpen(true);
                }}
                onFocus={() => {
                  setSearchA("");
                  setIsDropdownAOpen(true);
                }}
                placeholder="Search Lot ID or Owner A..."
                className={cn(
                  "w-full pl-9 pr-9 py-2.5 rounded-2xl outline-none font-bold text-xs focus:ring-4 focus:ring-indigo-505/10",
                  activeTheme.isDark 
                    ? "bg-slate-950 text-slate-100 border border-slate-850 focus:border-indigo-500" 
                    : "bg-white text-stone-850 border border-stone-250 focus:border-indigo-550"
                )}
              />
              {lotAId && (
                <button
                  type="button"
                  onClick={() => { setLotAId(""); setSearchA(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {isDropdownAOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownAOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className={cn(
                      "absolute top-[110%] left-0 right-0 max-h-[250px] overflow-y-auto rounded-2xl border shadow-xl z-50 p-2 text-left custom-scrollbar",
                      activeTheme.isDark ? "bg-slate-950 border-slate-800" : "bg-white border-stone-250"
                    )}
                  >
                    {filteredLotsA.length === 0 ? (
                      <div className="py-4 text-center text-[10px] font-bold text-slate-450 uppercase tracking-widest">No matching lots</div>
                    ) : (
                      filteredLotsA.map((lot) => (
                        <button
                          key={lot.id}
                          type="button"
                          onClick={() => {
                            setLotAId(lot.id);
                            setIsDropdownAOpen(false);
                            setSearchA("");
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-[10px] uppercase font-bold flex flex-col gap-0.5 transition-all cursor-pointer",
                            activeTheme.isDark ? "hover:bg-slate-905 text-slate-250" : "hover:bg-stone-50 text-stone-800"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-black text-indigo-500">{lot.lotId}</span>
                            <span className="opacity-60 text-[8px] font-mono">{lot.cp}</span>
                          </div>
                          <span className="opacity-70 mt-0.5 text-slate-450 truncate">{lot.ownerName || "— Unregistered —"}</span>
                        </button>
                      ))
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {lotA && (
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => { onViewLotDetails?.(lotA.id || lotA.lotId); onClose(); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[8.5px] font-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                    activeTheme.isDark
                      ? "bg-indigo-600/10 hover:bg-indigo-600/20 border-indigo-500/25 text-indigo-400 hover:text-indigo-300"
                      : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 hover:text-indigo-800"
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Lot {lotA.lotId} Details
                </button>
              </div>
            )}
          </div>

          {/* SWAP BUTTON */}
          <div className="flex justify-center pb-1 shrink-0">
            <button
              type="button"
              onClick={handleSwap}
              className={cn(
                "p-2.5 rounded-full border transition-all duration-300 hover:rotate-180 cursor-pointer shadow-md active:scale-95 flex items-center justify-center",
                activeTheme.isDark
                  ? "bg-slate-900 border-slate-800 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 hover:border-slate-700"
                  : "bg-white border-stone-250 text-indigo-600 hover:text-indigo-700 hover:bg-stone-50 hover:border-stone-300"
              )}
              title="Swap Position A and B"
              aria-label="Swap Lot positions"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* LOT B SELECT */}
          <div className="relative">
            <label className="text-[9.5px] font-black uppercase tracking-widest text-slate-400 block mb-2 font-mono">Lot Position B</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={isDropdownBOpen ? searchB : lotB ? `${lotB.lotId} - ${lotB.ownerName || "Unregistered"}` : ""}
                onChange={(e) => {
                  setSearchB(e.target.value);
                  setIsDropdownBOpen(true);
                }}
                onFocus={() => {
                  setSearchB("");
                  setIsDropdownBOpen(true);
                }}
                placeholder="Search Lot ID or Owner B..."
                className={cn(
                  "w-full pl-9 pr-9 py-2.5 rounded-2xl outline-none font-bold text-xs focus:ring-4 focus:ring-indigo-505/10",
                  activeTheme.isDark 
                    ? "bg-slate-950 text-slate-100 border border-slate-850 focus:border-indigo-500" 
                    : "bg-white text-stone-850 border border-stone-250 focus:border-indigo-550"
                )}
              />
              {lotBId && (
                <button
                  type="button"
                  onClick={() => { setLotBId(""); setSearchB(""); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {isDropdownBOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownBOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className={cn(
                      "absolute top-[110%] left-0 right-0 max-h-[250px] overflow-y-auto rounded-2xl border shadow-xl z-50 p-2 text-left custom-scrollbar",
                      activeTheme.isDark ? "bg-slate-950 border-slate-800" : "bg-white border-stone-250"
                    )}
                  >
                    {filteredLotsB.length === 0 ? (
                      <div className="py-4 text-center text-[10px] font-bold text-slate-450 uppercase tracking-widest">No matching lots</div>
                    ) : (
                      filteredLotsB.map((lot) => (
                        <button
                          key={lot.id}
                          type="button"
                          onClick={() => {
                            setLotBId(lot.id);
                            setIsDropdownBOpen(false);
                            setSearchB("");
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl text-[10px] uppercase font-bold flex flex-col gap-0.5 transition-all cursor-pointer",
                            activeTheme.isDark ? "hover:bg-slate-905 text-slate-250" : "hover:bg-stone-50 text-stone-800"
                          )}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-black text-indigo-500">{lot.lotId}</span>
                            <span className="opacity-60 text-[8px] font-mono">{lot.cp}</span>
                          </div>
                          <span className="opacity-70 mt-0.5 text-slate-450 truncate">{lot.ownerName || "— Unregistered —"}</span>
                        </button>
                      ))
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {lotB && (
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={() => { onViewLotDetails?.(lotB.id || lotB.lotId); onClose(); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[8.5px] font-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer",
                    activeTheme.isDark
                      ? "bg-indigo-600/10 hover:bg-indigo-600/20 border-indigo-500/25 text-indigo-400 hover:text-indigo-300"
                      : "bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-700 hover:text-indigo-800"
                  )}
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Lot {lotB.lotId} Details
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrolling Comparisons Field Container */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 select-text">
          {!lotA || !lotB ? (
            <div className="py-24 text-center text-slate-400 select-none max-w-md mx-auto">
              <Scale className="w-12 h-12 text-slate-400/40 mx-auto mb-4 animate-bounce-slow" />
              <h3 className="text-sm font-black uppercase tracking-wider">Select Two Lots to Begin</h3>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                Use the search fields above to select any two distinct lots from our land masterlist. The comparison deck will calculate differences in milestones, costs, and ownership details instantly.
              </p>
            </div>
          ) : (
            <>
              {/* Diff summary box if differences are found */}
              {totalDifferencesCount > 0 ? (
                <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl select-none">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h4 className="text-xs font-black text-amber-500 uppercase tracking-wide">Variance Detected</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      We detected <strong className="text-amber-500">{totalDifferencesCount} difference(s)</strong> across payments, milestones, and documentation records between Lot <strong className="font-mono text-slate-300">{lotA.lotId}</strong> and Lot <strong className="font-mono text-slate-300">{lotB.lotId}</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl select-none">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-wide">Identical Profiles</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Both selected lot profiles contain completely identical tracking and financial parameters. No differences were detected.
                    </p>
                  </div>
                </div>
              )}

              {/* Lot Columns Action Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Lot A Column Card */}
                <div className={cn(
                  "p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all duration-300",
                  activeTheme.isDark 
                    ? "bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80 text-slate-100" 
                    : "bg-stone-50 border-stone-200 hover:border-stone-300 text-slate-800"
                )}>
                  <div className="space-y-1">
                    <span className="text-[8px] text-indigo-500 font-mono font-black uppercase tracking-widest block">Column Lot A</span>
                    <h4 className="text-sm font-black tracking-tight font-mono text-slate-800 dark:text-slate-100">{lotA.lotId}</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium truncate">{lotA.ownerName || "Unregistered"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onViewLotDetails?.(lotA.id || lotA.lotId); onClose(); }}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-3xs",
                      activeTheme.isDark
                        ? "bg-indigo-600 hover:bg-indigo-550 text-white shadow-indigo-650/10"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Lot {lotA.lotId} Details
                  </button>
                </div>

                {/* Lot B Column Card */}
                <div className={cn(
                  "p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all duration-300",
                  activeTheme.isDark 
                    ? "bg-slate-950/40 border-slate-800/80 hover:border-slate-700/80 text-slate-100" 
                    : "bg-stone-50 border-stone-200 hover:border-stone-300 text-slate-800"
                )}>
                  <div className="space-y-1">
                    <span className="text-[8px] text-indigo-500 font-mono font-black uppercase tracking-widest block">Column Lot B</span>
                    <h4 className="text-sm font-black tracking-tight font-mono text-slate-800 dark:text-slate-100">{lotB.lotId}</h4>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 font-medium truncate">{lotB.ownerName || "Unregistered"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { onViewLotDetails?.(lotB.id || lotB.lotId); onClose(); }}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-3xs",
                      activeTheme.isDark
                        ? "bg-indigo-600 hover:bg-indigo-550 text-white shadow-indigo-650/10"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Lot {lotB.lotId} Details
                  </button>
                </div>
              </div>

              {/* SECTION A: GENERAL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-550/10 pb-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-black text-sky-400 uppercase tracking-wider">1. General Metadata & Classification</h3>
                </div>
                {activeGeneralRows.length === 0 ? (
                  <p className="text-[10px] text-slate-450 italic pl-2">No differences in General Metadata.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {activeGeneralRows.map((row, idx) => {
                      const differed = hasDiff(row.valA, row.valB);
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "grid grid-cols-12 gap-4 p-3 rounded-2xl border text-xs items-center transition-all",
                            differed 
                              ? activeTheme.isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/40 border-amber-200"
                              : activeTheme.isDark ? "bg-slate-950/20 border-slate-850" : "bg-stone-50/50 border-stone-150"
                          )}
                        >
                          <div className="col-span-12 sm:col-span-4 font-extrabold uppercase text-[9.5px] tracking-wider text-slate-400 font-mono">
                            {row.label}
                            {differed && <span className="ml-1.5 text-[7px] bg-amber-500/10 text-amber-500 px-1 rounded">≠ Diff</span>}
                          </div>
                          
                          {/* Lot A */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pr-2">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot A ({lotA.lotId})</span>
                            <span className={cn(row.label === "Lot ID" && "font-mono font-bold")}>
                              {row.isArea ? formatArea(row.valA) : (row.valA || "—")}
                            </span>
                          </div>

                          {/* Lot B */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pl-2 border-l border-slate-500/10">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot B ({lotB.lotId})</span>
                            <span className={cn(row.label === "Lot ID" && "font-mono font-bold")}>
                              {row.isArea ? formatArea(row.valB) : (row.valB || "—")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION B: PAYMENTS & COSTS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-550/10 pb-2">
                  <Coins className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-xs font-black text-emerald-500 uppercase tracking-wider">2. Valuations, Costs & Paid Disbursements</h3>
                </div>
                {activePaymentRows.length === 0 ? (
                  <p className="text-[10px] text-slate-450 italic pl-2">No differences in Cost and Payments.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {activePaymentRows.map((row, idx) => {
                      const differed = hasDiff(row.valA, row.valB, row.isCurrency);
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "grid grid-cols-12 gap-4 p-3 rounded-2xl border text-xs items-center transition-all",
                            differed 
                              ? activeTheme.isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/40 border-amber-200"
                              : activeTheme.isDark ? "bg-slate-950/20 border-slate-850" : "bg-stone-50/50 border-stone-150"
                          )}
                        >
                          <div className="col-span-12 sm:col-span-4 font-extrabold uppercase text-[9.5px] tracking-wider text-slate-400 font-mono">
                            {row.label}
                            {differed && <span className="ml-1.5 text-[7px] bg-amber-500/10 text-amber-500 px-1 rounded">≠ Diff</span>}
                          </div>
                          
                          {/* Lot A */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pr-2">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot A ({lotA.lotId})</span>
                            <span className={cn(row.isCurrency && "font-mono font-semibold")}>
                              {row.isCurrency ? formatCurrency(row.valA) : (row.valA || "—")}
                            </span>
                          </div>

                          {/* Lot B */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pl-2 border-l border-slate-500/10">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot B ({lotB.lotId})</span>
                            <span className={cn(row.isCurrency && "font-mono font-semibold")}>
                              {row.isCurrency ? formatCurrency(row.valB) : (row.valB || "—")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION C: MILESTONES */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-550/10 pb-2">
                  <Activity className="w-4 h-4 text-violet-400" />
                  <h3 className="text-xs font-black text-violet-400 uppercase tracking-wider">3. Acquisition Milestones</h3>
                </div>
                {activeMilestoneRows.length === 0 ? (
                  <p className="text-[10px] text-slate-450 italic pl-2">No differences in Milestones.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {activeMilestoneRows.map((row, idx) => {
                      const differed = hasDiff(row.valA, row.valB);
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "grid grid-cols-12 gap-4 p-3 rounded-2xl border text-xs items-center transition-all",
                            differed 
                              ? activeTheme.isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/40 border-amber-200"
                              : activeTheme.isDark ? "bg-slate-950/20 border-slate-850" : "bg-stone-50/50 border-stone-150"
                          )}
                        >
                          <div className="col-span-12 sm:col-span-4 font-extrabold uppercase text-[9.5px] tracking-wider text-slate-400 font-mono">
                            {row.label}
                            {differed && <span className="ml-1.5 text-[7px] bg-amber-500/10 text-amber-500 px-1 rounded">≠ Diff</span>}
                          </div>
                          
                          {/* Lot A */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pr-2">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot A ({lotA.lotId})</span>
                            <span>{row.valA || "—"}</span>
                          </div>

                          {/* Lot B */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pl-2 border-l border-slate-500/10">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot B ({lotB.lotId})</span>
                            <span>{row.valB || "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION D: REGISTRY & DOCUMENTS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-550/10 pb-2">
                  <Sparkles className="w-4 h-4 text-[#4f46e5]" />
                  <h3 className="text-xs font-black text-[#4f46e5] uppercase tracking-wider">4. Secure Vault & Relocation Registry Documents</h3>
                </div>
                {activeRegistryRows.length === 0 ? (
                  <p className="text-[10px] text-slate-450 italic pl-2">No differences in Vault and Registry Documents.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5">
                    {activeRegistryRows.map((row, idx) => {
                      const differed = hasDiff(row.valA, row.valB);
                      return (
                        <div 
                          key={idx} 
                          className={cn(
                            "grid grid-cols-12 gap-4 p-3 rounded-2xl border text-xs items-center transition-all",
                            differed 
                              ? activeTheme.isDark ? "bg-amber-500/5 border-amber-500/20" : "bg-amber-50/40 border-amber-200"
                              : activeTheme.isDark ? "bg-slate-950/20 border-slate-850" : "bg-stone-50/50 border-stone-150"
                          )}
                        >
                          <div className="col-span-12 sm:col-span-4 font-extrabold uppercase text-[9.5px] tracking-wider text-slate-400 font-mono">
                            {row.label}
                            {differed && <span className="ml-1.5 text-[7px] bg-amber-500/10 text-amber-500 px-1 rounded">≠ Diff</span>}
                          </div>
                          
                          {/* Lot A */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pr-2">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot A ({lotA.lotId})</span>
                            {row.isLink ? (
                              row.valA && row.valA !== "-" ? (
                                <a 
                                  href={row.valA} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-indigo-500 hover:underline flex items-center gap-1 text-[11px]"
                                >
                                  Open Google Drive <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : "No Folder Link"
                            ) : (
                              <span className={cn(row.isRemarks && "text-[11px] leading-relaxed font-serif whitespace-pre-wrap block")}>
                                {row.valA || "—"}
                              </span>
                            )}
                          </div>

                          {/* Lot B */}
                          <div className="col-span-6 sm:col-span-4 font-medium break-words pl-2 border-l border-slate-500/10">
                            <span className="text-[8px] text-slate-450 block uppercase font-black font-mono">Lot B ({lotB.lotId})</span>
                            {row.isLink ? (
                              row.valB && row.valB !== "-" ? (
                                <a 
                                  href={row.valB} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-indigo-500 hover:underline flex items-center gap-1 text-[11px]"
                                >
                                  Open Google Drive <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : "No Folder Link"
                            ) : (
                              <span className={cn(row.isRemarks && "text-[11px] leading-relaxed font-serif whitespace-pre-wrap block")}>
                                {row.valB || "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className={cn(
          "px-6 py-4 border-t flex justify-end gap-3 select-none shrink-0",
          activeTheme.isDark ? "border-slate-800 bg-slate-950/40" : "border-stone-150 bg-stone-50/40"
        )}>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "px-5 py-2 rounded-xl text-[10.5px] uppercase font-black tracking-widest transition-all cursor-pointer",
              activeTheme.isDark 
                ? "bg-slate-850 hover:bg-slate-800 text-slate-200" 
                : "bg-stone-150 hover:bg-stone-200 text-stone-700"
            )}
          >
            Close Comparison
          </button>
        </div>
      </motion.div>
    </div>
  );
};
