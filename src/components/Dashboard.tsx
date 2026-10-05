import React, { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parse, isValid, startOfMonth, startOfWeek, endOfWeek, isWithinInterval, addWeeks } from "date-fns";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  LabelList,
  ComposedChart,
  AreaChart,
  Area,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  Layout, 
  ChevronDown, 
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CheckSquare, 
  Square, 
  Database,
  ArrowUpRight,
  Download,
  Info,
  Calendar,
  AlertCircle,
  Camera,
  X,
  Code,
  Cpu,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  AlertTriangle,
  Settings,
  Leaf,
  Clock,
  DollarSign,
  FileText,
  ShieldCheck,
  Sparkles,
  Zap,
  Scale,
  Gavel,
  Activity,
  Building2,
  Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ExcelJS from "exceljs";
import { LotData, WeeklyUpdate } from "../types";
import { ALL_STATUS_OPTIONS, satisfiesStatusFilter } from "../utils/statusUtils";
import { ThemeConfig } from "../lib/theme";
import { cn, formatCurrency, formatArea, formatFullAmountWithScale, getUniqueItemColor } from "../lib/utils";
import {
  KpiWidgetConfig,
  DashboardPanelConfig,
  getStoredKpiWidgetsConfig,
  getStoredPanelsConfig,
  savePanelsConfig,
  EVENT_KPI_WIDGETS_CHANGED,
  EVENT_DASHBOARD_PANELS_CHANGED,
  STORAGE_KEY_KPI_WIDGETS,
  STORAGE_KEY_DASHBOARD_PANELS
} from "../lib/dashboardConfig";
import { DisbursementPlan } from "./DisbursementPlan";
// @ts-ignore
import defaultBanner from "../assets/images/gcr_consortium_banner_177941510016.png";
// @ts-ignore
import danielPortrait from "../assets/images/daniel_antoque_1779689544232.png";
// @ts-ignore
import christianPortrait from "../assets/images/christian_pablo_1779689564265.png";

declare const __APP_VERSION__: string;

interface DashboardProps {
  data: LotData[];
  loading?: boolean;
  weeklyData?: WeeklyUpdate[];
  activeTheme?: ThemeConfig;
  weekOffset?: number;
  setWeekOffset?: React.Dispatch<React.SetStateAction<number>>;
  onSelectLot?: (lot: LotData) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

const formatCompactCurrency = (val: number) => {
  if (!val || val === 0) return "0";
  const billions = val / 1_000_000_000;
  if (billions < 0.005) return "0";
  return `${billions.toFixed(2)}B`;
};

// Global helper to parse dates like "Sep-25" or "2025-Sep-01"
const parseDateSafely = (dateStr: string) => {
  if (!dateStr || dateStr.toLowerCase().includes("no data")) return null;
  try {
    const parts = dateStr.split('-');
    if (parts.length === 2) {
      const monthStr = parts[0].substring(0, 3);
      const yearDigit = parts[1];
      const yearStr = yearDigit.length === 2 ? `20${yearDigit}` : yearDigit;
      const parsed = parse(`${monthStr}-${yearStr}`, "MMM-yyyy", new Date());
      if (isValid(parsed)) return parsed;
    }
    
    const cleaned = dateStr.replace(/-/g, " ");
    const parsed = new Date(cleaned);
    if (isValid(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
};

// Check if a lot has had a status update in the last 24 hours
const hasRecentUpdate = (lot: LotData, weeklyData: WeeklyUpdate[] = []): boolean => {
  if (!lot) return false;
  const now = new Date();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // 1. Check weeklyData (accomplishment updates)
  const lotIdLower = (lot.lotId || "").trim().toLowerCase();
  const lotUpdates = weeklyData.filter(item => (item.lotId || "").trim().toLowerCase() === lotIdLower);
  
  for (const update of lotUpdates) {
    if (update.dateEntry) {
      const d = parseDateSafely(update.dateEntry);
      if (d) {
        const diffMs = now.getTime() - d.getTime();
        if (Math.abs(diffMs) <= ONE_DAY_MS) {
          return true;
        }
      }
    }
    if (update.dateAccomplishment) {
      const d = parseDateSafely(update.dateAccomplishment);
      if (d) {
        const diffMs = now.getTime() - d.getTime();
        if (Math.abs(diffMs) <= ONE_DAY_MS) {
          return true;
        }
      }
    }
  }

  // 2. Check individual date fields on the LotData object itself
  const dateFields: (keyof LotData)[] = [
    "dateNot",
    "dateRfd",
    "dateOtb",
    "dateOtc",
    "dateDoas",
    "datePte",
    "datePaid",
    "dateHo",
    "dateCno",
    "relocationDate",
    "rfdReplyDate",
    "otbReplyDate",
    "otcReplyDate"
  ];

  for (const field of dateFields) {
    const dateVal = lot[field];
    if (typeof dateVal === "string" && dateVal.trim() !== "") {
      const d = parseDateSafely(dateVal);
      if (d) {
        const diffMs = now.getTime() - d.getTime();
        if (Math.abs(diffMs) <= ONE_DAY_MS) {
          return true;
        }
      }
    }
  }

  return false;
};

const LGU_FIXED_ORDER = [
  "MANILA",
  "MAKATI",
  "TAGUIG",
  "PASAY",
  "PARANAQUE",
  "MUNTINLUPA",
  "SAN PEDRO",
  "BINAN",
  "STA ROSA",
  "CABUYAO",
  "CALAMBA"
];

const ZONE_FIXED_ORDER = [
  "MANILA PHASE I",
  "MANILA PHASE IIA",
  "MANILA PHASE IIB",
  "MAKATI",
  "TAGUIG PHASE I",
  "TAGUIG PHASE II",
  "TUNNEL SECTION",
  "PARAÑAQUE",
  "MUNTINLUPA PHASE I",
  "MUNTINLUPA PHASE II",
  "SAN PEDRO",
  "BIÑAN",
  "STA. ROSA",
  "CABUYAO",
  "CALAMBA",
  "BANLIC DEPOT"
];

const CP_FIXED_ORDER = [
  "S-01",
  "S-02",
  "S-03A",
  "S-03B",
  "S-03C",
  "S-04",
  "S-05",
  "S-06",
  "S-07"
];

const RAP_LGU_FIXED_ORDER = [
  "MANILA 1",
  "MANILA 2",
  "MAKATI",
  "TAGUIG 1",
  "PARAÑAQUE",
  "TAGUIG 2",
  "MUNTINLUPA 2",
  "TAGUIG, PASAY",
  "MUNTINLUPA 1",
  "SAN PEDRO",
  "BINAN",
  "STA. ROSA",
  "CABUYAO",
  "CALAMBA",
  "BANLIC DEPOT"
];

const RAP_CP_FIXED_ORDER = [
  "S-01",
  "S-02",
  "S-03A",
  "S-03B",
  "S-03C",
  "S-04",
  "S-05",
  "S-06",
  "S-07"
];

export type ComboMetricKey = 'acquiredLotsCount' | 'fullyPaidCount' | 'partiallyPaidCount' | 'pteSignedCount' | 'doasSignedCount' | 'cnoSignedCount' | 'handedOverCount' | 'exproCount' | 'notAffectedCount' | 'affectedArea' | 'actualCost' | 'totalCost';

export const COMBO_OPTIONS: { key: ComboMetricKey; label: string }[] = [
  { key: 'acquiredLotsCount', label: 'COMBO: ACQUIRED LOTS [COL BS]' },
  { key: 'fullyPaidCount', label: 'COMBO: FULLY PAID LOTS' },
  { key: 'partiallyPaidCount', label: 'COMBO: PARTIALLY PAID LOTS' },
  { key: 'pteSignedCount', label: 'COMBO: PTE SIGNED LOTS [COL N]' },
  { key: 'doasSignedCount', label: 'COMBO: DOAS SIGNED LOTS' },
  { key: 'cnoSignedCount', label: 'COMBO: CNO LOTS' },
  { key: 'handedOverCount', label: 'COMBO: HANDED OVER LOTS' },
  { key: 'exproCount', label: 'COMBO: EXPROPRIATION CASES' },
  { key: 'affectedArea', label: 'COMBO: TOTAL AREA (SQM) [COL AH]' },
  { key: 'actualCost', label: 'COMBO: ACTUAL COST (₱) [COL AO]' },
  { key: 'totalCost', label: 'COMBO: TOTAL EST. COST (₱)' },
];

const COMBO_METRIC_CONFIG: Record<string, { label: string; unit: string; key: string; color: string; gradientStart: string; gradientEnd: string }> = {
  none: { label: "None", unit: "", key: "", color: "#818cf8", gradientStart: "#818cf8", gradientEnd: "#6366f1" },
  acquiredLotsCount: { label: "Acquired Lots [Col BS]", unit: " lots", key: "acquiredLotsCount", color: "#10b981", gradientStart: "#34d399", gradientEnd: "#059669" },
  fullyPaidCount: { label: "Fully Paid Lots", unit: " lots", key: "fullyPaidCount", color: "#10b981", gradientStart: "#34d399", gradientEnd: "#059669" },
  partiallyPaidCount: { label: "Partially Paid Lots", unit: " lots", key: "partiallyPaidCount", color: "#f97316", gradientStart: "#fb923c", gradientEnd: "#ea580c" },
  pteSignedCount: { label: "PTE Signed Lots [Col N]", unit: " lots", key: "pteSignedCount", color: "#06b6d4", gradientStart: "#38bdf8", gradientEnd: "#0284c7" },
  doasSignedCount: { label: "DOAS Signed Lots", unit: " lots", key: "doasSignedCount", color: "#a855f7", gradientStart: "#c084fc", gradientEnd: "#7e22ce" },
  cnoSignedCount: { label: "CNO Lots", unit: " lots", key: "cnoSignedCount", color: "#14b8a6", gradientStart: "#2dd4bf", gradientEnd: "#0f766e" },
  handedOverCount: { label: "Handed Over Lots", unit: " lots", key: "handedOverCount", color: "#eab308", gradientStart: "#fde047", gradientEnd: "#ca8a04" },
  exproCount: { label: "Expro / Legal Cases", unit: " cases", key: "exproCount", color: "#f43f5e", gradientStart: "#fb7185", gradientEnd: "#e11d48" },
  notAffectedCount: { label: "Not Affected Lots", unit: " lots", key: "notAffectedCount", color: "#64748b", gradientStart: "#94a3b8", gradientEnd: "#475569" },
  affectedArea: { label: "Total Area (SQM) [Col AH]", unit: " sqm", key: "affectedArea", color: "#38bdf8", gradientStart: "#60a5fa", gradientEnd: "#1d4ed8" },
  actualCost: { label: "Actual Cost [Col AO]", unit: "", key: "actualCost", color: "#ec4899", gradientStart: "#f472b6", gradientEnd: "#db2777" },
  totalCost: { label: "Total Est. Cost", unit: "", key: "totalCost", color: "#f59e0b", gradientStart: "#fbbf24", gradientEnd: "#d97706" }
};

const STATUS_FIXED_ORDER = [
  "1 NOT FOR DRAFTING",
  "2 ISSUED NOT",
  "3 ISSUED OTB",
  "4 ACCEPTED OTB",
  "5 REJECTED OTB",
  "6 SIGNED DOAS",
  "7 EJSEAS",
  "8 PTE SIGNED",
  "9 PARTIALLY PAID",
  "10 FULLY PAID",
  "11 CNO",
  "12 HANDED OVER LOT",
  "13 ACQUIRED LOTS",
  "ACQUIRED LOTS",
  "ACQUIRED",
  "NOT FOR DRAFTING",
  "NOT ISSUED",
  "OTB ISSUED",
  "OTB ACCEPTED",
  "OTB REJECTED",
  "DOAS SIGNED",
  "PARTIALLY PAID",
  "FULLY PAID",
  "WITH PTE",
  "WITH CNO",
  "HANDED OVER LOT",
  "PAID CROPS AND TREES"
];

export const getItemOrderIndex = (type: string, name: string): number => {
  if (!name) return 999;
  const norm = name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .trim();

  if (type === 'lgu') {
    const idx = LGU_FIXED_ORDER.findIndex(item => {
      const itemNorm = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      return norm === itemNorm;
    });
    return idx !== -1 ? idx : 999;
  }

  if (type === 'rapLgu') {
    const idx = RAP_LGU_FIXED_ORDER.findIndex(item => {
      const itemNorm = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      return norm === itemNorm;
    });
    return idx !== -1 ? idx : 999;
  }

  if (type === 'cp') {
    const idx = CP_FIXED_ORDER.findIndex(item => {
      const itemNorm = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      return norm === itemNorm;
    });
    return idx !== -1 ? idx : 999;
  }

  if (type === 'rapCp') {
    const idx = RAP_CP_FIXED_ORDER.findIndex(item => {
      const itemNorm = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      return norm === itemNorm;
    });
    return idx !== -1 ? idx : 999;
  }

  if (type === 'zone') {
    let normZone = norm
      .replace("PHASE1", "PHASEI")
      .replace("PHASE2A", "PHASEIIA")
      .replace("PHASE2B", "PHASEIIB")
      .replace("PHASE2", "PHASEII");

    const idx = ZONE_FIXED_ORDER.findIndex(item => {
      const itemNorm = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      return normZone === itemNorm || norm === itemNorm;
    });
    return idx !== -1 ? idx : 999;
  }

  if (type === 'status') {
    // 1. Direct numeric prefix match (e.g., "1 NOT FOR DRAFTING", "2 ISSUED NOT", "10 FULLY PAID")
    const trimmedName = name.trim();
    const numMatch = trimmedName.match(/^(\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    // 2. Keyword matching for non-numbered status strings following the 1..12 sequence
    if (norm.includes("NOTFORDRAFTING")) return 1;
    if (norm.includes("ISSUEDNOT") || norm.includes("NOTISSUED") || norm.includes("DRAFTEDNOT")) return 2;
    if (norm.includes("ISSUEDOTB") || norm.includes("OTBISSUED") || norm.includes("3ISSUEDOTB")) return 3;
    if (norm.includes("ACCEPTED") || norm.includes("OTBACCEPTED")) return 4;
    if (norm.includes("REJECTED") || norm.includes("REJECT") || norm.includes("OTBREJECTED") || norm.includes("INCURABLE") || norm.includes("30DAYS")) return 5;
    if (norm.includes("SIGNEDDOAS") || norm.includes("DOASSIGNED") || norm.includes("DOAS")) return 6;
    if (norm.includes("EJSEAS")) return 7;
    if (norm.includes("PTESIGNED") || norm.includes("SIGNEDPTE") || norm.includes("WITHPTE") || norm.includes("PTE")) return 8;
    if (norm.includes("PARTIALLYPAID") || norm.includes("PARTIALPAID")) return 9;
    if (norm.includes("FULLYPAID")) return 10;
    if (norm.includes("WITHCNO") || norm.includes("CNO") || norm.includes("MOA")) return 11;
    if (norm.includes("HANDEDOVER") || norm.includes("HANDOVER") || norm.includes("HOL")) return 12;
    if (norm.includes("PAIDCROPS") || norm.includes("CROPS")) return 13;

    const idx = STATUS_FIXED_ORDER.findIndex(item => {
      const itemNorm = item.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "").trim();
      return norm === itemNorm;
    });
    return idx !== -1 ? idx : 999;
  }

  return 999;
};

export function extractPierNumbers(str: string | undefined | null): number[] {
  if (!str) return [];
  const matches: number[] = [];
  const norm = str.replace(/\s*-\s*/g, "-");
  
  // Regex to match sequences of digits preceded by letters or dash
  const generalPierRegex = /(?:P|PR|BUE|MT)[-N-S]*(\d+)/gi;
  let match;
  while ((match = generalPierRegex.exec(norm)) !== null) {
    matches.push(parseInt(match[1], 10));
  }
  
  // Fallback for pure numbers (without station plus sign)
  if (matches.length === 0 && !str.includes("+")) {
    const numbers = norm.match(/\d+/g);
    if (numbers) {
      numbers.forEach(numStr => {
        const val = parseInt(numStr, 10);
        if (val > 0 && val < 2000) { // filter out years like 2026
          matches.push(val);
        }
      });
    }
  }
  
  return Array.from(new Set(matches));
}

const INITIAL_FILTERS = {
  currentStatus: [] as string[],
  cp: [] as string[],
  rapCp: [] as string[],
  ownerClassification: [] as string[],
  prowImpact: [] as string[],
  lgu: [] as string[],
  rapLgu: [] as string[],
  zone: [] as string[],
  modeAcquisition: [] as string[],
  harmonization: [] as string[],
};

export const Dashboard: React.FC<DashboardProps> = ({ 
  data, 
  loading, 
  weeklyData = [], 
  activeTheme,
  weekOffset = 0,
  setWeekOffset = (_val: React.SetStateAction<number> | any) => {},
  onSelectLot
}) => {
  const [search, setSearch] = useState("");
  const [startPier, setStartPier] = useState("");
  const [endPier, setEndPier] = useState("");

  // Double-Click Drilldown Lots List Modal State
  const [selectedBarModal, setSelectedBarModal] = useState<{
    isOpen: boolean;
    categoryType: string;
    categoryLabel: string;
    barName: string;
    lots: LotData[];
  } | null>(null);

  const [barModalComboFilter, setBarModalComboFilter] = useState<'all' | 'combo'>('all');
  const [barModalSearch, setBarModalSearch] = useState("");
  const [barModalPage, setBarModalPage] = useState(1);
  const BAR_MODAL_PAGE_SIZE = 25;
  
  const isPierRangeReversed = useMemo(() => {
    if (!startPier || !endPier) return false;
    const sMatch = startPier.match(/\d+/);
    const eMatch = endPier.match(/\d+/);
    const s = sMatch ? parseInt(sMatch[0], 10) : NaN;
    const e = eMatch ? parseInt(eMatch[0], 10) : NaN;
    return !isNaN(s) && !isNaN(e) && s > e;
  }, [startPier, endPier]);

  const [nonWorkableCostFilter, setNonWorkableCostFilter] = useState<'land' | 'structure' | 'both'>('land');
  const [zoomedDev, setZoomedDev] = useState<{ name: string; role: string; badge: string; picture: string; bio: string; color: string } | null>(null);
  const [showCurrentWeekUpdates, setShowCurrentWeekUpdates] = useState(false);
  const [interactionMode, setInteractionMode] = useState<'hover' | 'click'>('click');
  const [selectedStatusCard, setSelectedStatusCard] = useState<string | null>(null);

  // Interactive Tour Guide State for First-Time Users & State Toggle
  const [tourActive, setTourActive] = useState<boolean>(() => {
    try {
      const tourSeen = localStorage.getItem("scla_dashboard_tour_seen_v1");
      return !tourSeen;
    } catch {
      return false;
    }
  });
  const [tourStep, setTourStep] = useState<number>(0);

  const tourSteps = useMemo(() => [
    {
      id: "tour-welcome",
      targetId: "tour-welcome",
      title: "Welcome to SCLA Analytics!",
      description: "This interactive tour highlights the core areas of the land acquisition data terminal. Let's get started!",
      icon: <Sparkles className="w-5 h-5 text-amber-400" />
    },
    {
      id: "tour-interaction-modes",
      targetId: "tour-interaction-modes",
      title: "Interactivity Controls",
      description: "Quickly toggle between 'Hover' and 'Click' triggers to customize how you explore detailed lot breakdowns and histories.",
      icon: <Activity className="w-5 h-5 text-brand-400" />
    },
    {
      id: "tour-snapshots",
      targetId: "tour-snapshots",
      title: "Physical & Financial Snapshots",
      description: "Review physical survey area metrics alongside real-time financial snapshots (Estimated vs. Actual project cost) compiled from registry databases.",
      icon: <Layout className="w-5 h-5 text-sky-400" />
    },
    {
      id: "tour-kpis",
      targetId: "tour-kpis",
      title: "Key Performance Indicators (KPIs)",
      description: "Monitor status counts across 16 different milestone columns, tracking everything from 'NoT Issued' up to 'Lot Handover'. Hover or click cards to reveal detailed lot lists.",
      icon: <Database className="w-5 h-5 text-emerald-400" />
    },
    {
      id: "tour-charts",
      targetId: "tour-charts",
      title: "Interactive Progress Charts",
      description: "Visualize overall land acquisition progress, velocity trends, and expropriation metrics. Switch chart styles and zoom panels seamlessly.",
      icon: <TrendingUp className="w-5 h-5 text-indigo-400" />
    }
  ], []);

  const handleTourNext = () => {
    if (tourStep < 4) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
      setTimeout(() => {
        const targetId = tourSteps[nextStep].targetId;
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    } else {
      handleTourClose();
    }
  };

  const handleTourPrev = () => {
    if (tourStep > 0) {
      const prevStep = tourStep - 1;
      setTourStep(prevStep);
      setTimeout(() => {
        const targetId = tourSteps[prevStep].targetId;
        const element = document.getElementById(targetId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  };

  const handleTourClose = () => {
    setTourActive(false);
    try {
      localStorage.setItem("scla_dashboard_tour_seen_v1", "true");
    } catch (e) {
      console.error("Storage write error:", e);
    }
  };

  // Keyboard navigation listeners for seamless accessibility
  React.useEffect(() => {
    if (!tourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleTourNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleTourPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleTourClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tourActive, tourStep, tourSteps]);

  // Initial scroll anchor when tour starts automatically
  React.useEffect(() => {
    if (tourActive && tourStep === 0) {
      const timer = setTimeout(() => {
        const element = document.getElementById("tour-welcome");
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tourActive]);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [lastToggledSeries, setLastToggledSeries] = useState<string | null>(null);

  const [kpiWidgetsConfig, setKpiWidgetsConfig] = useState<KpiWidgetConfig[]>(() => getStoredKpiWidgetsConfig());
  const [panelsConfig, setPanelsConfig] = useState<DashboardPanelConfig[]>(() => getStoredPanelsConfig());

  const [hiddenPanels, setHiddenPanels] = useState<Record<string, boolean>>(() => {
    const storedPanels = getStoredPanelsConfig();
    const map: Record<string, boolean> = {
      la: true,
      expro: true,
      scNonWorkable: false,
      cumulative: false,
      resourceLoad: false,
      disbursement: true,
    };
    storedPanels.forEach(p => {
      map[p.id] = !p.visible;
    });
    return map;
  });

  useEffect(() => {
    const handleKpiChange = (e?: Event) => {
      const detailKpis = (e as CustomEvent)?.detail;
      const updatedKpis = Array.isArray(detailKpis) && detailKpis.length > 0 
        ? detailKpis 
        : getStoredKpiWidgetsConfig();
      setKpiWidgetsConfig(updatedKpis);
    };

    const handlePanelsChange = (e?: Event) => {
      const detailPanels = (e as CustomEvent)?.detail;
      const updatedPanels = Array.isArray(detailPanels) && detailPanels.length > 0 
        ? detailPanels 
        : getStoredPanelsConfig();
      setPanelsConfig(updatedPanels);
      const newHidden: Record<string, boolean> = {};
      updatedPanels.forEach(p => {
        newHidden[p.id] = !p.visible;
      });
      setHiddenPanels(newHidden);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_KPI_WIDGETS) {
        handleKpiChange();
      } else if (e.key === STORAGE_KEY_DASHBOARD_PANELS) {
        handlePanelsChange();
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("gcr_dashboard_sync");
        channel.onmessage = (msg) => {
          if (msg.data?.type === EVENT_KPI_WIDGETS_CHANGED) {
            handleKpiChange(new CustomEvent(EVENT_KPI_WIDGETS_CHANGED, { detail: msg.data.config }));
          } else if (msg.data?.type === EVENT_DASHBOARD_PANELS_CHANGED) {
            handlePanelsChange(new CustomEvent(EVENT_DASHBOARD_PANELS_CHANGED, { detail: msg.data.config }));
          }
        };
      }
    } catch {
      // Channel unavailable
    }

    window.addEventListener(EVENT_KPI_WIDGETS_CHANGED, handleKpiChange);
    window.addEventListener(EVENT_DASHBOARD_PANELS_CHANGED, handlePanelsChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(EVENT_KPI_WIDGETS_CHANGED, handleKpiChange);
      window.removeEventListener(EVENT_DASHBOARD_PANELS_CHANGED, handlePanelsChange);
      window.removeEventListener("storage", handleStorageChange);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  const handleTogglePanel = (panelId: string, hide: boolean) => {
    setHiddenPanels(prev => ({ ...prev, [panelId]: hide }));
    const updated = panelsConfig.map(p => p.id === panelId ? { ...p, visible: !hide } : p);
    setPanelsConfig(updated);
    savePanelsConfig(updated);
  };
  const [resourceLoadType, setResourceLoadType] = useState<'lgu' | 'rapLgu' | 'cp' | 'rapCp' | 'zone' | 'mode' | 'payment' | 'status'>('lgu');
  const [resourceLoadComboMetrics, setResourceLoadComboMetrics] = useState<ComboMetricKey[]>([]);
  const [isComboDropdownOpen, setIsComboDropdownOpen] = useState<boolean>(false);
  const comboDropdownRef = useRef<HTMLDivElement>(null);

  // Close combo dropdown on outside click
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboDropdownRef.current && !comboDropdownRef.current.contains(e.target as Node)) {
        setIsComboDropdownOpen(false);
      }
    };
    if (isComboDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isComboDropdownOpen]);

  const toggleComboMetric = (key: ComboMetricKey) => {
    setResourceLoadComboMetrics(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const resourceLoadComboMetric: 'none' | ComboMetricKey = resourceLoadComboMetrics[0] || 'none';
  const setResourceLoadComboMetric = (metric: 'none' | ComboMetricKey) => {
    if (metric === 'none') {
      setResourceLoadComboMetrics([]);
    } else {
      setResourceLoadComboMetrics([metric]);
    }
  };
  const [resourceLoadChartStyle, setResourceLoadChartStyle] = useState<'vertical' | 'horizontal' | 'donut'>('vertical');
  const [showResourceLoadPct, setShowResourceLoadPct] = useState<boolean>(false);
  const [isResourceLoadHovered, setIsResourceLoadHovered] = useState<boolean>(false);
  const [maximizedPanel, setMaximizedPanel] = useState<string | null>(null);

  // Auto-reset selected status filter back to Total Lots after 30s of inactivity if mouse is not hovering over resource load distribution
  React.useEffect(() => {
    if (!selectedStatusCard || selectedStatusCard === "TOTAL LOTS" || selectedStatusCard === "LOT ID NO") {
      return;
    }
    if (isResourceLoadHovered) {
      return;
    }
    const timer = setTimeout(() => {
      setSelectedStatusCard(null);
    }, 30000);
    return () => clearTimeout(timer);
  }, [selectedStatusCard, isResourceLoadHovered]);

  // Date Range and Sidebar states
  const [dateRangeMode, setDateRangeMode] = useState<'latest' | 'any' | 'specific'>('latest');
  const [selectedSpecificMilestone, setSelectedSpecificMilestone] = useState<string>('datePaid');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
   const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const [isDateFilterExpanded, setIsDateFilterExpanded] = useState(false);
  const [presetType, setPresetType] = useState<'presets' | 'year' | 'quarter' | 'month'>('presets');
  const [selectedFilterYear, setSelectedFilterYear] = useState<number>(2026);
  const [selectedFilterQuarter, setSelectedFilterQuarter] = useState<number>(1);
  const [selectedFilterMonth, setSelectedFilterMonth] = useState<number>(0);

  React.useEffect(() => {
    setHasAnimated(true);
  }, []);

  React.useEffect(() => {
    if (interactionMode !== 'click') return;

    const handleWindowClick = () => {
      setHoveredCell(null);
      setHoveredStatCard(null);
    };

    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, [interactionMode]);

  React.useEffect(() => {
    if (lastToggledSeries) {
      const timer = setTimeout(() => {
        setLastToggledSeries(null);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [lastToggledSeries]);

  const panelNames: Record<string, string> = {
    la: "LA Progress Overview",
    expro: "Expro Progress Overview",
    scNonWorkable: "SC Non-Workable Area Progress",
    cumulative: "Cumulative Acquisition Progress",
    resourceLoad: "Resource Load Distribution",
    disbursement: "Disbursement Plan Matrix"
  };

  const hasHiddenPanels = Object.values(hiddenPanels).some(v => v);

  const exactSearch = true;
  const [filters, setFilters] = useState<typeof INITIAL_FILTERS>(() => ({ ...INITIAL_FILTERS }));

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Pre-calculate lots with recent updates to avoid O(N * M) performance hits on every render/hover
  const recentUpdatesSet = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Helper to parse date inside useMemo
    const parseDateLocal = (dateStr: string | undefined | null): Date | null => {
      if (!dateStr || String(dateStr).toLowerCase().includes("no data") || String(dateStr).trim() === "" || String(dateStr).trim() === "-") return null;
      try {
        const trimmed = dateStr.trim();
        const hasMonthLetters = /[a-zA-Z]/.test(trimmed);
        if (hasMonthLetters) {
          const cleaned = trimmed.replace(/-/g, " ");
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        } else {
          const cleaned = trimmed.replace(/-/g, "/");
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        }
        const fallback = new Date(trimmed);
        if (!isNaN(fallback.getTime())) return fallback;
        return null;
      } catch {
        return null;
      }
    };

    // 1. Process weeklyData
    if (weeklyData && weeklyData.length > 0) {
      for (const update of weeklyData) {
        if (!update.lotId) continue;
        
        let isRecent = false;
        if (update.dateEntry) {
          const d = parseDateLocal(update.dateEntry);
          if (d && Math.abs(now.getTime() - d.getTime()) <= ONE_DAY_MS) {
            isRecent = true;
          }
        }
        if (!isRecent && update.dateAccomplishment) {
          const d = parseDateLocal(update.dateAccomplishment);
          if (d && Math.abs(now.getTime() - d.getTime()) <= ONE_DAY_MS) {
            isRecent = true;
          }
        }

        if (isRecent) {
          set.add((update.lotId).toString().trim().toLowerCase());
        }
      }
    }

    // 2. Process data (LotData individual fields)
    const dateFields: (keyof LotData)[] = [
      "dateNot",
      "dateRfd",
      "dateOtb",
      "dateOtc",
      "dateDoas",
      "datePte",
      "datePaid",
      "dateHo",
      "dateCno",
      "relocationDate",
      "rfdReplyDate",
      "otbReplyDate",
      "otcReplyDate"
    ];

    if (data && data.length > 0) {
      for (const lot of data) {
        const lotIdLower = (lot.lotId || "").toString().trim().toLowerCase();
        if (!lotIdLower || set.has(lotIdLower)) continue;

        for (const field of dateFields) {
          const dateVal = lot[field];
          if (typeof dateVal === "string" && dateVal.trim() !== "") {
            const d = parseDateLocal(dateVal);
            if (d && Math.abs(now.getTime() - d.getTime()) <= ONE_DAY_MS) {
              set.add(lotIdLower);
              break;
            }
          }
        }
      }
    }

    return set;
  }, [data, weeklyData]);

  // Helper to normalize text for comparison
  const normalizeText = (text: string) => (text || "").toString().trim().toUpperCase();

  const isValidDateValue = (val: string | undefined | null): boolean => {
    if (!val) return false;
    const s = val.trim().toUpperCase();
    if (s === "" || s === "-" || s === "0" || s === "N/A" || s === "NO DATA" || s === "PENDING" || s === "NOT STARTED" || s === "NONE" || s === "NULL") {
      return false;
    }
    return /\d/.test(s);
  };

  const getStatusPredicate = (statusLabel: string) => {
    switch (statusLabel) {
      case "NoT Issued":
        return (d: LotData) => isValidDateValue(d.dateNot);
      case "Issued RfD/OTB/OtC":
        return (d: LotData) => isValidDateValue(d.dateOtb);
      case "Accepted RfD/OTB/OtC":
        return (d: LotData) => normalizeText(d.otbReply).includes("ACCEPTED") || normalizeText(d.rfdReply).includes("ACCEPTED");
      case "30 days Review RfD/OTB/OtC":
        return (d: LotData) => normalizeText(d.otbReply).includes("30 DAYS REVIEW") || normalizeText(d.rfdReply).includes("30 DAYS REVIEW");
      case "Incurable RfD/OTB/OtC":
        return (d: LotData) => normalizeText(d.otbReply).includes("INCURABLE") || normalizeText(d.rfdReply).includes("INCURABLE");
      case "Rejected RfD/OTB/OtC":
        return (d: LotData) => normalizeText(d.otbReply).includes("REJECT") || normalizeText(d.rfdReply).includes("REJECT");
      case "DOAS":
      case "SIGNED DOAS":
        return (d: LotData) => normalizeText(d.statusDoas).includes("SIGNED");
      case "EJSEAS":
        return (d: LotData) => normalizeText(d.statusDoas).includes("EJSEAS");
      case "PTE":
        return (d: LotData) => normalizeText(d.statusPte).includes("SIGNED");
      case "Partial Paid":
        return (d: LotData) => {
          const val = normalizeText(d.paymentStatus);
          return val.includes("PARTIALLY PAID") || val.includes("PAID WITH WOP");
        };
      case "Fully Paid":
        return (d: LotData) => normalizeText(d.paymentStatus).includes("FULLY PAID");
      case "Handed Over":
        return (d: LotData) => isValidDateValue(d.dateHo);
      case "CNO":
        return (d: LotData) => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("CNO");
      case "MOA":
        return (d: LotData) => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("MOA");
      case "Paid Crops":
        return (d: LotData) => Boolean(d.advancePaymentDate && d.advancePaymentDate.trim() !== "");
      default:
        return null;
    }
  };

  const parseDateSafelyGlobal = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr || String(dateStr).toLowerCase().includes("no data") || String(dateStr).trim() === "" || String(dateStr).trim() === "-") return null;
    try {
      const trimmed = dateStr.trim();
      const hasMonthLetters = /[a-zA-Z]/.test(trimmed);
      if (hasMonthLetters) {
        const cleaned = trimmed.replace(/-/g, " ");
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d;
      } else {
        const cleaned = trimmed.replace(/-/g, "/");
        const d = new Date(cleaned);
        if (!isNaN(d.getTime())) return d;
      }
      const fallback = new Date(trimmed);
      if (!isNaN(fallback.getTime())) return fallback;
      return null;
    } catch {
      return null;
    }
  };

  const dataDateBounds = useMemo(() => {
    if (!data || data.length === 0) {
      return { min: "2021-01-01", max: "2026-12-31", minDate: new Date(2021, 0, 1), maxDate: new Date(2026, 11, 31) };
    }
    
    let minD: Date | null = null;
    let maxD: Date | null = null;
    
    const dateFields: Array<keyof LotData> = ['dateNot', 'dateOtb', 'dateDoas', 'datePte', 'datePaid', 'dateHo', 'dateCno'];
    
    data.forEach(d => {
      dateFields.forEach(f => {
        const val = d[f];
        if (typeof val === 'string' && isValidDateValue(val)) {
          const parsed = parseDateSafelyGlobal(val);
          if (parsed && !isNaN(parsed.getTime())) {
            if (!minD || parsed < minD) minD = parsed;
            if (!maxD || parsed > maxD) maxD = parsed;
          }
        }
      });
    });
    
    const fallbackMin = minD || new Date(2021, 0, 1);
    const fallbackMax = maxD || new Date();
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    
    return {
      min: formatYMD(fallbackMin),
      max: formatYMD(fallbackMax),
      minDate: fallbackMin,
      maxDate: fallbackMax
    };
  }, [data]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const minYr = dataDateBounds.minDate?.getFullYear() || 2021;
    const maxYr = dataDateBounds.maxDate?.getFullYear() || 2026;
    for (let y = minYr; y <= maxYr; y++) {
      years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [dataDateBounds]);

  // Sync state with bounds on initial load (only if dates are not already set)
  React.useEffect(() => {
    if (dataDateBounds.min && dataDateBounds.max) {
      setStartDateStr(prev => prev || dataDateBounds.min);
      setEndDateStr(prev => prev || dataDateBounds.max);
    }
  }, [dataDateBounds.min, dataDateBounds.max]);

  // Find exact matching lot by search query
  const matchedLot = useMemo(() => {
    if (!data || !search.trim()) return null;
    return data.find(
      d => normalizeText(d.lotId) === normalizeText(search.trim())
    );
  }, [data, search]);

  const prevSearchRef = React.useRef<string>(search.trim());

  // Auto-populate filters when exact Lot ID matches the search query or revert when search is cleared
  React.useEffect(() => {
    if (!data) return;
    const trimmed = search.trim();
    const prevSearch = prevSearchRef.current;
    prevSearchRef.current = trimmed;

    // Only update filters if search query itself actually changed
    if (trimmed !== prevSearch) {
      if (!trimmed) {
        if (prevSearch) {
          setFilters({ ...INITIAL_FILTERS });
        }
      } else {
        const matchedLot = data.find(
          d => normalizeText(d.lotId) === normalizeText(trimmed)
        );

        if (matchedLot) {
          const statusVal = matchedLot.currentStatus || (matchedLot as any).status;
          setFilters({
            ...INITIAL_FILTERS,
            currentStatus: statusVal ? [normalizeText(statusVal)] : [],
            cp: matchedLot.cp ? [normalizeText(matchedLot.cp)] : [],
            rapCp: (matchedLot.rapCp || matchedLot.cp) ? [normalizeText(matchedLot.rapCp || matchedLot.cp)] : [],
            ownerClassification: matchedLot.ownerClassification ? [normalizeText(matchedLot.ownerClassification)] : [],
            prowImpact: matchedLot.prowImpact ? [normalizeText(matchedLot.prowImpact)] : [],
            lgu: matchedLot.lgu ? [normalizeText(matchedLot.lgu)] : [],
            rapLgu: (matchedLot.rapLgu || matchedLot.lgu) ? [normalizeText(matchedLot.rapLgu || matchedLot.lgu)] : [],
            zone: matchedLot.zone ? [normalizeText(matchedLot.zone)] : [],
            modeAcquisition: matchedLot.modeAcquisition ? [normalizeText(matchedLot.modeAcquisition)] : [],
            harmonization: (matchedLot.optimizationCases || matchedLot.harmonization) ? [normalizeText(matchedLot.optimizationCases || matchedLot.harmonization)] : [],
          });
        }
      }
    }
  }, [search, data]);

  // Safe Multi-select toggle
  const toggleFilter = (key: keyof typeof INITIAL_FILTERS, value: string) => {
    setFilters(prev => {
      const base = prev || INITIAL_FILTERS;
      const currentList = Array.isArray(base[key]) ? base[key] : [];
      const updatedList = currentList.includes(value) 
        ? currentList.filter(v => v !== value) 
        : [...currentList, value];
      return {
        ...INITIAL_FILTERS,
        ...base,
        [key]: updatedList
      };
    });
  };

  // Safe helper to remove a single filter value
  const removeFilterValue = (key: keyof typeof INITIAL_FILTERS, value: string) => {
    setFilters(prev => {
      const base = prev || INITIAL_FILTERS;
      const currentList = Array.isArray(base[key]) ? base[key] : [];
      return {
        ...INITIAL_FILTERS,
        ...base,
        [key]: currentList.filter(v => v !== value)
      };
    });
  };

  // Safe helper to clear an entire category of filters
  const clearFilterCategory = (key: keyof typeof INITIAL_FILTERS) => {
    setFilters(prev => ({
      ...INITIAL_FILTERS,
      ...(prev || {}),
      [key]: []
    }));
  };

  const clearAllFilters = () => {
    setSearch("");
    setStartPier("");
    setEndPier("");
    setSelectedStatusCard(null);
    setSelectedBarModal(null);
    setActiveDropdown(null);
    setFilters({ ...INITIAL_FILTERS });
    setDatePreset('all');
    if (dataDateBounds.min && dataDateBounds.max) {
      setStartDateStr(dataDateBounds.min);
      setEndDateStr(dataDateBounds.max);
    }
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    const start = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
    const end = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;

    const normSearch = search ? normalizeText(search) : "";
    const cpFilters = (filters?.cp || []).length > 0 ? filters.cp : null;
    const rapCpFilters = (filters?.rapCp || []).length > 0 ? filters.rapCp : null;
    const ownerFilters = (filters?.ownerClassification || []).length > 0 ? filters.ownerClassification : null;
    const prowFilters = (filters?.prowImpact || []).length > 0 ? filters.prowImpact : null;
    const lguFilters = (filters?.lgu || []).length > 0 ? filters.lgu : null;
    const rapLguFilters = (filters?.rapLgu || []).length > 0 ? filters.rapLgu : null;
    const zoneFilters = (filters?.zone || []).length > 0 ? filters.zone : null;
    const statusFilters = (filters?.currentStatus || []).length > 0 ? filters.currentStatus : null;
    const modeFilters = (filters?.modeAcquisition || []).length > 0 ? filters.modeAcquisition : null;
    const harmFilters = (filters?.harmonization || []).length > 0 ? filters.harmonization : null;
    
    return data.filter(d => {
      const lotIdNorm = normalizeText(d.lotId);
      if (normSearch) {
        if (exactSearch) {
          if (lotIdNorm !== normSearch) return false;
        } else {
          if (!lotIdNorm.includes(normSearch)) return false;
        }
      }

      if (cpFilters && !cpFilters.includes(normalizeText(d.cp || d.rapCp))) return false;
      if (rapCpFilters && !rapCpFilters.includes(normalizeText(d.rapCp || d.cp))) return false;
      if (ownerFilters && !ownerFilters.includes(normalizeText(d.ownerClassification))) return false;
      if (prowFilters && !prowFilters.includes(normalizeText(d.prowImpact))) return false;
      if (lguFilters && !lguFilters.includes(normalizeText(d.lgu))) return false;
      if (rapLguFilters && !rapLguFilters.includes(normalizeText(d.rapLgu || d.lgu))) return false;
      if (zoneFilters && !zoneFilters.includes(normalizeText(d.zone))) return false;
      if (modeFilters && !modeFilters.includes(normalizeText(d.modeAcquisition))) return false;
      
      if (statusFilters) {
        const isExpro = (d.modeAcquisition && normalizeText(d.modeAcquisition).includes("EXPRO")) || !!d.exproStatus;
        const lotStatusColAT = isExpro && d.exproStatus ? d.exproStatus : "";
        const defaultStatus = d.currentStatus || (d as any).status;
        
        const matchDefault = statusFilters.some(filterStr => {
          const normF = normalizeText(filterStr);
          if (normalizeText(defaultStatus) === normF) return true;
          return satisfiesStatusFilter(d, filterStr);
        });
        const matchColAT = lotStatusColAT ? statusFilters.includes(normalizeText(lotStatusColAT)) : false;
        const matchColBS = d.acquiredLots ? statusFilters.some(filterStr => {
          const normF = normalizeText(filterStr);
          const normAcq = normalizeText(d.acquiredLots);
          const isAcq = (normAcq.includes("ACQUIRED") && !normAcq.includes("NOT")) || normAcq === "YES";
          return normF.includes("ACQUIRED") ? isAcq : (normAcq === normF);
        }) : false;
        if (!matchDefault && !matchColAT && !matchColBS) return false;
      }
      if (harmFilters && !harmFilters.includes(normalizeText(d.harmonization))) return false;

      // Date Range Filtering
      let matchDate = true;
      const isCustomRangeActive = datePreset !== 'all';

      if (isCustomRangeActive) {
        const checkRange = (dateObj: Date | null) => {
          if (!dateObj) return false;
          if (start && dateObj < start) return false;
          if (end && dateObj > end) return false;
          return true;
        };

        if (dateRangeMode === 'latest') {
          const dateFields: Array<keyof LotData> = ['dateNot', 'dateOtb', 'dateDoas', 'datePte', 'datePaid', 'dateHo', 'dateCno'];
          let latestDate: Date | null = null;
          dateFields.forEach(f => {
            const val = d[f];
            if (typeof val === 'string' && isValidDateValue(val)) {
              const p = parseDateSafelyGlobal(val);
              if (p && (!latestDate || p > latestDate)) {
                latestDate = p;
              }
            }
          });
          matchDate = checkRange(latestDate);
        } else if (dateRangeMode === 'any') {
          const dateFields: Array<keyof LotData> = ['dateNot', 'dateOtb', 'dateDoas', 'datePte', 'datePaid', 'dateHo', 'dateCno'];
          let anyMatch = false;
          dateFields.forEach(f => {
            const val = d[f];
            if (typeof val === 'string' && isValidDateValue(val)) {
              const p = parseDateSafelyGlobal(val);
              if (p && checkRange(p)) {
                anyMatch = true;
              }
            }
          });
          matchDate = anyMatch;
        } else if (dateRangeMode === 'specific') {
          const val = d[selectedSpecificMilestone as keyof LotData];
          if (typeof val === 'string' && isValidDateValue(val)) {
            const p = parseDateSafelyGlobal(val);
            matchDate = checkRange(p);
          } else {
            matchDate = false;
          }
        }
      }

      if (!matchDate) return false;

      // Start & End Pier Filtering (strictly based on Column AU / pierNakashima)
      let matchPier = true;
      let startVal = NaN;
      if (startPier) {
        const sMatch = startPier.match(/\d+/);
        if (sMatch) startVal = parseInt(sMatch[0], 10);
      }
      let endVal = NaN;
      if (endPier) {
        const eMatch = endPier.match(/\d+/);
        if (eMatch) endVal = parseInt(eMatch[0], 10);
      }

      if (!isNaN(startVal) && !isNaN(endVal) && startVal > endVal) {
        matchPier = false; // invalid range if start is greater than end
      } else if (!isNaN(startVal) || !isNaN(endVal)) {
        const piers = extractPierNumbers(d.pierNakashima);
        if (piers.length === 0) {
          matchPier = false;
        } else {
          const minP = Math.min(...piers);
          const maxP = Math.max(...piers);
          
          if (!isNaN(startVal) && !isNaN(endVal)) {
            matchPier = Math.max(minP, startVal) <= Math.min(maxP, endVal);
          } else if (!isNaN(startVal)) {
            matchPier = maxP >= startVal;
          } else if (!isNaN(endVal)) {
            matchPier = minP <= endVal;
          }
        }
      }

      return matchPier;
    });
  }, [data, search, exactSearch, filters, startDateStr, endDateStr, dateRangeMode, selectedSpecificMilestone, datePreset, startPier, endPier]);

  const resourceLoadData = useMemo(() => {
    if (!filteredData) return [];
    
    let sourceData = filteredData;
    if (selectedStatusCard && selectedStatusCard !== "TOTAL LOTS" && selectedStatusCard !== "LOT ID NO") {
      const pred = getStatusPredicate(selectedStatusCard);
      if (pred) {
        sourceData = filteredData.filter(pred);
      }
    }

    const counts: Record<string, number> = {};
    const comboStats: Record<string, {
      fullyPaid: number;
      partiallyPaid: number;
      pteSigned: number;
      doasSigned: number;
      cnoSigned: number;
      handedOver: number;
      expro: number;
      acquiredLots: number;
      notAffected: number;
      affectedArea: number;
      actualCost: number;
      totalCost: number;
    }> = {};

    sourceData.forEach(item => {
      let val = "";
      if (resourceLoadType === 'lgu') {
        val = item.lgu;
      } else if (resourceLoadType === 'rapLgu') {
        val = item.rapLgu || item.lgu;
      } else if (resourceLoadType === 'cp') {
        val = item.cp || item.rapCp;
      } else if (resourceLoadType === 'rapCp') {
        val = item.rapCp || item.cp;
      } else if (resourceLoadType === 'zone') {
        val = item.zone;
      } else if (resourceLoadType === 'mode') {
        val = item.modeAcquisition;
      } else if (resourceLoadType === 'payment') {
        val = item.paymentStatus;
      } else if (resourceLoadType === 'status') {
        val = item.currentStatus || item.status || "N/A";
      }
      const key = val && val.trim() !== "" ? val.trim() : "N/A";
      counts[key] = (counts[key] || 0) + 1;

      if (!comboStats[key]) {
        comboStats[key] = {
          fullyPaid: 0,
          partiallyPaid: 0,
          pteSigned: 0,
          doasSigned: 0,
          cnoSigned: 0,
          handedOver: 0,
          expro: 0,
          acquiredLots: 0,
          notAffected: 0,
          affectedArea: 0,
          actualCost: 0,
          totalCost: 0
        };
      }

      const payStatus = (item.paymentStatus || "").toUpperCase();
      if (payStatus.includes("FULLY PAID")) comboStats[key].fullyPaid += 1;
      if (payStatus.includes("PARTIALLY PAID") || payStatus.includes("PAID WITH WOP") || payStatus.includes("PARTIAL")) comboStats[key].partiallyPaid += 1;

      // Column N (PTE Status): must contain SIGNED
      const pteSt = (item.statusPte || "").toUpperCase();
      if (pteSt.includes("SIGNED")) comboStats[key].pteSigned += 1;

      // Column BS (Acquired Lots): must contain ACQUIRED and not NOT
      const acqSt = (item.acquiredLots || "").toUpperCase();
      if ((acqSt.includes("ACQUIRED") && !acqSt.includes("NOT")) || acqSt === "YES") {
        comboStats[key].acquiredLots += 1;
      }

      const doasSt = (item.statusDoas || "").toUpperCase();
      if (isValidDateValue(item.dateDoas) || doasSt.includes("SIGNED") || doasSt.includes("EXECUTED")) comboStats[key].doasSigned += 1;

      const cnoMoa = (item.withCnoMoa || "").toUpperCase();
      const currSt = (item.currentStatus || "").toUpperCase();
      if (isValidDateValue(item.dateCno) || cnoMoa.includes("CNO") || currSt.includes("CNO")) comboStats[key].cnoSigned += 1;

      if (isValidDateValue(item.dateHo) || (item.handedOver || "").toUpperCase().includes("HAND") || currSt.includes("HANDED OVER") || currSt.includes("HANDOVER")) comboStats[key].handedOver += 1;

      // Expropriation Cases (Column BF: modeAcquisition / exproStatus)
      const exproCombined = `${normalizeText(item.exproStatus)} ${normalizeText(item.modeAcquisition)}`;
      if (exproCombined.includes("EXPRO") || exproCombined.includes("CASE") || exproCombined.includes("FILED") || exproCombined.includes("PENDING") || exproCombined.includes("COMPLAINT")) {
        comboStats[key].expro += 1;
      }

      // Total Area (SQM) (Column AH)
      comboStats[key].affectedArea += (Number(item.affectedArea) || 0);
      // Actual Cost (Column AO)
      comboStats[key].actualCost += (Number(item.actualCost ?? item.totalActualCost) || 0);
      comboStats[key].totalCost += (Number(item.totalEstimatedCost) || 0);
    });

    return Object.entries(counts)
      .map(([name, count]) => {
        const stats = comboStats[name] || { fullyPaid: 0, partiallyPaid: 0, pteSigned: 0, doasSigned: 0, cnoSigned: 0, handedOver: 0, expro: 0, acquiredLots: 0, notAffected: 0, affectedArea: 0, actualCost: 0, totalCost: 0 };
        const totalCostM = Number((stats.totalCost / 1000000).toFixed(2));
        return {
          name,
          count,
          acquiredLotsCount: stats.acquiredLots,
          fullyPaidCount: stats.fullyPaid,
          partiallyPaidCount: stats.partiallyPaid,
          pteSignedCount: stats.pteSigned,
          doasSignedCount: stats.doasSigned,
          cnoSignedCount: stats.cnoSigned,
          handedOverCount: stats.handedOver,
          exproCount: stats.expro,
          notAffectedCount: 0,
          affectedArea: Math.round(stats.affectedArea),
          actualCost: stats.actualCost,
          actualCostM: Number((stats.actualCost / 1000000).toFixed(2)),
          totalCostM,
          totalCost: stats.totalCost
        };
      })
      .sort((a, b) => {
        const orderA = getItemOrderIndex(resourceLoadType, a.name);
        const orderB = getItemOrderIndex(resourceLoadType, b.name);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return b.count - a.count;
      });
  }, [filteredData, resourceLoadType, selectedStatusCard, normalizeText, isValidDateValue]);

  // Fixed timeline from Sep-25 to Jun-28 (29 columns: 28 months from Sep-25 to Dec-27 + skip to Jun-28)
  const TIMELINE = useMemo(() => {
    const list = [];
    const startDate = new Date(2025, 8, 1); // Sep 2025
    let curr = new Date(startDate);
    
    // 28 months: Sep-25 to Dec-27
    for (let i = 0; i < 28; i++) {
      list.push({
        key: format(curr, "yyyy-MM"),
        name: format(curr, "MMM yy")
      });
      curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
    }
    
    // 29th month: Jun-28
    const jun28 = new Date(2028, 5, 1);
    list.push({
      key: format(jun28, "yyyy-MM"),
      name: format(jun28, "MMM yy")
    });
    
    return list;
  }, []);

  const handleBarOpenModal = React.useCallback((barName: string, categoryType: string) => {
    if (!barName) return;

    let categoryLabel = "Category";
    if (categoryType === 'lgu') categoryLabel = "LGU";
    else if (categoryType === 'cp') categoryLabel = "Contract Package (CP)";
    else if (categoryType === 'zone') categoryLabel = "Zone";
    else if (categoryType === 'mode') categoryLabel = "Acquisition Mode";
    else if (categoryType === 'status') categoryLabel = "Lot Status";
    else if (categoryType === 'payment') categoryLabel = "Payment Status";
    else if (categoryType === 'optimizationCases' || categoryType === 'harmonization') categoryLabel = "Optimization Cases";
    else if (categoryType === 'prowImpact') categoryLabel = "PROW Impact";
    else if (categoryType === 'scNonWorkable') categoryLabel = `SC Non-Workable (${barName})`;
    else if (categoryType === 'cumulative') categoryLabel = `Cumulative Progress (${barName})`;

    const targetData = filteredData || data || [];
    const matched = targetData.filter(item => {
      let val = "";
      if (categoryType === 'lgu') val = item.lgu;
      else if (categoryType === 'cp') val = item.cp;
      else if (categoryType === 'zone') val = item.zone;
      else if (categoryType === 'mode') val = item.modeAcquisition;
      else if (categoryType === 'payment') val = item.paymentStatus;
      else if (categoryType === 'status') val = item.currentStatus || item.status;
      else if (categoryType === 'optimizationCases' || categoryType === 'harmonization') val = item.optimizationCases || item.harmonization || item.controlNo;
      else if (categoryType === 'prowImpact') val = item.prowImpact;
      else if (categoryType === 'scNonWorkable') {
        if (!item.siteAccessDate) return false;
        const dObj = parseDateSafely(item.siteAccessDate);
        if (!dObj) return false;
        const key = format(startOfMonth(dObj), "yyyy-MM");
        const timelineItem = TIMELINE.find(t => t.name.trim().toUpperCase() === barName.trim().toUpperCase() || t.key === barName.trim());
        const targetKey = timelineItem ? timelineItem.key : barName;
        return key === targetKey;
      }
      else if (categoryType === 'cumulative') {
        if (!item.siteAccessDate) return false;
        const dObj = parseDateSafely(item.siteAccessDate);
        if (!dObj) return false;
        const key = format(startOfMonth(dObj), "yyyy-MM");
        const timelineItem = TIMELINE.find(t => t.name.trim().toUpperCase() === barName.trim().toUpperCase() || t.key === barName.trim());
        const targetKey = timelineItem ? timelineItem.key : barName;
        return key <= targetKey;
      }

      if (!val || val.trim() === "") val = "N/A";
      return val.trim().toUpperCase() === barName.trim().toUpperCase();
    });

    setSelectedBarModal({
      isOpen: true,
      categoryType,
      categoryLabel,
      barName,
      lots: matched
    });
    setBarModalComboFilter(resourceLoadComboMetric !== 'none' ? 'combo' : 'all');
    setBarModalSearch("");
    setBarModalPage(1);
  }, [filteredData, data, TIMELINE, parseDateSafely, resourceLoadComboMetric]);

  const handleChartColumnClick = React.useCallback((state: any, categoryType: string, chartData: any[]) => {
    if (!state) return;
    if (state.activeLabel !== undefined && state.activeLabel !== null && String(state.activeLabel).trim() !== "") {
      handleBarOpenModal(String(state.activeLabel), categoryType);
      return;
    }
    if (state.activePayload && state.activePayload.length) {
      const name = state.activePayload[0]?.payload?.name || state.activePayload[0]?.name;
      if (name) {
        handleBarOpenModal(String(name), categoryType);
        return;
      }
    }
    if (typeof state.activeTooltipIndex === 'number' && chartData && chartData[state.activeTooltipIndex]) {
      const item = chartData[state.activeTooltipIndex];
      const name = item?.name || item?.label;
      if (name) {
        handleBarOpenModal(String(name), categoryType);
        return;
      }
    }
  }, [handleBarOpenModal]);

  const lastBarClickRef = useRef<{ name: string; time: number }>({ name: "", time: 0 });

  const onBarClickOrDoubleClick = React.useCallback((barName: string, categoryType: string, e?: any) => {
    const now = Date.now();
    const isDetailTwo = e?.detail === 2 || e?.nativeEvent?.detail === 2;
    const isQuickSecondClick = lastBarClickRef.current.name === barName && (now - lastBarClickRef.current.time < 500);

    if (isDetailTwo || isQuickSecondClick) {
      handleBarOpenModal(barName, categoryType);
      lastBarClickRef.current = { name: "", time: 0 };
    } else {
      lastBarClickRef.current = { name: barName, time: now };
    }
  }, [handleBarOpenModal]);

  const activeModalColumns = useMemo(() => {
    if (!selectedBarModal) return [];
    const { categoryType, barName } = selectedBarModal;

    const baseColumns = [
      { id: 'lotId', label: 'LOT ID NO', minWidth: 'min-w-[120px]', resolver: (d: LotData) => d.lotId || d.id || '-' },
      { id: 'cp', label: 'CP', minWidth: 'min-w-[110px]', resolver: (d: LotData) => d.cp || '-' },
      { id: 'registeredOwner', label: 'REGISTERED OWNER', minWidth: 'min-w-[240px]', resolver: (d: LotData) => d.ownerName || '-' },
      { id: 'modeAcquisition', label: 'MODE OF ACQUISITION', minWidth: 'min-w-[160px]', resolver: (d: LotData) => d.modeAcquisition || '-' },
      { id: 'lgu', label: 'LGU', minWidth: 'min-w-[140px]', resolver: (d: LotData) => d.lgu || '-' },
      { 
        id: 'status', 
        label: 'CURRENT STATUS', 
        minWidth: 'min-w-[200px]', 
        resolver: (d: LotData) => {
          const isExpro = (d.modeAcquisition && normalizeText(d.modeAcquisition).includes("EXPRO")) || !!d.exproStatus;
          if (isExpro && d.exproStatus) {
            return `${d.exproStatus} (Col AT)`;
          }
          if (d.acquiredLots) {
            return `${d.currentStatus || (d as any).status || '-'} [Acquired: ${d.acquiredLots}]`;
          }
          return d.currentStatus || (d as any).status || '-';
        } 
      },
      { id: 'optimizationCases', label: 'OPTIMIZATION CASES', minWidth: 'min-w-[180px]', resolver: (d: LotData) => d.optimizationCases || d.harmonization || '-' },
      { id: 'prowImpact', label: 'PROW IMPACT', minWidth: 'min-w-[170px]', resolver: (d: LotData) => d.prowImpact || '-' }
    ];

    if ((categoryType === 'mode' && normalizeText(barName).includes("EXPRO")) || (filters?.modeAcquisition || []).some(m => normalizeText(m).includes("EXPRO"))) {
      baseColumns.splice(6, 0, {
        id: 'exproStatusColAT',
        label: 'EXPRO STATUS (COL AT)',
        minWidth: 'min-w-[220px]',
        resolver: (d: LotData) => d.exproStatus || '-'
      });
    }

    if (categoryType === 'status' || (filters?.currentStatus || []).length > 0 || normalizeText(barName).includes("ACQUIRED") || (filters?.currentStatus || []).some(m => normalizeText(m).includes("ACQUIRED"))) {
      baseColumns.splice(6, 0, {
        id: 'acquiredLotsColBS',
        label: 'Acquired lots (Col BS)',
        minWidth: 'min-w-[200px]',
        resolver: (d: LotData) => d.acquiredLots || '-'
      });
    }

    // Rule: if ang naka filter ay lgu, wag na isama sa header same sa iba
    return baseColumns.filter(col => {
      if (categoryType === 'lgu' && col.id === 'lgu') return false;
      if (categoryType === 'cp' && col.id === 'cp') return false;
      if (categoryType === 'mode' && col.id === 'modeAcquisition') return false;
      if ((categoryType === 'optimizationCases' || categoryType === 'harmonization' || categoryType === 'controlNo') && col.id === 'optimizationCases') return false;
      if (categoryType === 'prowImpact' && col.id === 'prowImpact') return false;
      if (categoryType === 'registeredOwner' && col.id === 'registeredOwner') return false;
      return true;
    });
  }, [selectedBarModal, filters.modeAcquisition, filters.currentStatus]);

  const modalMatchedLots = useMemo(() => {
    if (!selectedBarModal) return [];
    const { categoryType, barName } = selectedBarModal;
    let targetData = filteredData || data || [];

    if (selectedStatusCard && selectedStatusCard !== "TOTAL LOTS" && selectedStatusCard !== "LOT ID NO") {
      const pred = getStatusPredicate(selectedStatusCard);
      if (pred) {
        targetData = targetData.filter(pred);
      }
    }

    return targetData.filter(item => {
      let val = "";
      if (categoryType === 'lgu') val = item.lgu;
      else if (categoryType === 'cp') val = item.cp;
      else if (categoryType === 'zone') val = item.zone;
      else if (categoryType === 'mode') val = item.modeAcquisition;
      else if (categoryType === 'payment') val = item.paymentStatus;
      else if (categoryType === 'status') val = item.currentStatus || item.status;
      else if (categoryType === 'optimizationCases' || categoryType === 'harmonization') val = item.optimizationCases || item.harmonization || item.controlNo;
      else if (categoryType === 'prowImpact') val = item.prowImpact;
      else if (categoryType === 'scNonWorkable') {
        if (!item.siteAccessDate) return false;
        const dObj = parseDateSafely(item.siteAccessDate);
        if (!dObj) return false;
        const key = format(startOfMonth(dObj), "yyyy-MM");
        const timelineItem = TIMELINE.find(t => t.name.trim().toUpperCase() === barName.trim().toUpperCase() || t.key === barName.trim());
        const targetKey = timelineItem ? timelineItem.key : barName;
        return key === targetKey;
      }
      else if (categoryType === 'cumulative') {
        if (!item.siteAccessDate) return false;
        const dObj = parseDateSafely(item.siteAccessDate);
        if (!dObj) return false;
        const key = format(startOfMonth(dObj), "yyyy-MM");
        const timelineItem = TIMELINE.find(t => t.name.trim().toUpperCase() === barName.trim().toUpperCase() || t.key === barName.trim());
        const targetKey = timelineItem ? timelineItem.key : barName;
        return key <= targetKey;
      }

      if (!val || val.trim() === "") val = "N/A";
      return val.trim().toUpperCase() === barName.trim().toUpperCase();
    });
  }, [selectedBarModal, filteredData, data, selectedStatusCard, TIMELINE, parseDateSafely]);

  const modalComboMatchedLots = useMemo(() => {
    if (!modalMatchedLots || modalMatchedLots.length === 0) return [];
    if (!resourceLoadComboMetrics || resourceLoadComboMetrics.length === 0) return modalMatchedLots;

    return modalMatchedLots.filter(item => {
      return resourceLoadComboMetrics.some(metricKey => {
        if (metricKey === 'acquiredLotsCount') {
          const acq = (item.acquiredLots || "").toUpperCase();
          return (acq.includes("ACQUIRED") && !acq.includes("NOT")) || acq === "YES";
        }
        if (metricKey === 'exproCount') {
          const exproCombined = ((item.exproStatus || "") + " " + (item.modeAcquisition || "")).toUpperCase();
          return exproCombined.includes("EXPRO") || exproCombined.includes("CASE") || exproCombined.includes("FILED") || exproCombined.includes("PENDING") || exproCombined.includes("COMPLAINT");
        }
        if (metricKey === 'fullyPaidCount') {
          return (item.paymentStatus || "").toUpperCase().includes("FULLY PAID");
        }
        if (metricKey === 'partiallyPaidCount') {
          const payStatus = (item.paymentStatus || "").toUpperCase();
          return payStatus.includes("PARTIALLY PAID") || payStatus.includes("PAID WITH WOP") || payStatus.includes("PARTIAL");
        }
        if (metricKey === 'pteSignedCount') {
          const st = (item.statusPte || "").toUpperCase();
          return st.includes("SIGNED");
        }
        if (metricKey === 'doasSignedCount') {
          const st = (item.statusDoas || "").toUpperCase();
          return isValidDateValue(item.dateDoas) || st.includes("SIGNED") || st.includes("EXECUTED");
        }
        if (metricKey === 'cnoSignedCount') {
          const cnoMoa = (item.withCnoMoa || "").toUpperCase();
          const currSt = (item.currentStatus || "").toUpperCase();
          return isValidDateValue(item.dateCno) || cnoMoa.includes("CNO") || currSt.includes("CNO");
        }
        if (metricKey === 'handedOverCount') {
          const currSt = (item.currentStatus || "").toUpperCase();
          return isValidDateValue(item.dateHo) || (item.handedOver || "").toUpperCase().includes("HAND") || currSt.includes("HANDED OVER") || currSt.includes("HANDOVER");
        }
        if (metricKey === 'affectedArea') {
          return (Number(item.affectedArea) || 0) > 0;
        }
        if (metricKey === 'actualCost') {
          return (Number(item.actualCost ?? item.totalActualCost) || 0) > 0;
        }
        if (metricKey === 'totalCost') {
          return (Number(item.totalEstimatedCost) || 0) > 0;
        }
        return false;
      });
    });
  }, [modalMatchedLots, resourceLoadComboMetrics]);

  const finalModalMatchedLots = useMemo(() => {
    if (resourceLoadComboMetrics.length > 0 && barModalComboFilter === 'combo') {
      return modalComboMatchedLots;
    }
    return modalMatchedLots;
  }, [modalMatchedLots, modalComboMatchedLots, resourceLoadComboMetrics, barModalComboFilter]);

  const modalFilteredLots = useMemo(() => {
    if (!selectedBarModal) return [];
    if (!barModalSearch.trim()) return finalModalMatchedLots;

    const term = barModalSearch.toLowerCase().trim();
    return finalModalMatchedLots.filter(lot => {
      const lotId = (lot.lotId || lot.id || "").toLowerCase();
      const owner = (lot.ownerName || "").toLowerCase();
      const cp = (lot.cp || "").toLowerCase();
      const lgu = (lot.lgu || "").toLowerCase();
      const opt = (lot.optimizationCases || lot.harmonization || lot.controlNo || "").toLowerCase();
      const prow = (lot.prowImpact || "").toLowerCase();

      return lotId.includes(term) ||
             owner.includes(term) ||
             cp.includes(term) ||
             lgu.includes(term) ||
             opt.includes(term) ||
             prow.includes(term);
    });
  }, [selectedBarModal, finalModalMatchedLots, barModalSearch]);

  const totalModalPages = Math.ceil(modalFilteredLots.length / BAR_MODAL_PAGE_SIZE) || 1;
  const paginatedModalLots = useMemo(() => {
    const start = (barModalPage - 1) * BAR_MODAL_PAGE_SIZE;
    return modalFilteredLots.slice(start, start + BAR_MODAL_PAGE_SIZE);
  }, [modalFilteredLots, barModalPage]);

  const handleExportModalCSV = () => {
    if (!selectedBarModal || modalFilteredLots.length === 0) return;
    const headers = activeModalColumns.map(c => c.label).join(",");
    const rows = modalFilteredLots.map(lot => {
      return activeModalColumns.map(c => {
        const val = (c.resolver(lot) || "").replace(/"/g, '""');
        return `"${val}"`;
      }).join(",");
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Lots_List_${selectedBarModal.categoryLabel}_${selectedBarModal.barName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resourceLoadInsights = useMemo(() => {
    if (!resourceLoadData || resourceLoadData.length === 0) return null;
    const totalCount = resourceLoadData.reduce((sum, item) => sum + item.count, 0);

    // Find the item with the actual highest lot count
    const sortedByCount = [...resourceLoadData].sort((a, b) => b.count - a.count);
    const topItem = sortedByCount[0] || resourceLoadData[0];
    const topPct = totalCount > 0 ? ((topItem.count / totalCount) * 100).toFixed(1) : "0.0";
    
    // Top 3 percentage
    const top3Count = sortedByCount.slice(0, 3).reduce((sum, item) => sum + item.count, 0);
    const top3Pct = totalCount > 0 ? ((top3Count / totalCount) * 100).toFixed(1) : "0.0";
    
    let typeLabel = "entities";
    let typeSingular = "entity";
    let insightDesc = "";

    const projSuffix = selectedStatusCard && selectedStatusCard !== "TOTAL LOTS" && selectedStatusCard !== "LOT ID NO"
      ? ` for status "${selectedStatusCard}"`
      : "";

    if (resourceLoadType === 'lgu') {
      typeLabel = "Local Government Units (LGUs)";
      typeSingular = "LGU";
      insightDesc = `The primary workload${projSuffix} is heavily concentrated in ${topItem.name}, requiring intensive field team deployment. The top 3 LGUs represent ${top3Pct}% of the active alignment.`;
    } else if (resourceLoadType === 'rapLgu') {
      typeLabel = "RAP Local Government Units (RAP LGUs)";
      typeSingular = "RAP LGU";
      insightDesc = `The primary RAP workload${projSuffix} (Column BR) is heavily concentrated in ${topItem.name}, requiring focused resettlement coordination. The top 3 RAP LGUs represent ${top3Pct}% of the active alignment.`;
    } else if (resourceLoadType === 'cp') {
      typeLabel = "Contract Packages (CPs)";
      typeSingular = "CP";
      insightDesc = `Contract Package ${topItem.name} leads with the highest workload${projSuffix}. Aligning construction schedules with these packages will expedite right-of-way handovers.`;
    } else if (resourceLoadType === 'rapCp') {
      typeLabel = "RAP Contract Packages (RAP CPs)";
      typeSingular = "RAP CP";
      insightDesc = `RAP Contract Package ${topItem.name} (Column BQ) leads with the highest workload${projSuffix}. Aligning construction schedules with these packages will expedite right-of-way handovers.`;
    } else if (resourceLoadType === 'zone') {
      typeLabel = "Zones";
      typeSingular = "Zone";
      insightDesc = `Zone sector ${topItem.name} contains the largest count of properties${projSuffix}. Channeling localized coordination efforts here will unlock the highest volume of site clearability.`;
    } else if (resourceLoadType === 'mode') {
      typeLabel = "Acquisition Modes";
      typeSingular = "Mode";
      insightDesc = `The principal acquisition pathway${projSuffix} is ${topItem.name}, containing ${topPct}% of lots. Directing processing priority to this mode avoids systemic pipeline blocks.`;
    } else if (resourceLoadType === 'payment') {
      typeLabel = "Payment Statuses";
      typeSingular = "Status";
      insightDesc = `The primary financial processing status${projSuffix} is "${topItem.name}", representing ${topItem.count} lots (${topPct}%). Standardizing audit checkpoints will accelerate payment disbursements.`;
    } else if (resourceLoadType === 'status') {
      typeLabel = "Lot Statuses";
      typeSingular = "Status";
      insightDesc = `The highest lot volume is at status "${topItem.name}", representing ${topItem.count} lots (${topPct}% of selected scope).`;
    }

    return {
      totalCount,
      topItemName: topItem.name,
      topItemCount: topItem.count,
      topPct,
      top3Pct,
      typeLabel,
      typeSingular,
      insightDesc
    };
  }, [resourceLoadData, resourceLoadType, selectedStatusCard]);

  const parsedCurrentWeekRange = useMemo(() => {
    const now = addWeeks(new Date(), weekOffset); // Base date: real current date
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    const friday = new Date(start);
    friday.setDate(start.getDate() + 4);
    return {
      start,
      end,
      formatted: `${format(start, "MMM dd")} - ${format(friday, "MMM dd, yyyy")}`
    };
  }, [weekOffset]);

  const currentWeekUpdates = useMemo(() => {
    const now = addWeeks(new Date(), weekOffset); // Base date: real current date
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });

    const filteredLotIds = new Set(filteredData.map(d => (d.lotId || "").trim().toLowerCase()));

    const parseDateSafelyLocal = (dateStr: string) => {
      if (!dateStr || String(dateStr).toLowerCase().includes("no data")) return null;
      try {
        const trimmed = dateStr.trim();
        const hasMonthLetters = /[a-zA-Z]/.test(trimmed);
        if (hasMonthLetters) {
          const cleaned = trimmed.replace(/-/g, " ");
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        } else {
          const cleaned = trimmed.replace(/-/g, "/");
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        }
        const fallback = new Date(trimmed);
        if (!isNaN(fallback.getTime())) return fallback;
        return null;
      } catch {
        return null;
      }
    };

    return (weeklyData || []).filter(item => {
      // Filter by lot ID presence in filtered dataset first
      const normalizedLotId = (item.lotId || "").trim().toLowerCase();
      if (!filteredLotIds.has(normalizedLotId)) return false;

      const d = parseDateSafelyLocal(item.dateEntry || item.dateAccomplishment);
      if (!d) return false;
      return isWithinInterval(d, { start, end });
    });
  }, [weeklyData, weekOffset, filteredData]);

  const currentWeekCategoryCounts = useMemo(() => {
    const counts = Array(15).fill(0);
    currentWeekUpdates.forEach(update => {
      const acc = (update.accomplishment || "").toLowerCase().trim();
      const tag = (update.tag || "").toLowerCase().trim();
      
      let index: number | null = null;
      if (acc.includes("handed over") || acc === "ho" || tag.includes("handed over") || tag === "ho") index = 11;
      else if (/\b(ejseas)\b/i.test(acc) || /\b(ejseas)\b/i.test(tag)) index = 7;
      else if (/\b(doas|signed\s+doas|doas\s+signed)\b/i.test(acc) || /\b(doas)\b/i.test(tag)) index = 6;
      else if (/\b(pte)\b/i.test(acc) || /\b(pte)\b/i.test(tag)) index = 8;
      else if (/\b(partially\s+paid|partial\s+paid|partially|partial)\b/i.test(acc) || /\b(partial)\b/i.test(tag)) index = 9;
      else if (/\b(fully\s+paid|fully|paid)\b/i.test(acc) || /\b(paid)\b/i.test(tag)) index = 10;
      else if (/\b(not\s+issued|issued\s+not|not\s+delivered|notice\s+of\s+taking|not)\b/i.test(acc) || /\b(not|notice)\b/i.test(tag)) index = 0;
      else if (/\b(accepted?|collection)\b/i.test(acc) || /\b(accepted?|collection)\b/i.test(tag)) index = 2;
      else if (/\b(30\s+days?\s+review|review)\b/i.test(acc) || /\b(review)\b/i.test(tag)) index = 3;
      else if (/\b(incurable)\b/i.test(acc) || /\b(incurable)\b/i.test(tag)) index = 4;
      else if (/\b(rejected?|reject)\b/i.test(acc) || /\b(rejected?|reject)\b/i.test(tag)) index = 5;
      else if (
        /\b(issued\s+(rfd|otb|otc|offer)|(rfd|otb|otc|offer)\s+issued|offert?\s+to\s+buy|compensation|rfd|otb|otc)\b/i.test(acc) ||
        /\b(otb|otc|rfd|offer)\b/i.test(tag)
      ) index = 1;
      else if (/\b(cno)\b/i.test(acc) || /\b(cno)\b/i.test(tag)) index = 12;
      else if (/\b(moa)\b/i.test(acc) || /\b(moa)\b/i.test(tag)) index = 13;
      else if (/\b(crops|trees?)\b/i.test(acc) || /\b(crops|trees?)\b/i.test(tag)) index = 14;

      if (index !== null) {
        counts[index]++;
      }
    });
    return counts;
  }, [currentWeekUpdates]);

  const currentWeekMonthlyUpdates = useMemo(() => {
    const counts: Record<string, number> = {};
    currentWeekUpdates.forEach(update => {
      const lot = data.find(l => (l.lotId || "").trim().toLowerCase() === (update.lotId || "").trim().toLowerCase());
      if (lot && lot.siteAccessDate) {
        const dObj = parseDateSafely(lot.siteAccessDate);
        if (dObj) {
          const key = format(startOfMonth(dObj), "yyyy-MM");
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    });
    return counts;
  }, [currentWeekUpdates, data]);

  const siteAccessWeeklyUpdatesDetail = useMemo(() => {
    const counts: Record<string, { paid: number; pte: number; cno: number; total: number; acquired: number }> = {};
    
    currentWeekUpdates.forEach(update => {
      const lot = data.find(l => (l.lotId || "").trim().toLowerCase() === (update.lotId || "").trim().toLowerCase());
      if (lot && lot.siteAccessDate) {
        const dObj = parseDateSafely(lot.siteAccessDate);
        if (dObj) {
          const key = format(startOfMonth(dObj), "yyyy-MM");
          if (!counts[key]) {
            counts[key] = { paid: 0, pte: 0, cno: 0, total: 0, acquired: 0 };
          }
          
          const acc = (update.accomplishment || "").toLowerCase().trim();
          const tag = (update.tag || "").toLowerCase().trim();
          
          const isPaid = /\b(fully\s+paid|fully|paid|partially\s+paid|partial\s+paid|partially|partial)\b/i.test(acc) || /\b(paid|partial)\b/i.test(tag);
          const isPte = /\b(pte)\b/i.test(acc) || /\b(pte)\b/i.test(tag);
          const isCno = /\b(cno)\b/i.test(acc) || /\b(cno)\b/i.test(tag);
          
          if (isPaid) {
            counts[key].paid++;
          } else if (isPte) {
            counts[key].pte++;
          } else if (isCno) {
            counts[key].cno++;
          } else {
            counts[key].total++;
          }
        }
      }
    });
    
    Object.keys(counts).forEach(key => {
      counts[key].acquired = counts[key].paid + counts[key].pte + counts[key].cno;
    });
    
    return counts;
  }, [currentWeekUpdates, data]);

  const totalLAWeeklyUpdates = useMemo(() => {
    return currentWeekCategoryCounts.reduce((sum: number, val: number) => sum + val, 0);
  }, [currentWeekCategoryCounts]);

  const totalSCWeeklyUpdates = useMemo(() => {
    return Object.values(currentWeekMonthlyUpdates).reduce((sum: number, val: number) => sum + val, 0);
  }, [currentWeekMonthlyUpdates]);

  const latestDataUpdateStr = useMemo(() => {
    const now = new Date();
    let maxDate = new Date(2026, 0, 1); // Baseline Default January 1, 2026
    
    const parseDateLocal = (dateStr: string) => {
      if (!dateStr || String(dateStr).toLowerCase().includes("no data")) return null;
      try {
        const trimmed = dateStr.trim();
        const hasMonthLetters = /[a-zA-Z]/.test(trimmed);
        if (hasMonthLetters) {
          const cleaned = trimmed.replace(/-/g, " ");
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        } else {
          const cleaned = trimmed.replace(/-/g, "/");
          const d = new Date(cleaned);
          if (!isNaN(d.getTime())) return d;
        }
        const fallback = new Date(trimmed);
        if (!isNaN(fallback.getTime())) return fallback;
        return null;
      } catch {
        return null;
      }
    };

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach(item => {
        const dateStr = item.dateEntry || item.dateAccomplishment;
        if (!dateStr) return;
        const d = parseDateLocal(String(dateStr));
        if (d && !isNaN(d.getTime())) {
          if (d <= now && d > maxDate) {
            maxDate = d;
          }
        }
      });
    }

    return format(maxDate, "MMMM dd, yyyy");
  }, [weeklyData]);

  const [hoveredCell, setHoveredCell] = useState<{
    x: number;
    y: number;
    monthName: string;
    monthKey: string;
    type: 'total' | 'paid' | 'unpaid' | 'percent' | 'row-total' | 'row-paid' | 'row-unpaid' | 'row-percent' | 'column';
  } | null>(null);
  const [hoveredStatCard, setHoveredStatCard] = useState<{
    x: number;
    yTop: number;
    yBottom: number;
    rectLeft: number;
    rectRight: number;
    label: string;
    value: string | number;
    color: string;
    hoveredRectLeft?: number;
    hoveredRectRight?: number;
    hoveredRectTop?: number;
    hoveredRectBottom?: number;
  } | null>(null);

  const statCardCloseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const hoveredCellCloseTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const cellPositionStyle = useMemo(() => {
    if (!hoveredCell) return { left: 0, top: 0, transform: "translate(-50%, -100%)" };
    const tooltipHeight = 280;
    const tooltipWidth = 320;
    const margin = 16;
    let left = hoveredCell.x;
    let translateX = "-50%";
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth;
      const leftRatio = hoveredCell.x / screenWidth;
      
      if (leftRatio < 0.35) {
        // Left side -> shift tooltip to the right
        translateX = "-15%";
      } else if (leftRatio > 0.65) {
        // Right side -> shift tooltip to the left
        translateX = "-85%";
      } else {
        // Center-aligned
        translateX = "-50%";
      }
      
      const maxLeft = screenWidth - (tooltipWidth / 2) - margin;
      const minLeft = (tooltipWidth / 2) + margin;
      left = Math.max(minLeft, Math.min(hoveredCell.x, maxLeft));
    }
    const renderBelow = hoveredCell.y < tooltipHeight + margin;
    const top = renderBelow ? hoveredCell.y + 16 : hoveredCell.y - 12;
    const transform = renderBelow ? `translate(${translateX}, 0)` : `translate(${translateX}, -100%)`;
    return {
      left,
      top,
      transform
    };
  }, [hoveredCell]);

  const isLeftSideOfScreen = useMemo(() => {
    if (!hoveredStatCard) return true;
    return typeof window !== 'undefined' ? hoveredStatCard.x < window.innerWidth / 2 : true;
  }, [hoveredStatCard]);

  const statCardPositionStyle = useMemo(() => {
    if (!hoveredStatCard) return { left: 0, top: 0, transform: "translate(-50%, -100%)" };
    const tooltipHeight = 360; // approximate height of content
    const tooltipWidth = 320;
    const margin = 16;
    
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      // On mobile/narrow screens, render in the center of the viewport as a floating modal popover to prevent clipping
      return {
        left: window.innerWidth / 2,
        top: window.innerHeight / 2,
        transform: "translate(-50%, -50%)"
      };
    }

    // Position vertically at the center of the card
    let top = hoveredStatCard.yTop + (hoveredStatCard.yBottom - hoveredStatCard.yTop) / 2;
    if (typeof window !== 'undefined') {
      const minTop = (tooltipHeight / 2) + margin;
      const maxTop = window.innerHeight - (tooltipHeight / 2) - margin;
      top = Math.max(minTop, Math.min(top, maxTop));
    }
    
    if (isLeftSideOfScreen) {
      // Show on the right side of the card (pointing right)
      return {
        left: hoveredStatCard.rectRight + 12,
        top,
        transform: "translate(0, -50%)"
      };
    } else {
      // Show on the left side of the card (pointing left)
      return {
        left: hoveredStatCard.rectLeft - 12,
        top,
        transform: "translate(-100%, -50%)"
      };
    }
  }, [hoveredStatCard, isLeftSideOfScreen]);

  const connectorLine = useMemo(() => {
    if (!hoveredStatCard || hoveredStatCard.hoveredRectLeft === undefined) return null;
    if (typeof window !== 'undefined' && window.innerWidth < 768) return null;

    const tooltipHeight = 360;
    const margin = 16;
    let tooltipTop = hoveredStatCard.yTop + (hoveredStatCard.yBottom - hoveredStatCard.yTop) / 2;
    if (typeof window !== 'undefined') {
      const minTop = (tooltipHeight / 2) + margin;
      const maxTop = window.innerHeight - (tooltipHeight / 2) - margin;
      tooltipTop = Math.max(minTop, Math.min(tooltipTop, maxTop));
    }

    let startX = 0;
    let startY = tooltipTop;
    let endX = 0;
    let endY = (hoveredStatCard.hoveredRectTop ?? 0) + ((hoveredStatCard.hoveredRectBottom ?? 0) - (hoveredStatCard.hoveredRectTop ?? 0)) / 2;

    if (isLeftSideOfScreen) {
      startX = hoveredStatCard.rectRight + 12;
      endX = hoveredStatCard.hoveredRectRight ?? 0;
    } else {
      startX = hoveredStatCard.rectLeft - 12;
      endX = hoveredStatCard.hoveredRectLeft ?? 0;
    }

    return {
      startX,
      startY,
      endX,
      endY,
      isLeftSideOfScreen,
    };
  }, [hoveredStatCard, isLeftSideOfScreen]);

  const [activeSeries, setActiveSeries] = useState({
    total: true,
    paid: true,
    pte: true,
    cno: true,
    acquired: true,
  });
  const [cumulativeChartStyle, setCumulativeChartStyle] = useState<"standard" | "spectacular">("standard");
  const [laChartStyle, setLaChartStyle] = useState<"classic" | "spectacular" | "velocity">("classic");
  const [exproChartStyle, setExproChartStyle] = useState<"classic" | "spectacular">("classic");

  const [isLaHovered, setIsLaHovered] = useState(false);
  const [isExproHovered, setIsExproHovered] = useState(false);
  const [teamPhoto, setTeamPhoto] = useState<string>(() => {
    try {
      return localStorage.getItem("scla_team_photo") || localStorage.getItem("gcr_global_team_photo") || "";
    } catch {
      return "";
    }
  });

  const [dev1, setDev1] = useState(() => {
    try {
      return {
        name: localStorage.getItem("gcr_dev1_name") || "Daniel B. Antoque",
        role: localStorage.getItem("gcr_dev1_role") || "Main Developer",
        badge: localStorage.getItem("gcr_dev1_badge") || "Lead",
        picture: localStorage.getItem("gcr_dev1_pic") || "",
        bio: localStorage.getItem("gcr_dev1_bio") || "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."
      };
    } catch {
      return {
        name: "Daniel B. Antoque",
        role: "Main Developer",
        badge: "Lead",
        picture: "",
        bio: "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."
      };
    }
  });

  const [dev2, setDev2] = useState(() => {
    try {
      return {
        name: localStorage.getItem("gcr_dev2_name") || "Christian Jay Pablo",
        role: localStorage.getItem("gcr_dev2_role") || "Support Developer",
        badge: localStorage.getItem("gcr_dev2_badge") || "Partner",
        picture: localStorage.getItem("gcr_dev2_pic") || "",
        bio: localStorage.getItem("gcr_dev2_bio") || "GCR Land Acquisition Support Developer & Senior Quality Control Partner."
      };
    } catch {
      return {
        name: "Christian Jay Pablo",
        role: "Support Developer",
        badge: "Partner",
        picture: "",
        bio: "GCR Land Acquisition Support Developer & Senior Quality Control Partner."
      };
    }
  });

  React.useEffect(() => {
    const handleDevsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { dev1: d1, dev2: d2 } = customEvent.detail;
      if (d1) {
        setDev1({
          name: d1.name || "Daniel B. Antoque",
          role: d1.role || "Main Developer",
          badge: d1.badge || "Lead",
          picture: d1.picture || "",
          bio: d1.bio || "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."
        });
      }
      if (d2) {
        setDev2({
          name: d2.name || "Christian Jay Pablo",
          role: d2.role || "Support Developer",
          badge: d2.badge || "Partner",
          picture: d2.picture || "",
          bio: d2.bio || "GCR Land Acquisition Support Developer & Senior Quality Control Partner."
        });
      }
    };

    const handleGlobalBackgroundUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const val = customEvent.detail.globalBackground;
      setTeamPhoto(val || "");
      try {
        if (val) {
          localStorage.setItem("scla_team_photo", val);
          localStorage.setItem("gcr_global_team_photo", val);
        } else {
          localStorage.removeItem("scla_team_photo");
          localStorage.removeItem("gcr_global_team_photo");
        }
      } catch (err) {}
    };

    window.addEventListener("scla_devs_updated", handleDevsUpdated);
    window.addEventListener("scla_global_background_updated", handleGlobalBackgroundUpdated);

    return () => {
      window.removeEventListener("scla_devs_updated", handleDevsUpdated);
      window.removeEventListener("scla_global_background_updated", handleGlobalBackgroundUpdated);
    };
  }, []);

  const getWeekRange = React.useCallback((date: Date) => {
    const day = date.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  }, []);

  const getPreviousWeekRange = React.useCallback((mondayOfCurrentWeek: Date) => {
    const prevMonday = new Date(mondayOfCurrentWeek);
    prevMonday.setDate(mondayOfCurrentWeek.getDate() - 7);
    prevMonday.setHours(0, 0, 0, 0);

    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);
    prevSunday.setHours(23, 59, 59, 999);

    return { monday: prevMonday, sunday: prevSunday };
  }, []);

  // Helper to check if an accomplishment matches a label/card
  const isAccomplishmentMatch = React.useCallback((label: string, acc: string) => {
    const normLabel = label.toLowerCase();
    const normAcc = acc.toLowerCase();
    
    if (normLabel.includes("total lots") || normLabel.includes("lot id")) {
      return true; // Match everything for overall card
    }
    if (normLabel.includes("not issued")) {
      return normAcc.includes("not issued") || normAcc.includes("not_issued") || normAcc === "not issued" || normAcc.includes("not issued");
    }

    // Identical data matching for Issued, 30 days Review, and Incurable fields as requested by the user
    const isOtbGroupMatch = (accStr: string) => {
      const na = accStr.toLowerCase();
      return (
        na.includes("issued") || 
        na.includes("rfd/otb/otc") || 
        na.includes("rfd") || 
        na.includes("otb") || 
        na.includes("otc") ||
        na.includes("review") ||
        na.includes("incurable") ||
        na.includes("30 days") ||
        na.includes("30days")
      ) && !na.includes("accepted") && !na.includes("not") && !na.includes("pte") && !na.includes("rejected");
    };

    if (
      (normLabel.includes("issued") && !normLabel.includes("accepted") && !normLabel.includes("not")) ||
      normLabel.includes("30 days") || 
      normLabel.includes("review") || 
      normLabel.includes("incurable")
    ) {
      return isOtbGroupMatch(normAcc);
    }

    if (normLabel.includes("accepted")) {
      return normAcc.includes("accepted") || normAcc.includes("accept");
    }
    if (normLabel.includes("rejected")) {
      return normAcc.includes("rejected") || normAcc.includes("reject");
    }
    if (normLabel.includes("doas")) {
      return normAcc.includes("doas") || normAcc.includes("signed doas");
    }
    if (normLabel.includes("ejseas")) {
      return normAcc.includes("ejseas") || normAcc.includes("signed ejseas");
    }
    if (normLabel.includes("pte")) {
      return (normAcc.includes("pte") || normAcc.includes("pte signed") || normAcc.includes("signed pte")) && !normAcc.includes("accepted");
    }
    if (normLabel.includes("partial")) {
      return normAcc.includes("partial") || normAcc.includes("partially");
    }
    if (normLabel.includes("fully paid") || normLabel === "fully paid" || normLabel === "paid") {
      return (normAcc.includes("fully") && normAcc.includes("paid")) || normAcc === "fully paid" || normAcc === "paid" || (normAcc.includes("paid") && !normAcc.includes("partial") && !normAcc.includes("crop") && !normAcc.includes("crops"));
    }
    if (normLabel.includes("handed")) {
      return normAcc.includes("handed") || normAcc.includes("handover") || normAcc.includes("handed over");
    }
    if (normLabel.includes("cno")) {
      return normAcc.includes("cno");
    }
    if (normLabel.includes("moa")) {
      return normAcc.includes("moa");
    }
    if (normLabel.includes("crops")) {
      return normAcc.includes("crops") || normAcc.includes("crop");
    }
    
    return false;
  }, []);

  // Compute reference week ranges for comparison
  const statCardWeekInfo = useMemo(() => {
    const today = new Date();
    const currRange = getWeekRange(today);
    const prevRange = getPreviousWeekRange(currRange.monday);
    
    return {
      label: `Current Week (${format(currRange.monday, "MMM dd")} - ${format(currRange.sunday, "MMM dd, yyyy")})`,
      range: currRange,
      prevRange
    };
  }, [getWeekRange, getPreviousWeekRange]);

  const hoveredStatCardDetails = useMemo(() => {
    if (!hoveredStatCard || !statCardWeekInfo || !weeklyData || weeklyData.length === 0) return null;
    
    const { range, prevRange } = statCardWeekInfo;
    const label = hoveredStatCard.label;
    
    const filteredLotIds = new Set(filteredData.map(d => (d.lotId || "").trim().toLowerCase()));

    const currentWeekUpdates = weeklyData.filter(item => {
      const normalizedLotId = (item.lotId || "").trim().toLowerCase();
      if (!filteredLotIds.has(normalizedLotId)) return false;

      const d = parseDateSafely(item.dateEntry) || parseDateSafely(item.dateAccomplishment);
      return d && d.getTime() >= range.monday.getTime() && d.getTime() <= range.sunday.getTime();
    });
    
    const prevWeekUpdates = weeklyData.filter(item => {
      const normalizedLotId = (item.lotId || "").trim().toLowerCase();
      if (!filteredLotIds.has(normalizedLotId)) return false;

      const d = parseDateSafely(item.dateEntry) || parseDateSafely(item.dateAccomplishment);
      return d && d.getTime() >= prevRange.monday.getTime() && d.getTime() <= prevRange.sunday.getTime();
    });
    
    const matchedCurrent = currentWeekUpdates.filter(item => isAccomplishmentMatch(label, item.accomplishment));
    const matchedPrev = prevWeekUpdates.filter(item => isAccomplishmentMatch(label, item.accomplishment));
    
    const isTotalLotsCard = label.toLowerCase().includes("total lots") || label.toLowerCase().includes("lot id");
    
    const breakdown = isTotalLotsCard ? (() => {
      const groups: { [key: string]: { count: number; previousCount: number; color: string } } = {};
      
      const categories = [
        { label: "NoT Issued", color: "#e49864" },
        { label: "Issued RfD/OTB/OtC", color: "#e49864" },
        { label: "Accepted RfD/OTB/OtC", color: "#d6bf5d" },
        { label: "30 days Review RfD/OTB/OtC", color: "#b34b40" },
        { label: "Incurable RfD/OTB/OtC", color: "#b34b40" },
        { label: "Rejected RfD/OTB/OtC", color: "#bd0707" },
        { label: "DOAS", color: "#112bbc" },
        { label: "EJSEAS", color: "#112bbc" },
        { label: "PTE", color: "#66ac69" },
        { label: "Partial Paid", color: "#187f05" },
        { label: "Fully Paid", color: "#187f05" },
        { label: "Handed Over", color: "#239694" },
        { label: "CNO", color: "#187f05" },
        { label: "MOA", color: "#187f05" },
        { label: "Paid Crops", color: "#187f05" },
      ];
      
      categories.forEach(cat => {
        const currMatch = currentWeekUpdates.filter(item => isAccomplishmentMatch(cat.label, item.accomplishment)).length;
        const prevMatch = prevWeekUpdates.filter(item => isAccomplishmentMatch(cat.label, item.accomplishment)).length;
        if (currMatch > 0 || prevMatch > 0) {
          groups[cat.label] = {
            count: currMatch,
            previousCount: prevMatch,
            color: cat.color
          };
        }
      });
      
      return Object.entries(groups).map(([name, val]) => ({
        name,
        count: val.count,
        previousCount: val.previousCount,
        color: val.color
      }));
    })() : [];
    
    return {
      currentCount: matchedCurrent.length,
      previousCount: matchedPrev.length,
      entries: matchedCurrent,
      allEntriesCount: matchedCurrent.length,
      breakdown,
      isTotalLotsCard
    };
  }, [hoveredStatCard, statCardWeekInfo, weeklyData, filteredData, parseDateSafely, isAccomplishmentMatch]);

  const handleStatCardMouseEnter = (e: React.MouseEvent, label: string, value: string | number, color: string) => {
    if (statCardCloseTimeoutRef.current) {
      clearTimeout(statCardCloseTimeoutRef.current);
      statCardCloseTimeoutRef.current = null;
    }
    
    const actualCardRect = e.currentTarget.getBoundingClientRect();
    let targetElement = e.currentTarget;
    if (label === "DOAS") {
      const rejectedEl = document.getElementById("stat-card-rejected-otb");
      if (rejectedEl) {
        targetElement = rejectedEl;
      }
    } else if (label === "Paid Crops") {
      const moaEl = document.getElementById("stat-card-moa");
      if (moaEl) {
        targetElement = moaEl;
      }
    }

    const rect = targetElement.getBoundingClientRect();
    setHoveredStatCard({
      x: rect.left + rect.width / 2,
      yTop: rect.top,
      yBottom: rect.bottom,
      rectLeft: rect.left,
      rectRight: rect.right,
      label,
      value,
      color,
      hoveredRectLeft: actualCardRect.left,
      hoveredRectRight: actualCardRect.right,
      hoveredRectTop: actualCardRect.top,
      hoveredRectBottom: actualCardRect.bottom,
    });
  };

  const handleStatCardMouseLeave = () => {
    if (statCardCloseTimeoutRef.current) {
      clearTimeout(statCardCloseTimeoutRef.current);
    }
    statCardCloseTimeoutRef.current = setTimeout(() => {
      setHoveredStatCard(null);
    }, 200);
  };

  const handleMouseEnter = (e: React.MouseEvent, monthName: string, monthKey: string, type: 'total' | 'paid' | 'unpaid' | 'percent' | 'column') => {
    if (hoveredCellCloseTimeoutRef.current) {
      clearTimeout(hoveredCellCloseTimeoutRef.current);
      hoveredCellCloseTimeoutRef.current = null;
    }
    let rect = e.currentTarget.getBoundingClientRect();
    const rightSideKeys = ["2027-09", "2027-10", "2027-11", "2027-12", "2028-06"];
    if (rightSideKeys.includes(monthKey)) {
      const parentRow = e.currentTarget.closest("tr");
      if (parentRow) {
        const augCell = parentRow.querySelector('[data-month-key="2027-08"]');
        if (augCell) {
          rect = augCell.getBoundingClientRect();
        }
      }
    }
    setHoveredCell({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      monthName,
      monthKey,
      type
    });
  };

  const handleLabelMouseEnter = (e: React.MouseEvent, type: 'row-total' | 'row-paid' | 'row-unpaid' | 'row-percent') => {
    if (hoveredCellCloseTimeoutRef.current) {
      clearTimeout(hoveredCellCloseTimeoutRef.current);
      hoveredCellCloseTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredCell({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      monthName: "All Months",
      monthKey: "all",
      type
    });
  };

  const handleMouseLeave = () => {
    if (hoveredCellCloseTimeoutRef.current) {
      clearTimeout(hoveredCellCloseTimeoutRef.current);
    }
    hoveredCellCloseTimeoutRef.current = setTimeout(() => {
      setHoveredCell(null);
    }, 450); // Give the user 450ms transition window to move cursor to tooltip
  };

  // Click Interactivity Handlers for TriggerMode === 'click'
  const handleCellClick = (e: React.MouseEvent, monthName: string, monthKey: string, type: 'total' | 'paid' | 'unpaid' | 'percent' | 'column') => {
    e.stopPropagation();
    if (hoveredCell && hoveredCell.monthKey === monthKey && hoveredCell.type === type) {
      setHoveredCell(null);
    } else {
      if (hoveredCellCloseTimeoutRef.current) {
        clearTimeout(hoveredCellCloseTimeoutRef.current);
        hoveredCellCloseTimeoutRef.current = null;
      }
      let rect = e.currentTarget.getBoundingClientRect();
      const rightSideKeys = ["2027-09", "2027-10", "2027-11", "2027-12", "2028-06"];
      if (rightSideKeys.includes(monthKey)) {
        const parentRow = e.currentTarget.closest("tr");
        if (parentRow) {
          const augCell = parentRow.querySelector('[data-month-key="2027-08"]');
          if (augCell) {
            rect = augCell.getBoundingClientRect();
          }
        }
      }
      setHoveredCell({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        monthName,
        monthKey,
        type
      });
    }
  };

  const handleLabelClick = (e: React.MouseEvent, type: 'row-total' | 'row-paid' | 'row-unpaid' | 'row-percent') => {
    e.stopPropagation();
    if (hoveredCell && hoveredCell.monthKey === "all" && hoveredCell.type === type) {
      setHoveredCell(null);
    } else {
      if (hoveredCellCloseTimeoutRef.current) {
        clearTimeout(hoveredCellCloseTimeoutRef.current);
        hoveredCellCloseTimeoutRef.current = null;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredCell({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        monthName: "All Months",
        monthKey: "all",
        type
      });
    }
  };

  const handleStatCardClick = (e: React.MouseEvent, label: string, value: string | number, color: string) => {
    e.stopPropagation();
    if (hoveredStatCard && hoveredStatCard.label === label) {
      setHoveredStatCard(null);
    } else {
      if (statCardCloseTimeoutRef.current) {
        clearTimeout(statCardCloseTimeoutRef.current);
        statCardCloseTimeoutRef.current = null;
      }
      
      const actualCardRect = e.currentTarget.getBoundingClientRect();
      let targetElement = e.currentTarget;
      if (label === "DOAS") {
        const rejectedEl = document.getElementById("stat-card-rejected-otb");
        if (rejectedEl) {
          targetElement = rejectedEl;
        }
      } else if (label === "Paid Crops") {
        const moaEl = document.getElementById("stat-card-moa");
        if (moaEl) {
          targetElement = moaEl;
        }
      }

      const rect = targetElement.getBoundingClientRect();
      setHoveredStatCard({
        x: rect.left + rect.width / 2,
        yTop: rect.top,
        yBottom: rect.bottom,
        rectLeft: rect.left,
        rectRight: rect.right,
        label,
        value,
        color,
        hoveredRectLeft: actualCardRect.left,
        hoveredRectRight: actualCardRect.right,
        hoveredRectTop: actualCardRect.top,
        hoveredRectBottom: actualCardRect.bottom,
      });
    }
  };

  const handleStatCardSingleClick = (e: React.MouseEvent, label: string) => {
    e.stopPropagation();
    if (label === "TOTAL LOTS" || label === "LOT ID NO") {
      setSelectedStatusCard(null);
    } else {
      setSelectedStatusCard(prev => prev === label ? null : label);
    }
  };

  const handleStatCardDoubleClick = (e: React.MouseEvent, label: string, value: string | number, color: string) => {
    e.stopPropagation();
    if (label !== "TOTAL LOTS" && label !== "LOT ID NO") {
      setSelectedStatusCard(label);
    }
    handleStatCardClick(e, label, value, color);
  };

  const handleDownloadExcel = async (lotsToDownload: any[]) => {
    if (!lotsToDownload || lotsToDownload.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Financial Summary");

      // Freeze Pane: Freeze the first row (the header row)
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      const headers = [
        "Lot ID No",
        "Registered Owner",
        "CP",
        "LGU",
        "Total Area (sqm)",
        "Total Affected Area (sqm)",
        "PROW Impact",
        "Estimated Value (PHP)",
        "Remarks"
      ];

      worksheet.addRow(headers);

      // Style Header row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 25;
      headerRow.eachCell((cell) => {
        cell.font = { 
          name: 'Arial', 
          size: 10, 
          bold: true, 
          color: { argb: 'FF1E293B' } // Deep charcoal color text
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2E8F0' } // Beautiful elegant light gray background
        };
        cell.alignment = { 
          horizontal: 'left', 
          vertical: 'middle', 
          wrapText: true 
        };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FFA0AEC0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      });

      const cleanNumberValue = (val: any) => {
        if (val === null || val === undefined) return 0;
        const cleanStr = String(val).replace(/,/g, "").trim();
        const doubleVal = parseFloat(cleanStr);
        return isNaN(doubleVal) ? val : doubleVal;
      };

      lotsToDownload.forEach(d => {
        const estValue = Number(d.totalEstimatedCost) || ((Number(d.estimatedLandCost) || 0) + (Number(d.estimatedStructureCost) || 0));
        const rowValues = [
          d.lotId || "",
          d.ownerName || "Unknown Owner",
          d.cp || "N/A",
          d.lgu || "N/A",
          cleanNumberValue(d.totalArea) || 0,
          cleanNumberValue(d.affectedArea) || 0,
          d.prowImpact || "N/A",
          formatCurrency(estValue || 0),
          d.siteAccessPaid ? "PAID" : "UNPAID"
        ];
        worksheet.addRow(rowValues);
      });

      // Style Data Rows (Starting from Row 2)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip styling headers again
        row.height = 36; // Give ample room for wrapping text
        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 9 };
          cell.alignment = { 
            horizontal: 'left', 
            vertical: 'middle',
            wrapText: true // Enable wrapping
          };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };
        });
      });

      // Fit column widths elegantly
      worksheet.columns.forEach((col, index) => {
        // index 1 is Registered Owner (column B)
        if (index === 1) {
          col.width = 28;
          return;
        }
        let maxLen = 0;
        col.eachCell?.({ includeEmpty: true }, (cell) => {
          const valStr = cell.value ? String(cell.value) : "";
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        });
        col.width = Math.max(maxLen + 4, 12);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);

      const monthStr = hoveredCell?.monthKey === "all" ? "All_Months" : hoveredCell?.monthName || "Selected_Month";
      const typeStr = hoveredCell?.type || "summary";
      const fileName = `SC_Non_Workable_Area_${monthStr}_${typeStr}_Financial_Summary.xlsx`;

      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate Excel file", err);
    }
  };

  React.useEffect(() => {
    const handleScroll = () => {
      setHoveredCell(null);
      if (hoveredCellCloseTimeoutRef.current) {
        clearTimeout(hoveredCellCloseTimeoutRef.current);
        hoveredCellCloseTimeoutRef.current = null;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    const tableContainer = document.querySelector('.overflow-x-auto');
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll, { passive: true });
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (tableContainer) {
        tableContainer.removeEventListener('scroll', handleScroll);
      }
      if (hoveredCellCloseTimeoutRef.current) {
        clearTimeout(hoveredCellCloseTimeoutRef.current);
      }
    };
  }, []);

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          try {
            localStorage.setItem("scla_team_photo", compressedBase64);
            localStorage.setItem("gcr_global_team_photo", compressedBase64);
            setTeamPhoto(compressedBase64);
          } catch (err) {
            console.error("Failed to save to localStorage:", err);
            setTeamPhoto(compressedBase64);
          }
          // Broadcast global background change to all other users immediately in real-time
          window.dispatchEvent(new CustomEvent("scla_broadcast_global_background", {
            detail: { globalBackground: compressedBase64 }
          }));
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  // Helper to dynamically check if chart labels will overlap horizontally and need slanting
  const getShouldSlant = (chartData: any[] | undefined, estContainerWidth = 1100) => {
    if (!chartData || chartData.length <= 1) return false;
    const count = chartData.length;
    let maxLen = 0;
    for (let i = 0; i < count; i++) {
      const item = chartData[i];
      const nameStr = String(item?.name || item?.month || item?.weekLabel || item?.label || "");
      if (nameStr.length > maxLen) maxLen = nameStr.length;
    }
    const slotWidth = Math.max(10, (estContainerWidth - 60) / count);
    const estTextWidth = maxLen * 5.2;
    return estTextWidth > (slotWidth - 2);
  };

  const isSingle = filteredData.length === 1;
  const singleLot = isSingle ? filteredData[0] : null;

  // Dynamic cascading options for each filter dropdown
  const options = useMemo(() => {
    if (!data) return { 
      currentStatus: [], 
      cp: [], 
      rapCp: [], 
      ownerClassification: [], 
      prowImpact: [], 
      lgu: [], 
      rapLgu: [], 
      zone: [], 
      modeAcquisition: [], 
      harmonization: [] 
    };

    const getOptionsForField = (field: keyof typeof INITIAL_FILTERS, dataField: keyof LotData) => {
      let baseData = data;
      if (selectedStatusCard && selectedStatusCard !== "TOTAL LOTS" && selectedStatusCard !== "LOT ID NO") {
        const pred = getStatusPredicate(selectedStatusCard);
        if (pred) {
          baseData = baseData.filter(pred);
        }
      }

      // Filter data by ALL filters EXCEPT the current field
      const subset = baseData.filter(d => {
        const cpArr = filters?.cp || [];
        const rapCpArr = filters?.rapCp || [];
        const ownerArr = filters?.ownerClassification || [];
        const prowArr = filters?.prowImpact || [];
        const lguArr = filters?.lgu || [];
        const rapLguArr = filters?.rapLgu || [];
        const zoneArr = filters?.zone || [];
        const modeArr = filters?.modeAcquisition || [];
        const statusArr = filters?.currentStatus || [];
        const harmArr = filters?.harmonization || [];

        const matchCp = field === "cp" || cpArr.length === 0 || cpArr.includes(normalizeText(d.cp || d.rapCp));
        const matchRapCp = field === "rapCp" || rapCpArr.length === 0 || rapCpArr.includes(normalizeText(d.rapCp || d.cp));
        const matchOwner = field === "ownerClassification" || ownerArr.length === 0 || ownerArr.includes(normalizeText(d.ownerClassification));
        const matchProw = field === "prowImpact" || prowArr.length === 0 || prowArr.includes(normalizeText(d.prowImpact));
        const matchLgu = field === "lgu" || lguArr.length === 0 || lguArr.includes(normalizeText(d.lgu));
        const matchRapLgu = field === "rapLgu" || rapLguArr.length === 0 || rapLguArr.includes(normalizeText(d.rapLgu || d.lgu));
        const matchZone = field === "zone" || zoneArr.length === 0 || zoneArr.includes(normalizeText(d.zone));
        const matchMode = field === "modeAcquisition" || modeArr.length === 0 || modeArr.includes(normalizeText(d.modeAcquisition));
        
        let matchStatus = field === "currentStatus" || statusArr.length === 0;
        if (!matchStatus) {
          const isExpro = (d.modeAcquisition && normalizeText(d.modeAcquisition).includes("EXPRO")) || !!d.exproStatus;
          const lotStatusColAT = isExpro && d.exproStatus ? d.exproStatus : "";
          const defaultStatus = d.currentStatus || (d as any).status;
          const matchDefault = statusArr.some(filterStr => {
            const normF = normalizeText(filterStr);
            if (normalizeText(defaultStatus) === normF) return true;
            return satisfiesStatusFilter(d, filterStr);
          });
          const matchColAT = lotStatusColAT ? statusArr.includes(normalizeText(lotStatusColAT)) : false;
          const matchColBS = d.acquiredLots ? statusArr.some(filterStr => {
            const normF = normalizeText(filterStr);
            const normAcq = normalizeText(d.acquiredLots);
            const isAcq = (normAcq.includes("ACQUIRED") && !normAcq.includes("NOT")) || normAcq === "YES";
            return normF.includes("ACQUIRED") ? isAcq : (normAcq === normF);
          }) : false;
          matchStatus = matchDefault || matchColAT || matchColBS;
        }

        const matchHarm = field === "harmonization" || harmArr.length === 0 || harmArr.includes(normalizeText(d.harmonization));

        return matchCp && matchRapCp && matchOwner && matchProw && matchLgu && matchRapLgu && matchZone && matchMode && matchStatus && matchHarm;
      });

      const mappedValues = subset.flatMap(d => {
        if (field === "currentStatus") {
          const isExpro = (d.modeAcquisition && normalizeText(d.modeAcquisition).includes("EXPRO")) || !!d.exproStatus;
          const vals = [];
          if (d.currentStatus || (d as any).status) vals.push(d.currentStatus || (d as any).status);
          if (isExpro && d.exproStatus) vals.push(d.exproStatus);
          return vals;
        }
        if (field === "rapLgu") return [d.rapLgu || d.lgu];
        if (field === "rapCp") return [d.rapCp || d.cp];
        if (field === "cp") return [d.cp || d.rapCp];
        return [d[dataField]];
      });

      if (field === "currentStatus") {
        ALL_STATUS_OPTIONS.forEach(opt => mappedValues.push(opt));
      }

      const cleanMapped = field === "currentStatus"
        ? mappedValues.filter(v => {
            const nv = normalizeText(v as string);
            if (nv.includes("NOT YET ACQUIRED")) return false;
            if (nv === "ACQUIRED" || nv === "ACQUIRED LOTS") return false; // Consolidated into "13 ACQUIRED LOTS" (Column BS)
            return true;
          })
        : mappedValues;

      return (Array.from(new Set(cleanMapped.map(v => normalizeText(v as string)).filter(Boolean))) as string[])
        .sort((a: string, b: string) => {
          const fieldType = field === "lgu" ? "lgu" : field === "rapLgu" ? "rapLgu" : field === "cp" ? "cp" : field === "rapCp" ? "rapCp" : field === "zone" ? "zone" : field === "currentStatus" ? "status" : "";
          if (fieldType) {
            const idxA = getItemOrderIndex(fieldType, a);
            const idxB = getItemOrderIndex(fieldType, b);
            if (idxA !== idxB) return idxA - idxB;
          }
          return a.localeCompare(b);
        });
    };

    return {
      currentStatus: getOptionsForField("currentStatus", "currentStatus"),
      cp: getOptionsForField("cp", "cp"),
      rapCp: getOptionsForField("rapCp", "rapCp"),
      ownerClassification: getOptionsForField("ownerClassification", "ownerClassification"),
      prowImpact: getOptionsForField("prowImpact", "prowImpact"),
      lgu: getOptionsForField("lgu", "lgu"),
      rapLgu: getOptionsForField("rapLgu", "rapLgu"),
      zone: getOptionsForField("zone", "zone"),
      modeAcquisition: getOptionsForField("modeAcquisition", "modeAcquisition"),
      harmonization: getOptionsForField("harmonization", "harmonization"),
    };
  }, [data, filters, selectedStatusCard]);

  const allPierNames = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    const regex = /\b(?:P|PR|BUE|MT)(?:-P)?-?\d+[A-S]*\b/gi;
    data.forEach(d => {
      if (d.pierNakashima) {
        let match;
        while ((match = regex.exec(d.pierNakashima)) !== null) {
          set.add(match[0].toUpperCase());
        }
      }
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt((a.match(/\d+/) || ["0"])[0], 10);
      const numB = parseInt((b.match(/\d+/) || ["0"])[0], 10);
      if (numA !== numB) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
  }, [data]);

  // Stats for the 16 cards based on user script logic
  const stats = useMemo(() => {
    const count = (fn: (d: LotData) => boolean) => filteredData.filter(fn).length;

    if (isSingle && singleLot) {
      return {
        totalLots: singleLot.lotId,
        notIssued: isValidDateValue(singleLot.dateNot) ? singleLot.dateNot : "-",
        otbIssued: isValidDateValue(singleLot.dateOtb) ? singleLot.dateOtb : "-",
        otbAccepted: (normalizeText(singleLot.otbReply).includes("ACCEPTED") || normalizeText(singleLot.rfdReply).includes("ACCEPTED")) ? (singleLot.otbReplyDate || "ACCEPTED") : "-",
        otbReview: (normalizeText(singleLot.otbReply).includes("30 DAYS REVIEW") || normalizeText(singleLot.rfdReply).includes("30 DAYS REVIEW")) ? (singleLot.otbReplyDate || "REVIEW") : "-",
        otbIncurable: (normalizeText(singleLot.otbReply).includes("INCURABLE") || normalizeText(singleLot.rfdReply).includes("INCURABLE")) ? (singleLot.otbReplyDate || "INCURABLE") : "-",
        otbRejected: (normalizeText(singleLot.otbReply).includes("REJECT") || normalizeText(singleLot.rfdReply).includes("REJECT")) ? (singleLot.otbReplyDate || "REJECTED") : "-",
        signedDoas: normalizeText(singleLot.statusDoas).includes("SIGNED") ? (singleLot.dateDoas || "SIGNED") : "-",
        signedEjseas: normalizeText(singleLot.statusDoas).includes("EJSEAS") ? (singleLot.dateDoas || "EJSEAS") : "-",
        signedPte: normalizeText(singleLot.statusPte).includes("SIGNED") ? (singleLot.datePte || "SIGNED") : "-",
        partiallyPaid: (normalizeText(singleLot.paymentStatus).includes("PARTIALLY PAID") || normalizeText(singleLot.paymentStatus).includes("PAID WITH WOP")) ? (singleLot.datePaid || "PARTIAL") : "-",
        fullyPaid: normalizeText(singleLot.paymentStatus).includes("FULLY PAID") ? (singleLot.datePaid || "FULL") : "-",
        handedOver: isValidDateValue(singleLot.dateHo) ? (singleLot.dateHo || "YES") : "-",
        withCno: (isValidDateValue(singleLot.dateCno) && normalizeText(singleLot.withCnoMoa).includes("CNO")) ? (singleLot.dateCno || "CNO") : "-",
        withMoa: (isValidDateValue(singleLot.dateCno) && normalizeText(singleLot.withCnoMoa).includes("MOA")) ? (singleLot.dateCno || "MOA") : "-",
        paidCrops: singleLot.advancePaymentDate || "-",
      };
    }

    return {
      totalLots: filteredData.length,
      notIssued: count(d => isValidDateValue(d.dateNot)),
      otbIssued: count(d => isValidDateValue(d.dateOtb)),
      otbAccepted: count(d => normalizeText(d.otbReply).includes("ACCEPTED") || normalizeText(d.rfdReply).includes("ACCEPTED")),
      otbReview: count(d => normalizeText(d.otbReply).includes("30 DAYS REVIEW") || normalizeText(d.rfdReply).includes("30 DAYS REVIEW")),
      otbIncurable: count(d => normalizeText(d.otbReply).includes("INCURABLE") || normalizeText(d.rfdReply).includes("INCURABLE")),
      otbRejected: count(d => normalizeText(d.otbReply).includes("REJECT") || normalizeText(d.rfdReply).includes("REJECT")),
      signedDoas: count(d => normalizeText(d.statusDoas).includes("SIGNED")),
      signedEjseas: count(d => normalizeText(d.statusDoas).includes("EJSEAS")),
      signedPte: count(d => normalizeText(d.statusPte).includes("SIGNED")),
      partiallyPaid: count(d => {
        const val = normalizeText(d.paymentStatus);
        return val.includes("PARTIALLY PAID") || val.includes("PAID WITH WOP");
      }),
      fullyPaid: count(d => normalizeText(d.paymentStatus).includes("FULLY PAID")),
      handedOver: count(d => isValidDateValue(d.dateHo)),
      withCno: count(d => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("CNO")),
      withMoa: count(d => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("MOA")),
      paidCrops: count(d => d.advancePaymentDate.trim() !== ""),
    };
  }, [filteredData, isSingle, singleLot]);

  // Aggregate stats for charts (always numbers)
  const chartTotals = useMemo(() => {
    const totalLots = filteredData.length;
    const count = (fn: (d: LotData) => boolean) => filteredData.filter(fn).length;
    
    return {
      totalLots,
      notIssued: count(d => isValidDateValue(d.dateNot)),
      otbIssued: count(d => isValidDateValue(d.dateOtb)),
      otbAccepted: count(d => normalizeText(d.otbReply).includes("ACCEPTED") || normalizeText(d.rfdReply).includes("ACCEPTED")),
      otbReview: count(d => normalizeText(d.otbReply).includes("30 DAYS REVIEW") || normalizeText(d.rfdReply).includes("30 DAYS REVIEW")),
      otbIncurable: count(d => normalizeText(d.otbReply).includes("INCURABLE") || normalizeText(d.rfdReply).includes("INCURABLE")),
      otbRejected: count(d => normalizeText(d.otbReply).includes("REJECT") || normalizeText(d.rfdReply).includes("REJECT")),
      signedDoas: count(d => normalizeText(d.statusDoas).includes("SIGNED")),
      signedEjseas: count(d => normalizeText(d.statusDoas).includes("EJSEAS")),
      signedPte: count(d => normalizeText(d.statusPte).includes("SIGNED")),
      partiallyPaid: count(d => {
        const val = normalizeText(d.paymentStatus);
        return val.includes("PARTIALLY PAID") || val.includes("PAID WITH WOP");
      }),
      fullyPaid: count(d => normalizeText(d.paymentStatus).includes("FULLY PAID")),
      handedOver: count(d => isValidDateValue(d.dateHo)),
      withCno: count(d => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("CNO")),
      withMoa: count(d => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("MOA")),
      paidCrops: count(d => d.advancePaymentDate.trim() !== ""),
    };
  }, [filteredData]);

  // Area and Cost Summaries
  const summaries = useMemo(() => {
    if (isSingle && singleLot) {
      return {
        totalArea: singleLot.totalArea,
        affectedArea: singleLot.affectedArea,
        estLand: singleLot.estimatedLandCost,
        estStructure: singleLot.estimatedStructureCost,
        actLand: singleLot.actualLandCost,
        actStructure: singleLot.actualStructureCost,
      };
    }

    const sum = (key: keyof LotData) => filteredData.reduce((acc, d) => acc + (Number(d[key]) || 0), 0);
    return {
      totalArea: sum("totalArea"),
      affectedArea: sum("affectedArea"),
      estLand: sum("estimatedLandCost"),
      estStructure: sum("estimatedStructureCost"),
      actLand: sum("actualLandCost"),
      actStructure: sum("actualStructureCost"),
    };
  }, [filteredData, isSingle, singleLot]);

  // Chart Data: LA Progress with "Remaining" logic from user script
  const laProgressData = useMemo(() => {
    const labels = [
      'NoT Issued', 'OtB/C Issued', 'OtB/C Accepted', 'OtB/C 30 Days Review',
      'OtB/C Incurable Lots', 'OtB/C Rejected', 'DOAS Signed', 'EJSEAS Signed',
      'PTE Signed', 'Partially Paid', 'Fully Paid', 'Handed Over', 'With CNO', 'With MOA','Crops and Trees'
    ];
    const colors = [
      '#60A5FA', // NoT Issued (Blue)
      '#818CF8', // OtB/C Issued (Indigo)
      '#34D399', // OtB/C Accepted (Emerald Mint)
      '#F59E0B', // OtB/C 30 Days Review (Amber)
      '#EF4444', // OtB/C Incurable Lots (Red)
      '#A78BFA', // OtB/C Rejected (Purple)
      '#38BDF8', // DOAS Signed (Sky Blue)
      '#10B981', // EJSEAS Signed (Teal Emerald)
      '#EC4899', // PTE Signed (Hot Pink)
      '#F97316', // Partially Paid (Orange)
      '#06B6D4', // Fully Paid (Cyan)
      '#EAB308', // Handed Over (Yellow)
      '#8B5CF6', // With CNO (Deep Violet)
      '#14B8A6', // With MOA (Teal)
      '#F43F5E'  // Crops and Trees (Deep Rose)
    ];
    
    const dataCounts = [
      chartTotals.notIssued,       // 0
      chartTotals.otbIssued,       // 1
      chartTotals.otbAccepted,     // 2
      chartTotals.otbReview,       // 3
      chartTotals.otbIncurable,    // 4
      chartTotals.otbRejected,     // 5
      chartTotals.signedDoas,      // 6
      chartTotals.signedEjseas,    // 7
      chartTotals.signedPte,       // 8
      chartTotals.partiallyPaid,   // 9
      chartTotals.fullyPaid,       // 10
      chartTotals.handedOver,     // 11
      chartTotals.withCno,         // 12
      chartTotals.withMoa,         // 13
      chartTotals.paidCrops        // 14
    ];

    const totalLots = chartTotals.totalLots;

    return labels.map((label, i) => {
      const lotCount = dataCounts[i];
      let remaining = 0;

      switch(i) {
        case 0: // NoT Issued
          remaining = totalLots - lotCount; break;
        case 1: // OtB/C Issued
          remaining = dataCounts[0] - lotCount; break;
        case 2: // OtB/C Accepted
          remaining = dataCounts[1] - dataCounts[2] - dataCounts[5]; break;
        case 3: // OtB/C 30 Days Review
          remaining = dataCounts[1] - dataCounts[2] - dataCounts[5] - dataCounts[4]; break;
        case 4: // OtB/C Incurable Lots
          remaining = dataCounts[1] - dataCounts[2] - dataCounts[5] - dataCounts[3]; break;
        case 5: // OtB/C Rejected
          remaining = dataCounts[1] - dataCounts[2] - dataCounts[5]; break;
        case 6: // DOAS Signed
        case 7: // EJSEAS Signed
          remaining = dataCounts[2] - dataCounts[6] - dataCounts[7]; break;
        case 8: // PTE Signed
          remaining = 0; break;
        case 9: // Partially Paid
          remaining = (dataCounts[6] + dataCounts[7]) - dataCounts[10] - dataCounts[9]; break;
        case 10: // Fully Paid
          remaining = (dataCounts[6] + dataCounts[7]) - dataCounts[10]; break;
        case 11: // Handed Over
          remaining = totalLots - lotCount; break;
        default:
          remaining = 0;
      }

      const finalRemaining = Math.max(0, remaining);
      return {
        name: label,
        lotCount: lotCount,
        remaining: finalRemaining === 0 ? 0.0001 : finalRemaining,
        color: colors[i]
      };
    });
  }, [chartTotals]);

  // Chart Data: Weekly Velocity of Land Acquisition progress
  const weeklyVelocityData = useMemo(() => {
    const result = [];
    const filteredLotIds = new Set(filteredData.map(d => (d.lotId || "").trim().toLowerCase()));

    const parseDateSafelyLocal = (dateStr: string) => {
      if (!dateStr || String(dateStr).toLowerCase().includes("no data")) return null;
      try {
        const trimmed = dateStr.trim();
        const fallback = new Date(trimmed);
        if (!isNaN(fallback.getTime())) return fallback;
        return null;
      } catch {
        return null;
      }
    };

    for (let i = 4; i >= 0; i--) {
      const offset = (weekOffset || 0) - i;
      const now = addWeeks(new Date(), offset);
      const start = startOfWeek(now, { weekStartsOn: 1 });
      const end = endOfWeek(now, { weekStartsOn: 1 });
      
      const friday = new Date(start);
      friday.setDate(start.getDate() + 4);

      let label = "";
      if (i === 0) {
        label = "Current Week";
      } else {
        label = `W-${i} (${format(start, "MMM dd")})`;
      }

      const weekUpdates = (weeklyData || []).filter(item => {
        const normalizedLotId = (item.lotId || "").trim().toLowerCase();
        if (!filteredLotIds.has(normalizedLotId)) return false;

        const d = parseDateSafelyLocal(item.dateEntry || item.dateAccomplishment);
        if (!d) return false;
        return isWithinInterval(d, { start, end });
      });

      let noticeCount = 0;
      let agreementCount = 0;
      let paymentCount = 0;
      let cropsCount = 0;

      weekUpdates.forEach(update => {
        const acc = (update.accomplishment || "").toLowerCase().trim();
        const tag = (update.tag || "").toLowerCase().trim();
        
        let index: number | null = null;
        if (acc.includes("handed over") || acc === "ho" || tag.includes("handed over") || tag === "ho") index = 11;
        else if (/\b(ejseas)\b/i.test(acc) || /\b(ejseas)\b/i.test(tag)) index = 7;
        else if (/\b(doas|signed\s+doas|doas\s+signed)\b/i.test(acc) || /\b(doas)\b/i.test(tag)) index = 6;
        else if (/\b(pte)\b/i.test(acc) || /\b(pte)\b/i.test(tag)) index = 8;
        else if (/\b(partially\s+paid|partial\s+paid|partially|partial)\b/i.test(acc) || /\b(partial)\b/i.test(tag)) index = 9;
        else if (/\b(fully\s+paid|fully|paid)\b/i.test(acc) || /\b(paid)\b/i.test(tag)) index = 10;
        else if (/\b(not\s+issued|issued\s+not|not\s+delivered|notice\s+of\s+taking|not)\b/i.test(acc) || /\b(not|notice)\b/i.test(tag)) index = 0;
        else if (/\b(accepted?|collection)\b/i.test(acc) || /\b(accepted?|collection)\b/i.test(tag)) index = 2;
        else if (/\b(30\s+days?\s+review|review)\b/i.test(acc) || /\b(review)\b/i.test(tag)) index = 3;
        else if (/\b(incurable)\b/i.test(acc) || /\b(incurable)\b/i.test(tag)) index = 4;
        else if (/\b(rejected?|reject)\b/i.test(acc) || /\b(rejected?|reject)\b/i.test(tag)) index = 5;
        else if (
          /\b(issued\s+(rfd|otb|otc|offer)|(rfd|otb|otc|offer)\s+issued|offert?\s+to\s+buy|compensation|rfd|otb|otc)\b/i.test(acc) ||
          /\b(otb|otc|rfd|offer)\b/i.test(tag)
        ) index = 1;
        else if (/\b(cno)\b/i.test(acc) || /\b(cno)\b/i.test(tag)) index = 12;
        else if (/\b(moa)\b/i.test(acc) || /\b(moa)\b/i.test(tag)) index = 13;
        else if (/\b(crops|trees?)\b/i.test(acc) || /\b(crops|trees?)\b/i.test(tag)) index = 14;

        if (index !== null) {
          if (index >= 0 && index <= 5) {
            noticeCount++;
          } else if (index >= 6 && index <= 8) {
            agreementCount++;
          } else if (index >= 9 && index <= 13) {
            paymentCount++;
          } else if (index === 14) {
            cropsCount++;
          }
        }
      });

      result.push({
        weekLabel: label,
        dateRange: `${format(start, "MMM dd")} - ${format(friday, "MMM dd")}`,
        "Notice & Offers": noticeCount,
        "Agreements & Access": agreementCount,
        "Payment & Handover": paymentCount,
        "Crops & Trees": cropsCount,
        "Total Progress": noticeCount + agreementCount + paymentCount + cropsCount,
      });
    }

    return result;
  }, [weeklyData, weekOffset, filteredData]);

  const velocityMetrics = useMemo(() => {
    const currentCount = weeklyVelocityData[4]?.["Total Progress"] || 0;
    
    let sumPrev = 0;
    let maxVal = 0;
    let maxLabel = "None";
    for (let i = 0; i < 4; i++) {
      const val = weeklyVelocityData[i]?.["Total Progress"] || 0;
      sumPrev += val;
      if (val > maxVal) {
        maxVal = val;
        maxLabel = weeklyVelocityData[i]?.weekLabel || "";
      }
    }
    const avgPrev = sumPrev / 4;
    
    let percentageChange = 0;
    let status: "up" | "down" | "stable" = "stable";
    if (avgPrev > 0) {
      percentageChange = Math.round(((currentCount - avgPrev) / avgPrev) * 100);
      status = percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable";
    } else if (currentCount > 0) {
      percentageChange = 100;
      status = "up";
    }

    return {
      currentCount,
      avgPrev,
      percentageChange,
      status,
      peakWeek: maxVal > 0 ? `${maxLabel} (${maxVal} updates)` : "None"
    };
  }, [weeklyVelocityData]);

  // Chart Data: Expro Progress
  const exproProgressData = useMemo(() => {
    const labels = [
      'ECP & AoS Processing',
      'ECP & Affidavit Routing & Signature',
      'ECP Signing (GCR & DOTr)',
      'ECP Routing to OULA/SOLGEN',
      'ECP & Affidavit Endorsement to SOLGEN',
      'Petition & Judicial Affidavit Preparation',
      'WOP Check Preparation',
      'Petition Filing & Check Deposit',
      'WOP Issuance'
    ];
    const colors = ['#60A5FA', '#818CF8', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#38BDF8', '#4ADE80', '#F472B6'];
    
    return labels.map((label, index) => {
      const count = filteredData.filter(d => normalizeText(d.exproStatus).includes(normalizeText(label))).length;
      return {
        name: label,
        value: count,
        color: colors[index]
      };
    });
  }, [filteredData]);

  const exproTotalCount = useMemo(() => {
    return exproProgressData.reduce((sum, item) => sum + item.value, 0);
  }, [exproProgressData]);

  // Chart Data: Monthly Site Access
  const siteAccessData = useMemo(() => {
    const monthsMap: Record<string, any> = {};
    TIMELINE.forEach(m => {
      monthsMap[m.key] = { 
        ...m, 
        total: 0, 
        paid: 0, 
        pte: 0, 
        cno: 0, 
        acquired: 0,
        totalAmount: 0,
        paidAmount: 0,
        unpaidAmount: 0,
        paidPct: 0
      };
    });

    filteredData.forEach(d => {
      if (!d.siteAccessDate) return;
      const dObj = parseDateSafely(d.siteAccessDate);
      if (!dObj) return;
      
      const key = format(startOfMonth(dObj), "yyyy-MM");
      
      // If the date falls in our skip period (Jan-28 to May-28), we ignore it or map it if needed
      // But based on the user request, we only care about the 29 columns in TIMELINE
      if (monthsMap[key]) {
        monthsMap[key].total++;
        
        // Compute cost based on active filter (land/structure/both)
        let lotCost = 0;
        if (nonWorkableCostFilter === 'land') {
          lotCost = Number(d.estimatedLandCost) || 0;
        } else if (nonWorkableCostFilter === 'structure') {
          lotCost = Number(d.estimatedStructureCost) || 0;
        } else {
          lotCost = (Number(d.estimatedLandCost) || 0) + (Number(d.estimatedStructureCost) || 0);
        }
        monthsMap[key].totalAmount += lotCost;

        if (d.siteAccessPaid) {
          monthsMap[key].paid++;
          monthsMap[key].paidAmount += lotCost;
        } else {
          monthsMap[key].unpaidAmount += lotCost;
        }

        if (d.siteAccessPte) monthsMap[key].pte++;
        if (d.siteAccessCno) monthsMap[key].cno++;
        if (d.siteAccessAcquired) monthsMap[key].acquired++;
      }
    });

    // Make sure unpaid and percentage are strictly calculated
    TIMELINE.forEach(m => {
      const item = monthsMap[m.key];
      item.acquired = item.paid + item.pte + item.cno;
      item.unpaidAmount = item.totalAmount - item.paidAmount;
      item.paidPct = item.total > 0 ? (item.paid / item.total) * 100 : 0;
    });

    return TIMELINE.map(m => monthsMap[m.key]);
  }, [filteredData, TIMELINE, parseDateSafely, nonWorkableCostFilter]);

  // Tooltip calculations for row totals and hovered cell lots
  const siteAccessTotals = useMemo(() => {
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;
    let totalLots = 0;
    let paidLots = 0;
    let unpaidLots = 0;
    
    siteAccessData.forEach(d => {
      totalAmount += d.totalAmount || 0;
      paidAmount += d.paidAmount || 0;
      unpaidAmount += d.unpaidAmount || 0;
      totalLots += d.total || 0;
      paidLots += d.paid || 0;
      unpaidLots += (d.total - d.paid) || 0;
    });

    const paidPct = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

    return { totalAmount, paidAmount, unpaidAmount, totalLots, paidLots, unpaidLots, paidPct };
  }, [siteAccessData]);

  // Find actual lots associated with the cell being hovered
  const hoveredCellLots = useMemo(() => {
    if (!hoveredCell || hoveredCell.monthKey === "all") return [];
    
    return filteredData.filter(d => {
      if (!d.siteAccessDate) return false;
      const dObj = parseDateSafely(d.siteAccessDate);
      if (!dObj) return false;
      
      const key = format(startOfMonth(dObj), "yyyy-MM");
      if (key !== hoveredCell.monthKey) return false;

      if (hoveredCell.type === 'paid') {
        return d.siteAccessPaid;
      }
      if (hoveredCell.type === 'unpaid') {
        return !d.siteAccessPaid;
      }
      return true; // matches total or percent
    });
  }, [hoveredCell, filteredData, parseDateSafely]);

  // Comprehensive selector for the downloading function (includes 'all' months)
  const lotsForDownload = useMemo(() => {
    if (!hoveredCell) return [];
    
    if (hoveredCell.monthKey === "all") {
      if (hoveredCell.type === 'row-paid') {
        return filteredData.filter(d => d.siteAccessPaid);
      }
      if (hoveredCell.type === 'row-unpaid') {
        return filteredData.filter(d => !d.siteAccessPaid);
      }
      return filteredData;
    } else {
      return filteredData.filter(d => {
        if (!d.siteAccessDate) return false;
        const dObj = parseDateSafely(d.siteAccessDate);
        if (!dObj) return false;
        
        const key = format(startOfMonth(dObj), "yyyy-MM");
        if (key !== hoveredCell.monthKey) return false;

        if (hoveredCell.type === 'paid') {
          return d.siteAccessPaid;
        }
        if (hoveredCell.type === 'unpaid') {
          return !d.siteAccessPaid;
        }
        return true;
      });
    }
  }, [hoveredCell, filteredData, parseDateSafely]);

  // Cumulative Progress
  const cumulativeData = useMemo(() => {
    const now = new Date();
    const currentMonthKey = format(startOfMonth(now), "yyyy-MM");
    
    // Month-by-month buckets for cumulative logic
    const buckets: Record<string, { total: number; paid: number; pte: number; cno: number }> = {};
    TIMELINE.forEach(m => {
      buckets[m.key] = { total: 0, paid: 0, pte: 0, cno: 0 };
    });

    const startDate = new Date(2025, 8, 1); // Sep 2025

    filteredData.forEach(d => {
      // TOTAL (Private Lots) grouped by Site Access Date
      if (d.siteAccessDate) {
        const dObj = parseDateSafely(d.siteAccessDate);
        if (dObj) {
          const key = format(startOfMonth(dObj >= startDate ? dObj : startDate), "yyyy-MM");
          if (buckets[key]) buckets[key].total++;
        }
      }

      // Statuses (Paid, PTE, CNO) grouped by their OWN dates
      if (d.siteAccessDate) {
        let isPaid = false;
        let isPte = false;

        // PAID
        if (d.datePaid) {
          const dObj = parseDateSafely(d.datePaid);
          if (dObj) {
            const key = format(startOfMonth(dObj >= startDate ? dObj : startDate), "yyyy-MM");
            if (buckets[key]) {
              buckets[key].paid++;
              isPaid = true;
            }
          }
        }

        // PTE
        if (!isPaid && d.datePte) {
          const dObj = parseDateSafely(d.datePte);
          if (dObj) {
            const key = format(startOfMonth(dObj >= startDate ? dObj : startDate), "yyyy-MM");
            if (buckets[key]) {
              buckets[key].pte++;
              isPte = true;
            }
          }
        }

        // CNO
        if (!isPaid && !isPte && d.dateCno) {
          const dObj = parseDateSafely(d.dateCno);
          if (dObj) {
            const key = format(startOfMonth(dObj >= startDate ? dObj : startDate), "yyyy-MM");
            if (buckets[key]) {
              buckets[key].cno++;
            }
          }
        }
      }
    });

    let cumTotal = 0, cumPaid = 0, cumPte = 0, cumCno = 0;
    
    return TIMELINE.map(m => {
      const b = buckets[m.key];
      cumTotal += b.total;
      cumPaid += b.paid;
      cumPte += b.pte;
      cumCno += b.cno;
      const cumAcquired = cumPaid + cumPte + cumCno;

      // If the month is in the future relative to 'now', we only keep the 'total' (Private Lots) line
      if (m.key > currentMonthKey) {
        return { ...m, total: cumTotal, paid: undefined, pte: undefined, cno: undefined, acquired: undefined };
      }

      return { 
        ...m, 
        total: cumTotal, 
        paid: cumPaid, 
        pte: cumPte, 
        cno: cumCno, 
        acquired: cumAcquired 
      };
    });
  }, [filteredData, TIMELINE, parseDateSafely]);

  const siteAccessTotalLots = useMemo(() => {
    return siteAccessData.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [siteAccessData]);

  const maxCumulativeTotal = useMemo(() => {
    if (cumulativeData.length === 0) return 2014;
    const maxVal = Math.max(...cumulativeData.map(d => d.total || 0));
    return maxVal > 0 ? maxVal : 2014;
  }, [cumulativeData]);

  const cumulativeYAxisTicks = useMemo(() => {
    const max = maxCumulativeTotal > 0 ? maxCumulativeTotal : 2014;
    const raw = [
      0,
      Math.round(max * 0.2),
      Math.round(max * 0.4),
      Math.round(max * 0.6),
      Math.round(max * 0.8),
      max
    ];
    // Filter out duplicates and ensure strictly unique ascending order
    const unique = Array.from(new Set(raw)).sort((a, b) => a - b);
    return unique.length > 1 ? unique : [0, max];
  }, [maxCumulativeTotal]);

  const cumulativeTotalLots = useMemo(() => {
    return cumulativeData.length > 0 ? (cumulativeData[cumulativeData.length - 1].total || 0) : 0;
  }, [cumulativeData]);

  const latestCumulativeRow = useMemo(() => {
    if (cumulativeData.length === 0) return null;
    for (let i = cumulativeData.length - 1; i >= 0; i--) {
      if (cumulativeData[i].acquired !== undefined) return cumulativeData[i];
    }
    return null;
  }, [cumulativeData]);

  const totalAcquiredLots = useMemo(() => {
    return filteredData.filter(d => {
      const isHo = isValidDateValue(d.dateHo) || 
                   normalizeText(d.handedOver).includes("HAND") || 
                   normalizeText(d.handedOver).includes("DELIVER") || 
                   normalizeText(d.handedOver).includes("DONE") || 
                   normalizeText(d.handedOver).includes("YES");
                   
      const hasPte = normalizeText(d.statusPte).includes("SIGNED");
                       
      const isFullyPaid = normalizeText(d.paymentStatus).includes("FULLY PAID");
      const isPartiallyPaid = normalizeText(d.paymentStatus).includes("PARTIALLY PAID") || 
                              normalizeText(d.paymentStatus).includes("PAID WITH WOP") ||
                              normalizeText(d.paymentStatus).includes("PARTIALLY");
      const isPaid = isFullyPaid || isPartiallyPaid;
      
      const hasCno = isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("CNO");

      if (isHo) return true;
      if (hasPte && !isPaid && !isHo) return true;
      if (isPaid && !hasPte && !isHo) return true;
      if (hasCno && !isPaid && !hasPte && !isHo) return true;

      return false;
    }).length;
  }, [filteredData]);

  const acquiredPct = chartTotals.totalLots > 0 ? ((totalAcquiredLots / chartTotals.totalLots) * 100).toFixed(1) : "0.0";

  const disbursementGrandBudget2027 = useMemo(() => {
    const contractPackages = ["S-01", "S-02", "S-03a", "S-03b", "S-03c", "S-04", "S-05", "S-06", "S-07"];
    const matrix: Record<string, { lot: number[]; structure: number[] }> = {};
    contractPackages.forEach((cp) => {
      matrix[cp] = {
        lot: Array(12).fill(0),
        structure: Array(12).fill(0),
      };
    });

    matrix["S-07"].lot[3] = 28644513.67;

    filteredData.forEach((lotItem) => {
      if (lotItem.siteAccessPaid) return;

      const cp = (lotItem.cp || "").trim();
      if (!matrix[cp]) return;

      let lotYear: number | null = null;
      let lotMonth: number | null = null;
      if (lotItem.siteAccessDate) {
        const dObj = parseDateSafely(lotItem.siteAccessDate);
        if (dObj && !isNaN(dObj.getTime())) {
          lotYear = dObj.getFullYear();
          lotMonth = dObj.getMonth();
        }
      }

      if (cp === "S-07") {
        // Default preset
      } else if (lotYear === 2027 && lotMonth !== null) {
        matrix[cp].lot[lotMonth] += lotItem.estimatedLandCost || 0;
      }

      let bmYear: number | null = null;
      let bmMonth: number | null = null;
      const bmField = (lotItem as any).overallSad;
      if (bmField) {
        const dObj = parseDateSafely(bmField);
        if (dObj && !isNaN(dObj.getTime())) {
          bmYear = dObj.getFullYear();
          bmMonth = dObj.getMonth();
        }
      } else if (lotItem.siteAccessDate) {
        const dObj = parseDateSafely(lotItem.siteAccessDate);
        if (dObj && !isNaN(dObj.getTime())) {
          bmYear = dObj.getFullYear();
          bmMonth = dObj.getMonth();
        }
      }

      if (bmYear === 2027 && bmMonth !== null) {
        matrix[cp].structure[bmMonth] += lotItem.estimatedStructureCost || 0;
      }
    });

    let s07Overrides: any = {};
    try {
      const stored = localStorage.getItem("nscr_disbursement_s07_overrides");
      if (stored) s07Overrides = JSON.parse(stored);
    } catch (e) {
      // Ignore
    }

    const override = s07Overrides[2027];
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

    const totals = {
      land: Array(12).fill(0),
      structure: Array(12).fill(0),
      grandTotal: Array(12).fill(0),
    };

    contractPackages.forEach((cp) => {
      const cpData = matrix[cp];
      for (let month = 0; month < 12; month++) {
        totals.land[month] += cpData.lot[month];
        totals.structure[month] += cpData.structure[month];
      }
    });

    for (let month = 0; month < 12; month++) {
      const taxLand = totals.land[month] * 0.10;
      const demoStructure = totals.structure[month] * 0.30;
      const subTotal = totals.land[month] + totals.structure[month] + taxLand + demoStructure;
      const contingency = subTotal * 0.05;
      totals.grandTotal[month] = subTotal + contingency;
    }

    return totals.grandTotal.reduce((a, b) => a + b, 0);
  }, [filteredData]);

  // Dynamic YAxis Max rounding to sync estimation with actual Recharts scale
  const cumulativeYMax = 2014;

  // Dynamic non-overlapping cumulative progress label positioning helper
  const getSpacedYForIndex = React.useCallback((index: number) => {
    const row = cumulativeData[index];
    if (!row) return {};

    const chartHeight = 540; // 600 height - 40 top (offset) - 20 bottom (offset)
    const topPadding = 40;   // top margin

    const getEstimatedY = (val: number) => {
      return topPadding + chartHeight * (1 - val / 2014);
    };

    const candidates = [
      { key: 'total', val: row.total, order: 2 },
      { key: 'acquired', val: row.acquired, order: 1 }
    ];

    const activeItems = candidates
      .filter(item => activeSeries[item.key as keyof typeof activeSeries] && item.val !== undefined)
      .map(item => {
        // Position labels 10px above their actual point by default
        const originalY = getEstimatedY(item.val as number) - 10;
        return {
          key: item.key,
          val: item.val as number,
          originalY,
          spacedY: originalY,
          order: item.order
        };
      });

    // Sort by originalY ascending (top of the canvas to bottom of the canvas)
    activeItems.sort((a, b) => {
      if (Math.abs(a.originalY - b.originalY) > 0.1) {
        return a.originalY - b.originalY;
      }
      return b.order - a.order;
    });

    const minDistance = 16;
    for (let i = 1; i < activeItems.length; i++) {
      const prev = activeItems[i - 1];
      const curr = activeItems[i];
      if (curr.spacedY - prev.spacedY < minDistance) {
        curr.spacedY = prev.spacedY + minDistance;
      }
    }

    // Bottom out checking
    const maxAllowedY = topPadding + chartHeight - 10;
    if (activeItems.length > 0 && activeItems[activeItems.length - 1].spacedY > maxAllowedY) {
      activeItems[activeItems.length - 1].spacedY = maxAllowedY;
      for (let i = activeItems.length - 2; i >= 0; i--) {
        if (activeItems[i + 1].spacedY - activeItems[i].spacedY < minDistance) {
          activeItems[i].spacedY = activeItems[i + 1].spacedY - minDistance;
        }
      }
    }

    // Top out checking
    const minAllowedY = topPadding + 10;
    if (activeItems.length > 0 && activeItems[0].spacedY < minAllowedY) {
      activeItems[0].spacedY = minAllowedY;
      for (let i = 1; i < activeItems.length; i++) {
        if (activeItems[i].spacedY - activeItems[i - 1].spacedY < minDistance) {
          activeItems[i].spacedY = activeItems[i - 1].spacedY + minDistance;
        }
      }
    }

    const result: Record<string, { originalY: number; spacedY: number; shift: number }> = {};
    activeItems.forEach(item => {
      result[item.key] = {
        originalY: item.originalY,
        spacedY: item.spacedY,
        shift: item.spacedY - item.originalY
      };
    });

    return result;
  }, [cumulativeData, activeSeries]);

  const CustomCumulativeLabel = React.useCallback((props: any) => {
    const { x, y, width, height, value, index, dataKey } = props;
    if (y === undefined || index === undefined || value === undefined) return null;

    const config: Record<string, { color: string; labelColor: string }> = {
      total: { color: '#2596be', labelColor: '#2596be' },
      paid: { color: '#e87331', labelColor: '#ffffff' },
      pte: { color: '#a02b93', labelColor: '#ffffff' },
      cno: { color: '#0f9ed5', labelColor: '#ffffff' },
      acquired: { color: '#dc2626', labelColor: '#dc2626' },
    };

    const style = config[dataKey] || { color: '#64748b', labelColor: '#64748b' };

    // Check if it's one of the stacked Bar series
    if (dataKey === 'paid' || dataKey === 'pte' || dataKey === 'cno') {
      // Only display non-zero values for bars to avoid clutter
      if (Number(value) === 0) return null;
      if (width === undefined || height === undefined) return null;
      
      // Center inside the bar segment
      const cx = x + width / 2;
      const cy = y + height / 2;
      
      // If the bar height is too small, don't render to avoid overflow
      if (Math.abs(height) < 12) return null;

      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#ffffff"
          fontSize={10}
          fontWeight={800}
          className="select-none font-sans font-bold"
        >
          {value}
        </text>
      );
    }

    // Otherwise, it's a Line series (total or acquired)
    const dataItem = cumulativeData[index];
    const hasStackedBar = dataItem && (
      ((dataItem.paid ?? 0) > 0) ||
      ((dataItem.pte ?? 0) > 0) ||
      ((dataItem.cno ?? 0) > 0) ||
      (dataItem.acquired !== undefined && dataItem.acquired > 0)
    );

    if (dataKey === 'total' && hasStackedBar) {
      // Shifting total label of "No. of Private Lots" horizontally and vertically to avoid overlapping other labels and bars.
      // This matches Image 2 cleanly.
      const labelX = x + 24;
      const labelY = y + 14;
      return (
        <g>
          {/* Solid Dot on Chart Nodes - filled with the line's color */}
          <circle cx={x} cy={y} r={2} fill={style.color} stroke="#ffffff" strokeWidth={1} />

          {/* Thin leader line from dot to shifted label */}
          <line
            x1={x + 3}
            y1={y + 1}
            x2={labelX - 10}
            y2={labelY - 2}
            stroke="#94a3b8"
            strokeWidth={1}
            strokeDasharray="2 2"
          />

          {/* Clean bold label positioned in the gap between bars */}
          <g transform={`translate(${labelX}, ${labelY})`}>
            <text
              x={0}
              y={2}
              textAnchor="middle"
              fill={style.labelColor}
              fontSize={9.5}
              fontWeight={800}
              className="select-none font-sans font-extrabold"
              stroke="#ffffff"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              {value}
            </text>
          </g>
        </g>
      );
    }

    const isCumulativeSlanted = getShouldSlant(cumulativeData, maximizedPanel === 'cumulative' ? 1400 : 1100);

    const spacingInfo = getSpacedYForIndex(index);
    const info = spacingInfo[dataKey];
    if (!info) return null;

    const shift = info.shift;
    // Align with our vertical spacing index, but force below the line/dot if the value is 0
    let labelY = y - 10 + shift;
    if (Number(value) === 0) {
      labelY = y + 16;
    }

    return (
      <g>
        {/* Solid Dot on Chart Nodes - filled with the line's color */}
        <circle cx={x} cy={y} r={dataKey === 'total' ? 3 : 4.5} fill={style.color} stroke="#ffffff" strokeWidth={dataKey === 'total' ? 1 : 1.5} />

        {/* Clean bold label without background bounding box or leader lines */}
        <g transform={`translate(${x}, ${labelY})`}>
          <text
            x={0}
            y={2}
            textAnchor="middle"
            transform={undefined}
            fill={style.labelColor}
            fontSize={9.5}
            fontWeight={800}
            className="select-none font-sans font-extrabold"
            stroke="#ffffff"
            strokeWidth={2.5}
            paintOrder="stroke"
          >
            {value}
          </text>
        </g>
      </g>
    );
  }, [getSpacedYForIndex]);

  const handleDownloadList = async (label: string) => {
    let listToDownload: LotData[] = [];
    switch (label) {
      case "Total Lot":
      case "Total Lots":
      case "Total Lots / Lot ID NO":
      case "TOTAL LOTS":
      case "LOT ID NO":
        listToDownload = filteredData;
        break;
      case "NoT Issued":
        listToDownload = filteredData.filter(d => isValidDateValue(d.dateNot));
        break;
      case "Issued RfD/OTB/OtC":
        listToDownload = filteredData.filter(d => isValidDateValue(d.dateOtb));
        break;
      case "Accepted RfD/OTB/OtC":
        listToDownload = filteredData.filter(d => normalizeText(d.otbReply).includes("ACCEPTED") || normalizeText(d.rfdReply).includes("ACCEPTED"));
        break;
      case "30 days Review RfD/OTB/OtC":
        listToDownload = filteredData.filter(d => normalizeText(d.otbReply).includes("30 DAYS REVIEW") || normalizeText(d.rfdReply).includes("30 DAYS REVIEW"));
        break;
      case "Incurable RfD/OTB/OtC":
        listToDownload = filteredData.filter(d => normalizeText(d.otbReply).includes("INCURABLE") || normalizeText(d.rfdReply).includes("INCURABLE"));
        break;
      case "Rejected RfD/OTB/OtC":
        listToDownload = filteredData.filter(d => normalizeText(d.otbReply).includes("REJECT") || normalizeText(d.rfdReply).includes("REJECT"));
        break;
      case "DOAS":
        listToDownload = filteredData.filter(d => normalizeText(d.statusDoas).includes("SIGNED"));
        break;
      case "EJSEAS":
        listToDownload = filteredData.filter(d => normalizeText(d.statusDoas).includes("EJSEAS"));
        break;
      case "PTE":
        listToDownload = filteredData.filter(d => normalizeText(d.statusPte).includes("SIGNED"));
        break;
      case "Partial Paid":
        listToDownload = filteredData.filter(d => {
          const val = normalizeText(d.paymentStatus);
          return val.includes("PARTIALLY PAID") || val.includes("PAID WITH WOP");
        });
        break;
      case "Fully Paid":
        listToDownload = filteredData.filter(d => normalizeText(d.paymentStatus).includes("FULLY PAID"));
        break;
      case "Handed Over":
        listToDownload = filteredData.filter(d => isValidDateValue(d.dateHo));
        break;
      case "CNO":
        listToDownload = filteredData.filter(d => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("CNO"));
        break;
      case "MOA":
        listToDownload = filteredData.filter(d => isValidDateValue(d.dateCno) && normalizeText(d.withCnoMoa).includes("MOA"));
        break;
      case "Paid Crops":
        listToDownload = filteredData.filter(d => d.advancePaymentDate.trim() !== "");
        break;
      default:
        listToDownload = filteredData;
    }

    if (!listToDownload || listToDownload.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      // Clean sheet name of invalid characters as required by Excel JS
      const sheetName = label.substring(0, 30).replace(/[:\\/?*[\]]/g, "_") || "Sheet1";
      const worksheet = workbook.addWorksheet(sheetName);

      // Freeze Pane: Freeze the first row (the header row)
      worksheet.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2' }
      ];

      const cleanNumberValue = (val: any) => {
        if (val === null || val === undefined) return "";
        const cleanStr = String(val).replace(/,/g, "").trim();
        if (cleanStr === "") return "";
        const doubleVal = parseFloat(cleanStr);
        return isNaN(doubleVal) ? val : doubleVal;
      };

      const activeCols = new Set(Array.from({ length: 33 }, (_, i) => i + 1));

      const headers = Array(33).fill(undefined);
      
      const colMappings = [
        { col: 1, label: "Lot ID No.", resolver: (d: LotData) => d.lotId || "" },
        { col: 2, label: "CP", resolver: (d: LotData) => d.cp || "" },
        { col: 3, label: "Nearest Pier", resolver: (d: LotData) => d.pierNo || "" },
        { col: 4, label: "Mode of Acquisition", resolver: (d: LotData) => d.modeAcquisition || "" },
        { col: 5, label: "Registered Owner", resolver: (d: LotData) => d.ownerName || "" },
        { col: 6, label: "LGU", resolver: (d: LotData) => d.lgu || "" },
        { col: 7, label: "Zone", resolver: (d: LotData) => d.zone || "" },
        { col: 8, label: "Owners Classification", resolver: (d: LotData) => d.ownerClassification || "" },
        { col: 9, label: "Station Impact", resolver: (d: LotData) => d.station || "" },
        { col: 10, label: "PROW Impact", resolver: (d: LotData) => d.prowImpact || "" },
        { col: 11, label: "Optimization Lots Cases", resolver: (d: LotData) => d.optimizationCases || d.harmonization || "" },
        { col: 12, label: "NoT Status", resolver: (d: LotData) => d.statusNot || "" },
        { col: 13, label: "Date NoT Issued", resolver: (d: LotData) => d.dateNot || "" },
        { col: 14, label: "OTB Status", resolver: (d: LotData) => d.statusOtb || "" },
        { col: 15, label: "Date OTB Issued", resolver: (d: LotData) => d.dateOtb || "" },
        { col: 16, label: "OTB Reply by LO", resolver: (d: LotData) => d.otbReply || "" },
        { col: 17, label: "Date of LO Reply", resolver: (d: LotData) => d.otbReplyDate || d.rfdReplyDate || "" },
        { col: 18, label: "DoAS Status", resolver: (d: LotData) => d.statusDoas || "" },
        { col: 19, label: "Date DoAS Signed", resolver: (d: LotData) => d.dateDoas || "" },
        { col: 20, label: "Date PTE Signed", resolver: (d: LotData) => d.datePte || "" },
        { col: 21, label: "Payment Status", resolver: (d: LotData) => d.paymentStatus || "" },
        { col: 22, label: "Date of Payment", resolver: (d: LotData) => d.datePaid || "" },
        { col: 23, label: "Date of Handed Over Lot", resolver: (d: LotData) => d.dateHo || "" },
        { col: 24, label: "Date MOA / CNO", resolver: (d: LotData) => d.dateCno || "" },
        { col: 25, label: "Total Area per sqm", resolver: (d: LotData) => cleanNumberValue(d.totalArea) },
        { col: 26, label: "Total Affected Area per sqm", resolver: (d: LotData) => cleanNumberValue(d.affectedArea) },
        { col: 27, label: "Land Acquisition Status", resolver: (d: LotData) => d.overallSad || "" },
        { col: 28, label: "Land Acquisition (with EVA) Affected Area per sqm", resolver: (d: LotData) => {
          const status = (d.overallSad || "").trim().toUpperCase();
          if (status === "FULL") {
            return cleanNumberValue(d.totalArea);
          } else {
            return cleanNumberValue(d.affectedArea);
          }
        }},
        { col: 29, label: "Estimated Land Cost", resolver: (d: LotData) => cleanNumberValue(d.estimatedLandCost) },
        { col: 30, label: "Estimated Structure Cost", resolver: (d: LotData) => cleanNumberValue(d.estimatedStructureCost) },
        { col: 31, label: "Actual Offer Land Cost", resolver: (d: LotData) => cleanNumberValue(d.actualLandCost) },
        { col: 32, label: "Actual Offer Structure Cost", resolver: (d: LotData) => cleanNumberValue(d.actualStructureCost) },
        { col: 33, label: "Current Status", resolver: (d: LotData) => d.currentStatus || "" },
        { col: 34, label: "Acquired Lots (Col BS)", resolver: (d: LotData) => d.acquiredLots || "" }
      ];

      colMappings.forEach(m => {
        headers[m.col - 1] = m.label;
      });

      worksheet.addRow(headers);

      // Map labels to match active color themes
      const colorMap: Record<string, string> = {
        "Total Lot": "2596BE",
        "Total Lots": "2596BE",
        "Total Lots / Lot ID NO": "2596BE",
        "TOTAL LOTS": "2596BE",
        "LOT ID NO": "2596BE",
        "NoT Issued": "64748B",
        "Issued RfD/OTB/OtC": "E87331",
        "Accepted RfD/OTB/OtC": "E87331",
        "30 days Review RfD/OTB/OtC": "A02B93",
        "Incurable RfD/OTB/OtC": "DC2626",
        "Rejected RfD/OTB/OtC": "BD0707",
        "DOAS": "112BBC",
        "EJSEAS": "112BBC",
        "PTE": "A02B93",
        "Partial Paid": "E87331",
        "Fully Paid": "16A34A",
        "Handed Over": "239694",
        "CNO": "0F9ED5",
        "MOA": "0F9ED5",
        "Paid Crops": "187F05",
      };

      const themeHex = colorMap[label] || "1E3A8A";
      const headerBgColor = `FF${themeHex}`;

      // Style Header row
      const headerRow = worksheet.getRow(1);
      headerRow.height = 26;
      headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
        if (!activeCols.has(colNum)) {
          // Keep spacer headers completely unstyled and clean
          return;
        }
        cell.font = { 
          name: 'Arial', 
          size: 10, 
          bold: true, 
          color: { argb: 'FFFFFFFF' } // White header text
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerBgColor } 
        };
        cell.alignment = { 
          horizontal: 'left', 
          vertical: 'middle', 
          wrapText: true 
        };
        cell.border = {
          bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        };
      });

      listToDownload.forEach((d) => {
        const rowValues = Array(33).fill(undefined);
        colMappings.forEach(m => {
          rowValues[m.col - 1] = m.resolver(d);
        });
        worksheet.addRow(rowValues);
      });

      // Style Data Rows (Starting from Row 2)
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip styling headers again
        row.height = 24; // Balanced height
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          if (!activeCols.has(colNum)) {
            // Keep spacer columns completely border-free and blank
            return;
          }
          cell.font = { name: 'Arial', size: 9 };
          
          const isNumeric = [25, 26, 28, 29, 30, 31, 32].includes(colNum);
          cell.alignment = { 
            horizontal: isNumeric ? 'right' : 'left', 
            vertical: 'middle',
            wrapText: true // Enable wrapping
          };
          cell.border = {
            bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
            right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
          };

          // Format as Peso Currency for Cost Columns or plain decimals for area columns
          if (typeof cell.value === "number") {
            if ([29, 30, 31, 32].includes(colNum)) {
              cell.numFmt = "₱#,##0.00";
            } else if ([25, 26, 28].includes(colNum)) {
              cell.numFmt = "#,##0.00";
            }
          }
        });
      });

      // Fit column widths elegantly
      for (let i = 1; i <= 33; i++) {
        const col = worksheet.getColumn(i);
        let maxLen = 0;
        col.eachCell?.({ includeEmpty: true }, (cell) => {
          const valStr = cell.value ? String(cell.value) : "";
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        });
        if (maxLen > 0) {
          col.width = Math.min(Math.max(maxLen + 4, 12), 35);
        } else {
          col.width = 12;
        }
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      const formattedDate = format(new Date(), "yyyy-MM-dd");
      const sanitizedLabel = label.replace(/[\s/\\:*?"<>|]+/g, "_");
      link.setAttribute("download", `${sanitizedLabel}_List_${formattedDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate Excel file", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4 animate-pulse">
        <TrendingUp className="w-12 h-12 text-blue-500 opacity-50" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Analytics Intelligence...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Database className="w-12 h-12 text-slate-200" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No data records found in the database.</p>
      </div>
    );
  }

  return (
    <div id="dashboard-report-content" className="space-y-8 pb-4 relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 -z-10 w-[500px] h-[500px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] left-0 -z-10 w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Hero Header */}
      <motion.div 
        id="tour-welcome"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-slate-900/20 transition-all duration-300",
          tourActive && tourStep === 0 && "ring-4 ring-brand-500 ring-offset-4 ring-offset-slate-950 scale-[1.01] z-[40]"
        )}
      >
        {/* Background team photo or default GCR consortium banner */}
        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-[2.5rem] select-none">
          {/* Gradient overlay for excellent text readability on the left */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/75 to-transparent z-10" />
          <img 
            src={teamPhoto || defaultBanner} 
            alt="GCR RAP Team" 
            className="w-full h-full object-cover object-center opacity-45 select-none pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Interaction mode trigger toggle - absolute top-right position */}
        <div className="absolute top-6 right-6 md:top-8 md:right-8 z-20 flex flex-col items-end gap-2" data-html2canvas-ignore="true">
          {/* Guide Tour Launcher Button */}
          <button
            type="button"
            onClick={() => {
              setTourStep(0);
              setTourActive(true);
              setTimeout(() => {
                const element = document.getElementById("tour-welcome");
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 50);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white border border-brand-400/20 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md shadow-brand-500/10 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Guide Tour</span>
          </button>

          <div 
            id="tour-interaction-modes"
            className={cn(
              "flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-2xl border border-slate-800/80 shadow-md backdrop-blur-md transition-all duration-300",
              tourActive && tourStep === 1 && "ring-4 ring-brand-500 ring-offset-2 scale-105 z-[45]"
            )}
          >
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-2.5">Trigger:</span>
            <div className="relative group/hover-btn">
              <button
                type="button"
                onClick={() => setInteractionMode('hover')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1",
                  interactionMode === 'hover' 
                    ? "bg-brand-500 text-white shadow-md font-black" 
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                Hover
              </button>
              {/* Tooltip for Hover */}
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-xl opacity-0 pointer-events-none group-hover/hover-btn:opacity-100 group-hover/hover-btn:pointer-events-auto transition-all duration-200 z-50 text-slate-300 text-[10px] leading-relaxed text-left">
                <p className="font-extrabold text-white uppercase tracking-wider mb-1 text-[9px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  Hover Interactivity
                </p>
                Simply move your cursor over any dashboard statistic card or progress grid cell to instantly reveal a live breakdown of lot accomplishments.
              </div>
            </div>

            <div className="relative group/click-btn">
              <button
                type="button"
                onClick={() => setInteractionMode('click')}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1",
                  interactionMode === 'click' 
                    ? "bg-brand-500 text-white shadow-md font-black" 
                    : "text-slate-400 hover:text-slate-200"
                )}
              >
                Double Click
              </button>
              {/* Tooltip for Double Click */}
              <div className="absolute right-0 top-full mt-2 w-72 bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-xl opacity-0 pointer-events-none group-hover/click-btn:opacity-100 group-hover/click-btn:pointer-events-auto transition-all duration-200 z-50 text-slate-300 text-[10px] leading-relaxed text-left">
                <p className="font-extrabold text-white uppercase tracking-wider mb-1 text-[9px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  Double-Click Interactivity
                </p>
                Double-click on any stat card or matrix data cell to toggle and lock the detailed lot breakdown window. Single-click displays a quick guidance tip.
              </div>
            </div>
          </div>
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mr-2 select-none animate-pulse">Double-click cards to toggle breakdown</span>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/40">
                  <TrendingUp className="w-6 h-6 text-white" />
               </div>
               <div>
                 <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight font-display">SCLA Analytics</h1>
                 <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Real-time Acquisition Data Hub</p>
                 </div>
               </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm max-w-2xl font-medium leading-relaxed">
            Monitor land acquisition progress, expropriation milestones, and expenditure tracking with precision. 
            All values are subject to finalized validation.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{data.length} Total Records</span>
            </div>
            <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Last Updated: {format(new Date(), "MMM dd, yyyy")}</span>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* Search & Filters Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full relative"
          data-html2canvas-ignore="true"
        >
          <label className={cn("text-[9px] font-black uppercase tracking-[0.2em] mb-1 block px-1", activeTheme?.isDark ? "text-slate-400" : "text-slate-450")}>
            Property Search
          </label>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="flex-1 w-full relative group">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search Lot ID..." 
                  className={cn(
                    "w-full pl-8.5 pr-4 py-1.5 border rounded-xl shadow-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-xs",
                    activeTheme?.isDark 
                      ? "bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500" 
                      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  )}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Removed upper Date Filter button */}
            <div className="relative shrink-0 z-30">

              <AnimatePresence>
                {isDatePopupOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsDatePopupOpen(false)} />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className={cn(
                        "absolute right-0 top-full mt-2 w-[320px] border rounded-[2rem] p-5 shadow-2xl z-40 flex flex-col gap-4 text-left select-none",
                        activeTheme?.isDark 
                          ? "bg-slate-900 border-slate-800 text-slate-100" 
                          : "bg-white border-slate-200 text-slate-900"
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-brand-500" />
                          <h4 className="text-xs font-black tracking-wider uppercase">Date Range Filter</h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDatePopupOpen(false)}
                          className="p-1 hover:bg-slate-800/10 dark:hover:bg-slate-850 rounded-lg text-slate-400 cursor-pointer"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Grouping Filter Type Tabs (Presets, Year, Quarter, Month) */}
                      <div className="flex border rounded-xl p-0.5 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-850">
                        {(['presets', 'year', 'quarter', 'month'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPresetType(t)}
                            className={cn(
                              "flex-1 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all cursor-pointer",
                              presetType === t
                                ? (activeTheme?.isDark ? "bg-slate-800 text-brand-400 shadow" : "bg-white text-brand-600 shadow-sm")
                                : "text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {/* Presets Panel */}
                      {presetType === 'presets' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 'all', label: 'All Time' },
                              { id: 'this-year', label: 'This Year' },
                              { id: 'last-year', label: 'Last Year' },
                              { id: 'last-12m', label: 'Last 12 Mo.' },
                              { id: 'last-6m', label: 'Last 6 Mo.' },
                            ].map(preset => (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setDatePreset(preset.id);
                                  const now = new Date();
                                  const pad = (n: number) => n.toString().padStart(2, '0');
                                  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

                                  if (preset.id === 'all') {
                                    if (dataDateBounds.min && dataDateBounds.max) {
                                      setStartDateStr(dataDateBounds.min);
                                      setEndDateStr(dataDateBounds.max);
                                    }
                                  } else if (preset.id === 'this-year') {
                                    const start = new Date(now.getFullYear(), 0, 1);
                                    setStartDateStr(formatYMD(start));
                                    setEndDateStr(formatYMD(now));
                                  } else if (preset.id === 'last-year') {
                                    const start = new Date(now.getFullYear() - 1, 0, 1);
                                    const end = new Date(now.getFullYear() - 1, 11, 31);
                                    setStartDateStr(formatYMD(start));
                                    setEndDateStr(formatYMD(end));
                                  } else if (preset.id === 'last-12m') {
                                    const start = new Date(now);
                                    start.setMonth(now.getMonth() - 12);
                                    setStartDateStr(formatYMD(start));
                                    setEndDateStr(formatYMD(now));
                                  } else if (preset.id === 'last-6m') {
                                    const start = new Date(now);
                                    start.setMonth(now.getMonth() - 6);
                                    setStartDateStr(formatYMD(start));
                                    setEndDateStr(formatYMD(now));
                                  }
                                }}
                                className={cn(
                                  "px-2 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer",
                                  datePreset === preset.id
                                    ? (activeTheme?.isDark ? "bg-brand-500 border-brand-500 text-white" : "bg-brand-600 border-brand-600 text-white")
                                    : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850 hover:text-slate-200" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                                )}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Year Selection Panel */}
                      {presetType === 'year' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="grid grid-cols-3 gap-1.5">
                            {availableYears.map(yr => {
                              const isSelected = startDateStr === `${yr}-01-01` && endDateStr === `${yr}-12-31`;
                              return (
                                <button
                                  key={yr}
                                  type="button"
                                  onClick={() => {
                                    setStartDateStr(`${yr}-01-01`);
                                    setEndDateStr(`${yr}-12-31`);
                                    setDatePreset(`year-${yr}`);
                                  }}
                                  className={cn(
                                    "px-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer",
                                    isSelected
                                      ? (activeTheme?.isDark ? "bg-brand-500 border-brand-500 text-white" : "bg-brand-600 border-brand-600 text-white")
                                      : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850 hover:text-slate-200" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                                  )}
                                >
                                  {yr}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Quarter Selection Panel */}
                      {presetType === 'quarter' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Year</span>
                            <select
                              value={selectedFilterYear}
                              onChange={(e) => setSelectedFilterYear(Number(e.target.value))}
                              className={cn(
                                "px-2 py-1 rounded-lg text-[9px] font-black uppercase border outline-none tracking-wider",
                                activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-150 text-slate-700"
                              )}
                            >
                              {availableYears.map(yr => (
                                <option key={yr} value={yr}>{yr}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1.5">
                            {[
                              { id: 1, label: 'Q1 (Jan-Mar)', start: '01-01', end: '03-31' },
                              { id: 2, label: 'Q2 (Apr-Jun)', start: '04-01', end: '06-30' },
                              { id: 3, label: 'Q3 (Jul-Sep)', start: '07-01', end: '09-30' },
                              { id: 4, label: 'Q4 (Oct-Dec)', start: '10-01', end: '12-31' },
                            ].map(q => {
                              const qStart = `${selectedFilterYear}-${q.start}`;
                              const qEnd = `${selectedFilterYear}-${q.end}`;
                              const isSelected = startDateStr === qStart && endDateStr === qEnd;
                              return (
                                <button
                                  key={q.id}
                                  type="button"
                                  onClick={() => {
                                    setStartDateStr(qStart);
                                    setEndDateStr(qEnd);
                                    setSelectedFilterQuarter(q.id);
                                    setDatePreset(`q${q.id}-${selectedFilterYear}`);
                                  }}
                                  className={cn(
                                    "px-2 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer",
                                    isSelected
                                      ? (activeTheme?.isDark ? "bg-brand-500 border-brand-500 text-white" : "bg-brand-600 border-brand-600 text-white")
                                      : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850 hover:text-slate-200" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                                  )}
                                >
                                  {q.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Month Selection Panel */}
                      {presetType === 'month' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target Year</span>
                            <select
                              value={selectedFilterYear}
                              onChange={(e) => setSelectedFilterYear(Number(e.target.value))}
                              className={cn(
                                "px-2 py-1 rounded-lg text-[9px] font-black uppercase border outline-none tracking-wider",
                                activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-150 text-slate-700"
                              )}
                            >
                              {availableYears.map(yr => (
                                <option key={yr} value={yr}>{yr}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
                            {[
                              { name: 'Jan', index: 0 }, { name: 'Feb', index: 1 }, { name: 'Mar', index: 2 },
                              { name: 'Apr', index: 3 }, { name: 'May', index: 4 }, { name: 'Jun', index: 5 },
                              { name: 'Jul', index: 6 }, { name: 'Aug', index: 7 }, { name: 'Sep', index: 8 },
                              { name: 'Oct', index: 9 }, { name: 'Nov', index: 10 }, { name: 'Dec', index: 11 },
                            ].map(m => {
                              const pad = (n: number) => n.toString().padStart(2, '0');
                              const mStart = `${selectedFilterYear}-${pad(m.index + 1)}-01`;
                              const lastDay = new Date(selectedFilterYear, m.index + 1, 0).getDate();
                              const mEnd = `${selectedFilterYear}-${pad(m.index + 1)}-${pad(lastDay)}`;
                              const isSelected = startDateStr === mStart && endDateStr === mEnd;
                              
                              return (
                                <button
                                  key={m.index}
                                  type="button"
                                  onClick={() => {
                                    setStartDateStr(mStart);
                                    setEndDateStr(mEnd);
                                    setSelectedFilterMonth(m.index);
                                    setDatePreset(`m${m.index + 1}-${selectedFilterYear}`);
                                  }}
                                  className={cn(
                                    "px-1.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border text-center cursor-pointer",
                                    isSelected
                                      ? (activeTheme?.isDark ? "bg-brand-500 border-brand-500 text-white" : "bg-brand-600 border-brand-600 text-white")
                                      : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850 hover:text-slate-200" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100 hover:text-slate-900")
                                  )}
                                >
                                  {m.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Sliding Date Range Bar (Dual-Range Slider) */}
                      {(() => {
                        const minTime = dataDateBounds.minDate?.getTime() || new Date(2021, 0, 1).getTime();
                        const maxTime = dataDateBounds.maxDate?.getTime() || new Date(2026, 11, 31).getTime();

                        const currentTimeStart = (() => {
                          const d = new Date(startDateStr);
                          return !isNaN(d.getTime()) ? d.getTime() : minTime;
                        })();

                        const currentTimeEnd = (() => {
                          const d = new Date(endDateStr);
                          return !isNaN(d.getTime()) ? d.getTime() : maxTime;
                        })();

                        const leftPercent = maxTime === minTime ? 0 : ((currentTimeStart - minTime) / (maxTime - minTime)) * 100;
                        const rightPercent = maxTime === minTime ? 100 : ((currentTimeEnd - minTime) / (maxTime - minTime)) * 100;

                        const formatPrettyDate = (dateStr: string) => {
                          if (!dateStr) return "N/A";
                          const d = new Date(dateStr);
                          if (isNaN(d.getTime())) return dateStr;
                          return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                        };

                        return (
                          <div className="flex flex-col gap-2 border-t border-b border-slate-100 dark:border-slate-850/60 py-3 mt-1">
                            <div className="flex flex-col gap-0.5">
                              <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sliding Date Range</label>
                              <div className="text-[10px] font-black font-mono text-brand-500 dark:text-brand-400 bg-brand-500/5 dark:bg-brand-400/5 px-2 py-1 rounded-xl text-center border border-brand-500/10">
                                {formatPrettyDate(startDateStr)} - {formatPrettyDate(endDateStr)}
                              </div>
                            </div>

                            <div className="relative h-6 flex items-center select-none mt-1">
                              {/* Track Background */}
                              <div className="absolute left-0 right-0 h-1.5 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200/40 dark:border-slate-850 pointer-events-none" />
                              
                              {/* Selected Active Range Track */}
                              <div 
                                className="absolute h-1.5 rounded-full bg-brand-500 pointer-events-none"
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${rightPercent - leftPercent}%`
                                }}
                              />
                              
                              {/* Left Range Input Slider */}
                              <input 
                                type="range"
                                min={minTime}
                                max={maxTime}
                                step={86400000}
                                value={currentTimeStart}
                                onChange={(e) => {
                                  const val = Math.min(Number(e.target.value), currentTimeEnd - 86400000);
                                  const d = new Date(val);
                                  const pad = (n: number) => n.toString().padStart(2, '0');
                                  setStartDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                  setDatePreset('custom');
                                }}
                                className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none outline-none z-10
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-125
                                  [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:active:scale-125"
                              />
                              
                              {/* Right Range Input Slider */}
                              <input 
                                type="range"
                                min={minTime}
                                max={maxTime}
                                step={86400000}
                                value={currentTimeEnd}
                                onChange={(e) => {
                                  const val = Math.max(Number(e.target.value), currentTimeStart + 86400000);
                                  const d = new Date(val);
                                  const pad = (n: number) => n.toString().padStart(2, '0');
                                  setEndDateStr(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                                  setDatePreset('custom');
                                }}
                                className="absolute w-full h-1.5 appearance-none bg-transparent pointer-events-none outline-none z-20
                                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-125
                                  [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-500 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:transition-transform [&::-moz-range-thumb]:active:scale-125"
                              />
                            </div>
                            
                            <div className="flex justify-between items-center text-[7.5px] text-slate-400 font-extrabold uppercase tracking-wide">
                              <span>Min: {formatPrettyDate(dataDateBounds.min)}</span>
                              <span>Max: {formatPrettyDate(dataDateBounds.max)}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Manual From & To Date Pickers */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">From Date</label>
                          <input 
                            type="date"
                            value={startDateStr}
                            min={dataDateBounds.min}
                            max={dataDateBounds.max}
                            onChange={(e) => {
                              setStartDateStr(e.target.value);
                              setDatePreset('custom');
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded-xl text-[10px] font-bold border outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500",
                              activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-150 text-slate-800"
                            )}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">To Date</label>
                          <input 
                            type="date"
                            value={endDateStr}
                            min={dataDateBounds.min}
                            max={dataDateBounds.max}
                            onChange={(e) => {
                              setEndDateStr(e.target.value);
                              setDatePreset('custom');
                            }}
                            className={cn(
                              "w-full px-2.5 py-1.5 rounded-xl text-[10px] font-bold border outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500",
                              activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-200" : "bg-slate-50 border-slate-150 text-slate-800"
                            )}
                          />
                        </div>
                      </div>

                      {/* Filter Basis (Radio Buttons) */}
                      <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Filter Applied To</label>
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDateRangeMode('latest')}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-extrabold uppercase tracking-wider text-left transition-all cursor-pointer w-full",
                              dateRangeMode === 'latest'
                                ? (activeTheme?.isDark ? "bg-brand-950/30 border-brand-500 text-brand-400" : "bg-brand-50 border-brand-500 text-brand-700")
                                : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100")
                            )}
                          >
                            <div className={cn("w-2 h-2 rounded-full", dateRangeMode === 'latest' ? "bg-brand-500" : "bg-slate-400")} />
                            Latest Milestone Date
                          </button>

                          <button
                            type="button"
                            onClick={() => setDateRangeMode('any')}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-extrabold uppercase tracking-wider text-left transition-all cursor-pointer w-full",
                              dateRangeMode === 'any'
                                ? (activeTheme?.isDark ? "bg-brand-950/30 border-brand-500 text-brand-400" : "bg-brand-50 border-brand-500 text-brand-700")
                                : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100")
                            )}
                          >
                            <div className={cn("w-2 h-2 rounded-full", dateRangeMode === 'any' ? "bg-brand-500" : "bg-slate-400")} />
                            Any Milestone Date
                          </button>

                          <button
                            type="button"
                            onClick={() => setDateRangeMode('specific')}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-extrabold uppercase tracking-wider text-left transition-all cursor-pointer w-full",
                              dateRangeMode === 'specific'
                                ? (activeTheme?.isDark ? "bg-brand-950/30 border-brand-500 text-brand-400" : "bg-brand-50 border-brand-500 text-brand-700")
                                : (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-400 hover:bg-slate-850" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100")
                            )}
                          >
                            <div className={cn("w-2 h-2 rounded-full", dateRangeMode === 'specific' ? "bg-brand-500" : "bg-slate-400")} />
                            Specific Milestone
                          </button>
                        </div>

                        {dateRangeMode === 'specific' && (
                          <select
                            value={selectedSpecificMilestone}
                            onChange={(e) => setSelectedSpecificMilestone(e.target.value)}
                            className={cn(
                              "w-full px-3 py-2 rounded-xl text-[9px] font-black uppercase border outline-none tracking-wider",
                              activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-300" : "bg-slate-50 border-slate-150 text-slate-700"
                            )}
                          >
                            <option value="dateNot">Notice of Taking (NoT)</option>
                            <option value="dateOtb">Offer to Buy (OTB)</option>
                            <option value="dateDoas">Deed of Absolute Sale (DoAS)</option>
                            <option value="datePte">Permit to Enter (PTE)</option>
                            <option value="datePaid">Payment Date</option>
                            <option value="dateHo">Handed Over Date</option>
                            <option value="dateCno">CNO Date</option>
                          </select>
                        )}
                      </div>

                      {/* Statistics Panel inside Popup */}
                      <div className={cn(
                        "border rounded-2xl p-3 flex flex-col gap-2 mt-1",
                        activeTheme?.isDark ? "bg-slate-950/50 border-slate-850" : "bg-slate-50/50 border-slate-150"
                      )}>
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase text-slate-400">Filtered Lots</span>
                          <span className="text-[10px] font-black font-mono">{filteredData.length} / {data.length}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-brand-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${(filteredData.length / data.length) * 100}%` }}
                          />
                        </div>
                        <p className="text-[8px] font-extrabold text-slate-400 tracking-wide text-center leading-relaxed uppercase">
                          {data.length > 0 ? ((filteredData.length / data.length) * 100).toFixed(1) : 0}% fits date range.
                        </p>
                      </div>

                      {/* Reset Date range button */}
                      <button
                        type="button"
                        onClick={() => {
                          setDatePreset('all');
                          if (dataDateBounds.min && dataDateBounds.max) {
                            setStartDateStr(dataDateBounds.min);
                            setEndDateStr(dataDateBounds.max);
                          }
                        }}
                        className={cn(
                          "w-full py-2 border rounded-xl text-[9px] font-black uppercase tracking-wider text-center cursor-pointer mt-1 active:scale-95 transition-all",
                          activeTheme?.isDark
                            ? "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-400"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-150 text-slate-600"
                        )}
                      >
                        Reset Date range
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {(search || selectedStatusCard || (Object.values(filters) as string[][]).some(arr => (arr || []).length > 0)) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className={cn(
                  "px-5 py-3 border rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 active:scale-95 shadow-xs shrink-0",
                  activeTheme?.isDark 
                    ? "bg-slate-900/60 hover:bg-slate-850 text-slate-300 hover:text-slate-100 border-slate-800"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200"
                )}
              >
                Clear Search & Filters
              </button>
            )}
          </div>

          {matchedLot && (
            <div className="flex flex-wrap items-center gap-2 mt-2 px-0.5">
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 border rounded-xl text-xs font-semibold shadow-3xs",
                activeTheme?.isDark 
                  ? "bg-indigo-950/25 border-indigo-900/45 text-slate-300" 
                  : "bg-brand-50 border-brand-100/80 text-brand-800"
              )}>
                <span className={cn("text-[10px] font-black uppercase tracking-wider", activeTheme?.isDark ? "text-indigo-400" : "text-brand-600")}>Registered Owner:</span>
                <span className={cn("font-extrabold", activeTheme?.isDark ? "text-slate-100" : "text-slate-800")}>{matchedLot.ownerName || "N/A"}</span>
              </div>
              {recentUpdatesSet.has((matchedLot.lotId || "").toString().trim().toLowerCase()) && (
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold shadow-3xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                )}>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider">UPDATED IN LAST 24 HOURS</span>
                </div>
              )}
            </div>
          )}
        </motion.div>

      {/* Multi-Filters Bar */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-10 gap-2 w-full"
        data-html2canvas-ignore="true"
      >
        {(Object.keys(INITIAL_FILTERS) as Array<keyof typeof INITIAL_FILTERS>).map((key) => (
          <div key={key} className="relative w-full">
            <label className={cn("text-[8.5px] font-bold uppercase tracking-widest px-1 mb-0.5 block truncate", activeTheme?.isDark ? "text-slate-450" : "text-slate-500")}>
              {key === "cp" ? "CONTRACT PACKAGE" : key === "rapCp" ? "RAP CP (COL BQ)" : key === "harmonization" ? "OPTIMIZATION CASES" : key === "currentStatus" ? "CURRENT STATUS" : key === "modeAcquisition" ? "MODE OF ACQUISITION" : key === "rapLgu" ? "RAP LGU (COL BR)" : key === "lgu" ? "LGU" : (key as string).replace(/([A-Z])/g, ' $1').trim()}
            </label>
            <button 
              onClick={() => setActiveDropdown(activeDropdown === key ? null : key)}
              className={cn(
                "w-full px-2.5 py-1.5 border rounded-lg text-left truncate flex items-center justify-between transition-all font-bold text-[9.5px] shadow-xs",
                (filters[key] || []).length > 0 
                  ? (activeTheme?.isDark 
                      ? "border-brand-500 text-brand-400 bg-brand-950/20 ring-4 ring-brand-500/10" 
                      : "border-brand-500 text-brand-600 bg-brand-50/30 ring-4 ring-brand-500/5")
                  : (activeTheme?.isDark 
                      ? "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700" 
                      : "border-slate-200 text-slate-605 hover:border-slate-300")
              )}
            >
              <span className="truncate" title={(filters[key] || []).length === 0 ? "All" : (filters[key] || []).join(", ")}>
                {(filters[key] || []).length === 0 ? "All" : (filters[key] || []).join(", ")}
              </span>
              <ChevronDown className={cn("w-2.5 h-2.5 transition-transform opacity-40", activeDropdown === key && "rotate-180 opacity-100")} />
            </button>
            
            <AnimatePresence>
              {activeDropdown === key && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className={cn(
                       "absolute top-full left-0 mt-2 w-[220px] border rounded-2xl shadow-2xl z-50 p-2 max-h-[300px] overflow-y-auto custom-scrollbar",
                      activeTheme?.isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                    )}
                  >
                    <div className={cn(
                      "sticky top-0 pb-2 px-1 border-b mb-1 flex items-center justify-between",
                      activeTheme?.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-50"
                    )}>
                       <span className="text-[9px] font-black text-slate-400 uppercase">Select Options</span>
                       {(filters[key] || []).length > 0 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); clearFilterCategory(key); }}
                            className={cn("text-[9px] font-black uppercase tracking-wider hover:underline", activeTheme?.isDark ? "text-brand-400 hover:text-brand-350" : "text-brand-600 hover:text-brand-700")}
                          >
                            CLEAR
                          </button>
                       )}
                    </div>
                    {(options[key] || []).map((opt, optIdx) => (
                      <button
                        key={`${String(key)}-${String(opt)}-${optIdx}`}
                        onClick={() => toggleFilter(key, opt)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all mb-0.5",
                          (filters[key] || []).includes(opt) 
                            ? (activeTheme?.isDark ? "bg-indigo-950/40 text-indigo-300" : "bg-brand-50 text-brand-700") 
                            : (activeTheme?.isDark ? "hover:bg-slate-800/60 text-slate-300" : "hover:bg-slate-50 text-slate-600")
                        )}
                      >
                        {(filters[key] || []).includes(opt) ? (
                          <div className={cn("w-4 h-4 rounded flex items-center justify-center", activeTheme?.isDark ? "bg-brand-500" : "bg-brand-600")}>
                            <CheckSquare className="w-3.5 h-3.5 text-white" />
                          </div>
                        ) : (
                          <div className={cn("w-4 h-4 border rounded", activeTheme?.isDark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-white")} />
                        )}
                        <span className="text-[11px] font-bold uppercase truncate">{opt}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        ))}
      </motion.div>

      {/* Active Filter Chips with one-click removal */}
      {(() => {
        const activeEntries: Array<{ key: keyof typeof INITIAL_FILTERS; label: string; value: string }> = [];
        (Object.keys(INITIAL_FILTERS) as Array<keyof typeof INITIAL_FILTERS>).forEach(k => {
          const vals = filters?.[k] || [];
          vals.forEach(v => {
            const catLabel = k === "cp" ? "CP" : k === "rapCp" ? "RAP CP" : k === "harmonization" ? "Optimization" : k === "currentStatus" ? "Status" : k === "modeAcquisition" ? "Mode" : k === "rapLgu" ? "RAP LGU" : k === "lgu" ? "LGU" : (k as string).replace(/([A-Z])/g, ' $1').trim();
            activeEntries.push({ key: k, label: catLabel, value: v });
          });
        });

        if (activeEntries.length === 0 && !selectedStatusCard && !search.trim()) return null;

        return (
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 px-0.5" data-html2canvas-ignore="true">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-brand-500" />
              <span>Active:</span>
            </span>
            {search.trim() && (
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide border shadow-3xs transition-all",
                activeTheme?.isDark ? "bg-brand-950/40 border-brand-800 text-brand-300" : "bg-brand-50 border-brand-200 text-brand-700"
              )}>
                <span>Search: "{search.trim()}"</span>
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="hover:opacity-70 active:scale-90 p-0.5 transition-opacity cursor-pointer"
                  title="Remove search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedStatusCard && (
              <span className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide border shadow-3xs transition-all",
                activeTheme?.isDark ? "bg-amber-950/40 border-amber-800 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700"
              )}>
                <span>Card: {selectedStatusCard}</span>
                <button
                  type="button"
                  onClick={() => setSelectedStatusCard(null)}
                  className="hover:opacity-70 active:scale-90 p-0.5 transition-opacity cursor-pointer"
                  title="Remove KPI status card filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeEntries.map(({ key, label, value }) => (
              <span
                key={`${key}-${value}`}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide border shadow-3xs transition-all",
                  activeTheme?.isDark ? "bg-slate-800/90 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                )}
              >
                <span className="text-slate-400 font-bold">{label}:</span>
                <span className="truncate max-w-[150px]">{value}</span>
                <button
                  type="button"
                  onClick={() => removeFilterValue(key, value)}
                  className="hover:text-rose-500 active:scale-90 p-0.5 transition-colors cursor-pointer"
                  title={`Remove ${label}: ${value}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 hover:underline active:scale-95 transition-all ml-1 cursor-pointer"
            >
              Clear All ({activeEntries.length + (selectedStatusCard ? 1 : 0) + (search.trim() ? 1 : 0)})
            </button>
          </div>
        );
      })()}

      {/* Collapsible Premium Date Range Filter below the Multi-Filters Bar */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-3.5"
        data-html2canvas-ignore="true"
      >
        {/* Toggle Panel Bar */}
        <button
          type="button"
          onClick={() => setIsDateFilterExpanded(!isDateFilterExpanded)}
          className={cn(
            "w-full flex items-center justify-between px-5 py-3 border rounded-2xl transition-all shadow-xs active:scale-[0.99] cursor-pointer text-left font-black tracking-wider uppercase text-[11px]",
            isDateFilterExpanded
              ? (activeTheme?.isDark ? "bg-slate-900 border-brand-500/50 text-brand-400 ring-4 ring-brand-500/10" : "bg-brand-50 border-brand-200 text-brand-700 ring-4 ring-brand-500/5")
              : (activeTheme?.isDark ? "bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700" : "bg-white border-slate-200 text-slate-700 hover:border-slate-300")
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <Calendar className={cn("w-4 h-4", isDateFilterExpanded ? "text-brand-500" : "text-slate-400")} />
            <span>Date Range Filter:</span>
            <span className={cn(
              "px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-normal uppercase border",
              datePreset === 'all'
                ? (activeTheme?.isDark ? "bg-slate-950 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-150 text-slate-500")
                : (activeTheme?.isDark ? "bg-brand-500/10 border-brand-500/20 text-brand-400" : "bg-brand-100 border-brand-200 text-brand-700")
            )}>
              {datePreset === 'all' ? 'All Time (Overall Total)' : datePreset === 'custom' ? 'Custom Range' : datePreset.replace('-', ' ').toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-normal normal-case font-bold">
              {datePreset === 'all' ? '(No Date Filter Applied)' : `(${startDateStr ? new Date(startDateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"} – ${endDateStr ? new Date(endDateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"})`}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 font-mono tracking-normal">
              {filteredData.length} / {data.length} Lots ({data.length > 0 ? ((filteredData.length / data.length) * 100).toFixed(1) : 0}%)
            </span>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isDateFilterExpanded ? "rotate-180 text-brand-500" : "text-slate-400")} />
          </div>
        </button>

        {/* Collapsible Panel Content */}
        <AnimatePresence>
          {isDateFilterExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className={cn(
                "mt-2 p-5 border rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6",
                activeTheme?.isDark ? "bg-slate-900 border-slate-850" : "bg-white border-slate-150"
              )}>
                {/* Col 1: Preset Range Dropdown */}
                <div className={cn("col-span-1 md:col-span-5 flex flex-col gap-3.5 pr-2 md:border-r", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-500" />
                      Preset Range
                    </label>
                    <select
                      value={datePreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDatePreset(val);
                        if (val !== 'custom') {
                          const now = new Date();
                          const pad = (n: number) => n.toString().padStart(2, '0');
                          const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

                          if (val === 'all') {
                            if (dataDateBounds.min && dataDateBounds.max) {
                              setStartDateStr(dataDateBounds.min);
                              setEndDateStr(dataDateBounds.max);
                            }
                          } else if (val === 'this-year') {
                            const start = new Date(now.getFullYear(), 0, 1);
                            setStartDateStr(formatYMD(start));
                            setEndDateStr(formatYMD(now));
                          } else if (val === 'last-year') {
                            const start = new Date(now.getFullYear() - 1, 0, 1);
                            const end = new Date(now.getFullYear() - 1, 11, 31);
                            setStartDateStr(formatYMD(start));
                            setEndDateStr(formatYMD(end));
                          } else if (val === 'last-12m') {
                            const start = new Date(now);
                            start.setMonth(now.getMonth() - 12);
                            setStartDateStr(formatYMD(start));
                            setEndDateStr(formatYMD(now));
                          } else if (val === 'last-6m') {
                            const start = new Date(now);
                            start.setMonth(now.getMonth() - 6);
                            setStartDateStr(formatYMD(start));
                            setEndDateStr(formatYMD(now));
                          }
                        }
                      }}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-all focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 appearance-none bg-no-repeat bg-[right_12px_center]",
                        activeTheme?.isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                      )}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`,
                        backgroundSize: '16px'
                      }}
                    >
                      <option value="all">All Time (Overall Total)</option>
                      <option value="this-year">This Year</option>
                      <option value="last-year">Last Year</option>
                      <option value="last-12m">Last 12 Months</option>
                      <option value="last-6m">Last 6 Months</option>
                      <option value="custom">Custom Date Range...</option>
                    </select>
                  </div>

                  {/* Manual Date Inputs */}
                  <div className="grid grid-cols-2 gap-3 w-full font-sans">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">From Date</label>
                      <input 
                        type="date"
                        value={startDateStr}
                        min={dataDateBounds.min}
                        max={dataDateBounds.max}
                        onChange={(e) => {
                          setStartDateStr(e.target.value);
                          setDatePreset('custom');
                        }}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-xl text-[10px] font-bold border outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500",
                          activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-200 font-mono" : "bg-slate-50 border-slate-150 text-slate-800 font-mono"
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-slate-400">To Date</label>
                      <input 
                        type="date"
                        value={endDateStr}
                        min={dataDateBounds.min}
                        max={dataDateBounds.max}
                        onChange={(e) => {
                          setEndDateStr(e.target.value);
                          setDatePreset('custom');
                        }}
                        className={cn(
                          "w-full px-2.5 py-1.5 rounded-xl text-[10px] font-bold border outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500",
                          activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-200 font-mono" : "bg-slate-50 border-slate-150 text-slate-800 font-mono"
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* Col 2: Filter Applied Basis */}
                <div className={cn("col-span-1 md:col-span-4 flex flex-col gap-3.5 pr-2 md:border-r", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Filter className="w-3.5 h-3.5 text-brand-500" />
                      Filter Applied To
                    </label>
                    <select
                      value={dateRangeMode}
                      onChange={(e) => setDateRangeMode(e.target.value as any)}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-xl text-xs font-bold border outline-none cursor-pointer transition-all focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 appearance-none bg-no-repeat bg-[right_12px_center]",
                        activeTheme?.isDark ? "bg-slate-950 border-slate-800 text-slate-100" : "bg-slate-50 border-slate-200 text-slate-800"
                      )}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`,
                        backgroundSize: '16px'
                      }}
                    >
                      <option value="latest">Latest Milestone Date</option>
                      <option value="any">Any Milestone Date</option>
                      <option value="specific">Specific Milestone Date...</option>
                    </select>
                  </div>

                  {/* Specific Milestone Selector */}
                  <div className="flex flex-col gap-1">
                    <label className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      dateRangeMode === 'specific' ? "text-slate-400" : "text-slate-400/40"
                    )}>
                      Target Milestone
                    </label>
                    <select
                      value={selectedSpecificMilestone}
                      disabled={dateRangeMode !== 'specific'}
                      onChange={(e) => setSelectedSpecificMilestone(e.target.value)}
                      className={cn(
                        "w-full px-2.5 py-1.5 rounded-xl text-[10px] font-bold border outline-none tracking-wide transition-all",
                        dateRangeMode === 'specific'
                          ? (activeTheme?.isDark ? "bg-slate-950 border-slate-850 text-slate-200 cursor-pointer" : "bg-slate-50 border-slate-150 text-slate-800 cursor-pointer")
                          : (activeTheme?.isDark ? "bg-slate-950/20 border-slate-900/50 text-slate-600 cursor-not-allowed" : "bg-slate-50/50 border-slate-100 text-slate-400 cursor-not-allowed")
                      )}
                    >
                      <option value="dateNot">Notice of Taking (NoT)</option>
                      <option value="dateOtb">Offer to Buy (OTB)</option>
                      <option value="dateDoas">Deed of Absolute Sale (DoAS)</option>
                      <option value="datePte">Permit to Enter (PTE)</option>
                      <option value="datePaid">Payment Date</option>
                      <option value="dateHo">Handed Over Date</option>
                      <option value="dateCno">CNO Date</option>
                    </select>
                  </div>
                </div>

                {/* Col 3: Statistics & Reset Action */}
                <div className="col-span-1 md:col-span-3 flex flex-col justify-between gap-4 font-sans">
                  {/* Statistics */}
                  <div className={cn(
                    "p-4 rounded-2xl border flex flex-col gap-2.5",
                    activeTheme?.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50/50 border-slate-150"
                  )}>
                    <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <span>Lots Match</span>
                      <span className="font-mono text-[11px] font-black text-slate-600 dark:text-slate-300">
                        {filteredData.length} / {data.length}
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className="h-full bg-brand-500 transition-all duration-300"
                        style={{ width: `${data.length > 0 ? (filteredData.length / data.length) * 100 : 0}%` }}
                      />
                    </div>
                    
                    <p className="text-[9px] font-black text-brand-500 dark:text-brand-400 tracking-wide text-center leading-relaxed uppercase font-mono">
                      {data.length > 0 ? ((filteredData.length / data.length) * 100).toFixed(1) : 0}% of Lots Match
                    </p>
                  </div>

                  {/* Reset Date range button */}
                  <button
                    type="button"
                    onClick={() => {
                      setDatePreset('all');
                      setDateRangeMode('latest');
                      if (dataDateBounds.min && dataDateBounds.max) {
                        setStartDateStr(dataDateBounds.min);
                        setEndDateStr(dataDateBounds.max);
                      }
                    }}
                    className={cn(
                      "w-full py-2.5 border rounded-xl text-[10px] font-black uppercase tracking-wider text-center cursor-pointer transition-all font-bold active:scale-98 shadow-2xs hover:shadow-xs",
                      activeTheme?.isDark
                        ? "bg-slate-950 hover:bg-slate-850 border-slate-850 text-slate-300 hover:text-white"
                        : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900"
                    )}
                  >
                    Reset Date Range
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Area & Cost Boxes */}
      <motion.div 
        id="tour-snapshots"
        variants={containerVariants}
        initial={hasAnimated ? false : "hidden"}
        animate="visible"
        className={cn(
          "grid grid-cols-1 md:grid-cols-3 gap-4 transition-all duration-300 rounded-[2.5rem]",
          tourActive && tourStep === 2 && "ring-4 ring-sky-500/80 ring-offset-2 scale-[1.01] bg-sky-500/5 p-2 z-[40]"
        )}
      >
        <SummaryCard 
          title="TOTAL SURVEY AREA" 
          subtitle="Reference only / Subject to chamge"
          icon={<Layout className="w-4 h-4" />}
          items={[
            { value: formatArea(summaries.totalArea), label: "Total Area", status: "neutral", color: "#2379a7" },
            { value: formatArea(summaries.affectedArea), label: "Total Affected Area", status: "brand", color: "#2379a7" }
          ]}
          activeTheme={activeTheme}
        />
        <SummaryCard 
          title="ESTIMATED PROJECT COST" 
          subtitle="Reference only / Subject to change"
          icon={<span className="text-sm font-black text-slate-500">₱</span>}
          items={[
            { value: formatCurrency(summaries.estLand), label: "Estimated Cost for Land", status: "neutral", color: "#359b78" },
            { value: formatCurrency(summaries.estStructure), label: "Estimated Cost for Structure", status: "neutral", color: "#359b78" }
          ]}
          activeTheme={activeTheme}
        />
        <SummaryCard 
          title="ACTUAL COST" 
          subtitle="Updated from finalized records"
          icon={<span className="text-sm font-black text-slate-500">₱</span>}
          items={[
            { value: formatCurrency(summaries.actLand), label: "Actual Cost for Land", status: "success", color: "#006e7b" },
            { value: formatCurrency(summaries.actStructure), label: "Actual Cost for Structure", status: "success", color: "#006e7b" }
          ]}
          activeTheme={activeTheme}
        />
      </motion.div>

      {/* 16 Stats Grid (Dynamically Ordered & Filtered via Settings) */}
      <motion.div 
        id="tour-kpis"
        variants={containerVariants}
        initial={hasAnimated ? false : "hidden"}
        animate="visible"
        className={cn(
          "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 transition-all duration-300 rounded-3xl",
          tourActive && tourStep === 3 && "ring-4 ring-emerald-500/80 ring-offset-2 scale-[1.01] bg-emerald-500/5 p-2 z-[40]"
        )}
      >
        {kpiWidgetsConfig.filter(w => w.visible).map((widget) => {
          switch (widget.id) {
            case "totalLots":
              return (
                <MiniStat 
                  key="totalLots"
                  val={stats.totalLots} 
                  label={search.trim() ? "LOT ID NO" : "TOTAL LOTS"} 
                  icon={<Download className="w-3 h-3 text-brand-500" />} 
                  onDownload={() => handleDownloadList(search.trim() ? "LOT ID NO" : "TOTAL LOTS")} 
                  color={widget.color || "#616a8c"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "TOTAL LOTS", stats.totalLots, widget.color || "#616a8c")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, search.trim() ? "LOT ID NO" : "TOTAL LOTS")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "TOTAL LOTS", stats.totalLots, widget.color || "#616a8c")}
                  isHovered={hoveredStatCard?.label === "TOTAL LOTS" || hoveredStatCard?.label === (search.trim() ? "LOT ID NO" : "TOTAL LOTS")}
                  isSelected={!selectedStatusCard || selectedStatusCard === "TOTAL LOTS" || selectedStatusCard === "LOT ID NO"}
                  activeTheme={activeTheme}
                />
              );
            case "notIssued":
              return (
                <MiniStat 
                  key="notIssued"
                  val={stats.notIssued} 
                  label="NoT Issued" 
                  icon={<Download className="w-3 h-3 text-slate-400" />} 
                  onDownload={() => handleDownloadList("NoT Issued")} 
                  color={widget.color || "#e49864"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "NoT Issued", stats.notIssued, widget.color || "#e49864")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "NoT Issued")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "NoT Issued", stats.notIssued, widget.color || "#e49864")}
                  isHovered={hoveredStatCard?.label === "NoT Issued"}
                  isSelected={selectedStatusCard === "NoT Issued"}
                  activeTheme={activeTheme}
                />
              );
            case "otbIssued":
              return (
                <MiniStat 
                  key="otbIssued"
                  val={stats.otbIssued} 
                  label="Issued RfD/OTB/OtC" 
                  icon={<Download className="w-3 h-3 text-indigo-500" />} 
                  onDownload={() => handleDownloadList("Issued RfD/OTB/OtC")} 
                  color={widget.color || "#e49864"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Issued RfD/OTB/OtC", stats.otbIssued, widget.color || "#e49864")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Issued RfD/OTB/OtC")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Issued RfD/OTB/OtC", stats.otbIssued, widget.color || "#e49864")}
                  isHovered={hoveredStatCard?.label === "Issued RfD/OTB/OtC"}
                  isSelected={selectedStatusCard === "Issued RfD/OTB/OtC"}
                  activeTheme={activeTheme}
                />
              );
            case "otbAccepted":
              return (
                <MiniStat 
                  key="otbAccepted"
                  val={stats.otbAccepted} 
                  label="Accepted RfD/OTB/OtC" 
                  icon={<Download className="w-3 h-3 text-emerald-500" />} 
                  onDownload={() => handleDownloadList("Accepted RfD/OTB/OtC")} 
                  color={widget.color || "#d6bf5d"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Accepted RfD/OTB/OtC", stats.otbAccepted, widget.color || "#d6bf5d")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Accepted RfD/OTB/OtC")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Accepted RfD/OTB/OtC", stats.otbAccepted, widget.color || "#d6bf5d")}
                  isHovered={hoveredStatCard?.label === "Accepted RfD/OTB/OtC"}
                  isSelected={selectedStatusCard === "Accepted RfD/OTB/OtC"}
                  activeTheme={activeTheme}
                />
              );
            case "otbReview":
              return (
                <MiniStat 
                  key="otbReview"
                  val={stats.otbReview} 
                  label="30 days Review RfD/OTB/OtC" 
                  icon={<Download className="w-3 h-3 text-amber-500" />} 
                  onDownload={() => handleDownloadList("30 days Review RfD/OTB/OtC")} 
                  color={widget.color || "#b34b40"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "30 days Review RfD/OTB/OtC", stats.otbReview, widget.color || "#b34b40")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "30 days Review RfD/OTB/OtC")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "30 days Review RfD/OTB/OtC", stats.otbReview, widget.color || "#b34b40")}
                  isHovered={hoveredStatCard?.label === "30 days Review RfD/OTB/OtC"}
                  isSelected={selectedStatusCard === "30 days Review RfD/OTB/OtC"}
                  activeTheme={activeTheme}
                />
              );
            case "otbIncurable":
              return (
                <MiniStat 
                  key="otbIncurable"
                  val={stats.otbIncurable} 
                  label="Incurable RfD/OTB/OtC" 
                  icon={<Download className="w-3 h-3 text-orange-500" />} 
                  onDownload={() => handleDownloadList("Incurable RfD/OTB/OtC")} 
                  color={widget.color || "#b34b40"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Incurable RfD/OTB/OtC", stats.otbIncurable, widget.color || "#b34b40")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Incurable RfD/OTB/OtC")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Incurable RfD/OTB/OtC", stats.otbIncurable, widget.color || "#b34b40")}
                  isHovered={hoveredStatCard?.label === "Incurable RfD/OTB/OtC"}
                  isSelected={selectedStatusCard === "Incurable RfD/OTB/OtC"}
                  activeTheme={activeTheme}
                />
              );
            case "otbRejected":
              return (
                <MiniStat 
                  key="otbRejected"
                  id="stat-card-rejected-otb"
                  val={stats.otbRejected} 
                  label="Rejected RfD/OTB/OtC" 
                  icon={<Download className="w-3 h-3 text-red-500" />} 
                  onDownload={() => handleDownloadList("Rejected RfD/OTB/OtC")} 
                  color={widget.color || "#bd0707"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Rejected RfD/OTB/OtC", stats.otbRejected, widget.color || "#bd0707")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Rejected RfD/OTB/OtC")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Rejected RfD/OTB/OtC", stats.otbRejected, widget.color || "#bd0707")}
                  isHovered={hoveredStatCard?.label === "Rejected RfD/OTB/OtC"}
                  isSelected={selectedStatusCard === "Rejected RfD/OTB/OtC"}
                  activeTheme={activeTheme}
                />
              );
            case "signedDoas":
              return (
                <MiniStat 
                  key="signedDoas"
                  val={stats.signedDoas} 
                  label={widget.label || "SIGNED DOAS"} 
                  icon={<Download className="w-3 h-3 text-brand-500" />} 
                  onDownload={() => handleDownloadList("SIGNED DOAS")} 
                  color={widget.color || "#112bbc"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, widget.label || "SIGNED DOAS", stats.signedDoas, widget.color || "#112bbc")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, widget.label || "SIGNED DOAS")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, widget.label || "SIGNED DOAS", stats.signedDoas, widget.color || "#112bbc")}
                  isHovered={hoveredStatCard?.label === (widget.label || "SIGNED DOAS") || hoveredStatCard?.label === "DOAS"}
                  isSelected={selectedStatusCard === (widget.label || "SIGNED DOAS") || selectedStatusCard === "DOAS" || selectedStatusCard === "SIGNED DOAS"}
                  activeTheme={activeTheme}
                />
              );
            case "signedEjseas":
              return (
                <MiniStat 
                  key="signedEjseas"
                  val={stats.signedEjseas} 
                  label="EJSEAS" 
                  icon={<Download className="w-3 h-3 text-brand-500" />} 
                  onDownload={() => handleDownloadList("EJSEAS")} 
                  color={widget.color || "#112bbc"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "EJSEAS", stats.signedEjseas, widget.color || "#112bbc")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "EJSEAS")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "EJSEAS", stats.signedEjseas, widget.color || "#112bbc")}
                  isHovered={hoveredStatCard?.label === "EJSEAS"}
                  isSelected={selectedStatusCard === "EJSEAS"}
                  activeTheme={activeTheme}
                />
              );
            case "signedPte":
              return (
                <MiniStat 
                  key="signedPte"
                  val={stats.signedPte} 
                  label="PTE" 
                  icon={<Download className="w-3 h-3 text-brand-500" />} 
                  onDownload={() => handleDownloadList("PTE")} 
                  color={widget.color || "#66ac69"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "PTE", stats.signedPte, widget.color || "#66ac69")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "PTE")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "PTE", stats.signedPte, widget.color || "#66ac69")}
                  isHovered={hoveredStatCard?.label === "PTE"}
                  isSelected={selectedStatusCard === "PTE"}
                  activeTheme={activeTheme}
                />
              );
            case "partiallyPaid":
              return (
                <MiniStat 
                  key="partiallyPaid"
                  val={stats.partiallyPaid} 
                  label="Partial Paid" 
                  icon={<Download className="w-3 h-3 text-amber-500" />} 
                  onDownload={() => handleDownloadList("Partial Paid")} 
                  color={widget.color || "#187f05"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Partial Paid", stats.partiallyPaid, widget.color || "#187f05")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Partial Paid")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Partial Paid", stats.partiallyPaid, widget.color || "#187f05")}
                  isHovered={hoveredStatCard?.label === "Partial Paid"}
                  isSelected={selectedStatusCard === "Partial Paid"}
                  activeTheme={activeTheme}
                />
              );
            case "fullyPaid":
              return (
                <MiniStat 
                  key="fullyPaid"
                  val={stats.fullyPaid} 
                  label="Fully Paid" 
                  icon={<Download className="w-3 h-3 text-emerald-500" />} 
                  onDownload={() => handleDownloadList("Fully Paid")} 
                  color={widget.color || "#187f05"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Fully Paid", stats.fullyPaid, widget.color || "#187f05")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Fully Paid")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Fully Paid", stats.fullyPaid, widget.color || "#187f05")}
                  isHovered={hoveredStatCard?.label === "Fully Paid"}
                  isSelected={selectedStatusCard === "Fully Paid"}
                  activeTheme={activeTheme}
                />
              );
            case "handedOver":
              return (
                <MiniStat 
                  key="handedOver"
                  val={stats.handedOver} 
                  label="Handed Over" 
                  icon={<Download className="w-3 h-3 text-brand-500" />} 
                  onDownload={() => handleDownloadList("Handed Over")} 
                  color={widget.color || "#239694"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Handed Over", stats.handedOver, widget.color || "#239694")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Handed Over")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Handed Over", stats.handedOver, widget.color || "#239694")}
                  isHovered={hoveredStatCard?.label === "Handed Over"}
                  isSelected={selectedStatusCard === "Handed Over"}
                  activeTheme={activeTheme}
                />
              );
            case "withCno":
              return (
                <MiniStat 
                  key="withCno"
                  val={stats.withCno} 
                  label="CNO" 
                  icon={<Download className="w-3 h-3 text-slate-400" />} 
                  onDownload={() => handleDownloadList("CNO")} 
                  color={widget.color || "#187f05"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "CNO", stats.withCno, widget.color || "#187f05")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "CNO")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "CNO", stats.withCno, widget.color || "#187f05")}
                  isHovered={hoveredStatCard?.label === "CNO"}
                  isSelected={selectedStatusCard === "CNO"}
                  activeTheme={activeTheme}
                />
              );
            case "withMoa":
              return (
                <MiniStat 
                  key="withMoa"
                  id="stat-card-moa"
                  val={stats.withMoa} 
                  label="MOA" 
                  icon={<Download className="w-3 h-3 text-slate-400" />} 
                  onDownload={() => handleDownloadList("MOA")} 
                  color={widget.color || "#187f05"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "MOA", stats.withMoa, widget.color || "#187f05")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "MOA")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "MOA", stats.withMoa, widget.color || "#187f05")}
                  isHovered={hoveredStatCard?.label === "MOA"}
                  isSelected={selectedStatusCard === "MOA"}
                  activeTheme={activeTheme}
                />
              );
            case "paidCrops":
              return (
                <MiniStat 
                  key="paidCrops"
                  val={stats.paidCrops} 
                  label="Paid Crops" 
                  icon={<Download className="w-3 h-3 text-indigo-500" />} 
                  onDownload={() => handleDownloadList("Paid Crops")} 
                  color={widget.color || "#187f05"} 
                  onMouseEnter={(e) => interactionMode === 'hover' && handleStatCardMouseEnter(e, "Paid Crops", stats.paidCrops, widget.color || "#187f05")}
                  onMouseLeave={() => interactionMode === 'hover' && handleStatCardMouseLeave()}
                  onClick={(e) => interactionMode === 'click' && handleStatCardSingleClick(e, "Paid Crops")}
                  onDoubleClick={(e) => interactionMode === 'click' && handleStatCardDoubleClick(e, "Paid Crops", stats.paidCrops, widget.color || "#187f05")}
                  isHovered={hoveredStatCard?.label === "Paid Crops"}
                  isSelected={selectedStatusCard === "Paid Crops"}
                  activeTheme={activeTheme}
                />
              );
            default:
              return null;
          }
        })}
      </motion.div>

      {/* Main Charts */}
      <motion.div 
        id="tour-charts"
        variants={containerVariants}
        initial={hasAnimated ? false : "hidden"}
        animate="visible"
        className={cn(
          "grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-300 rounded-[2.25rem]",
          tourActive && tourStep === 4 && "ring-4 ring-indigo-500/80 ring-offset-2 scale-[1.01] bg-indigo-500/5 p-2 z-[40]"
        )}
      >
        {/* Resource Load Distribution Section - Positioned First */}
        {(!hiddenPanels.resourceLoad || maximizedPanel === 'resourceLoad') && (
          <div 
            className={maximizedPanel === 'resourceLoad' ? "col-span-1 lg:col-span-2" : "lg:col-span-2"}
            onMouseEnter={() => setIsResourceLoadHovered(true)}
            onMouseLeave={() => setIsResourceLoadHovered(false)}
          >
            <ChartBox 
              title="Resource Load Distribution"
              subtitle={
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    {`Distribution of lot volume grouped by ${
                      resourceLoadType === 'lgu' ? 'Local Government Unit (LGU)' :
                      resourceLoadType === 'rapLgu' ? 'RAP Local Government Unit (RAP LGU - Col BR)' :
                      resourceLoadType === 'cp' ? 'Contract Package (CP)' :
                      resourceLoadType === 'rapCp' ? 'RAP Contract Package (RAP CP - Col BQ)' :
                      resourceLoadType === 'zone' ? 'Zone Sector' :
                      resourceLoadType === 'mode' ? 'Acquisition Mode' :
                      resourceLoadType === 'status' ? 'Status' :
                      'Payment Status'
                    }`}
                  </span>
                  {selectedStatusCard && selectedStatusCard !== "TOTAL LOTS" && selectedStatusCard !== "LOT ID NO" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-in fade-in zoom-in-95">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Projecting Status: {selectedStatusCard}
                      <span className="text-[9px] font-semibold opacity-80 ml-0.5">
                        ({isResourceLoadHovered ? "Auto-reset paused while hovering" : "Auto-resets in 30s"})
                      </span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStatusCard(null);
                        }} 
                        className="ml-1 text-slate-400 hover:text-red-500 font-bold transition-colors cursor-pointer"
                        title="Reset to All Lots"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </span>
              } 
              spanFull
              badge={resourceLoadInsights?.totalCount || filteredData.length}
              activeTheme={activeTheme}
              isMaximized={maximizedPanel === 'resourceLoad'}
              onMaximize={() => setMaximizedPanel(maximizedPanel === 'resourceLoad' ? null : 'resourceLoad')}
              extra={(
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Property Selector & Visual Style Controls */}
                  <div className="flex items-center gap-2">
                    <select
                      value={resourceLoadType}
                      onChange={(e) => setResourceLoadType(e.target.value as any)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                        activeTheme?.isDark 
                          ? "bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700" 
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      )}
                    >
                      <option value="lgu">By LGU</option>
                      <option value="rapLgu">By RAP LGU (Col BR)</option>
                      <option value="cp">By CP</option>
                      <option value="rapCp">By RAP CP (Col BQ)</option>
                      <option value="zone">By Zone</option>
                      <option value="mode">By Mode</option>
                      <option value="status">By Status</option>
                      <option value="payment">By Payment</option>
                    </select>

                    {/* Multi-Select Combo Line Metric Overlay Selector */}
                    <div className="relative" ref={comboDropdownRef}>
                      <button
                        type="button"
                        onClick={() => setIsComboDropdownOpen(prev => !prev)}
                        title="Overlay secondary metric trend lines on this chart (Multiple select supported)"
                        className={cn(
                          "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/30 select-none",
                          resourceLoadComboMetrics.length > 0
                            ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-extrabold"
                            : activeTheme?.isDark 
                              ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200" 
                              : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>
                          {resourceLoadComboMetrics.length === 0 && "Combo Line: Off"}
                          {resourceLoadComboMetrics.length === 1 && `Combo: ${COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.label || 'Selected'}`}
                          {resourceLoadComboMetrics.length > 1 && `Combo (${resourceLoadComboMetrics.length}): ${COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.label || 'Multiple'} +${resourceLoadComboMetrics.length - 1}`}
                        </span>
                        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", isComboDropdownOpen ? "rotate-180" : "")} />
                      </button>

                      {isComboDropdownOpen && (
                        <div 
                          className={cn(
                            "absolute right-0 top-full mt-1.5 w-72 rounded-2xl border shadow-xl z-50 p-2 backdrop-blur-md animate-in fade-in zoom-in-95",
                            activeTheme?.isDark 
                              ? "bg-slate-900/95 border-slate-800 text-slate-200" 
                              : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-900/10"
                          )}
                        >
                          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-200/60 dark:border-slate-800/60 mb-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                              Multi-Select Combo Lines
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setResourceLoadComboMetrics(COMBO_OPTIONS.map(o => o.key))}
                                className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                              >
                                All
                              </button>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <button
                                type="button"
                                onClick={() => setResourceLoadComboMetrics([])}
                                className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                            {/* Off toggle option */}
                            <button
                              type="button"
                              onClick={() => setResourceLoadComboMetrics([])}
                              className={cn(
                                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer select-none text-left",
                                resourceLoadComboMetrics.length === 0
                                  ? "bg-slate-100 dark:bg-slate-800/80 text-slate-900 dark:text-white font-black"
                                  : "text-slate-500 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white"
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-slate-400 opacity-60" />
                                Combo Line: Off
                              </span>
                              {resourceLoadComboMetrics.length === 0 && (
                                <span className="text-[9px] font-black text-indigo-500 font-mono">OFF</span>
                              )}
                            </button>

                            {/* Individual Metric Options */}
                            {COMBO_OPTIONS.map((opt) => {
                              const isChecked = resourceLoadComboMetrics.includes(opt.key);
                              const cfg = COMBO_METRIC_CONFIG[opt.key];
                              return (
                                <button
                                  key={opt.key}
                                  type="button"
                                  onClick={() => toggleComboMetric(opt.key)}
                                  className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer select-none text-left",
                                    isChecked
                                      ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-black shadow-3xs"
                                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40"
                                  )}
                                >
                                  <span className="flex items-center gap-2 truncate pr-2">
                                    {isChecked ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    )}
                                    <span 
                                      className="w-2 h-2 rounded-full shrink-0" 
                                      style={{ backgroundColor: cfg?.color || '#6366f1' }}
                                    />
                                    <span className="truncate">{opt.label}</span>
                                  </span>
                                  {isChecked && (
                                    <span 
                                      className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                                      style={{ backgroundColor: cfg?.color || '#6366f1' }}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Percentage Show/Hide Toggle Button */}
                    <button
                      type="button"
                      onClick={() => setShowResourceLoadPct(prev => !prev)}
                      title={showResourceLoadPct ? "Hide percentage labels" : "Show percentage labels"}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs",
                        showResourceLoadPct
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20"
                          : activeTheme?.isDark 
                            ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200" 
                            : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                      )}
                    >
                      <span className={cn(
                        "px-1 py-0.2 rounded text-[9px] font-black font-mono",
                        showResourceLoadPct ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      )}>
                        %
                      </span>
                      <span className="hidden sm:inline">{showResourceLoadPct ? "Pct On" : "Pct Off"}</span>
                    </button>

                    {/* Quick Style Switcher Pills */}
                    <div className={cn(
                      "flex items-center p-0.5 rounded-xl border gap-0.5",
                      activeTheme?.isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-100/80 border-slate-200/80"
                    )}>
                      <button
                        type="button"
                        onClick={() => setResourceLoadChartStyle("vertical")}
                        title="Vertical Bar Chart"
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                          resourceLoadChartStyle === "vertical"
                            ? activeTheme?.isDark ? "bg-indigo-600 text-white shadow-3xs" : "bg-indigo-600 text-white shadow-3xs"
                            : activeTheme?.isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 131.5 0 0 1 1.5 0M9 3v18M15 9v12M21 3v18" />
                        </svg>
                        <span className="hidden sm:inline">Vertical</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResourceLoadChartStyle("horizontal")}
                        title="Horizontal Bar Chart"
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                          resourceLoadChartStyle === "horizontal"
                            ? activeTheme?.isDark ? "bg-indigo-600 text-white shadow-3xs" : "bg-indigo-600 text-white shadow-3xs"
                            : activeTheme?.isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <svg className="w-3.5 h-3.5 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 131.5 0 0 1 1.5 0M9 3v18M15 9v12M21 3v18" />
                        </svg>
                        <span className="hidden sm:inline">Horizontal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResourceLoadChartStyle("donut")}
                        title="Donut Pie Chart"
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                          resourceLoadChartStyle === "donut"
                            ? activeTheme?.isDark ? "bg-indigo-600 text-white shadow-3xs" : "bg-indigo-600 text-white shadow-3xs"
                            : activeTheme?.isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5z" />
                        </svg>
                        <span className="hidden sm:inline">Donut</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            >
              {hasAnimated && (
                <div className="w-full h-full flex flex-col justify-between">
                  {resourceLoadInsights && (
                    <div className={cn(
                      "mb-6 p-4 rounded-2xl border relative overflow-hidden transition-all duration-300 shadow-3xs",
                      activeTheme?.isDark 
                        ? "bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-950/60 border-indigo-500/20" 
                        : "bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-purple-50/60 border-indigo-200/60"
                    )}>
                      {/* Ambient Accent Glow */}
                      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                        <div className="flex gap-3.5 items-start md:items-center">
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-transform hover:scale-105",
                            activeTheme?.isDark ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-gradient-to-br from-indigo-600 to-blue-600 text-white"
                          )}>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-1-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.25 2.25 3.75-3.75" />
                            </svg>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-black uppercase tracking-wider", activeTheme?.isDark ? "text-indigo-300" : "text-indigo-900")}>
                                Resource Analytics Intelligence
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-indigo-500/15 text-indigo-500 border border-indigo-500/30">
                                Live Metrics
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span>💡 Click any column or bar to view lots</span>
                              </span>
                            </div>
                            <div className={cn("text-[11px] font-semibold mt-1 leading-relaxed max-w-2xl", activeTheme?.isDark ? "text-slate-300" : "text-slate-700")}>
                              {resourceLoadInsights.insightDesc}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                          <div className={cn(
                            "px-3 py-2 rounded-xl border flex flex-col items-end backdrop-blur-xs",
                            activeTheme?.isDark ? "bg-slate-900/60 border-slate-800" : "bg-white/80 border-slate-200/80 shadow-3xs"
                          )}>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Top Concentration</span>
                            <span className={cn("text-xs font-black uppercase tracking-tight", activeTheme?.isDark ? "text-white" : "text-slate-900")}>
                              {resourceLoadInsights.topItemName}
                            </span>
                          </div>
                          <div className={cn(
                            "px-3 py-2 rounded-xl border flex flex-col items-end backdrop-blur-xs",
                            activeTheme?.isDark ? "bg-slate-900/60 border-slate-800" : "bg-white/80 border-slate-200/80 shadow-3xs"
                          )}>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Scope Portion</span>
                            <span className="text-xs font-black font-mono text-emerald-500">
                              {resourceLoadInsights.topItemCount} lots ({resourceLoadInsights.topPct}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SVG Filter Definition for Shadow Glow */}
                  <svg className="absolute w-0 h-0" aria-hidden="true">
                    <defs>
                      <filter id="resourceGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.25" />
                      </filter>
                    </defs>
                  </svg>

                  {resourceLoadChartStyle === 'vertical' && (() => {
                    const isResourceSlanted = getShouldSlant(resourceLoadData, maximizedPanel === 'resourceLoad' ? 1400 : 1100);
                    const hasCombo = resourceLoadComboMetrics.length > 0;

                    return (
                      <ResponsiveContainer width="100%" height={maximizedPanel === 'resourceLoad' ? 550 : 420}>
                        <ComposedChart 
                          data={resourceLoadData} 
                          margin={{ top: 25, right: hasCombo ? 50 : 30, left: 10, bottom: isResourceSlanted ? 75 : 25 }}
                          className="cursor-pointer"
                          onClick={(state: any) => handleChartColumnClick(state, resourceLoadType, resourceLoadData)}
                        >
                          <defs>
                            {resourceLoadData.map((_, index) => {
                              const col = getUniqueItemColor(index, !!activeTheme?.isDark);
                              return (
                                <linearGradient key={`grad-v-${index}`} id={`resourceLoadGradV-${index}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={col.start} stopOpacity={1} />
                                  <stop offset="100%" stopColor={col.end} stopOpacity={0.85} />
                                </linearGradient>
                              );
                            })}
                            {resourceLoadComboMetrics.map(mKey => {
                              const mCfg = COMBO_METRIC_CONFIG[mKey];
                              if (!mCfg) return null;
                              return (
                                <React.Fragment key={`defs-v-${mKey}`}>
                                  <linearGradient id={`resourceComboLineGradV-${mKey}`} x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={mCfg.gradientStart} />
                                    <stop offset="100%" stopColor={mCfg.gradientEnd} />
                                  </linearGradient>
                                  <linearGradient id={`resourceComboAreaGradV-${mKey}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={mCfg.gradientStart} stopOpacity={0.08} />
                                    <stop offset="60%" stopColor={mCfg.gradientEnd} stopOpacity={0.02} />
                                    <stop offset="100%" stopColor={mCfg.gradientEnd} stopOpacity={0.00} />
                                  </linearGradient>
                                  <filter id={`resourceComboLineGlowV-${mKey}`} x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={mCfg.color} floodOpacity="0.3" />
                                  </filter>
                                </React.Fragment>
                              );
                            })}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.35)" : "#e2e8f0"} />
                          <XAxis 
                            dataKey="name" 
                            interval={0}
                            axisLine={false} 
                            tickLine={false} 
                            tickMargin={isResourceSlanted ? 8 : 12}
                            tick={(props: any) => {
                              const { x, y, payload } = props;
                              if (!payload) return null;
                              const val = String(payload.value || "");
                              return (
                                <g 
                                  transform={`translate(${x},${y})`} 
                                  className="cursor-pointer"
                                  onClick={(e: any) => {
                                    e.stopPropagation();
                                    handleBarOpenModal(val, resourceLoadType);
                                  }}
                                >
                                  <text 
                                    x={0} 
                                    y={0} 
                                    dy={isResourceSlanted ? 8 : 12} 
                                    dx={isResourceSlanted ? -4 : 0}
                                    textAnchor={isResourceSlanted ? "end" : "middle"} 
                                    transform={isResourceSlanted ? "rotate(-32)" : undefined}
                                    fill={activeTheme?.isDark ? '#cbd5e1' : '#475569'} 
                                    className="text-[8px] sm:text-[9px] md:text-[10px] font-black hover:fill-indigo-500 transition-colors select-none uppercase tracking-tight"
                                  >
                                    {val}
                                  </text>
                                </g>
                              );
                            }}
                          />
                          <YAxis 
                            yAxisId="left"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#cbd5e1' : '#475569'}} 
                          />
                          {hasCombo && (
                            <YAxis 
                              yAxisId="right"
                              orientation="right"
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fontWeight: 900, fill: COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.color || '#6366f1'}} 
                              tickFormatter={(v) => {
                                if (resourceLoadComboMetrics.length === 1) {
                                  const firstKey = resourceLoadComboMetrics[0];
                                  if (firstKey === 'totalCost' || firstKey === 'actualCost') {
                                    const fmt = formatFullAmountWithScale(v);
                                    return fmt.scaleWord ? `₱${fmt.scaledValue.toFixed(1)}${fmt.scaleWord[0]}` : `₱${v}`;
                                  }
                                  if (firstKey === 'affectedArea') {
                                    return `${v} sqm`;
                                  }
                                }
                                return `${v}`;
                              }}
                            />
                          )}
                          <RechartsTooltip 
                            cursor={{fill: activeTheme?.isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)'}}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const barItem = payload.find(p => p.dataKey === "count");
                                const barVal = (barItem ? barItem.value : payload[0].value) as number;
                                const total = resourceLoadInsights?.totalCount || 1;
                                const pct = ((barVal / total) * 100).toFixed(1);

                                return (
                                  <div className={cn(
                                    "p-4 rounded-2xl border shadow-xl space-y-2.5 min-w-[220px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                    activeTheme?.isDark 
                                      ? "bg-slate-900/95 border-indigo-500/30 text-slate-100 shadow-slate-950/60" 
                                      : "bg-white/95 border-indigo-200/80 text-slate-900 shadow-slate-200/60"
                                  )}>
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                      <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                        {resourceLoadType === 'lgu' ? 'LGU Entity' :
                                         resourceLoadType === 'rapLgu' ? 'RAP LGU Entity (Col BR)' :
                                         resourceLoadType === 'cp' ? 'Contract Package' :
                                         resourceLoadType === 'rapCp' ? 'RAP Contract Package (Col BQ)' :
                                         resourceLoadType === 'zone' ? 'Zone / Sector' :
                                         resourceLoadType === 'mode' ? 'Acquisition Mode' :
                                         resourceLoadType === 'status' ? 'Lot Status' :
                                         'Payment Status'}
                                      </span>
                                      <span className="text-[10px] font-black font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        {pct}% Share
                                      </span>
                                    </div>
                                    <div className="text-sm font-black truncate">
                                      {label}
                                    </div>
                                    <div className="space-y-1.5 pt-1">
                                      <div className="flex items-center justify-between text-xs font-semibold gap-4">
                                        <span className="text-slate-400 flex items-center gap-1.5">
                                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                                          Allocated Lots:
                                        </span>
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">{barVal} lots</span>
                                      </div>
                                      {resourceLoadComboMetrics.map(mKey => {
                                        const mCfg = COMBO_METRIC_CONFIG[mKey];
                                        if (!mCfg) return null;
                                        const cItem = payload.find(p => p.dataKey === mCfg.key);
                                        const valNum = Number(cItem?.value ?? (barItem as any)?.[mCfg.key] ?? 0);
                                        return (
                                          <div key={mKey} className="flex items-center justify-between text-xs font-semibold gap-4 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                            <span className="text-slate-400 flex items-center gap-1.5 truncate max-w-[140px]">
                                              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: mCfg.color }} />
                                              <span className="truncate">{mCfg.label}:</span>
                                            </span>
                                            <span className="font-black font-mono text-sm shrink-0" style={{ color: mCfg.color }}>
                                              {mKey === 'totalCost' || mKey === 'actualCost'
                                                ? formatFullAmountWithScale(valNum).displayFull
                                                : `${valNum.toLocaleString()}${mCfg.unit}`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            yAxisId="left"
                            dataKey="count" 
                            radius={[12, 12, 0, 0]}
                            isAnimationActive={!hasAnimated}
                            barSize={36}
                            filter="url(#resourceGlow)"
                            className="cursor-pointer"
                            onClick={(entry: any, index: number) => {
                              const barName = entry?.name || resourceLoadData[index]?.name;
                              if (barName) {
                                handleBarOpenModal(barName, resourceLoadType);
                              }
                            }}
                          >
                            {resourceLoadData.map((entry, index) => (
                              <Cell 
                                key={`cell-v-${index}`} 
                                fill={`url(#resourceLoadGradV-${index})`} 
                                className="cursor-pointer transition-opacity hover:opacity-85"
                                onClick={() => {
                                  handleBarOpenModal(entry.name, resourceLoadType);
                                }}
                              />
                            ))}
                            <LabelList 
                              dataKey="count" 
                              content={(props: any) => {
                                const { x, y, width, value } = props;
                                if (value === undefined || value === null) return null;
                                const total = resourceLoadInsights?.totalCount || 1;
                                const pct = ((Number(value) / total) * 100).toFixed(0);
                                const cx = Number(x) + Number(width) / 2;
                                const cy = Number(y) - 8;

                                return (
                                  <g>
                                    <text x={cx} y={cy} textAnchor="middle" className="font-mono select-none">
                                      <tspan 
                                        fill={activeTheme?.isDark ? "#ffffff" : "#0f172a"} 
                                        fontWeight="900" 
                                        fontSize="11"
                                      >
                                        {value}
                                      </tspan>
                                      {showResourceLoadPct && (
                                        <tspan 
                                          fill={activeTheme?.isDark ? "#38bdf8" : "#2563eb"} 
                                          fontWeight="800" 
                                          fontSize="10"
                                        >
                                          {` (${pct}%)`}
                                        </tspan>
                                      )}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                          </Bar>
                          {resourceLoadComboMetrics.map((mKey) => {
                            const mCfg = COMBO_METRIC_CONFIG[mKey];
                            if (!mCfg) return null;
                            return (
                              <Area 
                                key={`area-v-${mKey}`}
                                yAxisId="right"
                                type="monotone" 
                                dataKey={mCfg.key} 
                                name={mCfg.label}
                                stroke={`url(#resourceComboLineGradV-${mKey})`} 
                                strokeWidth={1.5} 
                                fill={`url(#resourceComboAreaGradV-${mKey})`}
                                filter={`url(#resourceComboLineGlowV-${mKey})`}
                                dot={(props: any) => {
                                  const { cx, cy, key } = props;
                                  if (cx === undefined || cy === undefined) return null;
                                  return (
                                    <g key={key || `dot-v-${mKey}-${cx}-${cy}`}>
                                      <circle cx={cx} cy={cy} r={5.5} fill={mCfg.color} fillOpacity={0.2} />
                                      <circle cx={cx} cy={cy} r={3} fill={mCfg.color} stroke={activeTheme?.isDark ? '#0f172a' : '#ffffff'} strokeWidth={1.5} />
                                    </g>
                                  );
                                }}
                                activeDot={{ r: 6, fill: mCfg.color, strokeWidth: 2, stroke: '#ffffff' }}
                                isAnimationActive={!hasAnimated}
                              >
                                <LabelList 
                                  dataKey={mCfg.key} 
                                  position="top" 
                                  content={(props: any) => {
                                    const { x, y, value } = props;
                                    if (value === undefined || value === null) return null;
                                    const textStr = mKey === 'totalCost' || mKey === 'actualCost'
                                      ? formatFullAmountWithScale(Number(value)).displayShort
                                      : `${value.toLocaleString()}${mCfg.unit}`;
                                    const approxWidth = Math.max(36, textStr.length * 6.5 + 12);
                                    return (
                                      <g transform={`translate(${x},${y - 12})`}>
                                        <rect 
                                          x={-approxWidth / 2} 
                                          y={-11} 
                                          width={approxWidth} 
                                          height={16} 
                                          rx={8} 
                                          fill={activeTheme?.isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)'}
                                          stroke={mCfg.color}
                                          strokeWidth={1.2}
                                        />
                                        <text 
                                          x={0} 
                                          y={1} 
                                          textAnchor="middle" 
                                          fill={mCfg.color} 
                                          fontWeight="900" 
                                          fontSize="9.5" 
                                          className="font-mono select-none"
                                        >
                                          {textStr}
                                        </text>
                                      </g>
                                    );
                                  }}
                                />
                              </Area>
                            );
                          })}
                        </ComposedChart>
                      </ResponsiveContainer>
                    );
                  })()}

                  {resourceLoadChartStyle === 'horizontal' && (() => {
                    const hasCombo = resourceLoadComboMetrics.length > 0;

                    return (
                      <ResponsiveContainer width="100%" height={maximizedPanel === 'resourceLoad' ? 550 : 420}>
                        <ComposedChart 
                          data={resourceLoadData} 
                          layout="vertical" 
                          margin={{ top: 25, right: 70, left: 80, bottom: 20 }}
                          className="cursor-pointer"
                          onClick={(state: any) => handleChartColumnClick(state, resourceLoadType, resourceLoadData)}
                        >
                          <defs>
                            {resourceLoadData.map((_, index) => {
                              const col = getUniqueItemColor(index, !!activeTheme?.isDark);
                              return (
                                <linearGradient key={`grad-h-${index}`} id={`resourceLoadGradH-${index}`} x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor={col.start} stopOpacity={0.85} />
                                  <stop offset="100%" stopColor={col.end} stopOpacity={1} />
                                </linearGradient>
                              );
                            })}
                            {resourceLoadComboMetrics.map(mKey => {
                              const mCfg = COMBO_METRIC_CONFIG[mKey];
                              if (!mCfg) return null;
                              return (
                                <React.Fragment key={`defs-h-${mKey}`}>
                                  <linearGradient id={`resourceComboLineGradH-${mKey}`} x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={mCfg.gradientStart} />
                                    <stop offset="100%" stopColor={mCfg.gradientEnd} />
                                  </linearGradient>
                                  <linearGradient id={`resourceComboAreaGradH-${mKey}`} x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={mCfg.gradientStart} stopOpacity={0.00} />
                                    <stop offset="60%" stopColor={mCfg.gradientStart} stopOpacity={0.02} />
                                    <stop offset="100%" stopColor={mCfg.gradientEnd} stopOpacity={0.08} />
                                  </linearGradient>
                                  <filter id={`resourceComboLineGlowH-${mKey}`} x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={mCfg.color} floodOpacity="0.3" />
                                  </filter>
                                </React.Fragment>
                              );
                            })}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.35)" : "#e2e8f0"} />
                          <XAxis 
                            xAxisId="bottom"
                            type="number"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#cbd5e1' : '#475569'}} 
                          />
                          {hasCombo && (
                            <XAxis 
                              xAxisId="top"
                              orientation="top"
                              type="number"
                              axisLine={false} 
                              tickLine={false} 
                              tick={{fontSize: 10, fontWeight: 900, fill: COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.color || '#6366f1'}}
                              tickFormatter={(v) => {
                                if (resourceLoadComboMetrics.length === 1) {
                                  const firstKey = resourceLoadComboMetrics[0];
                                  if (firstKey === 'totalCost' || firstKey === 'actualCost') {
                                    const fmt = formatFullAmountWithScale(v);
                                    return fmt.scaleWord ? `₱${fmt.scaledValue.toFixed(1)}${fmt.scaleWord[0]}` : `₱${v}`;
                                  }
                                  if (firstKey === 'affectedArea') {
                                    return `${v} sqm`;
                                  }
                                }
                                return `${v}`;
                              }}
                            />
                          )}
                          <YAxis 
                            type="category"
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tickMargin={12}
                            tick={(props: any) => {
                              const { x, y, payload } = props;
                              if (!payload) return null;
                              return (
                                <g 
                                  transform={`translate(${x},${y})`} 
                                  className="cursor-pointer"
                                  onClick={(e: any) => {
                                    e.stopPropagation();
                                    handleBarOpenModal(String(payload.value), resourceLoadType);
                                  }}
                                >
                                  <text 
                                    x={-6} 
                                    y={0} 
                                    dy={4} 
                                    textAnchor="end" 
                                    fill={activeTheme?.isDark ? '#cbd5e1' : '#475569'} 
                                    className="text-[10px] font-black hover:fill-indigo-500 transition-colors select-none"
                                  >
                                    {payload.value}
                                  </text>
                                </g>
                              );
                            }}
                          />
                          <RechartsTooltip 
                            cursor={{fill: activeTheme?.isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)'}}
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                const barItem = payload.find(p => p.dataKey === "count");
                                const barVal = (barItem ? barItem.value : payload[0].value) as number;
                                const total = resourceLoadInsights?.totalCount || 1;
                                const pct = ((barVal / total) * 100).toFixed(1);

                                return (
                                  <div className={cn(
                                    "p-4 rounded-2xl border shadow-xl space-y-2.5 min-w-[220px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                    activeTheme?.isDark 
                                      ? "bg-slate-900/95 border-indigo-500/30 text-slate-100 shadow-slate-950/60" 
                                      : "bg-white/95 border-indigo-200/80 text-slate-900 shadow-slate-200/60"
                                  )}>
                                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                                      <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                                        {resourceLoadType === 'lgu' ? 'LGU Entity' :
                                         resourceLoadType === 'rapLgu' ? 'RAP LGU Entity (Col BR)' :
                                         resourceLoadType === 'cp' ? 'Contract Package' :
                                         resourceLoadType === 'rapCp' ? 'RAP Contract Package (Col BQ)' :
                                         resourceLoadType === 'zone' ? 'Zone / Sector' :
                                         resourceLoadType === 'mode' ? 'Acquisition Mode' :
                                         resourceLoadType === 'status' ? 'Lot Status' :
                                         'Payment Status'}
                                      </span>
                                      <span className="text-[10px] font-black font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                        {pct}% Share
                                      </span>
                                    </div>
                                    <div className="text-sm font-black truncate">
                                      {label}
                                    </div>
                                    <div className="space-y-1.5 pt-1">
                                      <div className="flex items-center justify-between text-xs font-semibold gap-4">
                                        <span className="text-slate-400 flex items-center gap-1.5">
                                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                                          Allocated Lots:
                                        </span>
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">{barVal} lots</span>
                                      </div>
                                      {resourceLoadComboMetrics.map(mKey => {
                                        const mCfg = COMBO_METRIC_CONFIG[mKey];
                                        if (!mCfg) return null;
                                        const cItem = payload.find(p => p.dataKey === mCfg.key);
                                        const valNum = Number(cItem?.value ?? (barItem as any)?.[mCfg.key] ?? 0);
                                        return (
                                          <div key={mKey} className="flex items-center justify-between text-xs font-semibold gap-4 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                            <span className="text-slate-400 flex items-center gap-1.5 truncate max-w-[140px]">
                                              <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: mCfg.color }} />
                                              <span className="truncate">{mCfg.label}:</span>
                                            </span>
                                            <span className="font-black font-mono text-sm shrink-0" style={{ color: mCfg.color }}>
                                              {mKey === 'totalCost' || mKey === 'actualCost'
                                                ? formatFullAmountWithScale(valNum).displayFull
                                                : `${valNum.toLocaleString()}${mCfg.unit}`}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar 
                            xAxisId="bottom"
                            dataKey="count" 
                            radius={[0, 12, 12, 0]}
                            isAnimationActive={!hasAnimated}
                            barSize={24}
                            filter="url(#resourceGlow)"
                            className="cursor-pointer"
                            onClick={(entry: any, index: number) => {
                              const barName = entry?.name || resourceLoadData[index]?.name;
                              if (barName) {
                                handleBarOpenModal(barName, resourceLoadType);
                              }
                            }}
                          >
                            {resourceLoadData.map((entry, index) => (
                              <Cell 
                                key={`cell-h-${index}`} 
                                fill={`url(#resourceLoadGradH-${index})`} 
                                className="cursor-pointer transition-opacity hover:opacity-85"
                                onClick={() => {
                                  handleBarOpenModal(entry.name, resourceLoadType);
                                }}
                              />
                            ))}
                            <LabelList 
                              dataKey="count" 
                              content={(props: any) => {
                                const { x, y, width, height, value } = props;
                                if (value === undefined || value === null) return null;
                                const total = resourceLoadInsights?.totalCount || 1;
                                const pct = ((Number(value) / total) * 100).toFixed(0);
                                const cx = Number(x) + Number(width) + 8;
                                const cy = Number(y) + Number(height) / 2 + 4;

                                return (
                                  <g>
                                    <text x={cx} y={cy} textAnchor="start" className="font-mono select-none">
                                      <tspan 
                                        fill={activeTheme?.isDark ? "#ffffff" : "#0f172a"} 
                                        fontWeight="900" 
                                        fontSize="11"
                                      >
                                        {value}
                                      </tspan>
                                      {showResourceLoadPct && (
                                        <tspan 
                                          fill={activeTheme?.isDark ? "#38bdf8" : "#2563eb"} 
                                          fontWeight="800" 
                                          fontSize="10"
                                        >
                                          {` (${pct}%)`}
                                        </tspan>
                                      )}
                                    </text>
                                  </g>
                                );
                              }}
                            />
                          </Bar>
                          {resourceLoadComboMetrics.map(mKey => {
                            const mCfg = COMBO_METRIC_CONFIG[mKey];
                            if (!mCfg) return null;
                            return (
                              <Area 
                                key={`area-h-${mKey}`}
                                xAxisId="top"
                                type="monotone" 
                                dataKey={mCfg.key} 
                                name={mCfg.label}
                                stroke={`url(#resourceComboLineGradH-${mKey})`} 
                                strokeWidth={1.5} 
                                fill={`url(#resourceComboAreaGradH-${mKey})`}
                                filter={`url(#resourceComboLineGlowH-${mKey})`}
                                dot={(props: any) => {
                                  const { cx, cy, key } = props;
                                  if (cx === undefined || cy === undefined) return null;
                                  return (
                                    <g key={key || `dot-h-${mKey}-${cx}-${cy}`}>
                                      <circle cx={cx} cy={cy} r={5.5} fill={mCfg.color} fillOpacity={0.2} />
                                      <circle cx={cx} cy={cy} r={3} fill={mCfg.color} stroke={activeTheme?.isDark ? '#0f172a' : '#ffffff'} strokeWidth={1.5} />
                                    </g>
                                  );
                                }}
                                activeDot={{ r: 6, fill: mCfg.color, strokeWidth: 2, stroke: '#ffffff' }}
                                isAnimationActive={!hasAnimated}
                              >
                                <LabelList 
                                  dataKey={mCfg.key} 
                                  position="right" 
                                  content={(props: any) => {
                                    const { x, y, value } = props;
                                    if (value === undefined || value === null) return null;
                                    const textStr = mKey === 'totalCost' || mKey === 'actualCost'
                                      ? formatFullAmountWithScale(Number(value)).displayShort
                                      : `${value.toLocaleString()}${mCfg.unit}`;
                                    const approxWidth = Math.max(36, textStr.length * 6.5 + 12);
                                    return (
                                      <g transform={`translate(${x + 10},${y - 8})`}>
                                        <rect 
                                          x={0} 
                                          y={-1} 
                                          width={approxWidth} 
                                          height={16} 
                                          rx={8} 
                                          fill={activeTheme?.isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)'}
                                          stroke={mCfg.color}
                                          strokeWidth={1.2}
                                        />
                                        <text 
                                          x={approxWidth / 2} 
                                          y={11} 
                                          textAnchor="middle" 
                                          fill={mCfg.color} 
                                          fontWeight="900" 
                                          fontSize="9.5" 
                                          className="font-mono select-none"
                                        >
                                          {textStr}
                                        </text>
                                      </g>
                                    );
                                  }}
                                />
                              </Area>
                            );
                          })}
                        </ComposedChart>
                      </ResponsiveContainer>
                    );
                  })()}

                  {resourceLoadChartStyle === 'donut' && (
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center py-4">
                      {/* Left Donut Visualization */}
                      <div className="relative md:col-span-6 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={340}>
                          <PieChart>
                            <Pie
                              data={resourceLoadData}
                              cx="50%"
                              cy="50%"
                              innerRadius={82}
                              outerRadius={118}
                              paddingAngle={4}
                              dataKey="count"
                              isAnimationActive={!hasAnimated}
                            >
                              {resourceLoadData.map((entry, index) => {
                                const col = getUniqueItemColor(index, !!activeTheme?.isDark);
                                return (
                                  <Cell 
                                    key={`cell-p-${index}`} 
                                    fill={col.start} 
                                    stroke={activeTheme?.isDark ? "#0f172a" : "#ffffff"} 
                                    strokeWidth={3} 
                                    className="cursor-pointer transition-opacity hover:opacity-85"
                                    onClick={() => {
                                      handleBarOpenModal(entry.name, resourceLoadType);
                                    }}
                                  />
                                );
                              })}
                            </Pie>
                            <RechartsTooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const pct = resourceLoadInsights.totalCount > 0 ? ((data.count / resourceLoadInsights.totalCount) * 100).toFixed(1) : "0.0";
                                  return (
                                    <div className={cn(
                                      "p-4 rounded-2xl border shadow-xl space-y-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                      activeTheme?.isDark 
                                        ? "bg-slate-900/95 border-indigo-500/30 text-slate-100 shadow-slate-950/60" 
                                        : "bg-white/95 border-indigo-200/80 text-slate-900 shadow-slate-200/60"
                                    )}>
                                      <div className="text-xs font-black truncate border-b border-slate-200 dark:border-slate-800 pb-1.5 mb-1 text-indigo-500">
                                        {data.name}
                                      </div>
                                      <div className="flex items-center justify-between text-xs font-semibold gap-4">
                                        <span className="text-slate-400">Allocated Volume:</span>
                                        <span className="font-black text-indigo-600 dark:text-indigo-400 font-mono">{data.count} lots ({pct}%)</span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                          <span className={cn("text-[9px] font-black uppercase tracking-widest text-indigo-500")}>
                            Total Scope
                          </span>
                          <span className={cn("text-3xl font-black tracking-tight my-0.5 font-mono", activeTheme?.isDark ? "text-white" : "text-slate-900")}>
                            {resourceLoadInsights.totalCount}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            lots distributed
                          </span>
                        </div>
                      </div>

                      {/* Right Interactive Rank & Progress Cards */}
                      <div className="md:col-span-6 flex flex-col justify-center">
                        <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400 mb-3 border-b pb-2.5 border-slate-500/10">
                          <span>{resourceLoadInsights.typeSingular} Ranking & Load</span>
                          <span className="text-[10px] text-indigo-500">{resourceLoadData.length} Categories</span>
                        </div>
                        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {resourceLoadData.map((item, index) => {
                            const col = getUniqueItemColor(index, !!activeTheme?.isDark);
                            const color = col.start;
                            const pct = resourceLoadInsights.totalCount > 0 ? ((item.count / resourceLoadInsights.totalCount) * 100).toFixed(1) : "0.0";
                            return (
                              <div 
                                key={index} 
                                className={cn(
                                  "p-3 rounded-2xl border transition-all duration-200 group hover:shadow-md cursor-pointer",
                                  activeTheme?.isDark 
                                    ? "bg-slate-900/40 border-slate-800/80 hover:bg-slate-900/80 hover:border-indigo-500/30" 
                                    : "bg-white/80 border-slate-200/70 hover:bg-white hover:border-indigo-300"
                                )}
                                onClick={() => handleBarOpenModal(item.name, resourceLoadType)}
                              >
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="w-3 h-3 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: color }} />
                                    <span className={cn("font-black uppercase truncate", activeTheme?.isDark ? "text-slate-200" : "text-slate-800")}>
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5 font-mono">
                                    <span className={cn("font-black text-xs", activeTheme?.isDark ? "text-slate-300" : "text-slate-700")}>
                                      {item.count} <span className="text-[10px] text-slate-400 font-normal">lots</span>
                                    </span>
                                    {showResourceLoadPct && (
                                      <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full min-w-[50px] text-center">
                                        {pct}%
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {/* Mini Progress Indicator Bar */}
                                <div className={cn("w-full h-1.5 rounded-full overflow-hidden", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-100")}>
                                  <div 
                                    className="h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${pct}%`, backgroundColor: color }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ChartBox>
          </div>
        )}

        {(!hiddenPanels.la || maximizedPanel === 'la') && (
          <div className={(maximizedPanel === 'la' || hiddenPanels.expro) ? "col-span-1 lg:col-span-2" : "h-full"}>
            <ChartBox 
              title="LA Progress Overview" 
              subtitle="Land Acquisition Status Breakdown" 
              isMaximized={maximizedPanel === 'la'}
              onMaximize={() => setMaximizedPanel(maximizedPanel === 'la' ? null : 'la')}
          badge={showCurrentWeekUpdates && totalLAWeeklyUpdates > 0 ? (
            <span className="flex items-center gap-1.5 font-display">
              <span className={activeTheme?.isDark ? "text-slate-300" : "text-slate-700 font-bold"}>{filteredData.length}</span>
              <span className="text-red-500 font-extrabold font-mono text-xs shadow-3xs px-1.5 py-0.5 rounded bg-red-500/5 select-none animate-pulse">+{totalLAWeeklyUpdates}</span>
            </span>
          ) : filteredData.length} 
          extra={(
            <div className="flex items-center gap-1.5">
              {/* Select View Dropdown */}
              <select
                value={laChartStyle}
                onChange={(e) => setLaChartStyle(e.target.value as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                  activeTheme?.isDark 
                    ? "bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700" 
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                )}
              >
                <option value="classic">Classic View</option>
                <option value="spectacular">✨ Analytics View</option>
                <option value="velocity">📈 Velocity View</option>
              </select>
            </div>
          )}
          activeTheme={activeTheme}
        >
            {hasAnimated && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={laChartStyle}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  onMouseEnter={() => setIsLaHovered(true)}
                  onMouseLeave={() => setIsLaHovered(false)}
                  className="w-full h-full"
                >
                  {laChartStyle === "classic" ? (
                    <div className="flex flex-col h-full gap-5">
                      {/* Interactive inline date filter controls */}
                      <div className={cn(
                        "flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border transition-all duration-300",
                        activeTheme?.isDark 
                          ? "bg-slate-950/40 border-slate-800/80 hover:border-indigo-500/20" 
                          : "bg-slate-50/50 border-slate-150 hover:border-indigo-500/20"
                      )}>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "p-1.5 rounded-xl flex items-center justify-center",
                            activeTheme?.isDark ? "bg-slate-900 text-indigo-400" : "bg-white text-indigo-600 shadow-3xs"
                          )}>
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col">
                            <span className={cn("text-[9px] font-black uppercase tracking-wider", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>Time-Series Filter</span>
                            <span className={cn("text-[10px] font-black uppercase tracking-wider", activeTheme?.isDark ? "text-indigo-400" : "text-indigo-600")}>
                              {showCurrentWeekUpdates ? "Weekly Mode" : "All Dates Mode"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                          {/* Filter Dropdown */}
                          <select
                            value={showCurrentWeekUpdates ? "this-week" : "all"}
                            onChange={(e) => {
                              const nextVal = e.target.value === "this-week";
                              setShowCurrentWeekUpdates(nextVal);
                              if (!nextVal) {
                                setWeekOffset(0);
                              }
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                              activeTheme?.isDark 
                                ? "bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700" 
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                            )}
                          >
                            <option value="all">All Dates</option>
                            <option value="this-week">This Week Only</option>
                          </select>

                          {showCurrentWeekUpdates && (
                            /* Week Navigation */
                            <div className={cn(
                              "flex items-center gap-1 rounded-xl p-0.5 border shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]",
                              activeTheme?.isDark 
                                ? "bg-slate-950/85 border-slate-800/80" 
                                : "bg-white border-slate-200"
                            )}>
                              <button
                                type="button"
                                onClick={() => setWeekOffset(prev => prev - 1)}
                                className={cn(
                                  "p-1 rounded-lg transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105",
                                  activeTheme?.isDark 
                                    ? "hover:bg-slate-800/90 text-slate-400 hover:text-slate-100" 
                                    : "hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                                )}
                                title="Previous Week"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <span className={cn(
                                "text-[9px] font-black tracking-widest uppercase px-2 text-center min-w-[125px] sm:min-w-[140px] select-none",
                                activeTheme?.isDark ? "text-slate-300" : "text-slate-600 font-bold"
                              )}>
                                {parsedCurrentWeekRange.formatted}
                              </span>
                              <button
                                type="button"
                                onClick={() => setWeekOffset(prev => prev + 1)}
                                className={cn(
                                  "p-1 rounded-lg transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105",
                                  activeTheme?.isDark 
                                    ? "hover:bg-slate-800/90 text-slate-400 hover:text-slate-100" 
                                    : "hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                                )}
                                title="Next Week"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <ResponsiveContainer width="100%" height={maximizedPanel === 'la' ? "100%" : 430}>
                      <BarChart 
                        data={laProgressData} 
                        layout="vertical" 
                        margin={{ left: 20, right: 140, top: 20, bottom: 20 }}
                        barGap={0}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 900, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase'}} 
                          width={200} 
                          interval={0}
                        />
                        <RechartsTooltip 
                          cursor={{fill: activeTheme?.isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.4)'}}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const lotCount = data.lotCount;
                              const remaining = Math.round(data.remaining);
                              const total = lotCount + remaining;
                              const pct = total > 0 ? ((lotCount / total) * 100).toFixed(1) : "0.0";
                              return (
                                <div className={cn(
                                  "p-4 rounded-2xl border shadow-lg space-y-3 min-w-[210px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                  activeTheme?.isDark 
                                    ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-slate-950/40" 
                                    : "bg-white/95 border-slate-200/80 text-slate-900 shadow-slate-200/50"
                                )}>
                                  <div className={cn("flex items-center gap-2 border-b pb-2", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                    <span className="text-[11px] font-black uppercase tracking-wider">{data.name.split(' - ')[0]}</span>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-4 text-xs">
                                      <span className={activeTheme?.isDark ? "text-slate-405 font-medium" : "text-slate-500 font-semibold"}>Progress</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className={cn("font-black", activeTheme?.isDark ? "text-slate-100" : "text-slate-950")}>{lotCount}</span>
                                        <span className={cn(
                                          "text-[9px] font-black px-1.5 py-0.5 rounded",
                                          activeTheme?.isDark ? "text-brand-400 bg-brand-950/40" : "text-brand-600 bg-brand-50/80"
                                        )}>%{pct}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 text-xs">
                                      <span className={activeTheme?.isDark ? "text-slate-405 font-medium" : "text-slate-500 font-semibold"}>Remaining</span>
                                      <span className={activeTheme?.isDark ? "text-slate-400" : "text-slate-400 font-semibold"}>{remaining}</span>
                                    </div>
                                    <div className={cn("flex items-center justify-between gap-4 text-xs pt-1.5 border-t border-dashed", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                                      <span className={activeTheme?.isDark ? "text-slate-450 font-bold" : "text-slate-400 font-bold"}>Total Surveyed</span>
                                      <span className={activeTheme?.isDark ? "text-slate-200" : "text-slate-600 font-extrabold"}>{total}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          align="center"
                          iconType="circle"
                          wrapperStyle={{ 
                            fontSize: '9px', 
                            fontWeight: 900, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.1em', 
                            paddingTop: 0, 
                            paddingBottom: 30,
                            color: activeTheme?.isDark ? '#94a3b8' : '#64748b'
                          }}
                        />
                        <Bar dataKey="lotCount" name="Lot Count" stackId="a" radius={[2, 0, 0, 2]} barSize={16} isAnimationActive={false}>
                          {laProgressData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                        <Bar dataKey="remaining" name="Remaining" stackId="a" fill={activeTheme?.isDark ? "#1e293b" : "#f1f5f9"} radius={[0, 2, 2, 0]} barSize={16} isAnimationActive={false}>
                          <LabelList 
                            dataKey="remaining" 
                            position="right" 
                            content={(props: any) => {
                              const { x, y, width, index } = props;
                              const rowData = laProgressData[index];
                              if (!rowData) return null;
                              const lotCount = rowData.lotCount;
                              const actualRemaining = rowData.remaining;
                              const valVal = Math.round(actualRemaining);
                              const total = lotCount + valVal;
                              
                              const targetX = x + width;
                              const pct = total > 0 ? ((lotCount / total) * 100).toFixed(1) : "0.0";
                              const weeklyAdd = currentWeekCategoryCounts[index] || 0;
    
                              const labelColor = activeTheme?.isDark ? "#f1f5f9" : "#1e293b";
                              const slashColor = activeTheme?.isDark ? "#475569" : "#94a3b8";
                              const pctColor = activeTheme?.isDark ? "#38bdf8" : "#3b82f6";
    
                              if (lotCount === 0 && valVal === 0) {
                                return (
                                  <g>
                                    <text x={targetX + 10} y={y + 12} fill={slashColor} fontSize={11} fontWeight={900} textAnchor="start">
                                      0 <tspan fill={slashColor} fontWeight={300} dx={6}>/ 0</tspan> <tspan fill={slashColor} fontWeight={300} dx={8}>(0.0%)</tspan>
                                    </text>
                                  </g>
                                );
                              }
                              return (
                                <g>
                                  <text x={targetX + 10} y={y + 12} fill={labelColor} fontSize={11} fontWeight={900} textAnchor="start">
                                    {lotCount} 
                                    <tspan fill={slashColor} fontWeight={300} dx={6}>/ {total}</tspan>
                                    <tspan fill={pctColor} fontWeight={300} dx={8}>({pct}%)</tspan>
                                    {showCurrentWeekUpdates && weeklyAdd > 0 && (
                                      <tspan fill="#ef4444" fontWeight={900} dx={6}>+{weeklyAdd}</tspan>
                                    )}
                                  </text>
                                </g>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  ) : laChartStyle === "spectacular" ? (
                    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-350">
                      {/* OVERALL RADIAL STATS SUMMARIES */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Total Lots Stat Card */}
                        <div className={cn(
                          "p-4 rounded-3xl border flex items-center justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group h-[108px]",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80 hover:border-amber-500/50" : "bg-slate-50/70 border-slate-200/60 hover:border-amber-500/30"
                        )}>
                          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-amber-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1">
                              <Zap className="w-3.5 h-3.5 fill-amber-500" /> Land Acquisition Base
                            </span>
                            <h4 className="text-2xl font-black font-display mt-0.5">{chartTotals.totalLots.toLocaleString()} <span className="text-xs font-black text-slate-400">Lots</span></h4>
                            <p className="text-[10px] font-medium text-slate-450 truncate">Surveyed lots in scope</p>
                          </div>
                          <div className={cn("p-3 rounded-2xl flex-shrink-0 ml-3", activeTheme?.isDark ? "bg-slate-950" : "bg-white shadow-xs")}>
                            <Sparkles className="w-5 h-5 text-amber-500" />
                          </div>
                        </div>
    
                        {/* Completed Lots Stat Card */}
                        <div className={cn(
                          "p-4 rounded-3xl border flex items-center justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group h-[108px]",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80 hover:border-emerald-500/50" : "bg-slate-50/70 border-slate-200/60 hover:border-emerald-500/30"
                        )}>
                          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 fill-emerald-500/20" /> Completed Handover
                            </span>
                            <h4 className="text-2xl font-black font-display mt-0.5 text-emerald-500">
                              {chartTotals.handedOver.toLocaleString()} <span className="text-xs font-black text-slate-400">Lots</span>
                            </h4>
                            <p className="text-[10px] font-medium text-slate-450 truncate">Handed over to works</p>
                          </div>
                          <div className={cn("p-3 rounded-2xl", activeTheme?.isDark ? "bg-slate-950" : "bg-white shadow-xs")}>
                            <span className="text-xs font-black text-emerald-500 font-mono bg-emerald-500/10 px-2 py-1 rounded">
                              {((chartTotals.handedOver / chartTotals.totalLots) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
    
                        {/* Active Pipeline Progress Stat Card */}
                        <div className={cn(
                          "p-4 rounded-3xl border flex items-center justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group h-[108px]",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80 hover:border-blue-500/50" : "bg-slate-50/70 border-slate-200/60 hover:border-blue-500/30"
                        )}>
                          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-blue-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Pipeline Clearance
                            </span>
                            <h4 className="text-2xl font-black font-display mt-0.5 text-blue-500">
                              {totalAcquiredLots.toLocaleString()} <span className="text-xs font-black text-slate-400 font-sans">Lots</span>
                            </h4>
                            <p className="text-[10px] font-medium text-slate-450 truncate">Acquired: Paid + PTE + CNO</p>
                          </div>
                          <div className={cn("p-3 rounded-2xl", activeTheme?.isDark ? "bg-slate-950" : "bg-white shadow-xs")}>
                            <span className="text-xs font-black text-blue-500 font-mono bg-blue-500/10 px-2 py-1 rounded">
                              {chartTotals.totalLots > 0 ? ((totalAcquiredLots / chartTotals.totalLots) * 100).toFixed(1) : "0.0"}%
                            </span>
                          </div>
                        </div>
                      </div>
    
                      {/* SPLIT SCREEN VISUAL ANALYTICS CONTAINER */}
                      <div className={cn(
                        "grid grid-cols-1 gap-6 items-stretch",
                        maximizedPanel === 'la' ? "lg:grid-cols-12" : "grid-cols-1"
                      )}>
                        {/* LEFT COLUMN: THE GLOWING DONUT STAGE DISTRIBUTOR */}
                        <div className={cn(
                          maximizedPanel === 'la' ? "lg:col-span-5 h-auto" : "col-span-1 lg:h-[450px]",
                          "p-6 rounded-3xl border flex flex-col justify-between shadow-2xs relative overflow-hidden",
                          activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80"
                        )}>
                          <div className="space-y-1 mb-4 z-10">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Visual Category Volume</span>
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Milestone Distribution</h4>
                          </div>
                          
                          {/* Dynamic Glowing Radial/Pie Chart */}
                          <div className="relative flex items-center justify-center h-[260px] w-full z-10 select-none">
                            {/* Inner Text Overlay inside Donut Chart */}
                            <div className="absolute flex flex-col items-center justify-center text-center">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Surveyed</span>
                              <span className="text-3xl font-black font-display tracking-tight text-slate-900 dark:text-slate-100">{chartTotals.totalLots.toLocaleString()}</span>
                              <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full mt-1.5 uppercase tracking-widest">Active Scope</span>
                            </div>
    
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={laProgressData.filter(d => d.lotCount > 0)}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={78}
                                  outerRadius={105}
                                  paddingAngle={3}
                                  dataKey="lotCount"
                                  stroke={activeTheme?.isDark ? "#0f172a" : "#fff"}
                                  strokeWidth={2}
                                  isAnimationActive={false}
                                >
                                  {laProgressData.filter(d => d.lotCount > 0).map((entry, index) => (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={entry.color} 
                                      className="hover:opacity-90 hover:scale-105 transition-all duration-300 cursor-pointer origin-center"
                                      style={{ filter: `drop-shadow(0 0 6px ${entry.color}33)` }}
                                    />
                                  ))}
                                </Pie>
                                <RechartsTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className={cn(
                                          "p-3 rounded-2xl border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150",
                                          activeTheme?.isDark ? "bg-slate-900/95 border-slate-800 text-white" : "bg-white/95 border-slate-200 text-slate-900"
                                        )}>
                                          <div className="flex items-center gap-2 border-b pb-1.5 mb-1.5 border-slate-100/10">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                            <span className="text-[10px] font-black uppercase tracking-wider">{data.name}</span>
                                          </div>
                                          <div className="text-xs font-black">{data.lotCount.toLocaleString()} Lots</div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
    
                          {/* Floating Mini Summary of Custom Categories: Total Paid, With PTE, With CNO, Handed Over */}
                          <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] z-10">
                            {(() => {
                              const total = chartTotals.totalLots || 1;
                              const paidCount = chartTotals.partiallyPaid + chartTotals.fullyPaid;
                              const customSummaryItems = [
                                {
                                  name: "Total Paid",
                                  lotCount: paidCount,
                                  pct: ((paidCount / total) * 100).toFixed(1),
                                  color: '#10B981'
                                },
                                {
                                  name: "With PTE",
                                  lotCount: chartTotals.signedPte,
                                  pct: ((chartTotals.signedPte / total) * 100).toFixed(1),
                                  color: '#EC4899'
                                },
                                {
                                  name: "With CNO",
                                  lotCount: chartTotals.withCno,
                                  pct: ((chartTotals.withCno / total) * 100).toFixed(1),
                                  color: '#8B5CF6'
                                },
                                {
                                  name: "Handed Over",
                                  lotCount: chartTotals.handedOver,
                                  pct: ((chartTotals.handedOver / total) * 100).toFixed(1),
                                  color: '#EAB308'
                                }
                              ];
                              return customSummaryItems.map((entry, index) => (
                                <div key={index} className={cn(
                                  "p-2 rounded-xl flex items-center justify-between border",
                                  activeTheme?.isDark ? "bg-slate-900/40 border-slate-800/60" : "bg-slate-50/50 border-slate-200/50"
                                )}>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                    <span className="font-semibold text-slate-450 uppercase tracking-wider whitespace-nowrap">{entry.name}</span>
                                  </div>
                                  <span className="font-bold font-mono">{entry.pct}%</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
    
                        {/* RIGHT COLUMN: INTERACTIVE PROGRESS STAGE METERS */}
                        <div className={cn(
                          maximizedPanel === 'la' ? "lg:col-span-7 h-auto" : "col-span-1 lg:h-[480px]",
                          "p-6 rounded-3xl border flex flex-col justify-between shadow-2xs relative overflow-hidden",
                          activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80"
                        )}>
                          <div className="space-y-1 mb-4 z-10 flex items-center justify-between">
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Detailed Stages Pipeline</span>
                              <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Acquisition Milestones Progress</h4>
                            </div>
                            <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">Live Status</span>
                          </div>
    
                          {/* Scrollable grid container of milestones */}
                          <div className="space-y-3 flex-1 overflow-y-auto pr-1 select-none scrollbar-thin">
                            {laProgressData.map((item, index) => {
                              const total = item.lotCount + Math.round(item.remaining);
                              const pct = total > 0 ? ((item.lotCount / total) * 100).toFixed(1) : "0.0";
                              const weeklyAdd = currentWeekCategoryCounts[index] || 0;
    
                              return (
                                <div 
                                  key={index} 
                                  className={cn(
                                    "p-3 rounded-2xl border transition-all duration-300 group/item flex flex-col gap-2 relative overflow-hidden",
                                    activeTheme?.isDark 
                                      ? "bg-slate-900/30 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/60" 
                                      : "bg-slate-50/40 border-slate-100 hover:border-slate-200/80 hover:bg-slate-50/80"
                                  )}
                                >
                                  {/* Micro Color accent border left */}
                                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: item.color }} />
    
                                  <div className="flex items-center justify-between gap-4 pl-1">
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                      <span className="text-xs font-black uppercase tracking-wide pr-1">{item.name}</span>
                                      {weeklyAdd > 0 && (
                                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 uppercase tracking-widest animate-pulse">
                                          +{weeklyAdd} wk
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 font-mono text-[10px]">
                                      <span className="font-black text-slate-800 dark:text-slate-200">{item.lotCount.toLocaleString()}</span>
                                      <span className="text-slate-400">/</span>
                                      <span className="text-slate-450">{total.toLocaleString()}</span>
                                      <span 
                                        className="font-black text-xs px-2 py-0.5 rounded-lg ml-1"
                                        style={{ 
                                          backgroundColor: `${item.color}15`, 
                                          color: item.color 
                                        }}
                                      >
                                        {pct}%
                                      </span>
                                    </div>
                                  </div>
    
                                  {/* Spectacular Custom Glow/Gradient Progress Bar */}
                                  <div className={cn("w-full h-2 rounded-full overflow-hidden relative", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-200/60")}>
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut" }}
                                      className="h-full rounded-full relative"
                                      style={{ 
                                        backgroundColor: item.color,
                                        boxShadow: `0 0 10px ${item.color}77`
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-350">
                      {/* Metric Summary Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <div className={cn(
                          "p-4 rounded-2xl border flex flex-col justify-between shadow-3xs relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Current Week Pace</span>
                            <h4 className="text-2xl font-black font-display mt-1 text-blue-500">
                              {velocityMetrics.currentCount} <span className="text-xs font-semibold text-slate-400">Updates</span>
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Land acquisition milestones this week</p>
                        </div>

                        <div className={cn(
                          "p-4 rounded-2xl border flex flex-col justify-between shadow-3xs relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">4-Week Average Pace</span>
                            <h4 className="text-2xl font-black font-display mt-1 text-slate-700 dark:text-slate-300">
                              {velocityMetrics.avgPrev.toFixed(1)} <span className="text-xs font-semibold text-slate-400">Updates</span>
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Typical weekly run-rate</p>
                        </div>

                        <div className={cn(
                          "p-4 rounded-2xl border flex flex-col justify-between shadow-3xs relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">WoW Pace Variance</span>
                            <div className="flex items-center gap-2 mt-1">
                              {velocityMetrics.status === "up" ? (
                                <span className="text-2xl font-black font-display text-emerald-500 flex items-center gap-1">
                                  <TrendingUp className="w-5 h-5" /> +{velocityMetrics.percentageChange}%
                                </span>
                              ) : velocityMetrics.status === "down" ? (
                                <span className="text-2xl font-black font-display text-rose-500 flex items-center gap-1">
                                  <TrendingDown className="w-5 h-5" /> {velocityMetrics.percentageChange}%
                                </span>
                              ) : (
                                <span className="text-2xl font-black font-display text-slate-500 flex items-center gap-1">
                                  Stable
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Pace compared to 4-week average</p>
                        </div>

                        <div className={cn(
                          "p-4 rounded-2xl border flex flex-col justify-between shadow-3xs relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Peak Performance Window</span>
                            <h4 className="text-sm font-black mt-1.5 truncate text-amber-500">
                              {velocityMetrics.peakWeek}
                            </h4>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">Highest weekly accomplishment volume</p>
                        </div>
                      </div>

                      {/* Main Velocity Chart */}
                      <div className={cn(
                        "p-6 rounded-3xl border shadow-3xs flex flex-col justify-between relative overflow-hidden",
                        activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80"
                      )}>
                        <div className="space-y-1 mb-4 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Velocity Analysis</span>
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Land Acquisition Progress WoW Trend</h4>
                          </div>
                          <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">
                            5-Week Running Window
                          </span>
                        </div>

                        <div className="w-full" style={{ height: maximizedPanel === 'la' ? "550px" : "380px" }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                              data={weeklyVelocityData}
                              margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                              <XAxis 
                                dataKey="weekLabel" 
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b' }}
                              />
                              <YAxis 
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b' }}
                              />
                              <RechartsTooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className={cn(
                                        "p-4 rounded-2xl border shadow-lg space-y-3 min-w-[240px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                        activeTheme?.isDark 
                                          ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-slate-950/40" 
                                          : "bg-white/95 border-slate-200/80 text-slate-900 shadow-slate-200/50"
                                      )}>
                                        <div className={cn("border-b pb-2", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                                          <div className="text-xs font-black uppercase tracking-wider">{data.weekLabel}</div>
                                          <div className="text-[10px] text-slate-400 font-medium">{data.dateRange}</div>
                                        </div>
                                        <div className="space-y-2">
                                          {payload.map((entry: any, idx: number) => {
                                            if (entry.dataKey === "Total Progress") return null;
                                            return (
                                              <div key={idx} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5">
                                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                  <span className="text-slate-500 font-semibold">{entry.name}</span>
                                                </div>
                                                <span className="font-extrabold">{entry.value}</span>
                                              </div>
                                            );
                                          })}
                                          <div className={cn("flex items-center justify-between text-xs pt-2 border-t border-dashed font-black", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                                            <span className="text-slate-400">Total Progress Count</span>
                                            <span className="text-amber-500 font-extrabold">{data["Total Progress"]}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend 
                                verticalAlign="top" 
                                align="center"
                                iconType="circle"
                                wrapperStyle={{ 
                                  fontSize: '9px', 
                                  fontWeight: 900, 
                                  textTransform: 'uppercase', 
                                  letterSpacing: '0.1em', 
                                  paddingBottom: 20,
                                  color: activeTheme?.isDark ? '#94a3b8' : '#64748b'
                                }}
                              />
                              <Bar dataKey="Notice & Offers" name="Notice & Offers" stackId="velocityStack" fill="#60A5FA" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                              <Bar dataKey="Agreements & Access" name="Agreements & Access" stackId="velocityStack" fill="#A78BFA" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                              <Bar dataKey="Payment & Handover" name="Payment & Handover" stackId="velocityStack" fill="#10B981" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                              <Bar dataKey="Crops & Trees" name="Crops & Trees" stackId="velocityStack" fill="#F43F5E" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                              <Line 
                                type="monotone" 
                                dataKey="Total Progress" 
                                name="Total Progress Rate" 
                                stroke="#F59E0B" 
                                strokeWidth={3} 
                                dot={{ fill: "#F59E0B", strokeWidth: 2, r: 4 }} 
                                activeDot={{ r: 6 }}
                                isAnimationActive={false}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
        </ChartBox>
          </div>
        )}

        {(!hiddenPanels.expro || maximizedPanel === 'expro') && (
          <div className={(maximizedPanel === 'expro' || hiddenPanels.la) ? "col-span-1 lg:col-span-2" : "h-full"}>
            <ChartBox 
              title="Expro Progress Overview" 
              subtitle="Expropriation Legal Milestones" 
              badge={exproTotalCount} 
              activeTheme={activeTheme}
              isMaximized={maximizedPanel === 'expro'}
              onMaximize={() => setMaximizedPanel(maximizedPanel === 'expro' ? null : 'expro')}
              extra={(
                <select
                  value={exproChartStyle}
                  onChange={(e) => setExproChartStyle(e.target.value as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                    activeTheme?.isDark 
                      ? "bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700" 
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  )}
                >
                  <option value="classic">Classic View</option>
                  <option value="spectacular">✨ Analytics View</option>
                </select>
              )}
            >
              {hasAnimated && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={exproChartStyle}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  onMouseEnter={() => setIsExproHovered(true)}
                  onMouseLeave={() => setIsExproHovered(false)}
                  className="w-full h-full"
                >
                  {exproChartStyle === "classic" ? (
                    <ResponsiveContainer width="100%" height={maximizedPanel === 'expro' ? "100%" : 500} >
                      <BarChart data={exproProgressData} layout="vertical" margin={{ left: 20, right: 100, top: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                        <XAxis type="number" hide />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 900, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase'}} 
                          width={200} 
                          interval={0}
                        />
                        <RechartsTooltip 
                          cursor={{fill: activeTheme?.isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.4)'}}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const val = data.value;
                              return (
                                <div className={cn(
                                  "p-4 rounded-2xl border shadow-lg space-y-2.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                  activeTheme?.isDark 
                                    ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-slate-950/40" 
                                    : "bg-white/95 border-slate-200/80 text-slate-900 shadow-slate-200/50"
                                )}>
                                  <div className={cn("flex items-center gap-2 border-b pb-2", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                    <span className="text-[11px] font-black uppercase tracking-wider">{data.name.split(' - ')[0]}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs pt-1">
                                    <span className={activeTheme?.isDark ? "text-slate-405 font-medium" : "text-slate-500 font-semibold"}>Legal Stage Count</span>
                                    <span className={cn("font-black bg-indigo-50/80 px-2 py-0.5 rounded text-[13px]", activeTheme?.isDark ? "text-indigo-400 bg-indigo-950/40" : "text-indigo-600")}>{val} Lots</span>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          align="center"
                          iconType="circle"
                          wrapperStyle={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 0, paddingBottom: 30 }}
                        />
                        <Bar dataKey="value" name="Expro Count" stackId="b" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                           {exproProgressData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="value" position="right" fontSize={11} fontWeight={900} fill={activeTheme?.isDark ? "#f1f5f9" : "#1e293b"} offset={10} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-350">
                      {/* METRIC HIGHLIGHT PANELS */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Expro Total Scope */}
                        <div className={cn(
                          "p-4 rounded-3xl border flex items-center justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group h-[108px]",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80 hover:border-violet-500/50" : "bg-slate-50/70 border-slate-200/60 hover:border-violet-500/30"
                        )}>
                          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-violet-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-violet-500 flex items-center gap-1">
                              <Scale className="w-3.5 h-3.5" /> Total Legal Focus
                            </span>
                            <h4 className="text-2xl font-black font-display mt-0.5">{exproTotalCount.toLocaleString()} <span className="text-xs font-black text-slate-400">Lots</span></h4>
                            <p className="text-[10px] font-medium text-slate-400 truncate">Undergoing expropriation workflow</p>
                          </div>
                          <div className={cn("p-3 rounded-2xl", activeTheme?.isDark ? "bg-slate-950" : "bg-white shadow-xs")}>
                            <Gavel className="w-5 h-5 text-violet-500" />
                          </div>
                        </div>
    
                        {/* Expro Stage Saturation */}
                        <div className={cn(
                          "p-4 rounded-3xl border flex items-center justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group h-[108px]",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80 hover:border-rose-500/50" : "bg-slate-50/70 border-slate-200/60 hover:border-rose-500/30"
                        )}>
                          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-rose-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform duration-500" />
                          <div className="space-y-1 min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 flex items-center gap-1">
                              <Activity className="w-3.5 h-3.5" /> Stage Dispersion
                            </span>
                            <h4 className="text-2xl font-black font-display mt-0.5 text-rose-500">
                              {exproProgressData.filter(d => d.value > 0).length} <span className="text-xs font-black text-slate-400 font-sans">Active Phases</span>
                            </h4>
                            <p className="text-[10px] font-medium text-slate-400 truncate">Workflow steps with active lots</p>
                          </div>
                          <div className={cn("p-3 rounded-2xl", activeTheme?.isDark ? "bg-slate-950" : "bg-white shadow-xs")}>
                            <TrendingUp className="w-5 h-5 text-rose-500" />
                          </div>
                        </div>
                      </div>
    
                      {/* SPLIT BENTO SCREEN */}
                      <div className={cn(
                        "grid grid-cols-1 gap-6 items-stretch",
                        maximizedPanel === 'expro' ? "lg:grid-cols-12" : "grid-cols-1"
                      )}>
                        {/* RADAR COVERAGE MODEL */}
                        <div className={cn(
                          maximizedPanel === 'expro' ? "lg:col-span-5 h-auto" : "col-span-1 lg:h-[450px]",
                          "p-6 rounded-3xl border flex flex-col justify-between shadow-2xs relative overflow-hidden",
                          activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80"
                        )}>
                          <div className="space-y-1 mb-2 z-10">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Legal Balance Model</span>
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Milestone Radar</h4>
                          </div>
    
                          <div className="relative flex items-center justify-center h-[280px] w-full select-none z-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={exproProgressData}>
                                <PolarGrid stroke={activeTheme?.isDark ? "#334155" : "#e2e8f0"} />
                                <PolarAngleAxis 
                                  dataKey="name" 
                                  tick={props => {
                                    const { x, y, payload } = props;
                                    const shortName = payload.value.split(' - ')[0].substring(0, 15);
                                    return (
                                      <text 
                                        x={x} 
                                        y={y} 
                                        fill={activeTheme?.isDark ? "#94a3b8" : "#64748b"} 
                                        fontSize={8} 
                                        fontWeight={900} 
                                        textAnchor="middle"
                                        dy={4}
                                      >
                                        {shortName}
                                      </text>
                                    );
                                  }} 
                                />
                                <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fontSize: 8 }} stroke={activeTheme?.isDark ? "#475569" : "#cbd5e1"} />
                                <Radar 
                                  name="Legal Stages" 
                                  dataKey="value" 
                                  stroke="#8b5cf6" 
                                  fill="#8b5cf6" 
                                  fillOpacity={0.25} 
                                />
                                <RechartsTooltip 
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className={cn(
                                          "p-3 rounded-2xl border shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 text-[10px]",
                                          activeTheme?.isDark ? "bg-slate-900/95 border-slate-800 text-white" : "bg-white/95 border-slate-200 text-slate-900"
                                        )}>
                                          <div className="font-black uppercase">{data.name}</div>
                                          <div className="text-violet-500 font-bold mt-1 text-xs">{data.value} Lots</div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
    
                        {/* PHASE BREAKDOWN */}
                        <div className={cn(
                          maximizedPanel === 'expro' ? "lg:col-span-7 h-auto" : "col-span-1 lg:h-[480px]",
                          "p-6 rounded-3xl border flex flex-col justify-between shadow-2xs relative overflow-hidden",
                          activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80"
                        )}>
                          <div className="space-y-1 mb-4 z-10">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sequence Phase Tracking</span>
                            <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">Phase Densities</h4>
                          </div>
    
                          <div className="space-y-3 flex-1 overflow-y-auto pr-1 select-none scrollbar-thin">
                            {exproProgressData.map((item, index) => {
                              const pct = exproTotalCount > 0 ? ((item.value / exproTotalCount) * 100).toFixed(1) : "0.0";
                              return (
                                <div 
                                  key={index}
                                  className={cn(
                                    "p-3 rounded-2xl border transition-all duration-300 group/item flex flex-col gap-2 relative overflow-hidden",
                                    activeTheme?.isDark 
                                      ? "bg-slate-900/30 border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/60" 
                                      : "bg-slate-50/40 border-slate-100 hover:border-slate-200/80 hover:bg-slate-50/80"
                                  )}
                                >
                                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: item.color }} />
                                  <div className="flex items-center justify-between pl-1 gap-2">
                                    <span className="text-xs font-black uppercase tracking-wide flex-1 min-w-0 pr-1">{item.name}</span>
                                    <div className="flex items-center gap-1.5 font-mono text-[10px]">
                                      <span className="font-black text-slate-800 dark:text-slate-200">{item.value.toLocaleString()}</span>
                                      <span className="text-slate-450">lots</span>
                                      <span 
                                        className="font-black text-xs px-2 py-0.5 rounded-lg ml-1"
                                        style={{ 
                                          backgroundColor: `${item.color}15`, 
                                          color: item.color 
                                        }}
                                      >
                                        {pct}%
                                      </span>
                                    </div>
                                  </div>
    
                                  <div className={cn("w-full h-2 rounded-full overflow-hidden relative", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-200/60")}>
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.8, ease: "easeOut" }}
                                      className="h-full rounded-full relative"
                                      style={{ 
                                        backgroundColor: item.color,
                                        boxShadow: `0 0 10px ${item.color}55`
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
        </ChartBox>
          </div>
        )}

        {(!hiddenPanels.scNonWorkable || maximizedPanel === 'scNonWorkable') && (
          <div className={maximizedPanel === 'scNonWorkable' ? "col-span-1 lg:col-span-2" : "lg:col-span-2"}>
            <ChartBox 
              title="SC Non-Workable Area Progress"
              subtitle="Monthly Land Acquisition Distribution & Targets" 
              spanFull
              activeTheme={activeTheme}
              isMaximized={maximizedPanel === 'scNonWorkable'}
              onMaximize={() => setMaximizedPanel(maximizedPanel === 'scNonWorkable' ? null : 'scNonWorkable')}
              badge={showCurrentWeekUpdates && totalSCWeeklyUpdates > 0 ? (
                <span className="flex items-center gap-1.5 font-display">
                  <span className={activeTheme?.isDark ? "text-slate-300" : "text-slate-700 font-bold"}>{siteAccessTotalLots}</span>
                  <span className="text-red-500 font-extrabold font-mono text-xs shadow-3xs px-1.5 py-0.5 rounded bg-red-500/5 select-none animate-pulse">+{totalSCWeeklyUpdates}</span>
                </span>
              ) : siteAccessTotalLots}
          extra={(
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Week Navigation */}
              <div className={cn(
                "flex items-center gap-1 rounded-full p-0.5 border shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]",
                activeTheme?.isDark 
                  ? "bg-slate-950/85 border-slate-800/80" 
                  : "bg-slate-100 border-slate-200"
              )}>
                <button
                  type="button"
                  onClick={() => setWeekOffset(prev => prev - 1)}
                  className={cn(
                    "p-1 rounded-full transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105",
                    activeTheme?.isDark 
                      ? "hover:bg-slate-800/90 text-slate-400 hover:text-slate-100" 
                      : "hover:bg-slate-200/90 text-slate-500 hover:text-slate-800"
                  )}
                  title="Previous Week"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className={cn(
                  "text-[9px] font-black tracking-widest uppercase px-2 text-center min-w-[125px] sm:min-w-[140px] select-none",
                  activeTheme?.isDark ? "text-slate-300" : "text-slate-600 font-bold"
                )}>
                  {parsedCurrentWeekRange.formatted}
                </span>
                <button
                  type="button"
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  className={cn(
                    "p-1 rounded-full transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105",
                    activeTheme?.isDark 
                      ? "hover:bg-slate-800/90 text-slate-400 hover:text-slate-100" 
                      : "hover:bg-slate-200/90 text-slate-500 hover:text-slate-800"
                  )}
                  title="Next Week"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filter Dropdown */}
              <select
                value={showCurrentWeekUpdates ? "this-week" : "all"}
                onChange={(e) => {
                  const nextVal = e.target.value === "this-week";
                  setShowCurrentWeekUpdates(nextVal);
                  if (!nextVal) {
                    setWeekOffset(0);
                  }
                }}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                  activeTheme?.isDark 
                    ? "bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700" 
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                )}
              >
                <option value="all">All Dates</option>
                <option value="this-week">This Week Only</option>
              </select>
            </div>
          )}
        >
          {hasAnimated && (() => {
            const isSiteAccessSlanted = getShouldSlant(siteAccessData, maximizedPanel === 'scNonWorkable' ? 1400 : 1100);
            return (
              <ResponsiveContainer width="100%" height={maximizedPanel === 'scNonWorkable' ? "100%" : 600}>
              <BarChart 
                data={siteAccessData} 
                margin={{ top: 80, right: 30, left: 35, bottom: isSiteAccessSlanted ? 75 : 25 }} 
                barGap={2}
                className="cursor-pointer"
                onClick={(state: any) => handleChartColumnClick(state, 'scNonWorkable', siteAccessData)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  interval={0}
                  axisLine={false} 
                  tickLine={false} 
                  tick={(props: any) => {
                    const { x, y, payload } = props;
                    if (!payload) return null;
                    const val = String(payload.value || "");
                    return (
                      <g 
                        transform={`translate(${x},${y})`} 
                        className="cursor-pointer"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          handleBarOpenModal(val, 'scNonWorkable');
                        }}
                      >
                        <text 
                          x={0} 
                          y={0} 
                          dy={isSiteAccessSlanted ? 8 : 12} 
                          dx={isSiteAccessSlanted ? -4 : 0}
                          textAnchor={isSiteAccessSlanted ? "end" : "middle"} 
                          transform={isSiteAccessSlanted ? "rotate(-32)" : undefined}
                          fill={activeTheme?.isDark ? '#94a3b8' : '#64748b'} 
                          className="text-[8px] sm:text-[9px] md:text-[10px] font-black hover:fill-indigo-500 transition-colors select-none uppercase tracking-tight"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  }}
                />
              <YAxis 
                yAxisId="left" 
                axisLine={false} 
                tickLine={false} 
                tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}}
                label={{ value: 'LOT COUNT / SEGMENTS', angle: -90, position: 'insideLeft', offset: -25, style: { fontSize: 9, fontWeight: 900, fill: '#94a3b8', letterSpacing: '0.1em' } }}
              />
              <YAxis yAxisId="right" hide domain={[0, 100]} ticks={[]} tick={false} />
              <RechartsTooltip 
                cursor={{fill: 'rgba(241, 245, 249, 0.3)'}}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-[0_12px_36px_rgba(0,0,0,0.1)] space-y-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-brand-500" />
                          <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{label}</span>
                        </div>
                        <div className="space-y-1.5">
                          {payload.map((entry: any, i: number) => {
                            if (typeof entry.name === 'function' || entry.name === 'Percentage Labels' || entry.fill === 'transparent') return null;
                            return (
                              <div key={i} className="flex items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.fill }} />
                                  <span className="font-semibold text-slate-500">{entry.name}</span>
                                </div>
                                <span className="font-black text-slate-900">{entry.value}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                align="center" 
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-6 pb-12 select-none">
                    {[
                      { key: 'total', label: 'Private Lots', color: '#2596be' },
                      { key: 'paid', label: 'Paid', color: '#e87331' },
                      { key: 'pte', label: 'PTE', color: '#a02b93' },
                      { key: 'cno', label: 'CNO', color: '#0f9ed5' },
                      { key: 'acquired', label: 'Acquired', color: '#dc2626' },
                    ].map((item, index) => {
                      const isActive = activeSeries[item.key as keyof typeof activeSeries];
                      return (
                        <button
                          key={`leg-btn-1-${item.key}-${index}`}
                          onClick={() => {
                            setLastToggledSeries(item.key);
                            setActiveSeries(prev => ({
                              ...prev,
                              [item.key]: !prev[item.key]
                            }));
                          }}
                          className={`flex items-center gap-2 hover:opacity-80 active:scale-95 transition-all cursor-pointer ${
                            isActive ? 'opacity-100' : 'opacity-30 line-through'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: isActive ? item.color : '#cbd5e1' }} />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              
              {/* Percentage Labels */}
              <Bar yAxisId="right" dataKey={() => 100} fill="transparent" legendType="none" hide={!activeSeries.total || !activeSeries.paid} isAnimationActive={false}>
                <LabelList 
                  content={(props: any) => {
                    const { x, width, index } = props;
                    const d = siteAccessData[index];
                    if (!d) return null;
                    const pct = d.total > 0 ? ((d.paid / d.total) * 100).toFixed(1) : "0.0";
                    return (
                      <g>
                        {index === 0 && (
                          <text x={10} y={15} fill="#dc2626" fontSize={11} fontWeight={900} textAnchor="start" className="uppercase tracking-widest opacity-50">
                            Percentage of Paid Lots
                          </text>
                        )}
                        <text x={x + (width / 2)} y={35} fill="#dc2626" fontSize={10} fontWeight={900} textAnchor="middle">
                          {`${pct}%`}
                        </text>
                      </g>
                    );
                  }}
                />
              </Bar>
 
              <Bar yAxisId="left" dataKey="total" name="Private Lots" fill="#2596be" radius={[2, 2, 0, 0]} barSize={12} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(siteAccessData[index]?.name || entry?.name, 'scNonWorkable')} hide={!activeSeries.total} isAnimationActive={!hasAnimated || lastToggledSeries === 'total'}>
                <LabelList 
                  dataKey="total" 
                  position="top" 
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    const d = siteAccessData[index];
                    if (!d) return null;
                    const details = siteAccessWeeklyUpdatesDetail[d.key];
                    const addCount = details ? details.total : 0;
                    const valueColor = activeTheme?.isDark ? "#38bdf8" : "#0c4a6e";
                    const hasValue = value && Number(value) > 0;
                    const hasAdd = showCurrentWeekUpdates && addCount > 0;
                    if (!hasValue && !hasAdd) return null;
                    const cx = x + (width / 2);
                    const textAnchor = "middle";
                    const transformVal = (targetY: number) => undefined;

                    if (hasAdd) {
                      const addY = hasValue ? y - 12 : y - 3;
                      const valY = y - 3;
                      return (
                        <g>
                          <text x={cx} y={addY} fill="#ef4444" fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(addY)}>{`+${addCount}`}</text>
                          {hasValue && <text x={cx} y={valY} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(valY)}>{value}</text>}
                        </g>
                      );
                    }
                    return <text x={cx} y={y - 3} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(y - 3)}>{value}</text>;
                  }}
                />
              </Bar>
              <Bar yAxisId="left" dataKey="paid" name="Paid" fill="#e87331" radius={[2, 2, 0, 0]} barSize={12} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(siteAccessData[index]?.name || entry?.name, 'scNonWorkable')} hide={!activeSeries.paid} isAnimationActive={!hasAnimated || lastToggledSeries === 'paid'}>
                <LabelList 
                  dataKey="paid" 
                  position="top" 
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    const d = siteAccessData[index];
                    if (!d) return null;
                    const details = siteAccessWeeklyUpdatesDetail[d.key];
                    const addCount = details ? details.paid : 0;
                    const valueColor = activeTheme?.isDark ? "#fb923c" : "#7c2d12";
                    const hasValue = value && Number(value) > 0;
                    const hasAdd = showCurrentWeekUpdates && addCount > 0;
                    if (!hasValue && !hasAdd) return null;
                    const cx = x + (width / 2);
                    const textAnchor = "middle";
                    const transformVal = (targetY: number) => undefined;

                    if (hasAdd) {
                      const addY = hasValue ? y - 12 : y - 3;
                      const valY = y - 3;
                      return (
                        <g>
                          <text x={cx} y={addY} fill="#ef4444" fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(addY)}>{`+${addCount}`}</text>
                          {hasValue && <text x={cx} y={valY} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(valY)}>{value}</text>}
                        </g>
                      );
                    }
                    return <text x={cx} y={y - 3} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(y - 3)}>{value}</text>;
                  }}
                />
              </Bar>
              <Bar yAxisId="left" dataKey="pte" name="PTE" fill="#a02b93" radius={[2, 2, 0, 0]} barSize={12} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(siteAccessData[index]?.name || entry?.name, 'scNonWorkable')} hide={!activeSeries.pte} isAnimationActive={!hasAnimated || lastToggledSeries === 'pte'}>
                <LabelList 
                  dataKey="pte" 
                  position="top" 
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    const d = siteAccessData[index];
                    if (!d) return null;
                    const details = siteAccessWeeklyUpdatesDetail[d.key];
                    const addCount = details ? details.pte : 0;
                    const valueColor = activeTheme?.isDark ? "#c084fc" : "#4c0519";
                    const hasValue = value && Number(value) > 0;
                    const hasAdd = showCurrentWeekUpdates && addCount > 0;
                    if (!hasValue && !hasAdd) return null;
                    const cx = x + (width / 2);
                    const textAnchor = "middle";
                    const transformVal = (targetY: number) => undefined;

                    if (hasAdd) {
                      const addY = hasValue ? y - 12 : y - 3;
                      const valY = y - 3;
                      return (
                        <g>
                          <text x={cx} y={addY} fill="#ef4444" fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(addY)}>{`+${addCount}`}</text>
                          {hasValue && <text x={cx} y={valY} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(valY)}>{value}</text>}
                        </g>
                      );
                    }
                    return <text x={cx} y={y - 3} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(y - 3)}>{value}</text>;
                  }}
                />
              </Bar>
              <Bar yAxisId="left" dataKey="cno" name="CNO" fill="#0f9ed5" radius={[2, 2, 0, 0]} barSize={12} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(siteAccessData[index]?.name || entry?.name, 'scNonWorkable')} hide={!activeSeries.cno} isAnimationActive={!hasAnimated || lastToggledSeries === 'cno'}>
                <LabelList 
                  dataKey="cno" 
                  position="top" 
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    const d = siteAccessData[index];
                    if (!d) return null;
                    const details = siteAccessWeeklyUpdatesDetail[d.key];
                    const addCount = details ? details.cno : 0;
                    const valueColor = activeTheme?.isDark ? "#4ade80" : "#064e3b";
                    const hasValue = value && Number(value) > 0;
                    const hasAdd = showCurrentWeekUpdates && addCount > 0;
                    if (!hasValue && !hasAdd) return null;
                    const cx = x + (width / 2);
                    const textAnchor = "middle";
                    const transformVal = (targetY: number) => undefined;

                    if (hasAdd) {
                      const addY = hasValue ? y - 12 : y - 3;
                      const valY = y - 3;
                      return (
                        <g>
                          <text x={cx} y={addY} fill="#ef4444" fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(addY)}>{`+${addCount}`}</text>
                          {hasValue && <text x={cx} y={valY} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(valY)}>{value}</text>}
                        </g>
                      );
                    }
                    return <text x={cx} y={y - 3} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(y - 3)}>{value}</text>;
                  }}
                />
              </Bar>
              <Bar yAxisId="left" dataKey="acquired" name="Acquired" fill="#dc2626" radius={[2, 2, 0, 0]} barSize={12} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(siteAccessData[index]?.name || entry?.name, 'scNonWorkable')} hide={!activeSeries.acquired} isAnimationActive={!hasAnimated || lastToggledSeries === 'acquired'}>
                <LabelList 
                  dataKey="acquired" 
                  position="top" 
                  content={(props: any) => {
                    const { x, y, width, value, index } = props;
                    const d = siteAccessData[index];
                    if (!d) return null;
                    const details = siteAccessWeeklyUpdatesDetail[d.key];
                    const addCount = details ? details.acquired : 0;
                    const valueColor = activeTheme?.isDark ? "#f87171" : "#450a0a";
                    const hasValue = value && Number(value) > 0;
                    const hasAdd = showCurrentWeekUpdates && addCount > 0;
                    if (!hasValue && !hasAdd) return null;
                    const cx = x + (width / 2);
                    const textAnchor = "middle";
                    const transformVal = (targetY: number) => undefined;

                    if (hasAdd) {
                      const addY = hasValue ? y - 12 : y - 3;
                      const valY = y - 3;
                      return (
                        <g>
                          <text x={cx} y={addY} fill="#ef4444" fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(addY)}>{`+${addCount}`}</text>
                          {hasValue && <text x={cx} y={valY} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(valY)}>{value}</text>}
                        </g>
                      );
                    }
                    return <text x={cx} y={y - 3} fill={valueColor} fontSize={9} fontWeight={900} textAnchor={textAnchor} transform={transformVal(y - 3)}>{value}</text>;
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          );
          })()}

          {/* Monthly Financial Progress Table */}
          <div className={cn("mt-8 border rounded-3xl overflow-hidden shadow-sm", activeTheme?.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/60")}>
            <div className={cn("p-5 border-b flex flex-wrap items-center justify-between gap-4", activeTheme?.isDark ? "bg-slate-900 border-slate-800/80" : "bg-slate-50/50 border-slate-100")}>
              <div>
                <h4 className={cn("text-xs font-black uppercase tracking-wider", activeTheme?.isDark ? "text-slate-200" : "text-slate-700")}>SC Non-Workable Area Financial Summary</h4>
                <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-0.5", activeTheme?.isDark ? "text-slate-500" : "text-slate-400")}>
                  Month-by-Month breakdown of {nonWorkableCostFilter === 'land' ? 'Land' : nonWorkableCostFilter === 'structure' ? 'Structure' : 'Land & Structure'} Acquisition amounts
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Cost Type Filter */}
                <select
                  value={nonWorkableCostFilter}
                  onChange={(e) => setNonWorkableCostFilter(e.target.value as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                    activeTheme?.isDark 
                      ? "bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700" 
                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                  )}
                >
                  <option value="land">Land Cost Only</option>
                  <option value="structure">Structure Cost Only</option>
                  <option value="both">Land & Structure</option>
                </select>

                <span className={cn("text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider", activeTheme?.isDark ? "bg-indigo-950/45 text-indigo-400" : "bg-blue-50 text-blue-600")}>PHP</span>
                <span className={cn("text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider", activeTheme?.isDark ? "bg-emerald-950/40 text-emerald-400" : "bg-emerald-50 text-emerald-600")}>In Billions</span>
              </div>
            </div>
            
            <div className={cn("overflow-x-auto scrollbar-thin", activeTheme?.isDark ? "scrollbar-thumb-slate-800 scrollbar-track-slate-900" : "scrollbar-thumb-slate-200 scrollbar-track-slate-50")}>
              <table className="w-full text-left border-collapse table-fixed min-w-[1400px]">
                <thead>
                  <tr className={cn("border-b", activeTheme?.isDark ? "border-slate-800" : "border-slate-200")}>
                    <th 
                      className={cn("w-44 p-3 text-[10px] font-black uppercase tracking-widest sticky left-0 z-20 border-r shadow-[2px_0_5px_rgba(0,0,0,0.1)]", activeTheme?.isDark ? "text-slate-100" : "text-slate-800")}
                      style={{ backgroundColor: activeTheme?.isDark ? "#334155" : "#aabdcf" }}
                    >
                      Metric / Month
                    </th>
                    {siteAccessData.map((d: any, index: number) => {
                      let bgColor = "#76818c";
                      if (activeTheme?.isDark) {
                        if (index < 4) bgColor = "#475569";
                        else if (index < 16) bgColor = "#334155";
                        else if (index < 28) bgColor = "#1e293b";
                        else bgColor = "#0f172a";
                      } else {
                        if (index < 4) bgColor = "#9da9b4";
                        else if (index < 16) bgColor = "#76818c";
                        else if (index < 28) bgColor = "#515c67";
                        else bgColor = "#2f3740";
                      }
                      return (
                        <th 
                          key={index} 
                          data-month-key={d.key}
                          className="p-3 text-[10px] font-black text-white uppercase tracking-widest text-center border-r last:border-r-0 cursor-pointer hover:opacity-90 transition-all"
                          style={{ backgroundColor: bgColor, borderColor: bgColor }}
                          onMouseEnter={(e) => interactionMode === 'hover' && handleMouseEnter(e, d.name, d.key, 'column')}
                          onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                          onClick={(e) => interactionMode === 'click' && handleCellClick(e, d.name, d.key, 'column')}
                        >
                          {d.name}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className={cn("divide-y text-[11px]", activeTheme?.isDark ? "divide-slate-800/60" : "divide-slate-100")}>
                  {/* TOTAL AMOUNT */}
                  <tr className={cn("transition-colors", activeTheme?.isDark ? "hover:bg-indigo-950/20" : "hover:bg-blue-50/50")}>
                    <td 
                      className={cn("p-3 font-black sticky left-0 z-10 border-r flex items-center gap-1.5 uppercase tracking-wider text-[10px] cursor-help select-none shadow-[2px_0_5px_rgba(0,0,0,0.02)]", activeTheme?.isDark ? "bg-slate-900 border-slate-800/80" : "bg-white border-slate-100")}
                      style={{ color: activeTheme?.isDark ? "#38bdf8" : "#1885a3" }}
                      onMouseEnter={(e) => interactionMode === 'hover' && handleLabelMouseEnter(e, 'row-total')}
                      onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                      onClick={(e) => interactionMode === 'click' && handleLabelClick(e, 'row-total')}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTheme?.isDark ? "#38bdf8" : "#1885a3" }} />
                      <span>Total Amount</span>
                    </td>
                    {siteAccessData.map((d: any, index: number) => (
                      <td 
                        key={index} 
                        data-month-key={d.key}
                        className={cn(
                          "p-3 font-medium text-center font-sans text-xs border-r last:border-r-0 cursor-pointer transition-colors",
                          activeTheme?.isDark 
                            ? "border-slate-800/60 hover:bg-slate-805 hover:bg-slate-800" 
                            : "border-slate-50 hover:bg-blue-100/50"
                        )}
                        style={{ color: activeTheme?.isDark ? "#38bdf8" : "#1885a3" }}
                        onMouseEnter={(e) => interactionMode === 'hover' && handleMouseEnter(e, d.name, d.key, 'total')}
                        onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                        onClick={(e) => interactionMode === 'click' && handleCellClick(e, d.name, d.key, 'total')}
                      >
                        {formatCompactCurrency(d.totalAmount)}
                      </td>
                    ))}
                  </tr>
                  
                  {/* PAID AMOUNT */}
                  <tr className={cn("transition-colors", activeTheme?.isDark ? "hover:bg-orange-950/20" : "hover:bg-orange-50/50")}>
                    <td 
                      className={cn("p-3 font-black sticky left-0 z-10 border-r flex items-center gap-1.5 uppercase tracking-wider text-[10px] cursor-help select-none shadow-[2px_0_5px_rgba(0,0,0,0.02)]", activeTheme?.isDark ? "bg-slate-900 border-slate-800/80 text-orange-400" : "bg-white border-slate-100 text-orange-600")}
                      onMouseEnter={(e) => interactionMode === 'hover' && handleLabelMouseEnter(e, 'row-paid')}
                      onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                      onClick={(e) => interactionMode === 'click' && handleLabelClick(e, 'row-paid')}
                    >
                      <span className="w-2 h-2 rounded-full bg-orange-500" />
                      <span>Paid Amount</span>
                    </td>
                    {siteAccessData.map((d: any, index: number) => (
                      <td 
                        key={index} 
                        data-month-key={d.key}
                        className={cn(
                          "p-3 font-medium text-center font-sans text-xs border-r last:border-r-0 cursor-pointer transition-colors",
                          activeTheme?.isDark 
                            ? "border-slate-800/60 bg-orange-950/5 hover:bg-orange-900/20 text-orange-400" 
                            : "border-slate-50 bg-orange-50/5 hover:bg-orange-100/30 text-orange-600"
                        )}
                        onMouseEnter={(e) => interactionMode === 'hover' && handleMouseEnter(e, d.name, d.key, 'paid')}
                        onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                        onClick={(e) => interactionMode === 'click' && handleCellClick(e, d.name, d.key, 'paid')}
                      >
                        {formatCompactCurrency(d.paidAmount)}
                      </td>
                    ))}
                  </tr>
 
                  {/* UNPAID AMOUNT */}
                  <tr className={cn("transition-colors", activeTheme?.isDark ? "hover:bg-amber-950/20" : "hover:bg-amber-50/50")}>
                    <td 
                      className={cn("p-3 font-black sticky left-0 z-10 border-r flex items-center gap-1.5 uppercase tracking-wider text-[10px] cursor-help select-none shadow-[2px_0_5px_rgba(0,0,0,0.02)]", activeTheme?.isDark ? "bg-slate-900 border-slate-800/80" : "bg-white border-slate-100")}
                      style={{ color: activeTheme?.isDark ? "#fbbf24" : "#a6981e" }}
                      onMouseEnter={(e) => interactionMode === 'hover' && handleLabelMouseEnter(e, 'row-unpaid')}
                      onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                      onClick={(e) => interactionMode === 'click' && handleLabelClick(e, 'row-unpaid')}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTheme?.isDark ? "#fbbf24" : "#a6981e" }} />
                      <span>Unpaid Amount</span>
                    </td>
                    {siteAccessData.map((d: any, index: number) => (
                      <td 
                        key={index} 
                        data-month-key={d.key}
                        className={cn(
                          "p-3 font-medium text-center font-sans text-xs border-r last:border-r-0 cursor-pointer transition-colors",
                          activeTheme?.isDark 
                            ? "border-slate-800/60 hover:bg-amber-900/15" 
                            : "border-slate-50 hover:bg-amber-100/30"
                        )}
                        style={{ color: activeTheme?.isDark ? "#fbbf24" : "#a6981e" }}
                        onMouseEnter={(e) => interactionMode === 'hover' && handleMouseEnter(e, d.name, d.key, 'unpaid')}
                        onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                        onClick={(e) => interactionMode === 'click' && handleCellClick(e, d.name, d.key, 'unpaid')}
                      >
                        {formatCompactCurrency(d.unpaidAmount)}
                      </td>
                    ))}
                  </tr>
 
                  {/* PAID PERCENTAGE */}
                  <tr className={cn("transition-colors", activeTheme?.isDark ? "bg-red-950/10 hover:bg-red-950/20" : "bg-red-50/10 hover:bg-red-50/20")}>
                    <td 
                      className={cn("p-3 font-black sticky left-0 z-10 border-r flex items-center gap-1.5 uppercase tracking-wider text-[10px] cursor-help select-none shadow-[2px_0_5px_rgba(0,0,0,0.02)]", activeTheme?.isDark ? "bg-red-950/30 border-slate-800/80 text-red-400" : "bg-red-50/20 border-slate-100 text-red-600")}
                      onMouseEnter={(e) => interactionMode === 'hover' && handleLabelMouseEnter(e, 'row-percent')}
                      onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                      onClick={(e) => interactionMode === 'click' && handleLabelClick(e, 'row-percent')}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>Payment Progress</span>
                    </td>
                    {siteAccessData.map((d: any, index: number) => {
                      const hasAmount = d.total > 0;
                      return (
                        <td 
                          key={index} 
                          data-month-key={d.key}
                          className={cn(
                            "p-3 font-medium text-center font-sans text-xs border-r last:border-r-0 cursor-pointer transition-colors",
                            activeTheme?.isDark 
                              ? "border-slate-800/60 bg-red-950/10 hover:bg-red-900/25 text-red-400" 
                              : "border-slate-50 bg-red-50/10 hover:bg-red-100/30 text-red-600"
                          )}
                          onMouseEnter={(e) => interactionMode === 'hover' && handleMouseEnter(e, d.name, d.key, 'percent')}
                          onMouseLeave={() => interactionMode === 'hover' && handleMouseLeave()}
                          onClick={(e) => interactionMode === 'click' && handleCellClick(e, d.name, d.key, 'percent')}
                        >
                          {hasAmount ? `${d.paidPct.toFixed(1)}%` : "0.0%"}
                        </td>
                       );
                     })}
                    </tr>
                </tbody>
              </table>
            </div>
          </div>
        </ChartBox>
          </div>
        )}

        {(!hiddenPanels.cumulative || maximizedPanel === 'cumulative') && (
          <div className={maximizedPanel === 'cumulative' ? "col-span-1 lg:col-span-2" : "lg:col-span-2"}>
            <ChartBox 
              title="Cumulative Acquisition Progress"
              subtitle={
                startPier || endPier 
                  ? `Piers ${startPier || "Start"} to ${endPier || "End"} Cumulative Land Acquisition Performance`
                  : "Monthly Cumulative Land Acquisition Performance"
              } 
              spanFull
              badge={cumulativeTotalLots}
              activeTheme={activeTheme}
              isMaximized={maximizedPanel === 'cumulative'}
              onMaximize={() => setMaximizedPanel(maximizedPanel === 'cumulative' ? null : 'cumulative')}
              extra={(
                <div className="flex flex-wrap items-center gap-3">
                  {/* Invalid Range Warning badge */}
                  {isPierRangeReversed && (
                    <span className="text-[9px] font-black uppercase text-red-500 animate-pulse bg-red-500/10 dark:bg-red-500/5 px-2 py-1 rounded-xl border border-red-500/30">
                      ⚠️ Invalid Range (Start &gt; End)
                    </span>
                  )}

                  {/* Start Pier Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[9px] font-black uppercase tracking-wider", activeTheme?.isDark ? "text-slate-450" : "text-slate-500")}>
                      START PIER (AU):
                    </span>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        list="cumulative-start-piers"
                        value={startPier}
                        onChange={(e) => setStartPier(e.target.value)}
                        placeholder="All"
                        className={cn(
                          "w-16 px-2 py-1 border rounded-lg text-left transition-all font-bold text-[10px] shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20 pr-4.5",
                          startPier !== ""
                            ? (isPierRangeReversed
                                ? "border-red-500 text-red-500 bg-red-500/10"
                                : (activeTheme?.isDark 
                                    ? "border-brand-500 text-brand-450 bg-brand-950/20" 
                                    : "border-brand-500 text-brand-700 bg-brand-50/30"))
                            : (activeTheme?.isDark 
                                ? "border-slate-800 bg-slate-950 text-slate-350" 
                                : "border-slate-200 bg-white text-slate-650")
                        )}
                      />
                      <datalist id="cumulative-start-piers">
                        {allPierNames.map(p => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                      {startPier && (
                        <button
                          type="button"
                          onClick={() => setStartPier("")}
                          className="absolute right-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* End Pier Selector */}
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-[9px] font-black uppercase tracking-wider", activeTheme?.isDark ? "text-slate-450" : "text-slate-500")}>
                      END PIER (AU):
                    </span>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        list="cumulative-end-piers"
                        value={endPier}
                        onChange={(e) => setEndPier(e.target.value)}
                        placeholder="All"
                        className={cn(
                          "w-16 px-2 py-1 border rounded-lg text-left transition-all font-bold text-[10px] shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20 pr-4.5",
                          endPier !== ""
                            ? (isPierRangeReversed
                                ? "border-red-500 text-red-500 bg-red-500/10"
                                : (activeTheme?.isDark 
                                    ? "border-brand-500 text-brand-450 bg-brand-950/20" 
                                    : "border-brand-500 text-brand-700 bg-brand-50/30"))
                            : (activeTheme?.isDark 
                                ? "border-slate-800 bg-slate-950 text-slate-350" 
                                : "border-slate-200 bg-white text-slate-650")
                        )}
                      />
                      <datalist id="cumulative-end-piers">
                        {allPierNames.map(p => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                      {endPier && (
                        <button
                          type="button"
                          onClick={() => setEndPier("")}
                          className="absolute right-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>

                  {/* View Style Dropdown */}
                  <select
                    value={cumulativeChartStyle}
                    onChange={(e) => setCumulativeChartStyle(e.target.value as any)}
                    className={cn(
                      "px-3 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-indigo-500/20",
                      activeTheme?.isDark 
                        ? "bg-slate-900 border-slate-850 text-slate-300 hover:border-slate-700" 
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    )}
                  >
                    <option value="standard">Standard View</option>
                    <option value="spectacular">✨ Analytics View</option>
                  </select>
                </div>
              )}
            >
              {hasAnimated && (() => {
                const isCumulativeSlanted = getShouldSlant(cumulativeData, maximizedPanel === 'cumulative' ? 1400 : 1100);
                return (
                  <div className="w-full h-full flex flex-col justify-between">
                    {cumulativeChartStyle === 'standard' ? (
                      <ResponsiveContainer width="100%" height={maximizedPanel === 'cumulative' ? "100%" : 600}>
                        <ComposedChart 
                          data={cumulativeData} 
                          margin={{ top: 40, right: 30, left: 35, bottom: isCumulativeSlanted ? 75 : 50 }}
                          className="cursor-pointer"
                          onClick={(state: any) => handleChartColumnClick(state, 'cumulative', cumulativeData)}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                          <XAxis 
                            dataKey="name" 
                            interval={0}
                            axisLine={false} 
                            tickLine={false} 
                            tick={(props: any) => {
                              const { x, y, payload } = props;
                              if (!payload) return null;
                              const val = String(payload.value || "");
                              return (
                                <g 
                                  transform={`translate(${x},${y})`} 
                                  className="cursor-pointer"
                                  onClick={(e: any) => {
                                    e.stopPropagation();
                                    handleBarOpenModal(val, 'cumulative');
                                  }}
                                >
                                  <text 
                                    x={0} 
                                    y={0} 
                                    dy={isCumulativeSlanted ? 8 : 12} 
                                    dx={isCumulativeSlanted ? -4 : 0}
                                    textAnchor={isCumulativeSlanted ? "end" : "middle"} 
                                    transform={isCumulativeSlanted ? "rotate(-32)" : undefined}
                                    fill={activeTheme?.isDark ? '#94a3b8' : '#64748b'} 
                                    className="text-[8px] sm:text-[9px] md:text-[10px] font-black hover:fill-indigo-500 transition-colors select-none uppercase tracking-tight"
                                  >
                                    {val}
                                  </text>
                                </g>
                              );
                            }} 
                          />
                        <YAxis 
                          ticks={cumulativeYAxisTicks} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b'}} 
                          label={{ value: 'CUMULATIVE LOTS ACQUIRED', angle: -90, position: 'insideLeft', offset: -25, style: { fontSize: 8, fontWeight: 900, fill: '#94a3b8', letterSpacing: '0.1em' } }}
                        />
                        <RechartsTooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className={cn(
                                  "p-4 rounded-2xl border shadow-lg space-y-3 min-w-[200px] animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md",
                                  activeTheme?.isDark 
                                    ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-slate-950/40" 
                                    : "bg-white/95 border-slate-200/80 text-slate-900 shadow-slate-200/50"
                                )}>
                                  <div className={cn("flex items-center gap-2 border-b pb-2 mb-1", activeTheme?.isDark ? "border-slate-800" : "border-slate-100")}>
                                    <Calendar className="w-3.5 h-3.5 text-brand-500" />
                                    <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {payload.map((entry: any, i: number) => {
                                      if (entry.value === undefined) return null;
                                      return (
                                        <div key={i} className="flex items-center justify-between gap-4 text-xs">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.color || entry.fill }} />
                                            <span className={cn("font-semibold", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>{entry.name}</span>
                                          </div>
                                          <span className={cn("font-black", activeTheme?.isDark ? "text-slate-100" : "text-slate-900")}>{entry.value}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend 
                          verticalAlign="top" 
                          align="center" 
                          content={() => (
                            <div className="flex flex-wrap items-center justify-center gap-6 pb-12 select-none">
                              {[
                                { key: 'paid', label: 'Paid Lots', color: '#e87331', shape: 'rect' },
                                { key: 'pte', label: 'Lots with PTE, ongoing payment processing', color: '#a02b93', shape: 'rect' },
                                { key: 'cno', label: 'Lots with CNO', color: '#0f9ed5', shape: 'rect' },
                                { key: 'total', label: 'No. of Private Lots', color: '#2596be', shape: 'line-circle' },
                                { key: 'acquired', label: 'Total Acquired', color: '#dc2626', shape: 'circle' },
                              ].map((item, index) => {
                                const isActive = activeSeries[item.key as keyof typeof activeSeries];
                                return (
                                  <button
                                    key={`leg-btn-2-${item.key}-${index}`}
                                    onClick={() => {
                                      setLastToggledSeries(item.key);
                                      setActiveSeries(prev => ({
                                        ...prev,
                                        [item.key]: !prev[item.key]
                                      }));
                                    }}
                                    className={cn(
                                      "flex items-center gap-2 hover:opacity-80 active:scale-95 transition-all cursor-pointer",
                                      isActive ? 'opacity-100' : 'opacity-30 line-through'
                                    )}
                                  >
                                    {item.shape === 'rect' ? (
                                      <span className="w-4 h-2.5 rounded-xs inline-block flex-shrink-0" style={{ backgroundColor: isActive ? item.color : '#cbd5e1' }} />
                                    ) : item.shape === 'line-circle' ? (
                                      <svg className="w-6 h-3 inline-block flex-shrink-0" viewBox="0 0 24 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <line x1="0" y1="6" x2="24" y2="6" stroke={isActive ? item.color : '#cbd5e1'} strokeWidth="3" />
                                        <circle cx="12" cy="6" r="3.5" fill={isActive ? item.color : '#cbd5e1'} />
                                      </svg>
                                    ) : (
                                      <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: isActive ? item.color : '#cbd5e1' }} />
                                    )}
                                    <span className={cn("text-[10px] font-black uppercase tracking-widest", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        />
                        <Bar dataKey="paid" stackId="a" fill="#e87331" name="Paid Lots" barSize={28} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(cumulativeData[index]?.name || entry?.name, 'cumulative')} hide={!activeSeries.paid} isAnimationActive={!hasAnimated || lastToggledSeries === 'paid'}>
                          <LabelList dataKey="paid" content={<CustomCumulativeLabel dataKey="paid" />} />
                        </Bar>
                        <Bar dataKey="pte" stackId="a" fill="#a02b93" name="Lots with PTE, ongoing payment processing" barSize={28} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(cumulativeData[index]?.name || entry?.name, 'cumulative')} hide={!activeSeries.pte} isAnimationActive={!hasAnimated || lastToggledSeries === 'pte'}>
                          <LabelList dataKey="pte" content={<CustomCumulativeLabel dataKey="pte" />} />
                        </Bar>
                        <Bar dataKey="cno" stackId="a" fill="#0f9ed5" name="Lots with CNO" barSize={28} className="cursor-pointer" onClick={(entry: any, index: number) => handleBarOpenModal(cumulativeData[index]?.name || entry?.name, 'cumulative')} hide={!activeSeries.cno} isAnimationActive={!hasAnimated || lastToggledSeries === 'cno'}>
                          <LabelList dataKey="cno" content={<CustomCumulativeLabel dataKey="cno" />} />
                        </Bar>
                        <Line type="monotone" dataKey="total" name="No. of Private Lots" stroke="#2596be" strokeWidth={3} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} hide={!activeSeries.total} isAnimationActive={!hasAnimated || lastToggledSeries === 'total'}>
                          <LabelList dataKey="total" content={<CustomCumulativeLabel dataKey="total" />} />
                        </Line>
                        <Line type="monotone" dataKey="acquired" name="Total Acquired" stroke="transparent" strokeWidth={0} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} hide={!activeSeries.acquired} isAnimationActive={!hasAnimated || lastToggledSeries === 'acquired'}>
                          <LabelList dataKey="acquired" content={<CustomCumulativeLabel dataKey="acquired" />} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-350">
                      {/* STATS SUMMARY GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className={cn(
                          "p-5 rounded-3xl border flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target S-Curve Target</span>
                            <h4 className="text-3xl font-black font-display text-slate-900 dark:text-slate-100">{maxCumulativeTotal.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Lots</span></h4>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 font-semibold">Maximum volume of active parcels within current filter parameters.</p>
                        </div>

                        <div className={cn(
                          "p-5 rounded-3xl border flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Total Acquired To Date</span>
                            <h4 className="text-3xl font-black font-display text-slate-900 dark:text-slate-100">
                              {totalAcquiredLots.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Lots</span>
                            </h4>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full" 
                                style={{ width: `${maxCumulativeTotal > 0 ? (totalAcquiredLots / maxCumulativeTotal) * 100 : 0}%` }} 
                              />
                            </div>
                            <span className="text-xs font-black text-emerald-500">{maxCumulativeTotal > 0 ? ((totalAcquiredLots / maxCumulativeTotal) * 100).toFixed(1) : "0.0"}%</span>
                          </div>
                        </div>

                        <div className={cn(
                          "p-5 rounded-3xl border flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 relative overflow-hidden group",
                          activeTheme?.isDark ? "bg-slate-900/60 border-slate-800/80" : "bg-slate-50/70 border-slate-200/60"
                        )}>
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Fully Paid Progress</span>
                            <h4 className="text-3xl font-black font-display text-slate-900 dark:text-slate-100">
                              {chartTotals.fullyPaid.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Lots</span>
                            </h4>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-indigo-500 h-full rounded-full" 
                                style={{ width: `${maxCumulativeTotal > 0 ? (chartTotals.fullyPaid / maxCumulativeTotal) * 100 : 0}%` }} 
                              />
                            </div>
                            <span className="text-xs font-black text-indigo-500">{maxCumulativeTotal > 0 ? ((chartTotals.fullyPaid / maxCumulativeTotal) * 100).toFixed(1) : "0.0"}%</span>
                          </div>
                        </div>
                      </div>

                      {/* AREA CHART */}
                      <ResponsiveContainer width="100%" height={maximizedPanel === 'cumulative' ? "100%" : 450}>
                        <AreaChart 
                          data={cumulativeData} 
                          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                          className="cursor-pointer"
                          onClick={(state: any) => handleChartColumnClick(state, 'cumulative', cumulativeData)}
                        >
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2596be" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#2596be" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorAcquired" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#e87331" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#e87331" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                          <XAxis 
                            dataKey="name" 
                            interval={0}
                            axisLine={false} 
                            tickLine={false} 
                            tickMargin={10}
                            tick={(props: any) => {
                              const { x, y, payload } = props;
                              if (!payload) return null;
                              return (
                                <g 
                                  transform={`translate(${x},${y})`} 
                                  className="cursor-pointer"
                                  onClick={(e: any) => {
                                    e.stopPropagation();
                                    handleBarOpenModal(String(payload.value), 'cumulative');
                                  }}
                                >
                                  <text 
                                    x={0} 
                                    y={0} 
                                    dy={10} 
                                    textAnchor="middle" 
                                    fill={activeTheme?.isDark ? '#94a3b8' : '#64748b'} 
                                    className="text-[10px] font-black hover:fill-indigo-500 transition-colors select-none"
                                  >
                                    {payload.value}
                                  </text>
                                </g>
                              );
                            }} 
                          />
                          <YAxis 
                            ticks={cumulativeYAxisTicks} 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b'}} 
                          />
                          <RechartsTooltip 
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className={cn(
                                    "p-4 rounded-2xl border shadow-lg space-y-3 min-w-[200px] backdrop-blur-md",
                                    activeTheme?.isDark ? "bg-slate-900/95 border-slate-800 text-slate-100" : "bg-white/95 border-slate-200 text-slate-900"
                                  )}>
                                    <div className="flex items-center gap-2 border-b pb-2 mb-1">
                                      <span className="text-[11px] font-black uppercase tracking-widest">{label}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                      {payload.map((entry: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between gap-4 text-xs">
                                          <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                            <span className="font-semibold text-slate-400">{entry.name}</span>
                                          </div>
                                          <span className="font-black text-slate-100">{entry.value}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area type="monotone" dataKey="total" name="No. of Private Lots" stroke="#2596be" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                          <Area type="monotone" dataKey="acquired" name="Total Acquired" stroke="#dc2626" strokeWidth={3} fillOpacity={1} fill="url(#colorAcquired)" />
                          <Area type="monotone" dataKey="paid" name="Paid Lots" stroke="#e87331" strokeWidth={2} fillOpacity={1} fill="url(#colorPaid)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })()}
            </ChartBox>
          </div>
        )}

          {/* Dynamic Disbursement Plan Section */}
          {(!hiddenPanels.disbursement || maximizedPanel === 'disbursement') && (
            <div className={maximizedPanel === 'disbursement' ? "col-span-1 lg:col-span-2" : "lg:col-span-2"}>
              <DisbursementPlan 
                data={data} 
                activeTheme={activeTheme} 
                isMaximized={maximizedPanel === 'disbursement'}
                onMaximize={() => setMaximizedPanel(maximizedPanel === 'disbursement' ? null : 'disbursement')}
                onHide={() => handleTogglePanel('disbursement', true)}
              />
            </div>
          )}
        </motion.div>

      </div>

      <AnimatePresence>
        {hoveredCell && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="fixed z-[100] bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-80 pointer-events-auto select-text font-sans"
            style={cellPositionStyle}
            onMouseEnter={() => {
              if (hoveredCellCloseTimeoutRef.current) {
                clearTimeout(hoveredCellCloseTimeoutRef.current);
                hoveredCellCloseTimeoutRef.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
              {hoveredCell.type.startsWith('row-') ? (
                <div className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Database className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider leading-none mb-0.5">
                  {hoveredCell.monthKey === "all" ? "All-Time Financial Summary" : `${hoveredCell.monthName} Monthly Details`}
                </div>
                <div className="text-[11px] font-black text-slate-800 truncate leading-none">
                  {hoveredCell.type === 'total' && "Total Land Acquisition Amount"}
                  {hoveredCell.type === 'paid' && "Paid Land Acquisition Amount"}
                  {hoveredCell.type === 'unpaid' && "Unpaid Land Acquisition Amount"}
                  {hoveredCell.type === 'percent' && "Payment Progress Percent"}
                  {hoveredCell.type === 'column' && "Monthly Financial Overview"}
                  {hoveredCell.type === 'row-total' && "Consolidated Total Budget"}
                  {hoveredCell.type === 'row-paid' && "Consolidated Total Disbursements"}
                  {hoveredCell.type === 'row-unpaid' && "Consolidated Total Unpaid"}
                  {hoveredCell.type === 'row-percent' && "Overall Payment Fulfillment Rate"}
                </div>
              </div>
            </div>

            {/* Content Values */}
            <div className="space-y-3">
              {/* Row Total type tooltips */}
              {hoveredCell.type === 'row-total' && (
                <div>
                  <div className="text-lg font-black tracking-tight" style={{ color: "#1885a3" }}>
                    {formatCurrency(siteAccessTotals.totalAmount)}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-normal">
                    Total counts: <span className="font-black text-slate-800">{siteAccessTotals.totalLots} affected segments/lots</span> in the entire pipeline.
                  </div>
                </div>
              )}

              {hoveredCell.type === 'row-paid' && (
                <div>
                  <div className="text-lg font-black text-orange-600 tracking-tight">
                    {formatCurrency(siteAccessTotals.paidAmount)}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-normal">
                    Total counts: <span className="font-black text-orange-600">{siteAccessTotals.paidLots} lots paid & cleared</span> out of active alignment.
                  </div>
                </div>
              )}

              {hoveredCell.type === 'row-unpaid' && (
                <div>
                  <div className="text-lg font-black text-amber-600 tracking-tight" style={{ color: "#a6981e" }}>
                    {formatCurrency(siteAccessTotals.unpaidAmount)}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-normal">
                    Total counts: <span className="font-black text-amber-700">{siteAccessTotals.unpaidLots} lots unpaid/pending documentation</span>.
                  </div>
                </div>
              )}

              {hoveredCell.type === 'row-percent' && (
                <div>
                  <div className="text-lg font-black text-red-600 tracking-tight">
                    {siteAccessTotals.paidPct.toFixed(2)}%
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500 mt-1 leading-normal">
                    Overall progression rate: <span className="font-black text-red-600">{siteAccessTotals.paidLots} of {siteAccessTotals.totalLots} lots</span> are fully paid.
                  </div>
                </div>
              )}

              {/* Individual month metric type tooltips */}
              {hoveredCell.monthKey !== "all" && (
                <>
                  {/* Column Summary (contains total amount, paid amount, unpaid amount, and percentage progress) */}
                  {hoveredCell.type === 'column' && (
                    <div className="space-y-2 border-b border-slate-100 pb-3">
                      {/* Total Amount row */}
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                        <span className="font-bold text-[10px] text-slate-500 uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#1885a3" }} />
                          Total Amount
                        </span>
                        <span className="font-mono text-xs font-black" style={{ color: "#1885a3" }}>
                          {formatCurrency(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.totalAmount || 0)}
                        </span>
                      </div>
                      {/* Paid Amount row */}
                      <div className="flex justify-between items-center bg-orange-50/40 p-2 rounded-lg">
                        <span className="font-bold text-[10px] text-orange-600 uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                          Paid Amount
                        </span>
                        <span className="font-mono text-xs font-black text-orange-600">
                          {formatCurrency(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paidAmount || 0)}
                        </span>
                      </div>
                      {/* Unpaid Amount row */}
                      <div className="flex justify-between items-center bg-amber-50/40 p-2 rounded-lg">
                        <span className="font-bold text-[10px] text-amber-700 uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#fbbf24" }} />
                          Unpaid Amount
                        </span>
                        <span className="font-mono text-xs font-black text-amber-600" style={{ color: "#a6981e" }}>
                          {formatCurrency(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.unpaidAmount || 0)}
                        </span>
                      </div>
                      {/* Payment Progress Percentage */}
                      <div className="flex justify-between items-center bg-red-50/30 p-2 rounded-lg">
                        <span className="font-bold text-[10px] text-red-600 uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Payment Progress
                        </span>
                        <span className="font-mono text-xs font-black text-red-600">
                          {(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.totalAmount || 0) > 0 
                            ? `${siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paidPct.toFixed(1)}%` 
                            : "0.0%"}
                        </span>
                      </div>
                      
                      {/* Counts summary brief */}
                      <div className="text-[9px] font-semibold text-slate-500 text-center pt-1">
                        Ratio: {siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paid || 0} of {siteAccessData.find(m => m.key === hoveredCell.monthKey)?.total || 0} Lots fully paid
                      </div>
                    </div>
                  )}

                  {/* Values */}
                  {hoveredCell.type !== 'column' && (
                    <div>
                      {hoveredCell.type === 'percent' ? (
                        <div className="text-lg font-black text-red-600 tracking-tight">
                          {siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paidPct.toFixed(1)}%
                        </div>
                      ) : (
                        <div 
                          className="text-lg font-black tracking-tight"
                          style={{ 
                            color: hoveredCell.type === 'total' ? '#1885a3' : hoveredCell.type === 'paid' ? '#ea580c' : '#b2a11b' 
                          }}
                        >
                          {hoveredCell.type === 'total' && formatCurrency(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.totalAmount || 0)}
                          {hoveredCell.type === 'paid' && formatCurrency(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paidAmount || 0)}
                          {hoveredCell.type === 'unpaid' && formatCurrency(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.unpaidAmount || 0)}
                        </div>
                      )}
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                        {hoveredCell.type === 'total' && `Total counts: ${siteAccessData.find(m => m.key === hoveredCell.monthKey)?.total || 0} Lots in timeline`}
                        {hoveredCell.type === 'paid' && `Paid counts: ${siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paid || 0} Lots fully verified`}
                        {hoveredCell.type === 'unpaid' && `Unpaid counts: ${(siteAccessData.find(m => m.key === hoveredCell.monthKey)?.total - siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paid) || 0} Lots remaining`}
                        {hoveredCell.type === 'percent' && `Ratio: ${siteAccessData.find(m => m.key === hoveredCell.monthKey)?.paid || 0} of ${siteAccessData.find(m => m.key === hoveredCell.monthKey)?.total || 0} paid`}
                      </div>
                    </div>
                  )}

                  {/* Lot details list */}
                  <div className="border-t border-slate-100 pt-2 shrink-0">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex justify-between">
                      <span>Affected Lots ({hoveredCellLots.length})</span>
                      <span>Estimated Value</span>
                    </div>
                    {hoveredCellLots.length === 0 ? (
                      <div className="text-[10px] text-slate-400 italic py-1 text-center">
                        No lots recorded in this period
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                        {hoveredCellLots.slice(0, 4).map((lot, idx) => (
                          <div key={`${lot.id}-${idx}`} className="text-[10px] text-slate-600 flex justify-between items-center gap-2 py-0.5">
                            <div className="min-w-0 flex-1">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate leading-tight" title={lot.ownerName || 'Unknown Owner'}>
                                <span className="truncate">Lot {lot.lotId} ({lot.ownerName || 'Unknown Owner'})</span>
                                {recentUpdatesSet.has((lot.lotId || "").toString().trim().toLowerCase()) && (
                                  <span className="inline-flex items-center gap-1 shrink-0 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded-full text-[7px] font-black tracking-wider uppercase">
                                    <span className="relative flex h-1 w-1">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                                    </span>
                                    NEW
                                  </span>
                                )}
                              </span>
                              <span className="text-[8px] text-slate-400 block tracking-tight uppercase">
                                CP {lot.cp || 'N/A'} • {lot.barangay || 'N/A'}
                              </span>
                            </div>
                            <span className="font-mono text-[9px] font-semibold text-slate-700 whitespace-nowrap">
                              {formatCurrency(
                                nonWorkableCostFilter === 'land'
                                  ? (Number(lot.estimatedLandCost) || 0)
                                  : nonWorkableCostFilter === 'structure'
                                  ? (Number(lot.estimatedStructureCost) || 0)
                                  : ((Number(lot.estimatedLandCost) || 0) + (Number(lot.estimatedStructureCost) || 0))
                              )}
                            </span>
                          </div>
                        ))}
                        {hoveredCellLots.length > 4 && (
                          <div className="text-[8px] font-black text-brand-600 italic text-right mt-1 pt-1 border-t border-dashed border-slate-100 uppercase tracking-wider">
                            + {hoveredCellLots.length - 4} other lots in period
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Excel Download button footer */}
              {lotsForDownload.length > 0 && (
                <div className="border-t border-slate-100 pt-3 mt-1 shrink-0">
                  <button
                    onClick={() => handleDownloadExcel(lotsForDownload)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Excel ({lotsForDownload.length} Lots)</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {hoveredStatCard && statCardWeekInfo && hoveredStatCardDetails && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            onMouseEnter={() => {
              if (statCardCloseTimeoutRef.current) {
                clearTimeout(statCardCloseTimeoutRef.current);
                statCardCloseTimeoutRef.current = null;
              }
            }}
            onMouseLeave={handleStatCardMouseLeave}
            className="fixed z-[100] bg-slate-900/95 backdrop-blur-md shadow-2xl rounded-3xl p-4 w-80 pointer-events-auto select-text font-sans text-white border border-slate-800"
            style={statCardPositionStyle}
          >
            {/* Dynamic Speech Bubble arrow pointer pointing at the targeted core card */}
            {typeof window !== 'undefined' && window.innerWidth >= 768 && (
              isLeftSideOfScreen ? (
                <div 
                  className="absolute left-0 top-1/2 -translate-x-[9px] -translate-y-1/2 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-r-[10px] border-r-slate-900/95"
                  style={{ borderRightColor: 'rgba(15, 23, 42, 0.95)' }}
                />
              ) : (
                <div 
                  className="absolute right-0 top-1/2 translate-x-[9px] -translate-y-1/2 w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[10px] border-l-slate-900/95"
                  style={{ borderLeftColor: 'rgba(15, 23, 42, 0.95)' }}
                />
              )
            )}

            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-3">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Calendar className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">
                  {statCardWeekInfo.label}
                </div>
                <div className="text-xs font-black text-slate-200 truncate leading-none">
                  Accomplishment Updates
                </div>
              </div>
            </div>

            {/* Field metric compare name */}
            <div className="mb-3">
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-0.5">
                FIELD NAME / STATUS
              </div>
              <div className="text-sm font-extrabold text-white flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hoveredStatCard.color }} />
                {hoveredStatCard.label}
              </div>
            </div>

            {/* Total count comparisons and charts */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-3 mb-3 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="border-r border-slate-800">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Previous Week</div>
                  <div className="text-xl font-black text-slate-300">+{hoveredStatCardDetails.previousCount}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">This Week</div>
                  <div className="text-xl font-black text-emerald-400 flex items-center justify-center gap-1">
                    +{hoveredStatCardDetails.currentCount}
                    {hoveredStatCardDetails.currentCount > hoveredStatCardDetails.previousCount ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : hoveredStatCardDetails.currentCount < hoveredStatCardDetails.previousCount ? (
                      <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Chart "Graft" displaying visual size ratio comparison */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">
                  Visual Comparison Chart
                </div>
                <div className="space-y-1.5">
                  {/* Previous Week bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-semibold w-12 text-right">Prev Wk</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-slate-500 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${hoveredStatCardDetails.previousCount === 0 && hoveredStatCardDetails.currentCount === 0 ? 0 :
                            (hoveredStatCardDetails.previousCount / Math.max(hoveredStatCardDetails.previousCount, hoveredStatCardDetails.currentCount, 1)) * 105}%` 
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 w-4">
                      {hoveredStatCardDetails.previousCount}
                    </span>
                  </div>

                  {/* This Week bar */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-400 font-semibold w-12 text-right">This Wk</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          backgroundColor: hoveredStatCard.color,
                          width: `${hoveredStatCardDetails.previousCount === 0 && hoveredStatCardDetails.currentCount === 0 ? 0 :
                            (hoveredStatCardDetails.currentCount / Math.max(hoveredStatCardDetails.previousCount, hoveredStatCardDetails.currentCount, 1)) * 105}%` 
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 w-4">
                      {hoveredStatCardDetails.currentCount}
                    </span>
                  </div>
                </div>

                <div className="text-center text-[9px] font-bold text-slate-400">
                  {hoveredStatCardDetails.currentCount > hoveredStatCardDetails.previousCount ? (
                    <span className="text-emerald-400 font-extrabold">Increased by {hoveredStatCardDetails.currentCount - hoveredStatCardDetails.previousCount} lot accomplishment(s)</span>
                  ) : hoveredStatCardDetails.currentCount < hoveredStatCardDetails.previousCount ? (
                    <span className="text-rose-400 font-extrabold">Decreased by {hoveredStatCardDetails.previousCount - hoveredStatCardDetails.currentCount} lot accomplishment(s)</span>
                  ) : (
                    <span className="text-slate-400 font-extrabold">No Change</span>
                  )}
                </div>
              </div>
            </div>

            {/* List of updates in current week */}
            <div className="border-t border-slate-800 pt-2 shrink-0">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                {hoveredStatCardDetails.isTotalLotsCard ? "ALL WEEKLY LOT UPDATES" : `LOT UPDATES IN THIS PERIOD (${hoveredStatCardDetails.allEntriesCount})`}
              </div>
              
              {hoveredStatCardDetails.isTotalLotsCard ? (
                /* Overall summary list per field */
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                  {hoveredStatCardDetails.breakdown.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic py-1 text-center font-bold font-sans">
                      No updates in any field this week
                    </div>
                  ) : (
                    hoveredStatCardDetails.breakdown.map((b, idx) => (
                      <div key={idx} className="text-[10px] flex justify-between items-center py-1 border-b border-slate-850 last:border-0 font-sans">
                        <span className="font-extrabold text-slate-300 flex items-center gap-1.5 leading-none text-[9px]">
                          <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: b.color }} />
                          {b.name}
                        </span>
                        <div className="text-right font-mono text-[9px] font-semibold whitespace-nowrap">
                          <span className="text-emerald-400 font-bold">+{b.count}</span>
                          {b.previousCount !== b.count && (
                            <span className="text-slate-500 ml-1 text-[8px]">
                              (prev: +{b.previousCount})
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Specific field list entries */
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 relative">
                  {hoveredStatCardDetails.entries.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic py-1 text-center font-bold font-sans">
                      No accomplishments in this field this week
                    </div>
                  ) : (
                    <>
                      {hoveredStatCardDetails.entries.map((item, idx) => {
                        const isRecent = recentUpdatesSet.has((item.lotId || "").trim().toLowerCase());
                        return (
                          <div key={idx} className="text-[10px] text-slate-300 py-1 border-b border-slate-850 last:border-0 leading-tight font-sans">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="font-extrabold text-white flex items-center gap-1.5 truncate max-w-[160px]">
                                <span className="truncate">Lot {item.lotId}</span>
                                {isRecent && (
                                  <span className="inline-flex items-center gap-1 shrink-0 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded-full text-[7px] font-black tracking-wider uppercase">
                                    <span className="relative flex h-1 w-1">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                                    </span>
                                    NEW
                                  </span>
                                )}
                              </span>
                              <span className="text-[8px] font-mono font-semibold text-slate-400 whitespace-nowrap">
                                {item.dateAccomplishment || item.dateEntry}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[8.5px] text-slate-400 gap-1 font-sans">
                              <span className="truncate flex-1 min-w-0 font-semibold" title={item.cp || 'N/A'}>
                                Contract Package: {item.cp || "N/A"}
                              </span>
                              <span className="truncate max-w-[90px] text-slate-500 shrink-0 text-right" title={item.personnel || (item as any).handlerName}>
                                by {item.personnel || (item as any).handlerName || "N/A"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {hoveredStatCardDetails.allEntriesCount > 0 && (
                        <div className="text-[8.5px] font-black text-indigo-400 italic text-right pt-1.5 border-t border-dashed border-slate-800 uppercase tracking-widest sticky bottom-0 bg-slate-900/95 py-1">
                          Showing all {hoveredStatCardDetails.allEntriesCount} update(s)
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Developer Credits */}
      <footer className="mt-12 mb-0 px-4 relative z-40" data-html2canvas-ignore="true">
        <div className={cn(
          "relative rounded-3xl border p-6 sm:p-8 transition-all duration-300 hover:shadow-md select-none",
          activeTheme?.isDark 
            ? "bg-linear-to-r from-slate-900 via-slate-950/85 to-indigo-950/20 border-slate-800/80 text-slate-300 hover:border-slate-700/80"
            : "bg-linear-to-r from-white via-slate-50/70 to-slate-100/40 border-slate-200/80 text-slate-500 hover:border-slate-300/80"
        )}>
          {/* Decorative subtle ambient lights wrapped to prevent clipping other contents */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 rounded-full bg-indigo-400/10 blur-3xl pointer-events-none" />
          </div>
                    {/* Grid Layout */}
          <div className="relative flex flex-col lg:flex-row gap-6 lg:gap-8 items-center justify-between">
            {/* Left side: branding & status */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="p-3.5 bg-indigo-600 text-white rounded-2xl shadow-lg ring-4 ring-indigo-50/5 flex items-center justify-center">
                <Code className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className={cn("font-extrabold text-sm tracking-tight", activeTheme?.isDark ? "text-slate-100" : "text-slate-800")}>GCR LA Data Manager Team</h4>
                <p className="text-xs text-slate-400 mt-0.5">Database Administration, Quality Control & Dashboard Support</p>
              </div>
            </div>

            {/* Right side: Developer Profiles */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
              {/* Primary Developer Card */}
              <div 
                onClick={() => {
                  setZoomedDev({ 
                    name: dev1.name, 
                    role: dev1.role, 
                    badge: dev1.badge, 
                    picture: dev1.picture || danielPortrait, 
                    bio: dev1.bio, 
                    color: '#6366f1' 
                  });
                }}
                className={cn(
                  "flex-1 lg:flex-none border rounded-2xl p-2.5 pl-3.5 pr-5 shadow-xs flex items-center justify-between sm:justify-start gap-3 cursor-zoom-in hover:scale-101 hover:brightness-105 active:scale-99 transition-all duration-200 select-none",
                  activeTheme?.isDark 
                    ? "border-slate-800 bg-slate-950/70 hover:bg-slate-900/85 text-slate-200"
                    : "border-slate-200/60 bg-white/90 hover:bg-slate-50 text-slate-800"
                )}
                title="Zoom Profile"
              >
                {/* Miniature Avatar */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200/40 dark:border-slate-800/40 shadow-xs bg-indigo-50 flex items-center justify-center font-black text-[10px] text-indigo-600">
                    {dev1.picture ? (
                      <img 
                        src={dev1.picture}
                        alt="Dev 1"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <img 
                        src={danielPortrait}
                        alt="Daniel"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-normal">
                    {dev1.role}
                  </span>
                  <span className={cn("text-xs font-extrabold font-sans tracking-tight leading-none mt-0.5", activeTheme?.isDark ? "text-slate-200" : "text-slate-850")}>
                    {dev1.name}
                  </span>
                </div>
                <span className={cn("h-5 w-px hidden sm:block", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-200")} />
                <span className="text-[9px] font-black text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {dev1.badge}
                </span>
              </div>

              {/* Support Developer Card */}
              <div 
                onClick={() => {
                  setZoomedDev({ 
                    name: dev2.name, 
                    role: dev2.role, 
                    badge: dev2.badge, 
                    picture: dev2.picture || christianPortrait, 
                    bio: dev2.bio, 
                    color: '#10b981' 
                  });
                }}
                className={cn(
                  "flex-1 lg:flex-none border rounded-2xl p-2.5 pl-3.5 pr-5 shadow-xs flex items-center justify-between sm:justify-start gap-3 cursor-zoom-in hover:scale-101 hover:brightness-105 active:scale-99 transition-all duration-200 select-none",
                  activeTheme?.isDark 
                    ? "border-slate-800 bg-slate-950/70 hover:bg-slate-900/85 text-slate-200"
                    : "border-slate-200/60 bg-white/90 hover:bg-slate-50 text-slate-800"
                )}
                title="Zoom Profile"
              >
                {/* Miniature Avatar */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-slate-200/40 dark:border-slate-800/40 shadow-xs bg-indigo-50 flex items-center justify-center font-black text-[10px] text-emerald-600">
                    {dev2.picture ? (
                      <img 
                        src={dev2.picture}
                        alt="Dev 2"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <img 
                        src={christianPortrait}
                        alt="Christian"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-normal">
                    {dev2.role}
                  </span>
                  <span className={cn("text-xs font-extrabold font-sans tracking-tight leading-none mt-0.5", activeTheme?.isDark ? "text-slate-200" : "text-slate-850")}>
                    {dev2.name}
                  </span>
                </div>
                <span className={cn("h-5 w-px hidden sm:block", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-200")} />
                <span className="text-[9px] font-black text-emerald-600 bg-emerald-50/80 px-2 py-0.5 rounded-md uppercase tracking-wide">
                  {dev2.badge}
                </span>
              </div>
            </div>
          </div>

          {/* Underbar Copyright / Alignment Info */}
          <div className={cn(
            "mt-6 pt-4 border-t flex flex-col sm:flex-row justify-between items-center text-[10px] font-medium tracking-wide",
            activeTheme?.isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-400"
          )}>
            <span>© 2026 GCR Land Acquisition (LA) Team. All Rights Reserved.</span>
            <span className="mt-1 sm:mt-0 flex items-center gap-1.5 flex-wrap">
              <Cpu className="w-3 h-3 text-slate-400" />
              <span>Version {__APP_VERSION__} (Auto-Build)</span>
              <span className={cn("w-1 h-1 rounded-full hidden sm:inline", activeTheme?.isDark ? "bg-slate-700" : "bg-slate-300")} />
              <span className={cn("font-bold", activeTheme?.isDark ? "text-slate-300" : "text-slate-500")}>Last Update Detected: {latestDataUpdateStr}</span>
            </span>
          </div>
        </div>
      </footer>

      {/* Center-Aligned Zoomed Developer Profile Modal */}
      {createPortal(
        <AnimatePresence>
          {zoomedDev && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-zoom-out"
              onClick={() => setZoomedDev(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="relative max-w-sm w-full bg-slate-900 border border-slate-800/80 rounded-[2.5rem] overflow-hidden shadow-2xl p-6 flex flex-col items-center text-center gap-5 cursor-default select-none pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setZoomedDev(null)}
                  className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/45 hover:bg-slate-700/90 text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header Title Accent */}
                <div className="flex flex-col items-center gap-1 pt-2">
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                    <Code className="w-3.5 h-3.5 text-indigo-400" /> {zoomedDev.role}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Land Acquisition Management
                  </p>
                </div>

                {/* Avatar Frame with Glow */}
                <div className="relative mt-2">
                  <div 
                    className="absolute -inset-1 rounded-full blur-md opacity-75 animate-pulse" 
                    style={{ backgroundColor: zoomedDev.color }}
                  />
                  <div 
                    className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-slate-900 shadow-2xl bg-slate-850 flex items-center justify-center"
                  >
                    <img
                      src={zoomedDev.picture}
                      alt={zoomedDev.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {/* Active Indicator Pulse */}
                  <div className="absolute bottom-2 right-4 w-5.5 h-5.5 bg-emerald-500 border-4 border-slate-900 rounded-full shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  </div>
                </div>

                {/* Dynamic User Meta and Info content */}
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white tracking-tight font-sans px-2">
                    {zoomedDev.name}
                  </h3>
                  <div className="inline-block px-3 py-1 rounded-full bg-slate-950/40 border border-slate-850/60">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Role Category: {zoomedDev.badge}
                    </span>
                  </div>
                </div>

                {/* Custom biography bio text block */}
                <div className="w-full bg-slate-950/30 border border-slate-850/60 p-4 rounded-3xl">
                  <p className="text-xs text-slate-400 font-medium leading-relaxed font-sans px-1">
                    {zoomedDev.bio}
                  </p>
                </div>

                {/* Live Connection Tag */}
                <div className="flex items-center gap-1.5 justify-center py-0.5 px-3 bg-slate-950/60 border border-slate-850/60 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Core Development Member
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Immersive Master Zoom Overlay Modal */}
      {createPortal(
        <AnimatePresence>
          {maximizedPanel && (() => {
            const ZOOM_FIELDS = [
              { id: 'la', title: 'LA Progress Overview', subtitle: 'Land Acquisition Status Breakdown' },
              { id: 'expro', title: 'Expro Progress Overview', subtitle: 'Expropriation Legal Milestones' },
              { id: 'scNonWorkable', title: 'SC Non-Workable Area Progress', subtitle: 'Site Access Status by CP' },
              { id: 'cumulative', title: 'Cumulative Acquisition Progress', subtitle: 'S-Curve Growth & Milestone Targets' },
              { id: 'disbursement', title: 'Disbursement Plan Matrix (2027)', subtitle: 'Quarterly Release & S-07 Valuations' },
            ];
            const currentFieldIndex = ZOOM_FIELDS.findIndex(x => x.id === maximizedPanel);
            if (currentFieldIndex === -1) return null;
            const currentField = ZOOM_FIELDS[currentFieldIndex];

            const handlePrevField = () => {
              const prevIdx = currentFieldIndex > 0 ? currentFieldIndex - 1 : ZOOM_FIELDS.length - 1;
              setMaximizedPanel(ZOOM_FIELDS[prevIdx].id);
            };

            const handleNextField = () => {
              const nextIdx = currentFieldIndex < ZOOM_FIELDS.length - 1 ? currentFieldIndex + 1 : 0;
              setMaximizedPanel(ZOOM_FIELDS[nextIdx].id);
            };

            const paidPct = chartTotals.totalLots > 0 ? ((chartTotals.fullyPaid / chartTotals.totalLots) * 100).toFixed(1) : "0.0";
            const ptePct = chartTotals.totalLots > 0 ? ((chartTotals.signedPte / chartTotals.totalLots) * 100).toFixed(1) : "0.0";
            const activeExproCount = exproTotalCount;

            return (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[4000] flex items-center justify-center bg-slate-950/95 backdrop-blur-md cursor-default"
              >
                <motion.div
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  transition={{ type: "tween", duration: 0.22 }}
                  className={cn(
                    "relative w-screen h-screen flex flex-col overflow-hidden",
                    activeTheme?.isDark 
                      ? "bg-slate-950 text-slate-100" 
                      : "bg-white text-slate-900"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Decorative thin ambient accent bar at top edge */}
                  <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-emerald-500 shrink-0" />

                  {/* Header */}
                  <div className={cn(
                    "px-8 py-5 flex items-center justify-between border-b shrink-0 flex-wrap sm:flex-nowrap gap-4",
                    activeTheme?.isDark ? "border-slate-800/80 bg-slate-900/15" : "border-slate-100 bg-slate-50/50"
                  )}>
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        "text-[9px] uppercase font-black tracking-widest px-3 py-1.5 border rounded-xl leading-none shadow-xs shrink-0",
                        activeTheme?.isDark 
                          ? "bg-indigo-950/50 border-indigo-900/40 text-indigo-400" 
                          : "bg-indigo-50 border-indigo-100 text-indigo-700"
                      )}>
                        PANEL {currentFieldIndex + 1} OF 5
                      </span>
                      <div>
                        <h2 className="text-xl font-black tracking-tight font-display">{currentField.title}</h2>
                        <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] leading-none block mt-1", activeTheme?.isDark ? "text-slate-400" : "text-slate-505")}>
                          {currentField.subtitle}
                        </span>
                      </div>
                    </div>

                    {/* Navigation buttons: Prev Panel / Next Panel */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={cn(
                        "flex items-center p-0.5 rounded-xl border shadow-xs",
                        activeTheme?.isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"
                      )}>
                        <button
                          type="button"
                          onClick={handlePrevField}
                          className={cn(
                            "flex items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer select-none active:scale-95",
                            activeTheme?.isDark 
                              ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" 
                              : "hover:bg-white text-slate-650 hover:text-slate-900"
                          )}
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Prev Chart</span>
                        </button>
                        <div className={cn("w-px h-4", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-200")} />
                        <button
                          type="button"
                          onClick={handleNextField}
                          className={cn(
                            "flex items-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer select-none active:scale-95",
                            activeTheme?.isDark 
                              ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" 
                              : "hover:bg-white text-slate-650 hover:text-slate-900"
                          )}
                        >
                          <span>Next Chart</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setMaximizedPanel(null)}
                        className={cn(
                          "p-2.5 rounded-full border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm",
                          activeTheme?.isDark 
                            ? "bg-slate-800 border-slate-700/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100" 
                            : "bg-white border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                        )}
                        title="Exit Full-screen Mode"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
                    {/* Left Panel: Scaled-up high fidelity visualization */}
                    <div className={cn(
                      "flex-1 p-6 md:p-10 flex flex-col justify-center overflow-auto lg:overflow-hidden select-none",
                      activeTheme?.isDark ? "bg-slate-950/45" : "bg-slate-50/15"
                    )}>
                      <div className={cn(
                        "w-full h-full min-h-[350px]",
                        currentField.id !== 'disbursement' ? "flex items-center justify-center" : "flex flex-col"
                      )}>
                        {currentField.id === 'la' && (
                          <ResponsiveContainer width="100%" height={500}>
                            <BarChart 
                              data={laProgressData} 
                              layout="vertical" 
                              margin={{ left: 20, right: 140, top: 10, bottom: 20 }}
                              barGap={0}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fontWeight: 900, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase'}} 
                                width={180} 
                                interval={0}
                              />
                              <RechartsTooltip 
                                cursor={{fill: activeTheme?.isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(241, 245, 249, 0.4)'}}
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    const lotCount = data.lotCount;
                                    const remaining = Math.round(data.remaining);
                                    const total = lotCount + remaining;
                                    const pct = total > 0 ? ((lotCount / total) * 100).toFixed(1) : "0.0";
                                    return (
                                      <div className={cn(
                                        "p-4 rounded-2xl border shadow-lg space-y-3 min-w-[210px]",
                                        activeTheme?.isDark ? "bg-slate-900 border-slate-850 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                                      )}>
                                        <div className="flex items-center gap-2 border-b pb-2">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                          <span className="text-[11px] font-black uppercase tracking-wider">{data.name.split(' - ')[0]}</span>
                                        </div>
                                        <div className="space-y-2">
                                          <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                                            <span className="text-slate-500 text-[10px] uppercase">Progress</span>
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-extrabold">{lotCount}</span>
                                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-50 text-blue-650">%{pct}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center justify-between gap-4 text-xs font-semibold">
                                            <span className="text-slate-400 text-[10px] uppercase">Remaining</span>
                                            <span>{remaining}</span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 25 }} />
                              <Bar dataKey="lotCount" name="Lot Count" stackId="a" radius={[2, 0, 0, 2]} barSize={16} isAnimationActive={false}>
                                {laProgressData.map((entry, index) => (
                                   <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                              <Bar dataKey="remaining" name="Remaining" stackId="a" fill={activeTheme?.isDark ? "#1e293b" : "#f1f5f9"} radius={[0, 2, 2, 0]} barSize={16} isAnimationActive={false}>
                                <LabelList 
                                  dataKey="remaining" 
                                  position="right" 
                                  content={(props: any) => {
                                    const { x, y, width, index } = props;
                                    const rowData = laProgressData[index];
                                    if (!rowData) return null;
                                    const lotCount = rowData.lotCount;
                                    const actualRemaining = rowData.remaining;
                                    const valVal = Math.round(actualRemaining);
                                    const total = lotCount + valVal;
                                    const targetX = x + width;
                                    const pct = total > 0 ? ((lotCount / total) * 100).toFixed(1) : "0.0";
                                    return (
                                      <g>
                                        <text x={targetX + 10} y={y + 11} fill={activeTheme?.isDark ? "#f1f5f9" : "#1e293b"} fontSize={10.5} fontWeight={900} textAnchor="start">
                                          {lotCount} <tspan fill={activeTheme?.isDark ? "#475569" : "#94a3b8"} fontWeight={300} dx={4}>/ {total}</tspan> <tspan fill="#3b82f6" fontWeight={300} dx={6}>({pct}%)</tspan>
                                        </text>
                                      </g>
                                    );
                                  }}
                                />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}

                        {currentField.id === 'expro' && (
                          <ResponsiveContainer width="100%" height={500}>
                            <BarChart data={exproProgressData} layout="vertical" margin={{ left: 20, right: 100, top: 10, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fontWeight: 900, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase'}} 
                                width={180} 
                                interval={0}
                              />
                              <RechartsTooltip cursor={{fill: 'rgba(241, 245, 249, 0.3)'}} />
                              <Legend verticalAlign="top" align="center" iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.1em', paddingBottom: 25 }} />
                              <Bar dataKey="value" name="Expro Count" stackId="b" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
                                 {exproProgressData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                  <LabelList dataKey="value" position="right" fontSize={11} fontWeight={900} fill={activeTheme?.isDark ? "#f1f5f9" : "#1e293b"} offset={10} />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}

                        {currentField.id === 'scNonWorkable' && (
                          <ResponsiveContainer width="100%" height={500}>
                            <BarChart data={siteAccessData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }} barGap={2}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                              <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b'}} />
                              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b'}} />
                              <YAxis yAxisId="right" hide domain={[0, 100]} ticks={[]} tick={false} />
                              <RechartsTooltip cursor={{fill: 'rgba(241, 245, 249, 0.3)'}} />
                              <Legend 
                                verticalAlign="top" 
                                align="center" 
                                content={() => (
                                  <div className="flex flex-wrap items-center justify-center gap-5 pb-8 select-none">
                                    {[
                                      { key: 'total', label: 'Private Lots', color: '#2596be' },
                                      { key: 'paid', label: 'Paid', color: '#e87331' },
                                      { key: 'pte', label: 'PTE', color: '#a02b93' },
                                      { key: 'cno', label: 'CNO', color: '#0f9ed5' },
                                      { key: 'acquired', label: 'Acquired', color: '#dc2626' },
                                    ].map((item, index) => {
                                      const isActive = activeSeries[item.key as keyof typeof activeSeries];
                                      return (
                                        <button
                                          key={`legend-scnonworkable-${item.key}-${index}`}
                                          onClick={() => {
                                            setLastToggledSeries(item.key);
                                            setActiveSeries(prev => ({ ...prev, [item.key]: !prev[item.key] }));
                                          }}
                                          className={`flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all cursor-pointer ${
                                            isActive ? 'opacity-100' : 'opacity-30 line-through'
                                          }`}
                                        >
                                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: isActive ? item.color : '#cbd5e1' }} />
                                          <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider">{item.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              />
                              {activeSeries.total && (
                                <Bar yAxisId="left" dataKey="total" name="Private Lots" fill="#2596be" radius={[2, 2, 0, 0]} barSize={22} isAnimationActive={false} />
                              )}
                              {activeSeries.paid && (
                                <Bar yAxisId="left" dataKey="paid" name="Paid" fill="#e87331" radius={[2, 2, 0, 0]} barSize={22} isAnimationActive={false} />
                              )}
                              {activeSeries.pte && (
                                <Bar yAxisId="left" dataKey="pte" name="PTE" fill="#a02b93" radius={[2, 2, 0, 0]} barSize={22} isAnimationActive={false} />
                              )}
                              {activeSeries.cno && (
                                <Bar yAxisId="left" dataKey="cno" name="CNO" fill="#0f9ed5" radius={[2, 2, 0, 0]} barSize={22} isAnimationActive={false} />
                              )}
                              {activeSeries.acquired && (
                                <Bar yAxisId="left" dataKey="acquired" name="Acquired" fill="#dc2626" radius={[2, 2, 0, 0]} barSize={22} isAnimationActive={false} />
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                        )}

                        {currentField.id === 'cumulative' && (
                          <ResponsiveContainer width="100%" height={500}>
                            <ComposedChart data={cumulativeData} margin={{ top: 20, right: 30, left: 35, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={activeTheme?.isDark ? "rgba(51, 65, 85, 0.4)" : "#f1f5f9"} />
                              <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tickMargin={10} tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b'}} />
                              <YAxis 
                                ticks={cumulativeYAxisTicks} 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{fontSize: 10, fontWeight: 800, fill: activeTheme?.isDark ? '#94a3b8' : '#64748b'}}
                                label={{ value: 'CUMULATIVE LOTS ACQUIRED', angle: -90, position: 'insideLeft', offset: -25, style: { fontSize: 8, fontWeight: 900, fill: activeTheme?.isDark ? '#4b5563' : '#94a3b8', letterSpacing: '0.1em' } }}
                              />
                              <RechartsTooltip cursor={{fill: 'rgba(241, 245, 249, 0.3)'}} />
                              <Legend 
                                verticalAlign="top" 
                                align="center" 
                                content={() => (
                                  <div className="flex flex-wrap items-center justify-center gap-5 pb-8 select-none">
                                    {[
                                      { key: 'paid', label: 'Paid Lots', color: '#e87331', shape: 'rect' },
                                      { key: 'pte', label: 'Lots with PTE', color: '#a02b93', shape: 'rect' },
                                      { key: 'cno', label: 'Lots with CNO', color: '#0f9ed5', shape: 'rect' },
                                      { key: 'total', label: 'No. of Private Lots', color: '#2596be', shape: 'line-circle' },
                                      { key: 'acquired', label: 'Total Acquired', color: '#dc2626', shape: 'circle' },
                                    ].map((item, index) => {
                                      const isActive = activeSeries[item.key as keyof typeof activeSeries];
                                      return (
                                        <button
                                          key={`legend-cum-${item.key}-${index}`}
                                          onClick={() => {
                                            setLastToggledSeries(item.key);
                                            setActiveSeries(prev => ({ ...prev, [item.key]: !prev[item.key] }));
                                          }}
                                          className={`flex items-center gap-1.5 hover:opacity-80 active:scale-95 transition-all cursor-pointer ${
                                            isActive ? 'opacity-100' : 'opacity-30 line-through'
                                          }`}
                                        >
                                          {item.shape === 'rect' ? (
                                            <span className="w-3.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: isActive ? item.color : '#cbd5e1' }} />
                                          ) : item.shape === 'line-circle' ? (
                                            <svg className="w-5 h-2.5 inline-block shrink-0" viewBox="0 0 24 12" fill="none">
                                              <line x1="0" y1="6" x2="24" y2="6" stroke={isActive ? item.color : '#cbd5e1'} strokeWidth="3" />
                                              <circle cx="12" cy="6" r="3" fill={isActive ? item.color : '#cbd5e1'} />
                                            </svg>
                                          ) : (
                                            <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: isActive ? item.color : '#cbd5e1' }} />
                                          )}
                                          <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-widest">{item.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              />
                              <Bar dataKey="paid" stackId="a" fill="#e87331" name="Paid Lots" barSize={28} hide={!activeSeries.paid} isAnimationActive={false}>
                                <LabelList dataKey="paid" content={<CustomCumulativeLabel dataKey="paid" />} />
                              </Bar>
                              <Bar dataKey="pte" stackId="a" fill="#a02b93" name="Lots with PTE" barSize={28} hide={!activeSeries.pte} isAnimationActive={false}>
                                <LabelList dataKey="pte" content={<CustomCumulativeLabel dataKey="pte" />} />
                              </Bar>
                              <Bar dataKey="cno" stackId="a" fill="#0f9ed5" name="Lots with CNO" barSize={28} hide={!activeSeries.cno} isAnimationActive={false}>
                                <LabelList dataKey="cno" content={<CustomCumulativeLabel dataKey="cno" />} />
                              </Bar>
                              <Line type="monotone" dataKey="total" name="No. of Private Lots" stroke="#2596be" strokeWidth={3} dot={false} activeDot={{ r: 5 }} hide={!activeSeries.total} isAnimationActive={false}>
                                <LabelList dataKey="total" content={<CustomCumulativeLabel dataKey="total" />} />
                              </Line>
                              <Line type="monotone" dataKey="acquired" name="Total Acquired" stroke="transparent" strokeWidth={0} dot={false} activeDot={{ r: 5 }} hide={!activeSeries.acquired} isAnimationActive={false}>
                                <LabelList dataKey="acquired" content={<CustomCumulativeLabel dataKey="acquired" />} />
                              </Line>
                            </ComposedChart>
                          </ResponsiveContainer>
                        )}

                        {currentField.id === 'disbursement' && (
                          <div className={cn(
                            "w-full h-full min-h-[480px] p-4 rounded-3xl border shadow-md flex flex-col",
                            activeTheme?.isDark ? "bg-slate-900 border-slate-800 animate-fadeIn" : "bg-white border-slate-205 animate-fadeIn"
                          )}>
                            <DisbursementPlan data={data} activeTheme={activeTheme} isMaximized={true} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Panel: Beautiful explanation, insights & scrollable guidelines */}
                    <div className={cn(
                      "w-full lg:w-[480px] p-8 shrink-0 flex flex-col overflow-hidden border-t lg:border-t-0 lg:border-l select-none",
                      activeTheme?.isDark ? "border-slate-800 bg-slate-900" : "border-slate-150 bg-slate-50/70"
                    )}>
                      {/* Inner scroll wrapper */}
                      <div className="flex-1 overflow-y-auto pr-3 space-y-6 custom-scrollbar scroll-smooth">
                        {currentField.id === 'la' && (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-indigo-600">
                                <Info className="w-5 h-5 shrink-0" /> 
                                <h3 className="text-xs font-black uppercase tracking-wider font-display leading-none">
                                  Comprehensive Field Strategy Plan
                                </h3>
                              </div>
                              <p className={cn("text-xs font-semibold leading-relaxed", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                This strategy oversees the physical and administrative tracking of land lots from initial layout research, formal notice deployment, through amicable settlements or legal transitions.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5 pt-1">
                              <div className={cn(
                                "p-4 rounded-2.5xl border flex flex-col gap-1.5 shadow-3xs",
                                activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200"
                              )}>
                                <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Target Base</span>
                                <span className="text-xl font-black text-indigo-500">{chartTotals.totalLots} Lots</span>
                              </div>
                              <div className={cn(
                                "p-4 rounded-2.5xl border flex flex-col gap-1.5 shadow-3xs",
                                activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200"
                              )}>
                                <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Settled (Paid) Rate</span>
                                <span className="text-xl font-black text-emerald-500">{paidPct}%</span>
                              </div>
                            </div>

                            {/* Detailed Step-by-Step Acquisition Flow */}
                            <div className="space-y-4">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Core Acquisition Milestones Explained
                              </h4>
                              <div className="space-y-3">
                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-extrabold text-[10px] shrink-0 border border-emerald-500/20">01</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">Fully Paid (Deed of Absolute Sale)</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      Amicable acquisition finalized with verified landowners. The public deed is executed (DOAS), filed with the Registry of Deeds, and full compensation is disbursed. This is the ideal risk-free status.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-500 font-extrabold text-[10px] shrink-0 border border-violet-500/20">02</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-violet-500 mb-0.5">Signed PTE (Permit to Enter)</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      Owners grant immediate civil construction access via a standardized physical entry waiver. This permits structural utility clearing to begin while formal lot titles and replacement costs are undergoing legacy validation.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 font-extrabold text-[10px] shrink-0 border border-amber-500/20">03</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-amber-600 mb-0.5">Offer under 30-Day Legal Review</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      Official OTB (Offer to Buy) notices served to registered property owners. Legal boundaries are outlined with a strict 30-day decision timeline before proceeding to compulsory state legal mechanisms.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 font-extrabold text-[10px] shrink-0 border border-rose-500/20">04</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-rose-600 mb-0.5">Incurable Title Cases</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      Unresolvable title disputes, untraceable landowners, multiple heirs without estate settlements, or permanent tax liabilities. Submissions are instantly routed to Judicial Expropriation pathways to avoid project delay.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Tactical Field Directives */}
                            <div className="space-y-3 pt-2">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Active Strategic Actions
                              </h4>
                              <ul className={cn("text-[11px] font-semibold space-y-2.5 list-disc pl-5", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                <li>
                                  <span className="font-extrabold text-blue-600">Barangay Advocacy Desks:</span> Launch regional helpdesks directly inside concerned municipalities to resolve dispute valuations quickly.
                                </li>
                                <li>
                                  <span className="font-extrabold text-blue-600">Boundary Validation:</span> Dispatch rapid surveyor alignment teams to settle property over-lap protests real-time.
                                </li>
                              </ul>
                            </div>
                          </>
                        )}

                        {currentField.id === 'expro' && (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-indigo-600">
                                <Info className="w-5 h-5 shrink-0" />
                                <h3 className="text-xs font-black uppercase tracking-wider font-display leading-none block">
                                  Expropriation Milestone Masterplan
                                </h3>
                              </div>
                              <p className={cn("text-xs font-semibold leading-relaxed", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                This view tracks active eminent domain cases governed by national infrastructure acquisition laws (Republic Act 10752). Used exclusively for contested landowners or unresolvable titles.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3.5 pt-1">
                              <div className={cn(
                                "p-4 rounded-2.5xl border flex flex-col gap-1.5 shadow-3xs",
                                activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200"
                              )}>
                                <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Active Court Cases</span>
                                <span className="text-xl font-black text-indigo-500">{activeExproCount} Lots</span>
                              </div>
                              <div className={cn(
                                "p-4 rounded-2.5xl border flex flex-col gap-1.5 shadow-3xs",
                                activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200"
                              )}>
                                <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">Compiling Drafts</span>
                                <span className="text-xl font-black text-violet-500">
                                  {exproProgressData.find(x => x.name === 'Petition & Judicial Affidavit Preparation')?.value || 0}
                                </span>
                              </div>
                            </div>

                            {/* Deep Legal Milestones Walkthrough */}
                            <div className="space-y-4">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Legal Pipeline Stages & Requirements
                              </h4>
                              <div className="space-y-3">
                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 font-extrabold text-[10px] shrink-0 border border-pink-500/20">L-01</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-pink-600 mb-0.5">Court Petition Drafting</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      Internal legal teams pool technical lot descriptions, land layout plans, and proof of failed negotiations. Petitions are compiled and authorized by Office of the Solicitor General (OSG) representatives.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 font-extrabold text-[10px] shrink-0 border border-purple-500/20">L-02</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-purple-600 mb-0.5">Case Docketed in Presiding RTC</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      The lawsuit is formally registered at the Regional Trial Court (RTC). Landowners are served judicial summons to answer the condemnation petition.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 font-extrabold text-[10px] shrink-0 border border-blue-500/20">L-03</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-blue-600 mb-0.5">Land Bank Escrow Deposition</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      The legal requirement to deposit 100% of the government-mandated Zonal Value of the property into a dedicated escrow account at the Land Bank of the Philippines (LBP), proving liquid funding.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-200 shadow-3xs"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-extrabold text-[10px] shrink-0 border border-emerald-500/20">L-04</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">Writ of Possession (WOP) Issuance</h5>
                                    <p className={cn("text-[10.5px] font-medium leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-500")}>
                                      Once LBP escrow deposits are approved, the Judge issues a Writ of Possession. State sheriffs physically turn over land control to construction managers, granting unhindered access.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Legal Bottleneck Actions */}
                            <div className="space-y-3 pt-2">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Legal Directives to Overcome Backlogs
                              </h4>
                              <ul className={cn("text-[11px] font-semibold space-y-2.5 list-disc pl-5", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                <li>
                                  <span className="font-extrabold text-blue-600">OSG Document Auditing:</span> Ensure early formatting reviews of land survey records with the OSG to prevent court petition rejections.
                                </li>
                                <li>
                                  <span className="font-extrabold text-blue-600">Centralized Judicial Briefs:</span> Organize coordinate meetings with presiding judges to group petitions in clusters, speeding up generic dockets.
                                </li>
                              </ul>
                            </div>
                          </>
                        )}

                        {currentField.id === 'scNonWorkable' && (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-indigo-600">
                                <Info className="w-5 h-5 shrink-0" />
                                <h3 className="text-xs font-black uppercase tracking-wider font-display leading-none block">
                                  Segment Clearance & Obstacle Directives
                                </h3>
                              </div>
                              <p className={cn("text-xs font-semibold leading-relaxed", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                Ground execution monitoring. Clearing physically non-workable elements (encroaching buildings, heritage trees, high-voltage posts) is critical to establish continuous right-of-way (ROW) lines.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className={cn(
                                "p-5 rounded-3xl border flex flex-col gap-2 shadow-sm relative overflow-hidden transition-all hover:shadow-md",
                                activeTheme?.isDark 
                                  ? "bg-slate-900/50 border-slate-800/80 hover:border-emerald-500/35" 
                                  : "bg-white border-emerald-100/80 hover:border-emerald-300"
                              )}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400/90">Total Lots</span>
                                <span className="text-2xl font-black text-emerald-500 font-display">{chartTotals.totalLots} Lots</span>
                                <p className="text-[10px] font-medium text-slate-500/80 leading-normal">Overall project scope segments</p>
                              </div>
                              <div className={cn(
                                "p-5 rounded-3xl border flex flex-col gap-2 shadow-sm relative overflow-hidden transition-all hover:shadow-md",
                                activeTheme?.isDark 
                                  ? "bg-slate-900/50 border-slate-800/80 hover:border-orange-500/35" 
                                  : "bg-white border-orange-100/80 hover:border-orange-300"
                              )}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400/90">Paid Lots</span>
                                <span className="text-2xl font-black text-orange-500 font-display">{chartTotals.fullyPaid} Lots ({paidPct}%)</span>
                                <p className="text-[10px] font-medium text-slate-500/80 leading-normal">Compensated clearing status progress</p>
                              </div>
                            </div>

                            {/* Site Access Obstacles List */}
                            <div className="space-y-4">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                physical Site access obstacles
                              </h4>
                              <div className="space-y-3">
                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-0.5">Residential Encroachment</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-505")}>
                                      Dwelling structures standing inside structural alignments. Relocation packages, container housing distributions, and custom replacement cost evaluations are ongoing in dense urban segments.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <Settings className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-0.5">High Tension & Utility Relocation</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-505")}>
                                      Electric transmission grids and fiber communication trunks intersect multiple CP segments. Parallel planning with energy and phone companies is needed before soil drilling can begin.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <Leaf className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-0.5">Crop & Tree Appraisals</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-505")}>
                                      Fruit-bearing plantations blocking machinery corridors. Compensation calculations based on official DA-S07 standards protect agricultural owners while permitting removal schedules.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Next Steps for Contractors */}
                            <div className="space-y-3 pt-2">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Contractors Mobilization Guidelines
                              </h4>
                              <ul className={cn("text-[11px] font-semibold space-y-2.5 list-disc pl-5", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                <li>
                                  <span className="font-extrabold text-blue-600">Mobilization Link:</span> Align active construction spots with already-signed PTE lots to deploy framing rigs without legal claims.
                                </li>
                                <li>
                                  <span className="font-extrabold text-blue-600">Segment Priority:</span> Focus municipal surveys inside CP02 and CP04 first to match structural pier footings timelines.
                                </li>
                              </ul>
                            </div>
                          </>
                        )}

                        {currentField.id === 'cumulative' && (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-indigo-600">
                                <Info className="w-5 h-5 shrink-0" />
                                <h3 className="text-xs font-black uppercase tracking-wider font-display leading-none block">
                                  S-Curve Analysis & Variance Recovery
                                </h3>
                              </div>
                              <p className={cn("text-xs font-semibold leading-relaxed", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                Tracking planned timeline projections versus real field performance. Preventing delay gaps helps secure consistent funding with international lenders.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className={cn(
                                "p-5 rounded-3xl border flex flex-col gap-2 shadow-sm relative overflow-hidden transition-all hover:shadow-md",
                                activeTheme?.isDark 
                                  ? "bg-slate-900/50 border-slate-800/80 hover:border-indigo-500/35" 
                                  : "bg-white border-indigo-100/80 hover:border-indigo-300"
                              )}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400/90">Baseline Target</span>
                                <span className="text-2xl font-black text-indigo-500 font-display">2,014 Lots</span>
                                <p className="text-[10px] font-medium text-slate-500/80 leading-normal">Overall required segments for final alignment</p>
                              </div>
                              <div className={cn(
                                "p-5 rounded-3xl border flex flex-col gap-2 shadow-sm relative overflow-hidden transition-all hover:shadow-md",
                                activeTheme?.isDark 
                                  ? "bg-slate-900/50 border-slate-800/80 hover:border-rose-500/35" 
                                  : "bg-white border-rose-100/80 hover:border-rose-300"
                              )}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400/90">Current Achievement</span>
                                <span className="text-2xl font-black text-rose-500 font-display">{totalAcquiredLots} Lots ({acquiredPct}%)</span>
                                <p className="text-[10px] font-medium text-slate-500/80 leading-normal">Lots fully/partially acquired of 2,014</p>
                              </div>
                            </div>

                            {/* S-Curve Variance and Gap Remedies */}
                            <div className="space-y-4">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Variance Analysis & Action Guidelines
                              </h4>
                              <div className="space-y-3">
                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <TrendingUp className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-indigo-650 mb-0.5">Historical Progress Dry seasons</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-550")}>
                                      S-Curve data demonstrates peak progress occurs during dry seasons (Q1/Q2). Expanding appraisal teams during this phase capitalizes on soil stability and owner accessibility.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <Clock className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-rose-600 mb-0.5">Delay Gap Recovery Plan</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-550")}>
                                      Where court filings take longer, auxiliary surveyors run parallel mappings of adjacent blocks. This pre-negotiation reduces baseline preparation time from 60 to 14 days once court dockets finish.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Strategic Action Summary */}
                            <div className="space-y-3 pt-2">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Timeline Compliance Strategies
                              </h4>
                              <ul className={cn("text-[11px] font-semibold space-y-2.5 list-disc pl-5", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                <li>
                                  <span className="font-extrabold text-blue-600">Early Detection Metrics:</span> Deploy red-alert warning charts if real progress trails baseline values by more than 5%.
                                </li>
                                <li>
                                  <span className="font-extrabold text-blue-600">Dynamic Reallocation:</span> Pivot expert title certifiers to lag segments to clear lingering verification steps.
                                </li>
                              </ul>
                            </div>
                          </>
                        )}

                        {currentField.id === 'disbursement' && (
                          <>
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-indigo-600">
                                <DollarSign className="w-5 h-5 shrink-0 animate-pulse text-indigo-500" />
                                <h3 className="text-xs font-black uppercase tracking-wider font-display leading-none block">
                                  NSCR South Disbursement Plan & Overhead Strategy
                                </h3>
                              </div>
                              <p className={cn("text-xs font-semibold leading-relaxed", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                This matrix calculates the comprehensive cash flow requirements for the North-South Commuter Railway (NSCR) alignment. It filters out paid lots and factors in legal acquisition overheads and taxes.
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div className={cn(
                                "p-5 rounded-3xl border flex flex-col gap-2 shadow-sm relative overflow-hidden transition-all hover:shadow-md col-span-2",
                                activeTheme?.isDark 
                                  ? "bg-slate-900/50 border-slate-800/80 hover:border-emerald-500/35" 
                                  : "bg-white border-emerald-100/80 hover:border-emerald-300"
                              )}>
                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400/90">Grand Cash Flow Budget</span>
                                <span className="text-2xl font-black text-emerald-500 font-display">{formatCurrency(disbursementGrandBudget2027)}</span>
                                <p className="text-[10px] font-medium text-slate-500/80 leading-normal">Calculated 2027 capital requirements (+Taxes & Demolition)</p>
                              </div>
                            </div>

                            {/* Detailed Explanation of Formulas */}
                            <div className="space-y-4">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Detailed Financial Framework & Formulas
                              </h4>
                              <div className="space-y-3">
                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-extrabold text-[12px] shrink-0 border border-emerald-500/20">%</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">1) Land Tax & Transfer Fees (+10%)</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-550")}>
                                      Tax calculations apply a flat <strong>10%</strong> on top of the raw land cost (Column AJ). This covers Capital Gains Tax (CGT), Documentary Stamp Tax (DST), registration fees, and transfer taxes to clear the property title.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-extrabold text-[12px] shrink-0 border border-indigo-500/20">🏚️</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-indigo-650 mb-0.5">2) Structure Demo & Utilities (+30%)</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-550")}>
                                      Structure evaluations (Column AK) are marked up by <strong>30%</strong>. This reserve fund covers physical demolition costs, relocation assistance, utility clearing, and basic site preparation overhead.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 font-extrabold text-[12px] shrink-0 border border-amber-500/20">🛡️</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-amber-600 mb-0.5">3) Contingency Buffer Reserve (+5%)</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-550")}>
                                      To secure funding against market fluctuations and unexpected inflation, a final <strong>5% contingency buffer</strong> is calculated directly on the sub-total of Land, Structure, Tax, and Demolition costs.
                                    </p>
                                  </div>
                                </div>

                                <div className={cn(
                                  "p-4 rounded-2xl border flex items-start gap-3.5 shadow-3xs",
                                  activeTheme?.isDark ? "bg-slate-950/20 border-slate-800/80" : "bg-white border-slate-230"
                                )}>
                                  <div className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500 font-extrabold text-[12px] shrink-0 border border-pink-500/20">🔑</div>
                                  <div>
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-pink-600 mb-0.5">4) Live Override Input Control</h5>
                                    <p className={cn("text-[10.5px] font-semibold leading-normal", activeTheme?.isDark ? "text-slate-400" : "text-slate-550")}>
                                      Enable <strong>Admin Unlocked</strong> (password: <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-rose-500 font-mono font-black text-[9.5px]">dataadmin</code>) to edit S-07 month cells inside the ledger. Overrides instantly ripple into the Grand Total.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Active Financial Guidelines */}
                            <div className="space-y-3 pt-2">
                              <h4 className="text-[9.5px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">
                                Actionable Financial Directives
                              </h4>
                              <ul className={cn("text-[11px] font-semibold space-y-2.5 list-disc pl-5", activeTheme?.isDark ? "text-slate-350" : "text-slate-600")}>
                                <li>
                                  <span className="font-extrabold text-blue-600">Exclude Cumulative Paid:</span> Automatic logic checks Column AW to ignore settled elements, avoiding double disbursement allocations.
                                </li>
                                <li>
                                  <span className="font-extrabold text-blue-600">Quarterly Allotments:</span> Distribute funds dynamically according to Dry/Wet weather segments to maintain liquidity at the Land Bank.
                                </li>
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Interactive Tour Guide Overlay HUD */}
      <AnimatePresence>
        {tourActive && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-[9999]"
            data-html2canvas-ignore="true"
          >
            <div className={cn(
              "relative overflow-hidden p-6 rounded-3xl border shadow-2xl backdrop-blur-xl flex flex-col gap-4 text-left transition-all duration-300",
              activeTheme?.isDark
                ? "bg-slate-950/90 border-brand-500/30 text-white shadow-brand-500/5"
                : "bg-white/95 border-brand-300/40 text-slate-900 shadow-slate-900/10"
            )}>
              {/* Top Accent Line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 via-sky-400 to-indigo-500" />

              {/* Progress and Header */}
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                  Terminal Tour
                </span>
                <span>Step {tourStep + 1} of {tourSteps.length}</span>
              </div>

              {/* Micro Progress Bar */}
              <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-brand-500 to-sky-400 rounded-full transition-all duration-300"
                  style={{ width: `${((tourStep + 1) / tourSteps.length) * 100}%` }}
                />
              </div>

              {/* Core Step Info */}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-500/10 text-brand-500 dark:text-brand-400 rounded-2xl border border-brand-500/10 shrink-0">
                  {tourSteps[tourStep]?.icon}
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-sm font-black uppercase tracking-wider font-display">
                    {tourSteps[tourStep]?.title}
                  </h4>
                  <p className={cn(
                    "text-xs leading-relaxed font-semibold transition-colors duration-200",
                    activeTheme?.isDark ? "text-slate-300" : "text-slate-650"
                  )}>
                    {tourSteps[tourStep]?.description}
                  </p>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-1">
                <button
                  type="button"
                  onClick={handleTourClose}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer select-none"
                >
                  Skip Tour
                </button>
                <div className="flex items-center gap-2">
                  {tourStep > 0 && (
                    <button
                      type="button"
                      onClick={handleTourPrev}
                      className={cn(
                        "px-3.5 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer select-none active:scale-95",
                        activeTheme?.isDark 
                          ? "bg-slate-900 hover:bg-slate-800 text-slate-300" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      )}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTourNext}
                    className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-brand-500/20 cursor-pointer select-none active:scale-95 flex items-center gap-1 hover:translate-x-[1px]"
                  >
                    <span>{tourStep === tourSteps.length - 1 ? "Finish" : "Next"}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Double Click Drilldown Lots List Modal */}
      {selectedBarModal && selectedBarModal.isOpen && createPortal(
        <div 
          className="fixed inset-0 z-[8500] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-text"
          onClick={() => setSelectedBarModal(null)}
        >
          <div 
            className={cn(
              "relative w-full max-w-6xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all animate-in zoom-in-95 duration-200",
              activeTheme?.isDark
                ? "bg-slate-900 border-slate-800 text-slate-100 shadow-slate-950/80"
                : "bg-white border-slate-200 text-slate-900 shadow-slate-300/80"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 border-b shrink-0",
              activeTheme?.isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50/80 border-slate-200"
            )}>
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 truncate max-w-sm">
                      {resourceLoadComboMetrics.length > 0 && barModalComboFilter === 'combo' 
                        ? `Filtered by Combo (${resourceLoadComboMetrics.length} selected): ${resourceLoadComboMetrics.map(k => COMBO_METRIC_CONFIG[k]?.label).join(', ')}` 
                        : "Filtered Lots List"}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black font-mono border shrink-0",
                      resourceLoadComboMetrics.length > 0 && barModalComboFilter === 'combo'
                        ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
                        : "bg-indigo-500/15 text-indigo-500 border-indigo-500/30"
                    )}>
                      {modalFilteredLots.length} Lots
                    </span>
                  </div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white mt-0.5">
                    {selectedBarModal.categoryLabel}: <span className="text-indigo-600 dark:text-indigo-400">{selectedBarModal.barName}</span>
                  </h2>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleExportModalCSV}
                  className={cn(
                    "px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-3xs",
                    activeTheme?.isDark
                      ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <Download className="w-4 h-4 text-indigo-500" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBarModal(null)}
                  className={cn(
                    "p-2 rounded-xl border text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all cursor-pointer",
                    activeTheme?.isDark ? "bg-slate-800/80 border-slate-700 hover:bg-slate-700" : "bg-white border-slate-200 hover:bg-slate-100"
                  )}
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Filter Bar */}
            <div className={cn(
              "px-5 py-3 border-b flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0",
              activeTheme?.isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-100/50 border-slate-200"
            )}>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={barModalSearch}
                    onChange={(e) => {
                      setBarModalSearch(e.target.value);
                      setBarModalPage(1);
                    }}
                    placeholder="Search Lot ID, Owner, CP, etc..."
                    className={cn(
                      "w-full pl-9 pr-4 py-2 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all",
                      activeTheme?.isDark
                        ? "bg-slate-900 border-slate-800 text-white placeholder-slate-500"
                        : "bg-white border-slate-200 text-slate-900 placeholder-slate-400"
                    )}
                  />
                </div>

                {resourceLoadComboMetrics.length > 0 && (
                  <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/60 text-xs font-bold w-full sm:w-auto overflow-x-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setBarModalComboFilter('all');
                        setBarModalPage(1);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap text-[11px]",
                        barModalComboFilter === 'all'
                          ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      <span>All Category Lots ({modalMatchedLots.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBarModalComboFilter('combo');
                        setBarModalPage(1);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap text-[11px]",
                        barModalComboFilter === 'combo'
                          ? "bg-white dark:bg-slate-900 shadow-xs font-black"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                      style={{
                        color: barModalComboFilter === 'combo' ? (COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.color || '#f43f5e') : undefined
                      }}
                    >
                      <TrendingUp className="w-3.5 h-3.5" style={{ color: COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.color || '#f43f5e' }} />
                      <span>
                        {resourceLoadComboMetrics.length === 1
                          ? `${COMBO_METRIC_CONFIG[resourceLoadComboMetrics[0]]?.label} (${modalComboMatchedLots.length})`
                          : `Combo Filter (${resourceLoadComboMetrics.length}) (${modalComboMatchedLots.length})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                Showing <span className="font-bold text-slate-900 dark:text-white">{paginatedModalLots.length}</span> of <span className="font-bold text-slate-900 dark:text-white">{modalFilteredLots.length}</span> lots
              </div>
            </div>

            {/* Modal Table Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
              {modalFilteredLots.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <p className="text-sm font-bold">No lots found matching search criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={cn(
                        "border-b text-[10px] font-black uppercase tracking-wider",
                        activeTheme?.isDark ? "bg-slate-950/80 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
                      )}>
                        <th className="py-3.5 px-4 w-12 text-center whitespace-nowrap font-black">#</th>
                        {activeModalColumns.map(col => (
                          <th key={col.id} className={cn("py-3.5 px-4 font-black whitespace-nowrap", col.minWidth)}>
                            {col.label}
                          </th>
                        ))}
                        <th className="py-3.5 px-4 text-right font-black whitespace-nowrap min-w-[140px]">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs font-medium">
                      {paginatedModalLots.map((lot, idx) => {
                        const globalIdx = (barModalPage - 1) * BAR_MODAL_PAGE_SIZE + idx + 1;
                        return (
                          <tr 
                            key={lot.id || lot.lotId || idx}
                            onClick={() => {
                              if (onSelectLot) {
                                onSelectLot(lot);
                              }
                              setSelectedBarModal(null);
                            }}
                            className={cn(
                              "transition-colors cursor-pointer group",
                              activeTheme?.isDark
                                ? "hover:bg-indigo-950/40 text-slate-200"
                                : "hover:bg-indigo-50/70 text-slate-800"
                            )}
                          >
                            <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-400 font-bold whitespace-nowrap">
                              {globalIdx}
                            </td>
                            {activeModalColumns.map(col => (
                              <td 
                                key={col.id} 
                                className={cn(
                                  "py-3.5 px-4", 
                                  col.id === 'registeredOwner'
                                    ? "whitespace-normal break-words font-semibold max-w-[280px] sm:max-w-[360px]"
                                    : "whitespace-nowrap",
                                  col.minWidth, 
                                  col.id === 'lotId' ? "font-bold font-mono text-indigo-600 dark:text-indigo-400" : ""
                                )}
                              >
                                {col.resolver(lot)}
                              </td>
                            ))}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap min-w-[140px]">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                View Profile <ChevronRight className="w-3 h-3" />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Pagination Footer */}
            {totalModalPages > 1 && (
              <div className={cn(
                "px-5 py-3 border-t flex items-center justify-between text-xs font-semibold shrink-0",
                activeTheme?.isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <span className="text-slate-500">
                  Page {barModalPage} of {totalModalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={barModalPage <= 1}
                    onClick={() => setBarModalPage(p => Math.max(1, p - 1))}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border font-bold text-xs transition-all disabled:opacity-40 cursor-pointer",
                      activeTheme?.isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={barModalPage >= totalModalPages}
                    onClick={() => setBarModalPage(p => Math.min(totalModalPages, p + 1))}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border font-bold text-xs transition-all disabled:opacity-40 cursor-pointer",
                      activeTheme?.isDark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700"
                    )}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const getAdaptiveColor = (color: string | undefined, isDark: boolean) => {
  if (!color) return undefined;
  if (!isDark) return color;
  // Map low-contrast dark text colors in dark mode to bright, comfortable equivalents
  if (color === "#2379a7") return "#38bdf8"; // Light Sky Blue
  if (color === "#359b78") return "#34d399"; // Light Emerald
  if (color === "#006e7b") return "#2dd4bf"; // Light Teal
  if (color === "#003153") return "#60a5fa"; // Light Blue
  if (color === "#616a8c") return "#a5b4fc"; // Indigo Indigo
  if (color === "#e49864") return "#fdba74"; // Vibrant Orange
  if (color === "#d6bf5d") return "#fde047"; // Yellow
  if (color === "#b34b40") return "#f87171"; // Coral Red
  if (color === "#bd0707") return "#fca5a5"; // Soft Red
  if (color === "#112bbc") return "#818cf8"; // Lavender Blue
  if (color === "#66ac69") return "#4ade80"; // Bright Green
  if (color === "#187f05") return "#4ade80"; // Success Green
  if (color === "#239694") return "#2dd4bf"; // Teal Accent
  return color;
};

const SummaryCard = ({ title, subtitle, icon, items, activeTheme }: { 
  title: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  items: Array<{ value: string | number; label: string; status: "neutral" | "brand" | "success"; color?: string }>;
  activeTheme?: ThemeConfig;
}) => (
  <motion.div 
    variants={itemVariants}
    className={cn(
      "border rounded-[2rem] p-6 flex flex-col gap-5 shadow-sm hover:shadow-2xl transition-all duration-500",
      activeTheme?.isDark 
        ? "bg-slate-900 border-slate-800 text-slate-100/90 shadow-slate-950/40" 
        : "bg-white border-slate-200/50 text-slate-900 hover:shadow-slate-200/40"
    )}
  >
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h3 className={cn("text-[11px] font-black uppercase tracking-[0.2em]", activeTheme?.isDark ? "text-slate-100" : "text-slate-900")}>{title}</h3>
        <p className={cn("text-[9px] font-bold uppercase tracking-widest", activeTheme?.isDark ? "text-slate-500" : "text-slate-400")}>{subtitle}</p>
      </div>
      <div className={cn("w-9 h-9 rounded-2xl flex items-center justify-center text-slate-400", activeTheme?.isDark ? "bg-slate-800" : "bg-slate-50")}>
        {icon}
      </div>
    </div>
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const itemColor = getAdaptiveColor(item.color || "#003153", activeTheme?.isDark || false);
        return (
          <div key={i} className={cn(
            "rounded-2xl py-3 px-4.5 text-left border shadow-3xs transition-all hover:scale-[1.01] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative overflow-hidden pl-6",
            activeTheme?.isDark 
              ? "bg-slate-950/45 border-slate-850" 
              : "bg-slate-50/40 border-slate-100"
          )}>
            {/* Elegant Left Accent Line */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: itemColor }} />
            
            <p className={cn("text-[9.5px] font-bold uppercase tracking-wider leading-snug", activeTheme?.isDark ? "text-slate-450" : "text-slate-500")}>
              {item.label}
            </p>
            <div className="text-xl font-black tracking-tight leading-none font-mono" style={{ color: itemColor }}>
              {item.value}
            </div>
          </div>
        );
      })}
    </div>
  </motion.div>
);

const MiniStat = ({ 
  val, 
  label, 
  icon, 
  onDownload, 
  color,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
  id,
  isHovered,
  isSelected,
  activeTheme
}: { 
  key?: string;
  val: string | number; 
  label: string; 
  icon: React.ReactNode; 
  onDownload?: () => void; 
  color?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  onDoubleClick?: (e: React.MouseEvent) => void;
  id?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  activeTheme?: ThemeConfig;
}) => {
  const parsedColor = getAdaptiveColor(color || "#4C516D", activeTheme?.isDark || false);
  return (
    <motion.div 
      id={id}
      variants={itemVariants}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        "border rounded-[1.5rem] p-4 text-center transition-all duration-300 group cursor-pointer select-none h-full flex flex-col justify-between relative overflow-hidden",
        isSelected
          ? (activeTheme?.isDark
              ? "bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/80 scale-[1.03] shadow-lg shadow-emerald-950/40 z-20 text-slate-100"
              : "bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/80 scale-[1.03] shadow-lg shadow-emerald-500/10 z-20 text-slate-900")
          : activeTheme?.isDark 
            ? (isHovered 
                ? "bg-slate-900 border-slate-700 scale-[1.04] shadow-xl shadow-slate-950/50 z-10" 
                : "bg-slate-900/30 border-slate-850 shadow-3xs hover:shadow-lg hover:shadow-slate-950/25 hover:-translate-y-1 text-slate-100")
            : (isHovered 
                ? "bg-white border-slate-200 scale-[1.04] shadow-xl shadow-slate-200/70 z-10" 
                : "bg-white border-slate-100/80 shadow-3xs hover:shadow-lg hover:shadow-slate-200/30 hover:-translate-y-1 text-slate-900")
      )}
    >
      <div className="flex flex-col items-center justify-center gap-1 mb-2">
        <p className={cn("text-[9px] font-bold uppercase tracking-wider leading-tight min-h-[22px] flex items-center justify-center text-center", activeTheme?.isDark ? "text-slate-450" : "text-slate-500")} title={label}>
          {label}
        </p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onDownload) onDownload();
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            if (onMouseLeave) onMouseLeave();
          }}
          title={`Download ${label} List`}
          className={cn(
            "absolute top-3 right-3 w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all hover:scale-110 active:scale-95 border opacity-0 group-hover:opacity-100 shadow-3xs shrink-0",
            activeTheme?.isDark 
              ? "bg-slate-950 border-slate-800 hover:bg-brand-950 hover:text-brand-400 text-slate-400" 
              : "bg-slate-50 border-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-400"
          )}
        >
          {icon}
        </button>
      </div>
      <div className="flex-1 flex flex-col justify-end items-center">
        <div 
          className={cn(
            "font-black tracking-tight truncate leading-none font-mono text-center w-full",
            typeof val === 'string' && val.length > 8 ? "text-xs px-1" : "text-2xl"
          )}
          style={{ color: parsedColor }}
        >
          {val}
        </div>
      </div>
    </motion.div>
  );
};

const ChartBox = ({ 
  title, 
  subtitle, 
  children, 
  spanFull, 
  badge, 
  extra, 
  activeTheme,
  isMaximized,
  onMaximize,
  onHide
}: { 
  title: string; 
  subtitle: string; 
  children: React.ReactNode; 
  spanFull?: boolean; 
  badge?: React.ReactNode; 
  extra?: React.ReactNode; 
  activeTheme?: ThemeConfig;
  isMaximized?: boolean;
  onMaximize?: () => void;
  onHide?: () => void;
}) => {
  const content = (
    <motion.div 
      variants={itemVariants}
      className={cn(
        isMaximized 
          ? "fixed inset-0 z-[60] p-6 md:p-10 overflow-y-auto flex flex-col w-screen h-screen m-0 border-none rounded-none shadow-none"
          : "border rounded-[2.25rem] p-6 shadow-sm flex flex-col h-full group hover:shadow-2xl transition-[box-shadow,border-color] duration-305",
        isMaximized && (activeTheme?.isDark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"),
        !isMaximized && (activeTheme?.isDark 
          ? "bg-slate-900 border-slate-800 shadow-slate-950/45 hover:shadow-slate-950/60 text-slate-100 hover:border-brand-500/35"
          : "bg-white border-slate-200/50 shadow-sm hover:shadow-slate-200/50 text-slate-900 hover:border-brand-200/40"),
        spanFull && !isMaximized && "lg:col-span-2"
      )}
      style={isMaximized ? { margin: 0 } : undefined}
    >
      <div className={cn(
        "flex items-center justify-between mb-8 border-b pb-5 flex-wrap gap-4",
        activeTheme?.isDark ? "border-slate-800" : "border-slate-50"
      )}>
        <div className="space-y-1.5 flex-1 min-w-[240px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className={cn("text-xl font-black tracking-tight leading-none font-display transition-colors", activeTheme?.isDark ? "text-slate-100 group-hover:text-brand-400" : "text-slate-900 group-hover:text-brand-900")}>{title}</h3>
            {badge !== undefined && (
              <span className={cn(
                "inline-flex items-center justify-center px-2.5 py-1 text-[10px] font-black border rounded-lg shadow-2xs leading-none",
                activeTheme?.isDark ? "bg-brand-950/40 border-brand-900/40 text-brand-400" : "bg-brand-50 border-brand-100/60 text-brand-700"
              )}>
                TOTAL: {badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
             <div className={cn("w-1 h-3 rounded-full", activeTheme?.isDark ? "bg-brand-450 bg-brand-440" : "bg-brand-500")} />
             <p className={cn("text-[10px] font-black uppercase tracking-[0.2em]", activeTheme?.isDark ? "text-slate-400" : "text-slate-400")}>{subtitle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap justify-end md:flex-nowrap" data-html2canvas-ignore="true">
          {extra}
          
          {/* Panel Action Controls */}
          <div className={cn(
            "flex items-center gap-1 p-1 rounded-2xl border",
            activeTheme?.isDark 
              ? "bg-slate-950/60 border-slate-800/80" 
              : "bg-slate-100 border-slate-220"
          )}>
            {onMaximize && (
              <button
                type="button"
                onClick={onMaximize}
                className={cn(
                  "p-1.5 rounded-xl transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105",
                  activeTheme?.isDark 
                    ? "hover:bg-slate-800/90 text-slate-400 hover:text-slate-100" 
                    : "hover:bg-slate-200 text-slate-500 hover:text-slate-850"
                )}
                title={isMaximized ? "Minimize/Restore" : "Maximize to Full Screen"}
              >
                {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
            
            {onHide && !isMaximized && (
              <button
                type="button"
                onClick={onHide}
                className={cn(
                  "p-1.5 rounded-xl transition-all cursor-pointer duration-200 active:scale-90 hover:scale-105 hover:text-red-500",
                  activeTheme?.isDark 
                    ? "hover:bg-slate-800/90 text-slate-400" 
                    : "hover:bg-slate-200 text-slate-500"
                )}
                title="Hide layout panel"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <div className={cn("w-full h-full", isMaximized ? "min-h-[70vh] h-[70vh]" : "min-h-[350px]")}>
          {children}
        </div>
      </div>
    </motion.div>
  );

  if (isMaximized) {
    return createPortal(content, document.body);
  }
  return content;
};
