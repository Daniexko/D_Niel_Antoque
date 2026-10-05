import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Calendar, 
  Info, 
  Download, 
  Calculator, 
  ShieldCheck, 
  Sparkles, 
  Database,
  Layers,
  LayoutGrid,
  ListCollapse,
  Search,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  TrendingUp,
  PieChart,
  Grid,
  FileText,
  ChevronRight,
  Filter,
  Minimize2,
  Maximize2,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Lightbulb
} from "lucide-react";
import { LotData } from "../types";
import { ThemeConfig } from "../lib/theme";

interface DisbursementPlanProps {
  data: LotData[];
  activeTheme?: ThemeConfig;
  onMaximize?: () => void;
  onHide?: () => void;
  isMaximized?: boolean;
}

type TabMode = "summary" | "spreadsheet" | "cards";
type QuarterFilter = "Q1" | "Q2" | "Q3" | "Q4" | "ALL";

// Inline SAD date parser extracting month (0-11) and 4-digit year (e.g. 2027)
const parseSADDate = (dateStr: string | undefined): { month: number; year: number } | null => {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (trimmed.toLowerCase().includes("no data") || trimmed === "" || trimmed === "-") {
    return null;
  }

  try {
    const parts = trimmed.split("-");
    if (parts.length === 2) {
      const mStr = parts[0].trim().toLowerCase().substring(0, 3);
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthIdx = months.indexOf(mStr);
      
      const yStr = parts[1].trim();
      let year = parseInt(yStr, 10);
      if (isNaN(year)) return null;
      if (yStr.length === 2 || year < 100) {
        year = 2000 + year;
      }
      
      if (monthIdx !== -1) {
        return { month: monthIdx, year };
      }
    }

    if (parts.length === 3) {
      const mStr = parts[1].trim().toLowerCase().substring(0, 3);
      const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      const monthIdx = months.indexOf(mStr);
      const yStr = parts[2].trim();
      let year = parseInt(yStr, 10);
      if (isNaN(year)) return null;
      if (yStr.length === 2 || year < 100) {
        year = 2000 + year;
      }
      if (monthIdx !== -1) {
        return { month: monthIdx, year };
      }
    }

    const cleaned = trimmed.replace(/-/g, " ");
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return { month: parsed.getMonth(), year: parsed.getFullYear() };
    }
  } catch {
    return null;
  }
  return null;
};

// Standard Philippine Currency Formatter
const formatPHP = (amount: number) => {
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `₱${formatted}`;
};

// Simple helper to format very compact currency numbers inside cells for extremely clean layouts
const formatShortPHP = (amount: number) => {
  if (amount === 0) return "-";
  return formatPHP(amount);
};

// Traditional full currency formatter for spreadsheet tab (showing true decimals)
const formatSpreadsheetPHP = (amount: number) => {
  return formatPHP(amount);
};

const getAutoFontSizeClass = (val: number, isCompact?: boolean): string => {
  const text = val > 0 ? formatSpreadsheetPHP(val) : "-";
  const len = text.length;
  const alignment = val > 0 ? "text-right" : "text-center";
  if (isCompact) {
    if (len > 18) return `text-[7.5px] leading-tight tracking-tighter font-mono ${alignment}`;
    if (len > 14) return `text-[8.5px] leading-tight tracking-tight font-mono ${alignment}`;
    if (len > 11) return `text-[9px] tracking-tight font-mono ${alignment}`;
    return `text-[9.5px] font-mono ${alignment}`;
  } else {
    if (len > 18) return `text-[8px] leading-tight tracking-tighter font-mono ${alignment}`;
    if (len > 14) return `text-[9px] leading-tight tracking-tight font-mono ${alignment}`;
    if (len > 11) return `text-[9.5px] tracking-tight font-mono ${alignment}`;
    return `text-[10.5px] font-mono ${alignment}`;
  }
};

const S07Cell: React.FC<{
  type: "lot" | "structure";
  mIdx: number;
  val: number;
  isDark: boolean;
  onChange: (type: "lot" | "structure", mIdx: number, val: string) => void;
  isCompact?: boolean;
  isAdminAuthenticated: boolean;
  onRequestAuth: (onSuccess: () => void) => void;
}> = ({ type, mIdx, val, isDark, onChange, isCompact, isAdminAuthenticated, onRequestAuth }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempVal, setTempVal] = useState(val > 0 ? String(val) : "");

  useEffect(() => {
    setTempVal(val > 0 ? String(val) : "");
  }, [val]);

  if (isEditing) {
    return (
      <input
        type="text"
        autoFocus
        value={tempVal}
        placeholder="-"
        onBlur={() => {
          setIsEditing(false);
          onChange(type, mIdx, tempVal);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setIsEditing(false);
            onChange(type, mIdx, tempVal);
          } else if (e.key === "Escape") {
            setIsEditing(false);
            setTempVal(val > 0 ? String(val) : "");
          }
        }}
        onChange={(e) => setTempVal(e.target.value)}
        className={`w-full text-right bg-transparent border-b outline-none font-mono font-black py-0.5 ${
          isCompact ? "text-[9.5px]" : "text-[10.5px]"
        } ${
          isDark 
            ? "text-amber-400 border-amber-500 placeholder-slate-750" 
            : "text-slate-900 border-[#273240] placeholder-slate-400"
        }`}
      />
    );
  }

  const handleClick = () => {
    if (isAdminAuthenticated) {
      setIsEditing(true);
    } else {
      onRequestAuth(() => {
        setIsEditing(true);
      });
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`cursor-pointer hover:bg-slate-500/10 rounded min-h-[1.25rem] flex items-center select-none group relative w-full ${
        val > 0 ? "justify-end" : "justify-center"
      }`}
      title="Click to edit S-07 month disbursement data (Requires Admin Password)"
    >
      <span className={`font-black ${getAutoFontSizeClass(val, isCompact)}`}>
        {val > 0 ? formatSpreadsheetPHP(val) : "-"}
      </span>
      <span className="opacity-0 group-hover:opacity-60 text-[9px] absolute left-1 top-1/2 -translate-y-1/2 select-none text-slate-400">
        ✎
      </span>
    </div>
  );
};

interface HelpGuideProps {
  title: string;
  steps: { title: string; desc: string; taglish: string }[];
  accentColor?: "blue" | "emerald" | "orange" | "indigo";
}

const HelpGuide: React.FC<HelpGuideProps> = ({ title, steps, accentColor = "blue" }) => {
  const [isOpen, setIsOpen] = useState(false);

  const colors = {
    blue: {
      leftBorder: "border-l-4 border-l-blue-600",
      containerBg: "bg-blue-50/40",
      containerBorder: "border-blue-100",
      pillBg: "bg-blue-100",
      pillText: "text-blue-800 font-extrabold",
      pillBorder: "border-blue-200",
      accentIcon: "text-blue-600",
      numberBg: "bg-blue-600 text-white",
      taglishBg: "bg-blue-50/70 border border-blue-100/60",
      taglishText: "text-blue-900"
    },
    emerald: {
      leftBorder: "border-l-4 border-l-emerald-600",
      containerBg: "bg-emerald-50/40",
      containerBorder: "border-emerald-100",
      pillBg: "bg-emerald-100",
      pillText: "text-emerald-800 font-extrabold",
      pillBorder: "border-emerald-200",
      accentIcon: "text-emerald-600",
      numberBg: "bg-emerald-600 text-white",
      taglishBg: "bg-emerald-50/70 border border-emerald-100/60",
      taglishText: "text-emerald-900"
    },
    orange: {
      leftBorder: "border-l-4 border-l-amber-500",
      containerBg: "bg-amber-50/40",
      containerBorder: "border-amber-100",
      pillBg: "bg-amber-100",
      pillText: "text-amber-800 font-extrabold",
      pillBorder: "border-amber-200",
      accentIcon: "text-amber-600",
      numberBg: "bg-amber-600 text-white",
      taglishBg: "bg-amber-50/70 border border-amber-100/60",
      taglishText: "text-amber-900"
    },
    indigo: {
      leftBorder: "border-l-4 border-l-indigo-600",
      containerBg: "bg-indigo-50/40",
      containerBorder: "border-indigo-100",
      pillBg: "bg-indigo-100",
      pillText: "text-indigo-800 font-extrabold",
      pillBorder: "border-indigo-200",
      accentIcon: "text-indigo-600",
      numberBg: "bg-indigo-600 text-white",
      taglishBg: "bg-indigo-50/70 border border-indigo-100/60",
      taglishText: "text-indigo-900"
    }
  };

  const choice = colors[accentColor] || colors.blue;

  return (
    <div className={`mb-6 rounded-2xl border ${choice.containerBorder} ${choice.containerBg} transition-all duration-300 overflow-hidden shadow-xs ${choice.leftBorder}`}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left cursor-pointer outline-none select-none hover:bg-white/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-3xs flex items-center justify-center">
            <Lightbulb className={`w-4 h-4 ${choice.accentIcon}`} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-850 flex items-center gap-2">
              {title}
              <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wider uppercase border ${choice.pillBg} ${choice.pillText} ${choice.pillBorder}`}>
                Guideline
              </span>
            </h4>
            <p className="text-[10px] text-slate-500 font-extrabold mt-0.5 uppercase tracking-wider">
              {isOpen ? "Click to close guide" : "Click to view user guide"}
            </p>
          </div>
        </div>
        <div className="text-slate-400 hover:text-slate-600 flex items-center justify-center p-1 rounded-lg">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-dashed border-slate-200 pt-4 animate-fade-in bg-white/60">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {steps.map((st, idx) => (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 flex gap-3 h-full shadow-3xs hover:border-slate-300 transition-colors duration-250">
                <div className={`w-6 h-6 rounded-lg text-white flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5 shadow-2xs ${choice.numberBg}`}>
                  {idx + 1}
                </div>
                <div className="space-y-2.5 min-w-0 flex-1">
                  <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    {st.title}
                  </h5>
                  <div className="space-y-2.5 text-[11px] leading-relaxed">
                    <p className="text-slate-700 font-semibold">
                      {st.desc}
                    </p>
                    <div className="pt-2.5 border-t border-slate-150 space-y-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`text-[8.5px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded ${choice.pillBg} ${choice.pillText} border ${choice.pillBorder}`}>
                          Quick Summary
                        </span>
                      </div>
                      <p className={`text-[10.5px] font-medium italic p-2 rounded-lg leading-relaxed ${choice.taglishBg} ${choice.taglishText}`}>
                        {st.taglish}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const DisbursementPlan: React.FC<DisbursementPlanProps> = ({ 
  data, 
  activeTheme,
  onMaximize,
  onHide,
  isMaximized
}) => {
  const years = [2025, 2026, 2027, 2028, 2029, 2030];
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [activeTab, setActiveTab ] = useState<TabMode>(isMaximized ? "summary" : "spreadsheet");
  const [quarter, setQuarter] = useState<QuarterFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hoveredCp, setHoveredCp] = useState<string | null>(null);
  const [showFillColor, setShowFillColor] = useState<boolean>(true);
  const [isCompact, setIsCompact] = useState<boolean>(false);

  // Admin access validation states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [authSuccessCallback, setAuthSuccessCallback] = useState<(() => void) | null>(null);

  const handleRequestAuth = (onSuccess: () => void) => {
    if (isAdminAuthenticated) {
      onSuccess();
    } else {
      setAuthSuccessCallback(() => onSuccess);
      setShowPasswordDialog(true);
      setPasswordInput("");
      setPasswordError("");
    }
  };

  const handleVerifyPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPwd = passwordInput.trim().toLowerCase();
    if (cleanPwd === "dataadmin") {
      setIsAdminAuthenticated(true);
      setShowPasswordDialog(false);
      setPasswordError("");
      if (authSuccessCallback) {
        authSuccessCallback();
        setAuthSuccessCallback(null);
      }
    } else {
      setPasswordError("Incorrect Admin Password.");
    }
  };

  // Custom live user input overrides for state "S-07" (Lot & Structure), saved persistently
  const [s07Overrides, setS07Overrides ] = useState<Record<number, { lot: Record<number, number>; structure: Record<number, number> }>>(() => {
    try {
      const saved = localStorage.getItem("gcr_disb_s07_overrides_v2");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Persist edits to localStorage
  useEffect(() => {
    localStorage.setItem("gcr_disb_s07_overrides_v2", JSON.stringify(s07Overrides));
  }, [s07Overrides]);

  // Dynamically default to the "Summary Matrix (Fast view)" when the component is zoomed/maximized
  useEffect(() => {
    if (isMaximized) {
      setActiveTab("summary");
    }
  }, [isMaximized]);

  const handleS07OverrideChange = (type: "lot" | "structure", mIdx: number, rawVal: string) => {
    const cleanNumStr = rawVal.replace(/[^0-9.]/g, "");
    const numericVal = parseFloat(cleanNumStr) || 0;

    setS07Overrides(prev => {
      const yearOverride = prev[selectedYear] || { lot: {}, structure: {} };
      const updatedType = { ...yearOverride[type], [mIdx]: numericVal };
      const updatedYear = { ...yearOverride, [type]: updatedType };
      return {
        ...prev,
        [selectedYear]: updatedYear
      };
    });
  };

  // Standard static order for contract packages
  const contractPackages = ["S-01", "S-02", "S-03a", "S-03b", "S-03c", "S-04", "S-05", "S-06", "S-07"];
  const isDark = activeTheme?.isDark || false;

  const primaryBgClass = activeTheme?.primaryBg || "bg-amber-600";
  const primaryTextClass = activeTheme?.primaryText || "text-amber-600";

  // Filter contract packages based on query
  const filteredCPs = useMemo(() => {
    if (!searchQuery.trim()) return contractPackages;
    return contractPackages.filter(cp => cp.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery, contractPackages]);

  // Process and aggregate all amounts based on CPs, SAD bases and years
  const tableData = useMemo(() => {
    const matrix: Record<string, { lot: number[]; structure: number[] }> = {};
    contractPackages.forEach((cp) => {
      matrix[cp] = {
        lot: Array(12).fill(0),
        structure: Array(12).fill(0),
      };
    });

    if (selectedYear === 2027) {
      matrix["S-07"].lot[3] = 28644513.67;
    }

    data.forEach((lot) => {
      // EXCLUDE already paid lots based on column AW (siteAccessPaid)
      if (lot.siteAccessPaid) return;

      const cp = (lot.cp || "").trim();
      if (!matrix[cp]) return;

      const avDate = parseSADDate(lot.siteAccessDate);
      if (cp === "S-07" && selectedYear === 2027) {
        // Default data is preset to 28644513.67, user edits are merged below
      } else {
        if (avDate && avDate.year === selectedYear) {
          matrix[cp].lot[avDate.month] += lot.estimatedLandCost || 0;
        }
      }

      const bmField = (lot as any).overallSad;
      const bmDate = parseSADDate(bmField);
      if (bmDate && bmDate.year === selectedYear) {
        matrix[cp].structure[bmDate.month] += lot.estimatedStructureCost || 0;
      } else if (!bmField && avDate && avDate.year === selectedYear) {
        matrix[cp].structure[avDate.month] += lot.estimatedStructureCost || 0;
      }
    });

    // Merge S-07 manual user overrides if applicable for the active year
    const override = s07Overrides[selectedYear];
    if (override) {
      if (override.lot) {
        Object.entries(override.lot).forEach(([mIdxStr, val]) => {
          const mIdx = parseInt(mIdxStr);
          if (!isNaN(mIdx) && mIdx >= 0 && mIdx < 12) {
            matrix["S-07"].lot[mIdx] = val as number;
          }
        });
      }
      if (override.structure) {
        Object.entries(override.structure).forEach(([mIdxStr, val]) => {
          const mIdx = parseInt(mIdxStr);
          if (!isNaN(mIdx) && mIdx >= 0 && mIdx < 12) {
            matrix["S-07"].structure[mIdx] = val as number;
          }
        });
      }
    }

    return matrix;
  }, [data, selectedYear, s07Overrides]);

  // Aggregate monthly Totals across all CPs for Land (Lot) & Structure
  const aggregatedTotals = useMemo(() => {
    const totals = {
      land: Array(12).fill(0),
      structure: Array(12).fill(0),
      perSad: Array(12).fill(0),
      taxLand: Array(12).fill(0),
      demoStructure: Array(12).fill(0),
      subTotal: Array(12).fill(0),
      contingency: Array(12).fill(0),
      grandTotal: Array(12).fill(0),
    };

    contractPackages.forEach((cp) => {
      const cpData = tableData[cp];
      for (let month = 0; month < 12; month++) {
        totals.land[month] += cpData.lot[month];
        totals.structure[month] += cpData.structure[month];
      }
    });

    for (let month = 0; month < 12; month++) {
      totals.perSad[month] = totals.land[month] + totals.structure[month];
      totals.taxLand[month] = totals.land[month] * 0.10; // (c) 10% tax
      totals.demoStructure[month] = totals.structure[month] * 0.30; // (d) 30% demolition
      totals.subTotal[month] = totals.land[month] + totals.structure[month] + totals.taxLand[month] + totals.demoStructure[month]; // (e) Sub-total
      totals.contingency[month] = totals.subTotal[month] * 0.05; // (f) 5% contingency
      totals.grandTotal[month] = totals.subTotal[month] + totals.contingency[month]; // (g) Grand Total
    }

    return totals;
  }, [tableData]);

  // Totals sums
  const totalLand = useMemo(() => aggregatedTotals.land.reduce((a, b) => a + b, 0), [aggregatedTotals]);
  const totalStructure = useMemo(() => aggregatedTotals.structure.reduce((a, b) => a + b, 0), [aggregatedTotals]);
  const totalGrandRequirement = useMemo(() => aggregatedTotals.grandTotal.reduce((a, b) => a + b, 0), [aggregatedTotals]);

  // Calculate each CP's total budget relative share to draw progress indicators
  const cpBudgetShares = useMemo(() => {
    const shares: Record<string, number> = {};
    let grandUnadjustedSum = 0;

    contractPackages.forEach((cp) => {
      const cpData = tableData[cp];
      const sum = cpData.lot.reduce((a, b) => a + b, 0) + cpData.structure.reduce((a, b) => a + b, 0);
      shares[cp] = sum;
      grandUnadjustedSum += sum;
    });

    const percentages: Record<string, number> = {};
    contractPackages.forEach((cp) => {
      percentages[cp] = grandUnadjustedSum > 0 ? (shares[cp] / grandUnadjustedSum) * 100 : 0;
    });

    return { percentages, absolute: shares };
  }, [tableData]);

  // Export current plan state to CSV
  const handleExportCSV = () => {
    const formattedYear2Digits = selectedYear.toString().substring(2);
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const headers = ["CP", "Disbursement Type", ...monthsShort.map(m => `${m}-${formattedYear2Digits}`), "Total", "Adjusted Total (Land+10%, Struct+30%)"];
    
    let csvRows = [];
    csvRows.push(headers.join(","));

    contractPackages.forEach((cp) => {
      const cpData = tableData[cp];
      const lotSum = cpData.lot.reduce((a, b) => a + b, 0);
      const strSum = cpData.structure.reduce((a, b) => a + b, 0);

      const lotCells = [cp, "Lot", ...cpData.lot.map(v => v.toFixed(2)), lotSum.toFixed(2), (lotSum * 1.10).toFixed(2)];
      csvRows.push(lotCells.join(","));

      const strCells = ["", "Structure", ...cpData.structure.map(v => v.toFixed(2)), strSum.toFixed(2), (strSum * 1.30).toFixed(2)];
      csvRows.push(strCells.join(","));
    });

    csvRows.push("");

    const formatRow = (name: string, arr: number[]) => {
      const sum = arr.reduce((a, b) => a + b, 0);
      return [name, "", ...arr.map(v => v.toFixed(2)), sum.toFixed(2), ""].join(",");
    };

    csvRows.push(formatRow("TOTAL PER SAD (Lot + Structure)", aggregatedTotals.perSad));
    csvRows.push(formatRow("(a) Total for Land", aggregatedTotals.land));
    csvRows.push(formatRow("(b) Total for Structure", aggregatedTotals.structure));
    csvRows.push(formatRow("(c) 10% Tax for land (a x 10%)", aggregatedTotals.taxLand));
    csvRows.push(formatRow("(d) 30% Demolition cost (b x 30%)", aggregatedTotals.demoStructure));
    csvRows.push(formatRow("(e) Sub-Total (a+b+c+d)", aggregatedTotals.subTotal));
    csvRows.push(formatRow("(f) 5% Contingency (e x 5%)", aggregatedTotals.contingency));
    csvRows.push(formatRow("(g) GRAND TOTAL (e+f)", aggregatedTotals.grandTotal));

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Disbursement_Plan_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedYearShort = selectedYear.toString().substring(2);
  const monthsData = [
    { name: "Jan", index: 0, quarter: "Q1" },
    { name: "Feb", index: 1, quarter: "Q1" },
    { name: "Mar", index: 2, quarter: "Q1" },
    { name: "Apr", index: 3, quarter: "Q2" },
    { name: "May", index: 4, quarter: "Q2" },
    { name: "Jun", index: 5, quarter: "Q2" },
    { name: "Jul", index: 6, quarter: "Q3" },
    { name: "Aug", index: 7, quarter: "Q3" },
    { name: "Sep", index: 8, quarter: "Q3" },
    { name: "Oct", index: 9, quarter: "Q4" },
    { name: "Nov", index: 10, quarter: "Q4" },
    { name: "Dec", index: 11, quarter: "Q4" }
  ];

  // Dynamically filter which months to show to prevent horizontal cluttering
  const visibleMonths = useMemo(() => {
    if (quarter === "ALL") return monthsData;
    return monthsData.filter(m => m.quarter === quarter);
  }, [quarter]);

  const content = (
    <div
      id="disbursement-plan-section"
      className={isMaximized 
        ? `w-full h-full p-2 md:p-4 overflow-y-auto flex flex-col m-0 border-none rounded-none shadow-none`
        : `lg:col-span-2 border rounded-3xl p-6 shadow-lg transition-all duration-300 w-full relative overflow-hidden ${
            isDark ? "text-slate-100" : "text-slate-800"
          }`
      }
      style={{
        backgroundColor: isDark 
          ? (isMaximized ? "transparent" : "#1e293b") 
          : (isMaximized ? "transparent" : "#edf1f5"),
        borderColor: isDark ? "#334155" : "#cbd5e1",
        color: isMaximized ? (isDark ? "#f1f5f9" : "#0f172a") : undefined
      }}
    >
      {/* Absolute top visual indicator bar */}
      {!isMaximized && <div className={`absolute top-0 left-0 right-0 h-1 ${primaryBgClass}`} />}

      {/* Main Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-5 border-b gap-4"
           style={{ borderColor: isDark ? "#414c61" : "#cbd5e1" }}>
        
        {/* Title & Explainer Badge */}
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl text-white ${primaryBgClass} shadow-sm shrink-0`}>
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-lg font-extrabold font-display tracking-tight flex items-center gap-2 ${isDark ? "text-white" : "text-slate-900"}`}>
              Disbursement Plan Matrix ({selectedYear})
            </h3>
            <p className={`text-[11px] font-medium ${isDark ? "text-slate-350" : "text-slate-600"}`}>
              Site access date schedules with overhead adjustments. Exempting paid lots (Col AW).
            </p>
          </div>
        </div>

        {/* Calendar Year Selector Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Calendar:</span>
          <div className={`flex items-center p-0.5 rounded-xl border ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setSelectedYear(y)}
                className={`text-[11px] font-black px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedYear === y
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "text-slate-500 hover:text-slate-200 dark:hover:text-slate-350"
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCSV}
            className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide py-1.5 px-3 rounded-lg border transition-all cursor-pointer ${
              isDark 
                ? "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200" 
                : "bg-white hover:bg-slate-50 border-slate-200 text-slate-800"
            }`}
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>

          {/* Panel Action Controls */}
          <div className={`flex items-center gap-1 p-0.5 rounded-xl border ${isDark ? "bg-slate-950 border-slate-800/80" : "bg-white border-slate-250"}`} data-html2canvas-ignore="true">
            {onMaximize && (
              <button
                type="button"
                onClick={onMaximize}
                className={`p-1.5 rounded-lg transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105 ${
                  isDark 
                    ? "hover:bg-slate-800/90 text-slate-400 hover:text-slate-100" 
                    : "hover:bg-slate-100/95 text-slate-500 hover:text-slate-800"
                }`}
                title={isMaximized ? "Minimize/Restore" : "Maximize to Full Screen"}
              >
                {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
            
            {onHide && !isMaximized && (
              <button
                type="button"
                onClick={onHide}
                className={`p-1.5 rounded-lg transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105 hover:text-red-500 ${
                  isDark 
                    ? "hover:bg-slate-800/90 text-slate-400" 
                    : "hover:bg-slate-100/95 text-slate-500"
                }`}
                title="Hide layout panel"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <HelpGuide 
        title="Disbursement Plan Matrix (S-Curve & Cashflow) Guide"
        accentColor="indigo"
        steps={[
          {
            title: "Simulate Monthly S-Curve Forecasts",
            desc: "The spreadsheet automatically aggregates land and structure costs for all contract packages based on forecasted Site Access dates.",
            taglish: "The spreadsheet automatically combines estimated land and structure values based on your target Site Access date."
          },
          {
            title: "Calibrate Contingencies & Taxes",
            desc: "Click monthly cells to customize cash flow distributions. The footer automatically recalculates 10% tax variables and 5% contingencies.",
            taglish: "Click any monthly cell to customize cash flows. It automatically recalculates 10% tax and 5% contingency below."
          },
          {
            title: "Export & Report Financial Logs",
            desc: "Toggle between 'Spreadsheet View (Old Style)', 'Summary Matrix (Fast view)', or 'By Package Cards', and click the 'CSV' button next to the year selectors to save financial logs.",
            taglish: "Quickly switch between Spreadsheet, Summary, or By Package Cards, and click the 'CSV' button next to the year selector to download."
          }
        ]}
      />

      {/* Main Top Level Tab Buttons to separate information view - VERY UNCLUTTERED */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className={`flex items-center p-1 rounded-xl border w-max ${isDark ? "bg-slate-950 border-slate-800" : "bg-slate-100/80 border-slate-250"}`}>
          <button
            onClick={() => setActiveTab("spreadsheet")}
            className={`flex items-center gap-2 text-[11px] font-extrabold uppercase py-1.5 px-4 rounded-lg transition-all cursor-pointer ${
              activeTab === "spreadsheet"
                ? (isDark ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "bg-[#273240] text-white border border-[#273240] shadow-xs")
                : (isDark ? "text-slate-400 hover:text-slate-200" : "text-[#516b91] hover:text-[#273240]")
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Spreadsheet View (Old Style)</span>
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-2 text-[11px] font-extrabold uppercase py-1.5 px-4 rounded-lg transition-all cursor-pointer ${
              activeTab === "summary"
                ? (isDark ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "bg-[#273240] text-white border border-[#273240] shadow-xs")
                : (isDark ? "text-slate-400 hover:text-slate-200" : "text-[#516b91] hover:text-[#273240]")
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Summary Matrix (Fast view)</span>
          </button>
          <button
            onClick={() => setActiveTab("cards")}
            className={`flex items-center gap-2 text-[11px] font-extrabold uppercase py-1.5 px-4 rounded-lg transition-all cursor-pointer ${
              activeTab === "cards"
                ? (isDark ? "bg-amber-500 text-slate-950 font-black shadow-sm" : "bg-[#273240] text-white border border-[#273240] shadow-xs")
                : (isDark ? "text-slate-400 hover:text-slate-200" : "text-[#516b91] hover:text-[#273240]")
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>By Package Cards</span>
          </button>
        </div>

        {/* Controls: Shade Toggle & Filter Quick Search inside matrix */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              if (isAdminAuthenticated) {
                setIsAdminAuthenticated(false);
              } else {
                handleRequestAuth(() => {});
              }
            }}
            className={`flex items-center gap-1.5 text-[11.5px] font-black uppercase tracking-wide py-1.5 px-3.5 rounded-xl border transition-all cursor-pointer select-none shadow-xs ${
              isAdminAuthenticated
                ? "bg-emerald-500 text-slate-950 border-emerald-550 shadow-emerald-500/10"
                : (isDark ? "bg-slate-900 border-slate-800 text-slate-350 hover:text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50")
            }`}
            title={isAdminAuthenticated ? "Click to lock S-07 editing" : "Click to authenticate as Admin"}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAdminAuthenticated ? "Admin: Unlocked" : "Admin: Locked"}</span>
          </button>

          <button
            onClick={() => setIsCompact(!isCompact)}
            className={`flex items-center gap-1.5 text-[11.5px] font-black uppercase tracking-wide py-1.5 px-3.5 rounded-xl border transition-all cursor-pointer select-none shadow-xs ${
              isCompact
                ? (isDark ? "bg-amber-500 text-slate-950 border-amber-500" : "bg-[#273240] text-white border-[#273240]")
                : (isDark ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50")
            }`}
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>{isCompact ? "Normal Padding" : "Compact Mode"}</span>
          </button>

          <button
            onClick={() => setShowFillColor(!showFillColor)}
            className={`flex items-center gap-1.5 text-[11.5px] font-black uppercase tracking-wide py-1.5 px-3.5 rounded-xl border transition-all cursor-pointer select-none shadow-xs ${
              showFillColor
                ? (isDark ? "bg-amber-500 text-slate-950 border-amber-500" : "bg-[#273240] text-white border-[#273240]")
                : (isDark ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50")
            }`}
          >
            <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ backgroundColor: showFillColor ? (isDark ? "#0f172a" : "#fff") : "#94a3b8" }} />
            <span>{showFillColor ? "Hide Cell Fill Color" : "Show Cell Fill Color"}</span>
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search package (e.g. S-01)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`text-xs font-bold rounded-xl pl-9 pr-3 py-1.5 w-60 border transition-all outline-none ${
                isDark 
                  ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-amber-500/50" 
                  : "bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-500"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Financial aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
        {/* Total Managed Land Cost */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-xs transition-all ${
          isDark ? "bg-slate-950/45 border-slate-800/60" : "bg-blue-50/40 border-blue-100/70"
        }`}>
          <div>
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase block">
              Total Land Funds Required
            </span>
            <span className="text-base font-black font-mono tracking-tight block mt-0.5 text-[#414c61] dark:text-[#1d2c40]">
              {formatPHP(totalLand)}
            </span>
          </div>
          <div className={`p-2 rounded-lg ${isDark ? "bg-blue-500/10 text-[#1d2c40]" : "bg-blue-100 text-[#414c61]"}`}>
            <Database className="w-4 h-4" />
          </div>
        </div>

        {/* Total Standing Structure Cost */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-xs transition-all ${
          isDark ? "bg-slate-950/45 border-slate-800/60" : "bg-orange-50/40 border-orange-100/75"
        }`}>
          <div>
            <span className="text-[9px] font-extrabold tracking-wider text-slate-400 uppercase block">
              Total Structure Funds Required
            </span>
            <span className="text-base font-black font-mono tracking-tight block mt-0.5 text-[#c2410c] dark:text-orange-400">
              {formatPHP(totalStructure)}
            </span>
          </div>
          <div className={`p-2 rounded-lg ${isDark ? "bg-orange-500/10 text-orange-400" : "bg-orange-100 text-[#c2410c]"}`}>
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Total Grand Realization Budget */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-xs transition-all ${
          isDark ? "bg-slate-950/45 border-slate-850" : "bg-slate-50 border-slate-200"
        }`}>
          <div>
            <span className="text-[9px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400 uppercase block">
              Grand Cash Flow Budget (+Taxes & Demo)
            </span>
            <span className="text-base font-black font-mono tracking-tight block mt-0.5 text-[#414c61] dark:text-[#1d2c40]">
              {formatPHP(totalGrandRequirement)}
            </span>
          </div>
          <div className={`p-2 rounded-lg ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-[#414c61]"}`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* RENDER ACTIVE TAB VIEW WITH POLISHED DESIGN (NOT GULO!) */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: SUMMARY MATRIX (Extremely clean overview CP table) */}
        {activeTab === "summary" && (
          <motion.div
            key="tab-summary"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className={`border rounded-2xl overflow-hidden shadow-xs ${
              isDark ? "border-slate-800 bg-slate-950" : "border-slate-300 bg-white"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse" style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                <thead>
                  <tr className={`border-b text-[10.5px] font-black uppercase tracking-wider ${
                    isDark ? "bg-slate-900/80 border-slate-800 text-slate-400" : "bg-[#273240] border-blue-900 text-white"
                  }`}>
                    <th className="p-3 border-r" style={{ borderColor: isDark ? "#334155" : "#172554" }}>Contract Package</th>
                    <th className="p-3 text-right border-r" style={{ borderColor: isDark ? "#334155" : "#172554" }}>Unadjusted Land Cost (col AJ)</th>
                    <th className="p-3 text-right border-r" style={{ borderColor: isDark ? "#334155" : "#172554" }}>Unadjusted Structure Cost (col AK)</th>
                    <th className="p-3 text-right border-r" style={{ borderColor: isDark ? "#334155" : "#172554" }}>Land Acq. Tax (+10%)</th>
                    <th className="p-3 text-right border-r" style={{ borderColor: isDark ? "#334155" : "#172554" }}>Structure Demo Overhead (+30%)</th>
                    <th className="p-3 text-right font-black border-r" style={{ borderColor: isDark ? "#334155" : "#172554" }}>Adjusted Total Budget</th>
                    <th className="p-3 text-right">Budget Share %</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[10.5px] font-semibold" style={{ borderColor: isDark ? "#414c61" : "#cbd5e1" }}>
                  {filteredCPs.map((cp, cpIdx) => {
                    const cpData = tableData[cp];
                    const lotSum = cpData.lot.reduce((a, b) => a + b, 0);
                    const strSum = cpData.structure.reduce((a, b) => a + b, 0);
                    const adjustedLand = lotSum * 1.10;
                    const adjustedStr = strSum * 1.30;
                    const grandAdjustedCp = adjustedLand + adjustedStr;
                    
                    const percentOfTotal = totalGrandRequirement > 0 
                      ? ((grandAdjustedCp * 1.05) / totalGrandRequirement) * 100 
                      : 0;

                    const hasActivity = lotSum > 0 || strSum > 0;
                    const isEven = cpIdx % 2 === 0;
                    
                    const rowBg = isDark 
                      ? (isEven ? "bg-slate-900/45" : "bg-slate-950/35") 
                      : (isEven ? "bg-[#f8fafc]" : "bg-white");

                    return (
                      <tr 
                        key={cp} 
                        className={`hover:bg-[#414c61]/5 transition-colors ${rowBg} ${
                          hasActivity ? "" : "opacity-60"
                        }`}
                      >
                        {/* Package Name */}
                        <td 
                          className="p-3 font-black text-center sticky left-0 z-10 text-white border-r"
                          style={{
                            backgroundColor: isDark ? "#0f172a" : "#273240",
                            borderColor: isDark ? "#334155" : "#cbd5e1"
                          }}
                        >
                          <span className="text-xs font-black font-display tracking-tight">{cp}</span>
                        </td>

                        {/* Unadjusted Land */}
                        <td className={`p-3 font-mono border-r ${
                          lotSum > 0 
                            ? "text-[#414c61] dark:text-[#1d2c40] font-extrabold text-right" 
                            : "text-slate-355 dark:text-slate-700 font-normal opacity-20 select-none text-center"
                        }`} style={{ borderColor: isDark ? "#334155/65" : "#cbd5e1/60" }}>
                          {lotSum > 0 ? formatPHP(lotSum) : "-"}
                        </td>

                        {/* Unadjusted Structure */}
                        <td className={`p-3 font-mono border-r ${
                          strSum > 0 
                            ? "text-[#c2410c] dark:text-orange-450 font-extrabold text-right" 
                            : "text-slate-350 dark:text-slate-700 font-normal opacity-20 select-none text-center"
                        }`} style={{ borderColor: isDark ? "#334155/65" : "#cbd5e1/60" }}>
                          {strSum > 0 ? formatPHP(strSum) : "-"}
                        </td>

                        {/* +10% Land Tax */}
                        <td className={`p-3 font-mono border-r ${
                          lotSum > 0 
                            ? "text-[#414c61] dark:text-[#1d2c40] font-black text-right" 
                            : "text-slate-350 dark:text-slate-700 font-normal opacity-20 select-none text-center"
                        }`}
                            style={{ 
                              borderColor: isDark ? "#334155/65" : "#cbd5e1/60",
                              backgroundColor: lotSum > 0 ? (isDark ? "rgba(47,203,255,0.04)" : "rgba(57,82,128,0.015)") : undefined
                            }}>
                          {lotSum > 0 ? formatPHP(lotSum * 0.10) : "-"}
                        </td>

                        {/* +30% Structure Demo */}
                        <td className={`p-3 font-mono border-r ${
                          strSum > 0 
                            ? "text-[#c2410c] dark:text-orange-400 font-black text-right" 
                            : "text-slate-350 dark:text-slate-700 font-normal opacity-20 select-none text-center"
                        }`}
                            style={{ 
                              borderColor: isDark ? "#334155/65" : "#cbd5e1/60",
                              backgroundColor: strSum > 0 ? (isDark ? "rgba(249,115,22,0.04)" : "rgba(245,158,11,0.015)") : undefined
                            }}>
                          {strSum > 0 ? formatPHP(strSum * 0.30) : "-"}
                        </td>

                        {/* Adjusted Grand with local package share */}
                        <td className={`p-3 font-mono font-black border-r ${
                          grandAdjustedCp > 0 
                            ? "text-orange-600 dark:text-orange-405 text-right" 
                            : "text-slate-355 dark:text-slate-700 font-normal opacity-20 select-none text-center"
                        }`}
                            style={{ 
                              borderColor: isDark ? "#334155" : "#cbd5e1",
                              backgroundColor: grandAdjustedCp > 0 ? (isDark ? "rgba(249,115,22,0.06)" : "rgba(194,65,12,0.02)") : undefined
                            }}>
                          {grandAdjustedCp > 0 ? formatPHP(grandAdjustedCp * 1.05) : "-"}
                        </td>

                        {/* Relative Share progress indicator */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2 text-slate-400 text-[10px]">
                            <span className="font-extrabold">{percentOfTotal.toFixed(1)}%</span>
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500" style={{ width: `${percentOfTotal}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Summary Rows */}
                  <tr 
                    className="font-extrabold text-[11px]"
                    style={{
                      backgroundColor: isDark ? "#0c1f30" : "#273240",
                      borderColor: isDark ? "#1d4ed8" : "#2563eb",
                      color: "#dba660"
                    }}
                  >
                    <td className="p-3 font-black text-center sticky left-0 z-10 text-white border-r"
                        style={{
                          backgroundColor: isDark ? "#0f172a" : "#273240",
                          borderColor: isDark ? "#1d4ed8" : "#2563eb",
                          color: "#dba660"
                        }}>
                      TOTALS PER SAD
                    </td>
                    <td className="p-3 font-mono text-right border-r font-black" style={{ borderColor: isDark ? "#1d4ed8" : "#cbd5e1", color: "#dba660" }}>{formatSpreadsheetPHP(totalLand)}</td>
                    <td className="p-3 font-mono text-right border-r font-black" style={{ borderColor: isDark ? "#1d4ed8" : "#cbd5e1", color: "#dba660" }}>{formatSpreadsheetPHP(totalStructure)}</td>
                    <td className="p-3 font-mono text-right border-r font-black" style={{ borderColor: isDark ? "#1d4ed8" : "#cbd5e1", color: "#dba660" }}>{formatSpreadsheetPHP(totalLand * 0.10)}</td>
                    <td className="p-3 font-mono text-right border-r font-black" style={{ borderColor: isDark ? "#1d4ed8" : "#cbd5e1", color: "#dba660" }}>{formatSpreadsheetPHP(totalStructure * 0.30)}</td>
                    <td className="p-3 font-mono text-right border-r font-black text-sm" style={{ borderColor: isDark ? "#1d4ed8" : "#cbd5e1", color: "#dba660" }}>
                      {formatSpreadsheetPHP(totalGrandRequirement)}
                    </td>
                    <td className="p-3 text-right text-[10px] font-black" style={{ color: "#dba660" }}>100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Quick Context Message */}
            <div className={`p-4 border-t text-[11px] leading-relaxed flex items-start gap-2.5 ${
              isDark ? "bg-slate-950/40 text-slate-400 border-slate-850" : "bg-slate-50/50 text-slate-500 border-slate-150"
            }`}>
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                This Summary Matrix quickly highlights unadjusted and adjusted values per Contract Package. 
                Land Acquisition Tax adds <b>10%</b> on top of <b>Estimated Land Cost (Col AJ)</b>. 
                Structure Demolition overhead adds <b>30%</b> on top of <b>Estimated Structure Cost (Col AK)</b>. 
                All totals are calculated including a <b>5%</b> overall contingency buffer reserve.
              </p>
            </div>
          </motion.div>
          )}

        {/* TAB: SPREADSHEET (Traditional Ledger spreadsheet style with precise rows & highlights) */}
        {activeTab === "spreadsheet" && (
          <motion.div
            key="tab-spreadsheet"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className={`border rounded-2xl overflow-hidden shadow-xs ${
              isDark ? "border-slate-850 bg-slate-950" : "border-slate-200 bg-white"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-left border-collapse table-fixed min-w-[1580px]"
                     style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                <thead>
                  {/* Big title matching image */}
                  <tr className={isDark ? "bg-slate-950 text-slate-100" : "bg-[#273240] text-white"}>
                    <th colSpan={16} className="text-center py-3.5 text-base font-black tracking-widest uppercase font-display border-b border-sky-900 select-none">
                      Disbursement Plan {selectedYear}
                    </th>
                  </tr>
                  {/* Headers */}
                  <tr className={`border-b ${isCompact ? "text-[9.5px]" : "text-[10.5px]"} font-black uppercase tracking-wider text-center ${
                    isDark ? "bg-slate-900/80 border-slate-800 text-slate-400" : "bg-[#273240] border-blue-900 text-white"
                  }`}>
                    <th className={`w-11 border-r ${isCompact ? "p-1" : "p-2.5"}`} style={{ borderColor: isDark ? "#334155" : "#172554" }}>CP</th>
                    <th className={`w-14 border-r ${isCompact ? "p-1" : "p-2"}`} style={{ borderColor: isDark ? "#334155" : "#172554" }}>Type</th>
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m) => (
                      <th key={m} className={`w-24 min-w-[95px] border-r font-black ${isCompact ? "p-1" : "p-2"}`} style={{ borderColor: isDark ? "#334155" : "#172554" }}>
                        {m}-{formattedYearShort}
                      </th>
                    ))}
                    <th className={`w-28 border-r font-black ${isCompact ? "p-1" : "p-2"}`} style={{ borderColor: isDark ? "#334155" : "#172554" }}>CP TOTAL UNADJ</th>
                    <th className={`w-52 font-black ${isCompact ? "p-1" : "p-2"}`} style={{ borderColor: isDark ? "#334155" : "#172554" }}>ADJUSTED +OVERHEAD</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-bold" style={{ borderColor: isDark ? "#414c61" : "#cbd5e1" }}>
                  {filteredCPs.map((cp, cpIdx) => {
                    const cpData = tableData[cp];
                    const lotSum = cpData.lot.reduce((a, b) => a + b, 0);
                    const strSum = cpData.structure.reduce((a, b) => a + b, 0);

                    const isEven = cpIdx % 2 === 0;
                    
                    const lotRowBg = isDark 
                      ? (isEven ? "bg-slate-900/40" : "bg-slate-950/35") 
                      : "bg-[#f8fafc]";
                      
                    const strRowBg = isDark 
                      ? (isEven ? "bg-slate-900/30" : "bg-slate-950/25") 
                      : "bg-white";

                    return (
                      <React.Fragment key={cp}>
                        {/* LOT ROW */}
                        <tr className={`hover:bg-[#273240]/5 transition-colors duration-100 ${isCompact ? "text-[9.5px]" : "text-[10.5px]"} ${lotRowBg}`}>
                          {/* Spanned CP Name */}
                          <td 
                            rowSpan={2} 
                            className={`text-center border-r font-black z-10 select-none ${isCompact ? "p-1.5" : "p-3"} ${
                              isDark ? "bg-[#0f172a] text-slate-100" : "bg-[#273240] text-white"
                            }`}
                            style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}
                          >
                            <span className={`font-black font-display tracking-tight ${isCompact ? "text-[10px]" : "text-xs"}`}>{cp}</span>
                          </td>

                          {/* Category Lot */}
                          <td 
                            className={`category-lot text-center border-r uppercase font-black ${isCompact ? "p-1.5" : "p-2.5"}`}
                            style={{ 
                              borderColor: isDark ? "#334155" : "#cbd5e1",
                              color: isDark ? "#1d2c40" : "#414c61",
                              backgroundColor: isDark ? "rgba(47,203,255,0.04)" : "rgba(57,82,128,0.015)"
                            }}
                          >
                            Lot
                          </td>

                          {/* 12 Months cells */}
                          {cpData.lot.map((val, mIdx) => {
                            const isS07 = cp === "S-07";
                            let cellClass = "";
                            if (val > 0) {
                              if (isDark) {
                                cellClass = showFillColor 
                                  ? "text-[#1d2c40] font-extrabold bg-[#2fcbff]/10 opacity-100" 
                                  : "text-[#1d2c40] font-extrabold opacity-100";
                              } else {
                                cellClass = showFillColor 
                                  ? "text-[#414c61] font-black bg-blue-100/50 opacity-100" 
                                  : "text-[#414c61] font-black opacity-100";
                              }
                            } else {
                              if (isS07) {
                                cellClass = "text-slate-350 dark:text-slate-700 font-medium opacity-100";
                              } else {
                                cellClass = "text-slate-350 dark:text-slate-700 font-medium opacity-20 select-none";
                              }
                            }
                            return (
                              <td 
                                key={`lot-cell-${mIdx}`} 
                                className={`border-r ${isCompact ? "p-1" : "p-2.5"} ${cellClass} ${getAutoFontSizeClass(val, isCompact)}`}
                                style={{ borderColor: isDark ? "rgba(51,65,85,0.65)" : "rgba(203,213,225,0.60)" }}
                                title={val > 0 ? formatSpreadsheetPHP(val) : "-"}
                              >
                                {isS07 ? (
                                  <S07Cell
                                    type="lot"
                                    mIdx={mIdx}
                                    val={val}
                                    isDark={isDark}
                                    onChange={handleS07OverrideChange}
                                    isCompact={isCompact}
                                    isAdminAuthenticated={isAdminAuthenticated}
                                    onRequestAuth={handleRequestAuth}
                                  />
                                ) : (
                                  val > 0 ? formatSpreadsheetPHP(val) : "-"
                                )}
                              </td>
                            );
                          })}

                          {/* Unadjusted CP Lot Total */}
                          <td 
                            className={`border-r ${isCompact ? "p-1" : "p-2.5"} ${getAutoFontSizeClass(lotSum, isCompact)} ${
                              lotSum > 0 
                                ? "text-[#414c61] dark:text-[#1d2c40] font-extrabold opacity-100" 
                                : "text-slate-355 dark:text-slate-700 font-normal opacity-20 select-none"
                            }`}
                            style={{ 
                              borderColor: isDark ? "#334155" : "#cbd5e1",
                              backgroundColor: lotSum > 0 ? (isDark ? "rgba(47,203,255,0.02)" : "rgba(57,82,128,0.015)") : undefined
                            }}
                            title={lotSum > 0 ? formatSpreadsheetPHP(lotSum) : "-"}
                          >
                            {lotSum > 0 ? formatSpreadsheetPHP(lotSum) : "-"}
                          </td>

                          {/* 1.1x Adjusted total */}
                          <td 
                            className={`${isCompact ? "p-1" : "p-2.5"} ${getAutoFontSizeClass(lotSum * 1.10, isCompact)}`}
                            style={{ 
                              backgroundColor: lotSum > 0 ? (isDark ? "rgba(47,203,255,0.04)" : "rgba(57,82,128,0.02)") : undefined
                            }}
                            title={lotSum > 0 ? formatSpreadsheetPHP(lotSum * 1.10) : "-"}
                          >
                            <span className={
                              lotSum > 0 
                                ? `text-[#414c61] dark:text-[#1d2c40] font-black opacity-100 block w-full text-right` 
                                : "text-slate-355 dark:text-slate-700 font-normal opacity-20 select-none"
                            }>
                              {lotSum > 0 ? formatSpreadsheetPHP(lotSum * 1.10) : "-"}
                            </span>
                          </td>
                        </tr>

                        {/* STRUCTURE ROW */}
                        <tr className={`hover:bg-orange-550/5 transition-colors duration-100 ${isCompact ? "text-[9.5px]" : "text-[10.5px]"} ${strRowBg}`}>
                          {/* Category Structure */}
                          <td 
                            className={`text-center border-r uppercase font-black ${isCompact ? "p-1.5" : "p-2.5"}`}
                            style={{ 
                              borderColor: isDark ? "#334155" : "#cbd5e1",
                              color: isDark ? "#f97316" : "#c2410c",
                              backgroundColor: isDark ? "rgba(249,115,22,0.04)" : "rgba(245,158,11,0.015)"
                            }}
                          >
                            Structure
                          </td>

                          {/* 12 Months cells */}
                          {cpData.structure.map((val, mIdx) => {
                            const isS07 = cp === "S-07";
                            let cellClass = "";
                            if (val > 0) {
                              if (isDark) {
                                  cellClass = showFillColor 
                                    ? "text-orange-400 font-extrabold bg-orange-950/30 opacity-100" 
                                    : "text-orange-400 font-extrabold opacity-100";
                              } else {
                                cellClass = showFillColor 
                                  ? "text-[#c2410c] font-black bg-orange-100/40 opacity-100" 
                                  : "text-[#c2410c] font-black opacity-100";
                              }
                            } else {
                              if (isS07) {
                                cellClass = "text-slate-350 dark:text-slate-700 font-medium opacity-100";
                              } else {
                                cellClass = "text-slate-350 dark:text-slate-700 font-medium opacity-20 select-none";
                              }
                            }
                            return (
                              <td 
                                key={`str-cell-${mIdx}`} 
                                className={`border-r ${isCompact ? "p-1" : "p-2.5"} ${cellClass} ${getAutoFontSizeClass(val, isCompact)}`}
                                style={{ borderColor: isDark ? "rgba(51,65,85,0.65)" : "rgba(203,213,225,0.60)" }}
                                title={val > 0 ? formatSpreadsheetPHP(val) : "-"}
                              >
                                {isS07 ? (
                                  <S07Cell
                                    type="structure"
                                    mIdx={mIdx}
                                    val={val}
                                    isDark={isDark}
                                    onChange={handleS07OverrideChange}
                                    isCompact={isCompact}
                                    isAdminAuthenticated={isAdminAuthenticated}
                                    onRequestAuth={handleRequestAuth}
                                  />
                                ) : (
                                  val > 0 ? formatSpreadsheetPHP(val) : "-"
                                )}
                              </td>
                            );
                          })}

                          {/* Unadjusted CP Structure Total */}
                          <td 
                            className={`border-r ${isCompact ? "p-1" : "p-2.5"} ${getAutoFontSizeClass(strSum, isCompact)} ${
                              strSum > 0 
                                ? "text-[#c2410c] dark:text-orange-400 font-extrabold opacity-100" 
                                : "text-slate-355 dark:text-slate-700 font-normal opacity-20 select-none"
                            }`}
                            style={{ 
                              borderColor: isDark ? "#334155" : "#cbd5e1",
                              backgroundColor: strSum > 0 ? (isDark ? "rgba(249,115,22,0.02)" : "rgba(245,158,11,0.015)") : undefined
                            }}
                            title={strSum > 0 ? formatSpreadsheetPHP(strSum) : "-"}
                          >
                            {strSum > 0 ? formatSpreadsheetPHP(strSum) : "-"}
                          </td>

                          {/* 1.3x Adjusted total */}
                          <td 
                            className={`${isCompact ? "p-1" : "p-2.5"} ${getAutoFontSizeClass(strSum * 1.30, isCompact)}`}
                            style={{ 
                              backgroundColor: strSum > 0 ? (isDark ? "rgba(249,115,22,0.04)" : "rgba(245,158,11,0.02)") : undefined
                            }}
                            title={strSum > 0 ? formatSpreadsheetPHP(strSum * 1.30) : "-"}
                          >
                            <span className={
                              strSum > 0 
                                ? `text-[#c2410c] dark:text-orange-400 font-black opacity-100 block w-full text-right` 
                                : "text-slate-355 dark:text-slate-700 font-normal opacity-20 select-none"
                            }>
                              {strSum > 0 ? formatSpreadsheetPHP(strSum * 1.30) : "-"}
                            </span>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* Divider block */}
                  <tr style={{ height: "14px" }} className={isDark ? "bg-slate-900/20" : "bg-slate-100"}>
                    <td colSpan={16} className="p-0 border-y" style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }} />
                  </tr>

                  {/* TOTAL PER SAD Row */}
                  <tr className="font-extrabold select-none text-[11.5px] border-y-2"
                      style={{
                        backgroundColor: isDark ? "#0c1f30" : "#273240",
                        borderColor: isDark ? "#1d4ed8" : "#cbd5e1",
                        color: "#dba660"
                      }}>
                    <td colSpan={2} className="p-3.5 text-xs font-black uppercase text-center border-r font-display text-white"
                        style={{
                          backgroundColor: isDark ? "#0c2b4e" : "#273240",
                          borderColor: isDark ? "#125a9c" : "#cbd5e1",
                          color: "#dba660"
                        }}>
                      TOTAL PER SAD
                    </td>
                    
                    {aggregatedTotals.perSad.map((val, idx) => (
                      <td key={`sa-tot-${idx}`} className={`p-3.5 border-r font-black ${getAutoFontSizeClass(val, isCompact)}`}
                          style={{ 
                            borderColor: isDark ? "#125a9c" : "#cbd5e1",
                            color: "#dba660"
                          }}>
                        {formatSpreadsheetPHP(val)}
                      </td>
                    ))}

                    <td className={`p-3.5 border-r font-black ${getAutoFontSizeClass(aggregatedTotals.perSad.reduce((a, b) => a + b, 0), isCompact)}`}
                        style={{ 
                          borderColor: isDark ? "#125a9c" : "#cbd5e1",
                          color: "#dba660"
                        }}>
                       {formatSpreadsheetPHP(aggregatedTotals.perSad.reduce((a, b) => a + b, 0))}
                    </td>

                    <td className={`p-3.5 font-black ${getAutoFontSizeClass(
                        (aggregatedTotals.land.reduce((a, b) => a + b, 0) * 1.10) +
                        (aggregatedTotals.structure.reduce((a, b) => a + b, 0) * 1.30),
                        isCompact
                      )}`}
                        style={{ 
                          backgroundColor: isDark ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.06)",
                          color: "#dba660"
                        }}>
                       {formatSpreadsheetPHP(
                        (aggregatedTotals.land.reduce((a, b) => a + b, 0) * 1.10) +
                        (aggregatedTotals.structure.reduce((a, b) => a + b, 0) * 1.30)
                      )}
                    </td>
                  </tr>

                  {/* Divider block */}
                  <tr style={{ height: "14px" }} className={isDark ? "bg-slate-900/20" : "bg-slate-100"}>
                    <td colSpan={16} className="p-0 border-y" style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }} />
                  </tr>

                  {/* (a) Total for Land */}
                  <tr className="hover:bg-slate-500/5 text-slate-900 dark:text-slate-100 text-[10.5px]" style={{ borderBottom: isDark ? "1px solid #414c61" : "1px solid #cbd5e1" }}>
                    <td colSpan={2} className="p-2.5 font-bold text-start border-r text-[#414c61] dark:text-[#1d2c40]"
                        style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      (a) Total for Land
                    </td>
                    {aggregatedTotals.land.map((val, idx) => {
                      const hasVal = val > 0;
                      return (
                        <td key={`rep-land-${idx}`} className={`p-2.5 border-r ${getAutoFontSizeClass(val, isCompact)} ${
                          hasVal ? "font-bold text-[#414c61] dark:text-[#1d2c40]" : "font-normal text-slate-350 dark:text-slate-700 opacity-20"
                        }`}
                            style={{ borderColor: isDark ? "#334155/40" : "#cbd5e1/40" }}>
                          {hasVal ? formatSpreadsheetPHP(val) : "-"}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-2.5 border-r font-black text-[#414c61] dark:text-[#1d2c40] ${getAutoFontSizeClass(totalLand, isCompact)}`} style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      {totalLand > 0 ? formatSpreadsheetPHP(totalLand) : "-"}
                    </td>
                  </tr>

                  {/* (b) Total for Structure */}
                  <tr className="hover:bg-slate-500/5 text-slate-900 dark:text-slate-100 text-[10.5px]" style={{ borderBottom: isDark ? "1px solid #414c61" : "1px solid #cbd5e1" }}>
                    <td colSpan={2} className="p-2.5 font-bold text-start border-r text-[#c2410c] dark:text-orange-405"
                        style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      (b) Total for Structure
                    </td>
                    {aggregatedTotals.structure.map((val, idx) => {
                      const hasVal = val > 0;
                      return (
                        <td key={`rep-str-${idx}`} className={`p-2.5 border-r ${getAutoFontSizeClass(val, isCompact)} ${
                          hasVal ? "font-bold text-[#c2410c] dark:text-orange-405" : "font-normal text-slate-350 dark:text-slate-700 opacity-20"
                        }`}
                            style={{ borderColor: isDark ? "#334155/40" : "#cbd5e1/40" }}>
                          {hasVal ? formatSpreadsheetPHP(val) : "-"}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-2.5 border-r font-black text-[#c2410c] dark:text-orange-455 ${getAutoFontSizeClass(totalStructure, isCompact)}`} style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      {totalStructure > 0 ? formatSpreadsheetPHP(totalStructure) : "-"}
                    </td>
                  </tr>

                  {/* (c) 10% acquisition tax */}
                  <tr className="hover:bg-slate-500/5 text-slate-900 dark:text-slate-100 text-[10.5px]" style={{ borderBottom: isDark ? "1px solid #414c61" : "1px solid #cbd5e1" }}>
                    <td colSpan={2} className="p-2.5 font-bold text-start border-r text-[#414c61] dark:text-[#1d2c40]"
                        style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      (c) 10% Tax for land (a x 10%)
                    </td>
                    {aggregatedTotals.taxLand.map((val, idx) => {
                      const hasVal = val > 0;
                      return (
                        <td key={`rep-tax-${idx}`} className={`p-2.5 border-r ${getAutoFontSizeClass(val, isCompact)} ${
                          hasVal ? "font-bold text-[#414c61] dark:text-[#1d2c40]" : "font-normal text-slate-350 dark:text-slate-700 opacity-20"
                        }`}
                            style={{ borderColor: isDark ? "#334155/40" : "#cbd5e1/40" }}>
                          {hasVal ? formatSpreadsheetPHP(val) : "-"}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-2.5 border-r font-extrabold text-[#414c61] dark:text-[#1d2c40] ${getAutoFontSizeClass(totalLand * 0.10, isCompact)}`} style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      {(totalLand * 0.10) > 0 ? formatSpreadsheetPHP(totalLand * 0.10) : "-"}
                    </td>
                  </tr>

                  {/* (d) 30% demolition overhead */}
                  <tr className="hover:bg-slate-500/5 text-slate-900 dark:text-slate-100 text-[10.5px]" style={{ borderBottom: isDark ? "1px solid #414c61" : "1px solid #cbd5e1" }}>
                    <td colSpan={2} className="p-2.5 font-bold text-start border-r text-[#c2410c] dark:text-orange-405"
                        style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      (d) 30% demolition cost for structure (b x 30%)
                    </td>
                    {aggregatedTotals.demoStructure.map((val, idx) => {
                      const hasVal = val > 0;
                      return (
                        <td key={`rep-demo-${idx}`} className={`p-2.5 border-r ${getAutoFontSizeClass(val, isCompact)} ${
                          hasVal ? "font-bold text-[#c2410c] dark:text-orange-405" : "font-normal text-slate-350 dark:text-slate-700 opacity-20"
                        }`}
                            style={{ borderColor: isDark ? "#334155/40" : "#cbd5e1/40" }}>
                          {hasVal ? formatSpreadsheetPHP(val) : "-"}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-2.5 border-r font-extrabold text-[#c2410c] dark:text-orange-455 ${getAutoFontSizeClass(totalStructure * 0.30, isCompact)}`} style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      {(totalStructure * 0.30) > 0 ? formatSpreadsheetPHP(totalStructure * 0.30) : "-"}
                    </td>
                  </tr>

                  {/* (e) Sub-Total */}
                  <tr className="text-[#414c61] dark:text-[#1d2c40] font-extrabold text-[11.5px]"
                      style={{
                        backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                        borderBottom: isDark ? "2px solid #334155" : "2px solid #cbd5e1"
                      }}>
                    <td colSpan={2} className="p-3.5 text-start border-r"
                        style={{ 
                          borderColor: isDark ? "#334155" : "#cbd5e1"
                        }}>
                      (e) Sub-Total (a+b+c+d)
                    </td>
                    {aggregatedTotals.subTotal.map((val, idx) => {
                      const hasVal = val > 0;
                      return (
                        <td key={`rep-sub-${idx}`} className={`p-3.5 border-r font-black ${getAutoFontSizeClass(val, isCompact)}`}
                            style={{ 
                              borderColor: isDark ? "#334155" : "#cbd5e1",
                              color: hasVal ? (isDark ? "#1d2c40" : "#414c61") : "#94a3b8"
                            }}>
                          {hasVal ? formatSpreadsheetPHP(val) : "-"}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-3.5 border-r text-[#414c61] dark:text-[#1d2c40] font-black ${getAutoFontSizeClass(aggregatedTotals.subTotal.reduce((a, b) => a + b, 0), isCompact)}`}
                        style={{ 
                          borderColor: isDark ? "#334155" : "#cbd5e1"
                        }}>
                      {aggregatedTotals.subTotal.reduce((a, b) => a + b, 0) > 0 ? formatSpreadsheetPHP(aggregatedTotals.subTotal.reduce((a, b) => a + b, 0)) : "-"}
                    </td>
                  </tr>

                  {/* (f) 5% contingency */}
                  <tr className="hover:bg-slate-500/5 text-[#414c61] dark:text-[#1d2c40] text-[10.5px]" style={{ borderBottom: isDark ? "1px solid #414c61" : "1px solid #cbd5e1" }}>
                    <td colSpan={2} className="p-2.5 font-bold text-start border-r text-[#414c61] dark:text-[#1d2c40]"
                        style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      (f) 5% contingency (e x 5%)
                    </td>
                    {aggregatedTotals.contingency.map((val, idx) => {
                      const hasVal = val > 0;
                      return (
                        <td key={`rep-cont-${idx}`} className={`p-2.5 border-r ${getAutoFontSizeClass(val, isCompact)} ${
                          hasVal ? "font-bold text-[#414c61] dark:text-[#1d2c40]" : "font-normal text-slate-350 dark:text-slate-700 opacity-20"
                        }`}
                            style={{ borderColor: isDark ? "#334155/40" : "#cbd5e1/40" }}>
                          {hasVal ? formatSpreadsheetPHP(val) : "-"}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-2.5 border-r text-[#414c61] dark:text-[#1d2c40] font-black ${getAutoFontSizeClass(aggregatedTotals.subTotal.reduce((a, b) => a + b, 0) * 0.05, isCompact)}`} style={{ borderColor: isDark ? "#334155" : "#cbd5e1" }}>
                      {(aggregatedTotals.subTotal.reduce((a, b) => a + b, 0) * 0.05) > 0 ? formatSpreadsheetPHP(aggregatedTotals.subTotal.reduce((a, b) => a + b, 0) * 0.05) : "-"}
                    </td>
                  </tr>

                  {/* (g) GRAND TOTAL */}
                  <tr className="font-black text-[12px] shadow-xs"
                      style={{
                        backgroundColor: isDark ? "#0f172a" : "#273240",
                        borderTop: "3px solid #0f172a",
                        color: "#f0be0a"
                      }}>
                    <td colSpan={2} className="p-4 text-start border-r font-black text-xs"
                        style={{ 
                          borderColor: isDark ? "#0c1f30" : "#cbd5e1",
                          backgroundColor: isDark ? "#0f172a" : "#273240",
                          color: "#f0be0a"
                        }}>
                      (g) GRAND TOTAL (e+f)
                    </td>
                    {aggregatedTotals.grandTotal.map((val, idx) => {
                      return (
                        <td key={`rep-grand-${idx}`} className={`p-4 border-r font-black ${getAutoFontSizeClass(val, isCompact)}`}
                            style={{ 
                              borderColor: isDark ? "#0c1f30" : "#cbd5e1",
                              color: "#f0be0a"
                            }}>
                          {formatSpreadsheetPHP(val)}
                        </td>
                      );
                    })}
                    <td colSpan={2} className={`p-4 border-r text-sm font-black ${getAutoFontSizeClass(totalGrandRequirement, isCompact)}`}
                        style={{ 
                          borderColor: isDark ? "#0c1f30" : "#cbd5e1",
                          color: "#f0be0a"
                        }}>
                      {formatSpreadsheetPHP(totalGrandRequirement)}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

            {/* Explainer Block */}
            <div className={`p-4 border-t text-[11px] leading-relaxed flex items-start gap-2.5 ${
              isDark ? "bg-slate-950 text-slate-400 border-slate-850" : "bg-slate-50 text-slate-500 border-slate-150"
            }`}>
              <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                This <b>Full Spreadsheet View</b> matches your traditional workbook format exactly. It presents Lot and Structure allocations per Contract Package vertically on the same sheet with complete overhead tax (+10%), demolition overhead (+30%), and contingency (+5%) totals.
              </p>
            </div>
          </motion.div>
        )}

        {/* TAB 3: SPLENDID PACKAGE CARDS GRID (Beautiful & Highly digestible breakdown) */}
        {activeTab === "cards" && (
          <motion.div
            key="tab-cards"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredCPs.map((cp) => {
              const cpData = tableData[cp];
              const lotSum = cpData.lot.reduce((a, b) => a + b, 0);
              const strSum = cpData.structure.reduce((a, b) => a + b, 0);
              
              const adjustedLand = lotSum * 1.10;
              const adjustedStr = strSum * 1.30;
              const adjustedTotal = (adjustedLand + adjustedStr) * 1.05; // 5% buffer on top

              // Check if there is actual activity
              const empty = lotSum === 0 && strSum === 0;

              return (
                <div 
                  key={cp}
                  className={`rounded-2xl border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between ${
                    empty 
                      ? (isDark ? "bg-slate-900/30 border-slate-850/50 opacity-50" : "bg-slate-100/50 border-slate-200/50 opacity-60")
                      : (isDark ? "bg-slate-950 hover:bg-slate-850 border-slate-850 hover:border-amber-500/40" : "bg-white hover:bg-slate-50/50 border-slate-200/80 hover:border-[#414c61]/40 shadow-xs")
                  }`}
                >
                  {/* Top visual accent matching the table columns */}
                  <div className={`h-1.5 w-full ${empty ? "bg-slate-300/40" : (isDark ? "bg-amber-500" : "bg-[#414c61]")}`} />
                  
                  <div className="p-4 flex-1">
                    <div className="flex items-center justify-between mb-3.5">
                      <span className={`inline-block px-3 py-1 text-xs font-black rounded-lg ${
                        isDark ? "bg-slate-800 text-slate-100" : "bg-[#414c61] text-white"
                      }`}>
                        Package {cp}
                      </span>
                      {!empty && (
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                          isDark ? "text-amber-400 bg-amber-500/5 border-amber-500/20" : "text-amber-800 bg-amber-50 border-amber-200"
                        }`}>
                          Active Plan
                        </span>
                      )}
                    </div>

                    <div className="space-y-2.5">
                      
                      {/* Land row details */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                          <Database className="w-3 h-3 text-sky-500" /> Land Cost:
                        </span>
                        <div className="text-right">
                          <div className="font-mono font-black text-[#414c61] dark:text-[#1d2c40]">{lotSum > 0 ? formatPHP(lotSum) : "-"}</div>
                          {lotSum > 0 && <div className="text-[9px] text-[#414c61] dark:text-[#1d2c40] font-bold">+10% Tax: {formatShortPHP(lotSum * 0.10)}</div>}
                        </div>
                      </div>

                      {/* Structure details */}
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                          <Layers className="w-3 h-3 text-orange-500" /> Structure:
                        </span>
                        <div className="text-right">
                          <div className="font-mono font-black text-[#c2410c] dark:text-orange-400">{strSum > 0 ? formatPHP(strSum) : "-"}</div>
                          {strSum > 0 && <div className="text-[9px] text-[#c2410c] dark:text-orange-400 font-bold">+30% Demo: {formatShortPHP(strSum * 0.30)}</div>}
                        </div>
                      </div>

                      {/* Final Adjusted total of the card package in a stylized elegant banner */}
                      <div 
                        className={`mt-3.5 p-2.5 rounded-xl flex justify-between items-center ${
                          isDark ? "bg-slate-900 border border-slate-800" : "bg-slate-50 border border-slate-200"
                        }`}
                      >
                        <span className={`text-[10px] font-black uppercase ${
                          isDark ? "text-slate-400" : "text-[#414c61]"
                        }`}>
                          Adjusted Total
                        </span>
                        <span className={`text-xs font-black font-mono ${
                          isDark ? "text-[#1d2c40]" : "text-[#414c61]"
                        }`}>
                          {adjustedTotal > 0 ? formatPHP(adjustedTotal) : "-"}
                        </span>
                      </div>

                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPasswordDialog && (
          <motion.div
            key="admin-password-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => {
              setShowPasswordDialog(false);
              setAuthSuccessCallback(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl relative overflow-hidden ${
                isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
              }`}
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-md font-extrabold tracking-tight">Admin Authorization</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Please verify your identity to modify S-07 data</p>
                </div>
              </div>

              <form onSubmit={handleVerifyPassword} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5">
                    Admin Password
                  </label>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Enter password..."
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError("");
                    }}
                    className={`w-full px-3.5 py-2 text-xs font-bold rounded-xl border outline-none font-mono transition-all ${
                      passwordError 
                        ? "border-rose-500 bg-rose-500/5 focus:border-rose-500" 
                        : (isDark 
                            ? "bg-slate-950 border-slate-800 text-amber-400 placeholder-slate-650 focus:border-amber-500/50" 
                            : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#273240]")
                    }`}
                  />
                  {passwordError && (
                    <p className="text-[10.5px] text-rose-500 font-extrabold mt-1.5 flex items-center gap-1 leading-none">
                      ⚠️ {passwordError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordDialog(false);
                      setAuthSuccessCallback(null);
                    }}
                    className={`flex-1 py-2 text-xs font-black uppercase rounded-xl border transition-all cursor-pointer ${
                      isDark 
                        ? "bg-slate-950 border-slate-800 hover:bg-slate-850 text-slate-400" 
                        : "bg-white border-slate-255 hover:bg-slate-50 text-slate-600"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-black uppercase rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm transition-all cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
  return content;
};
