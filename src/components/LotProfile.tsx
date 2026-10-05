import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { 
  Search, 
  User, 
  MapPin, 
  Ruler, 
  Coins, 
  FileText, 
  ExternalLink,
  CheckCircle2,
  X,
  Filter,
  Building2,
  Compass,
  Activity,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Copy,
  Check,
  History,
  Lock,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  Printer,
  SlidersHorizontal,
  FolderOpen,
  Calendar,
  Handshake,
  FileCheck,
  Flag,
  MessageSquare,
  Percent,
  FileSignature,
  FileEdit,
  Save,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Trash2,
  GitCompare,
  Clock,
  ArrowUpDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LotData, WeeklyUpdate } from "../types";
import { ALL_STATUS_OPTIONS, satisfiesStatusFilter } from "../utils/statusUtils";
import { cn, formatCurrency, formatArea } from "../lib/utils";
import { ThemeConfig } from "../lib/theme";
import { initAuth, googleSignIn, logoutGoogle } from "../services/googleAuth";
import { QuickSearchBox } from "./QuickSearchBox";

const formatToSheetDate = (dateStr: string): string => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    // Looks like YYYY-MM-DD
    const yyyy = parts[0];
    const mm = parseInt(parts[1], 10);
    const dd = parseInt(parts[2], 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (mm >= 1 && mm <= 12) {
      return `${dd}-${months[mm - 1]}-${yyyy}`;
    }
  }
  return dateStr; // fallback
};

const formatToInputDate = (dateStr: string): string => {
  if (!dateStr || dateStr === "-" || dateStr.toLowerCase() === "no data") return "";
  
  // If it's already in YYYY-MM-DD, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  
  // Parse format like D-MMM-YYYY or DD-MMM-YYYY (e.g. 5-Aug-2025)
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    let dStr = parts[0].trim();
    const mStr = parts[1].trim().toLowerCase();
    const yStr = parts[2].trim();
    
    // Check if month exists in array
    const mIndex = months.findIndex(m => mStr.startsWith(m));
    if (mIndex !== -1 && /^\d+$/.test(dStr) && /^\d{4}$/.test(yStr)) {
      const dd = dStr.padStart(2, "0");
      const mm = (mIndex + 1).toString().padStart(2, "0");
      return `${yStr}-${mm}-${dd}`;
    }
  }
  return "";
};

const getNotesCount = (lotId: string): number => {
  if (!lotId) return 0;
  try {
    const stored = localStorage.getItem(`gcr_notes_${lotId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch {}
  return 0;
};


interface ActualsPartition {
  rowNumber: number;
  structureTag: string;
  paymentStructureStatus: string;
  totalPaidStructureCost: string;
  paymentFenceStatus: string;
  fenceOtherCost: string;
}

interface StructureEntry {
  key: number;
  tag: string;
  use: string;
  owner: string;
}

export function parseStructureOverlay(lot: LotData): StructureEntry[] {
  const parseFields = (raw: string) => {
    if (!raw || raw.trim() === "" || raw.trim() === "-") return [];
    const text = raw.trim();
    
    // Match numbered item markers at the start of string or preceded by whitespace/newlines (e.g. "1 - ", "2 - ", "1. ", "2) ")
    const itemRegex = /(?:^|\s+)(\d{1,3})\s*[\-\.\)]\s*/g;
    const matches: { index: number; fullMatchStart: number; contentStart: number }[] = [];
    
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(text)) !== null) {
      const num = parseInt(m[1], 10);
      matches.push({
        index: num,
        fullMatchStart: m.index,
        contentStart: m.index + m[0].length
      });
    }

    if (matches.length > 0) {
      return matches.map((item, i) => {
        const nextMatchStart = i + 1 < matches.length ? matches[i + 1].fullMatchStart : text.length;
        const rawContent = text.slice(item.contentStart, nextMatchStart).trim();
        return {
          index: item.index,
          text: rawContent || "—"
        };
      });
    }

    return [{ index: 1, text: text }];
  };

  const parsedTags = parseFields(lot.affectedStructure);
  const parsedUses = parseFields(lot.useStructure);
  const parsedOwners = parseFields(lot.ownerStructure);

  const allIndices = Array.from(new Set([
    ...parsedTags.map(x => x.index),
    ...parsedUses.map(x => x.index),
    ...parsedOwners.map(x => x.index)
  ])).sort((a, b) => a - b);

  if (allIndices.length === 0) {
    const hasTag = lot.affectedStructure && lot.affectedStructure.trim() !== "" && lot.affectedStructure.trim() !== "-";
    const hasUse = lot.useStructure && lot.useStructure.trim() !== "" && lot.useStructure.trim() !== "-";
    const hasOwner = lot.ownerStructure && lot.ownerStructure.trim() !== "" && lot.ownerStructure.trim() !== "-";
    
    if (hasTag || hasUse || hasOwner) {
      return [{
        key: 1,
        tag: lot.affectedStructure || "—",
        use: lot.useStructure || "—",
        owner: lot.ownerStructure || "—"
      }];
    }
    return [];
  }

  return allIndices.map(idx => {
    const tagMatch = parsedTags.find(x => x.index === idx)?.text || "—";
    const useMatch = parsedUses.find(x => x.index === idx)?.text || "—";
    const ownerMatch = parsedOwners.find(x => x.index === idx)?.text || "—";
    return {
      key: idx,
      tag: tagMatch,
      use: useMatch,
      owner: ownerMatch
    };
  });
}

interface RemarksAnalysis {
  riskScore: number;
  riskLevel: "CLEARED" | "ROUTINE" | "ATTENTION" | "CRITICAL";
  priorityColor: "emerald" | "indigo" | "amber" | "rose";
  categoryTags: string[];
  suggestedAction: string;
}

export function analyzeRemarks(remarks: string | undefined): RemarksAnalysis {
  if (!remarks || remarks.trim() === "" || remarks.toLowerCase().includes("no supplemental remarks") || remarks === "-") {
    return {
      riskScore: 0,
      riskLevel: "CLEARED",
      priorityColor: "emerald",
      categoryTags: ["CLEARED / ROUTINE", "ALL OKAY"],
      suggestedAction: "Proceed with final ROW handover and formal registration."
    };
  }

  const lower = remarks.toLowerCase();
  const tags: string[] = [];
  let score = 25;
  let level: "CLEARED" | "ROUTINE" | "ATTENTION" | "CRITICAL" = "ROUTINE";
  let color: "emerald" | "indigo" | "amber" | "rose" = "indigo";
  let suggested = "Normal acquisition monitoring.";

  if (lower.includes("expro") || lower.includes("court") || lower.includes("legal") || lower.includes("case") || lower.includes("filed")) {
    tags.push("LEGAL DISPUTE");
    tags.push("COURT PROCEEDINGS");
    score += 55;
    suggested = "Coordinate with legal division for expropriation tracking.";
  }

  if (lower.includes("heir") || lower.includes("deceased") || lower.includes("death") || lower.includes("dead") || lower.includes("estate")) {
    tags.push("ESTATE / HEIRSHIP");
    score += 25;
    if (suggested === "Normal acquisition monitoring.") {
      suggested = "Follow up compliance of extrajudicial settlement documents among heirs.";
    }
  }

  if (lower.includes("reloc") || lower.includes("tenant") || lower.includes("lgu") || lower.includes("informal")) {
    tags.push("SOCIAL STATUS");
    tags.push("TENANT RELOCATION");
    score += 20;
    if (suggested === "Normal acquisition monitoring.") {
      suggested = "Coordinate with social development team for active municipal relocation scheduling.";
    }
  }

  if (lower.includes("appraisal") || lower.includes("cost") || lower.includes("value") || lower.includes("disapprove")) {
    tags.push("VALUATION ISSUE");
    score += 15;
  }

  if (lower.includes("demol") || lower.includes("clear") || lower.includes("cleared")) {
    tags.push("PHYSICAL STATUS");
  }

  if (score >= 70) {
    level = "CRITICAL";
    color = "rose";
  } else if (score >= 40) {
    level = "ATTENTION";
    color = "amber";
  }

  if (tags.length === 0) {
    tags.push("ROUTINE AUDIT");
  }

  return {
    riskScore: Math.min(100, score),
    riskLevel: level,
    priorityColor: color,
    categoryTags: tags,
    suggestedAction: suggested
  };
}

// Helper to format currency inputs on the fly as they type
const formatAsTheyType = (val: string): string => {
  // Strip non-numeric/non-decimal characters
  const clean = val.replace(/[^0-9.]/g, "");
  if (!clean) return "";
  
  const parts = clean.split(".");
  const integerPart = parseFloat(parts[0]);
  if (isNaN(integerPart)) return "";
  
  let formattedInteger = new Intl.NumberFormat("en-US").format(integerPart);
  
  if (parts.length > 1) {
    // Keep up to 2 decimal places
    const decimalPart = parts[1].substring(0, 2);
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

// Helper to format currency inputs when losing focus (onBlur) to have standard 2 decimal places
const formatOnBlur = (val: string): string => {
  const clean = val.replace(/[^0-9.-]+/g, "");
  if (!clean) return "";
  const num = parseFloat(clean);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

interface LotProfileProps {
  data: LotData[];
  activeTheme: ThemeConfig;
  isModalMode?: boolean;
  onCloseModal?: () => void;
  selectedLotIdFromSearch?: string;
  onRefreshData?: () => void;
  selectedTab?: "general" | "tech" | "costs" | "milestones" | "supplemental" | "update" | "comments";
  onSelectedTabChange?: (tab: "general" | "tech" | "costs" | "milestones" | "supplemental" | "update" | "comments") => void;
  showSummaryModal?: boolean;
  onShowSummaryModalChange?: (show: boolean) => void;
  onCompareLot?: (lotId: string) => void;
  weeklyUpdates?: WeeklyUpdate[];
}

interface PreprocessedLot extends LotData {
  _searchStr: string;
  _progress: number;
}

export const LotProfile: React.FC<LotProfileProps> = ({ 
  data = [], 
  activeTheme,
  isModalMode = false,
  onCloseModal,
  selectedLotIdFromSearch = "",
  onRefreshData,
  selectedTab: selectedTabProp,
  onSelectedTabChange,
  showSummaryModal: showSummaryModalProp,
  onShowSummaryModalChange,
  onCompareLot,
  weeklyUpdates = []
}) => {
  // Navigation states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLotId, setSelectedLotId] = useState<string>(selectedLotIdFromSearch || "");
  
  const [localShowSummaryModal, setLocalShowSummaryModal] = useState(false);
  const showSummaryModal = onShowSummaryModalChange !== undefined ? (showSummaryModalProp !== undefined ? showSummaryModalProp : localShowSummaryModal) : localShowSummaryModal;
  const setShowSummaryModal = onShowSummaryModalChange !== undefined ? onShowSummaryModalChange : setLocalShowSummaryModal;

  const [localSelectedTab, setLocalSelectedTab] = useState<"general" | "tech" | "costs" | "milestones" | "supplemental" | "update" | "comments">("general");
  const selectedTab = onSelectedTabChange !== undefined ? (selectedTabProp !== undefined ? selectedTabProp : localSelectedTab) : localSelectedTab;
  const setSelectedTab = onSelectedTabChange !== undefined ? onSelectedTabChange : setLocalSelectedTab;

  // Timeline component states
  const [timelineSortOrder, setTimelineSortOrder] = useState<"newest" | "oldest">("newest");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "milestone" | "log">("all");

  // Local comments/notes section states
  const [notesList, setNotesList] = useState<{ id: string; text: string; createdAt: string; author: string }[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("Local User");
  const [noteCountTrigger, setNoteCountTrigger] = useState(0);

  // Google Auth states
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Live status update states
  const [updateFile, setUpdateFile] = useState<string>("land_acquisition");
  const [updateCategory, setUpdateCategory] = useState<string>("NOT");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [bulkLotIds, setBulkLotIds] = useState<string>("");
  const [singleLotInput, setSingleLotInput] = useState<string>("");

  const [statusFields, setStatusFields] = useState({
    notStatus: "",
    notDateIssued: "",
    rfdStatus: "",
    rfdDateIssued: "",
    rfdLoReplyStatus: "",
    rfdLoDateReply: "",
    otbStatus: "",
    otbDateIssued: "",
    otbLoReplyStatus: "",
    otbLoDateReply: "",
    otcStatus: "",
    otcDateIssued: "",
    otcLoReplyStatus: "",
    otcLoDateReply: "",
    doasStatus: "",
    doasDateSigned: "",
    doasDateNotarized: "",
    adriStatus: "",
    adriDateSigned: "",
    adriDateNotarized: "",
    pteStatus: "",
    pteDateSigned: "",
    enviStatus: "",
    enviDatePaid: "",
    paymentStatus: "",
    paymentDateOfPayment: "",
    rowStatus: "",
    rowDateSigned: "",
    handedOverStatus: "",
    handedOverDate: "",
    sourceOfCostInfo: "",
    totalLotLandCost: "",
    paymentStructureStatus: "",
    totalPaidStructureCost: "",
    paymentFenceStatus: "",
    fenceOtherCost: "",
    structureOverallTotalCost: "",
    overallTotalCostLotStructure: "",
    correctedLotId: "",
    dominantLotId: "",
    // Entitlements fields
    entitlementsPaymentDate: "",
    rentalSubsidyMultiplier: "",
    rentalSubsidyAmount: "",
    transpoRelocationMultiplier: "",
    transpoRelocationAmount: "",
    foodRelocationMultiplier: "",
    foodRelocationAmount: "",
    utilitiesConnectionMultiplier: "",
    utilitiesConnectionAmount: "",
    inconvenienceAllowanceMultiplier: "",
    inconvenienceAllowanceAmount: "",
    specialAssistanceMultiplier: "",
    specialAssistanceAmount: "",
    forIncomeLoss: "",
  });

  const [isFetchingActuals, setIsFetchingActuals] = useState<boolean>(false);
  const [isFetchingEntitlements, setIsFetchingEntitlements] = useState<boolean>(false);
  const [rawActualsIsLotOnly, setRawActualsIsLotOnly] = useState<boolean>(false);
  const [actualsPartitions, setActualsPartitions] = useState<ActualsPartition[]>([]);

  const checkIfLotOnly = useCallback((str: string): boolean => {
    if (!str) return false;
    const s = str.trim().toUpperCase();
    const normalized = s.replace(/[\s\-_]/g, "");
    return (
      normalized.includes("LOTONLY") ||
      normalized.includes("L.O.") ||
      s === "LO" ||
      s.startsWith("LO ") ||
      s.endsWith(" LO") ||
      s.includes(" LO ")
    );
  }, []);

  const actualsIsLotOnly = useMemo(() => {
    const correctedLotIdVal = (statusFields.correctedLotId || "").toString();
    if (checkIfLotOnly(correctedLotIdVal)) {
      return true;
    }
    return rawActualsIsLotOnly;
  }, [statusFields.correctedLotId, rawActualsIsLotOnly, checkIfLotOnly]);

  // Automatically reset structure/fence status fields to N/A and costs to 0 when in Lot Only mode
  useEffect(() => {
    if (actualsIsLotOnly) {
      setStatusFields(prev => {
        if (
          prev.paymentStructureStatus === "N/A" &&
          prev.totalPaidStructureCost === "0" &&
          prev.paymentFenceStatus === "N/A" &&
          prev.fenceOtherCost === "0"
        ) {
          return prev;
        }
        return {
          ...prev,
          paymentStructureStatus: "N/A",
          totalPaidStructureCost: "0",
          paymentFenceStatus: "N/A",
          fenceOtherCost: "0"
        };
      });
    }
  }, [actualsIsLotOnly]);

  // Filter conditions
  const [filterCp, setFilterCp] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterLgu, setFilterLgu] = useState<string>("ALL");
  const [filterBarangay, setFilterBarangay] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<string>("ALL");

  // Layout Accordion state
  const [activeAccordion, setActiveAccordion] = useState<"scope" | "geo" | "finance" | null>(null);

  // Group setting
  const [groupMode, setGroupMode] = useState<"NONE" | "CP" | "RAP_CP" | "LGU" | "RAP_LGU" | "BARANGAY" | "STATUS">("NONE");

  // Sidebar visible count (chunking to prevent rendering lag on hundreds of lots)
  const [visibleCount, setVisibleCount] = useState(25);

  // Copy success feedback maps
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // History tracker: keep top 5 recently accessed lots
  const [recentLots, setRecentLots] = useState<string[]>([]);
  // Toast notifications
  const [notification, setNotification] = useState<string | null>(null);

  // Subscribe to google authentication status to pull accessToken
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setIsAuthLoading(false);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
        setIsAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);




  const handleStatusUpdate = async () => {
    if (!googleToken) {
      setSubmitStatus({
        type: "error",
        message: "Please sign in to your Google Account first to update live status directly."
      });
      return;
    }

    if (!isBulkMode && !selectedLot && updateFile !== "actual_amounts" && updateFile !== "entitlements") {
      setSubmitStatus({
        type: "error",
        message: "No Lot selected."
      });
      return;
    }

    setIsUpdatingStatus(true);
    setSubmitStatus(null);

    try {
      const isActualAmounts = updateFile === "actual_amounts";
      const isEntitlements = updateFile === "entitlements";
      const spreadsheetId = isActualAmounts 
        ? "18yHsrS2PHuYhoUtp_Q0ZRSviKoagJGc48hA9uHb-qvI" 
        : "15MLklcCnFgaGTo_w_mM9Nb3qV3jWLfrK5i-hMAW5QMU";
      const sheetName = isActualAmounts 
        ? "CONSOLIDATED LIST" 
        : isEntitlements 
          ? "OTHER ENTITLEMENTS" 
          : "01.MASTERLIST";
      
      let targets: { lotId: string; rowNumber: number }[] = [];
      let isAppendMode = false;
      let appendLotId = "";
      let nextEmptyRowIndex = -1;

      if (isActualAmounts) {
        // Fetch Columns C to H to locate row indexes (C = LOT ID NO, E = STUCTURE TAG, F = CORRECTED LOT ID No., H = Dominant Lot ID No.)
        const fetchResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!C:H")}`, {
          headers: {
            "Authorization": `Bearer ${googleToken}`
          }
        });

        if (!fetchResponse.ok) {
          const errText = await fetchResponse.text();
          throw new Error(`Failed to read spreadsheet columns C:H: ${errText}`);
        }

        const resultData = await fetchResponse.json();
        const values = resultData.values;
        if (!values || !Array.isArray(values)) {
          throw new Error("No data returned from spreadsheet Columns C:H.");
        }

        // Determine targets for actual amounts
        let searchTerms: string[] = [];
        if (isBulkMode) {
          searchTerms = bulkLotIds
            .split(/[,\n]+/)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);
          if (searchTerms.length === 0) {
            throw new Error("Please enter at least one Structure Tag or Lot ID to update in bulk.");
          }
        } else {
          const singleTerm = (singleLotInput.trim() || (selectedLot ? selectedLot.lotId : "")).trim();
          if (!singleTerm) {
            throw new Error("Please search or enter a target Structure Tag or Lot ID.");
          }
          searchTerms = [singleTerm];
        }

        const missingTargets: string[] = [];
        for (const term of searchTerms) {
          let matchedRowIndices: number[] = [];
          
          // Pass 1: Search in Column E (STUCTURE TAG) - index 2 in C:H
          for (let i = 0; i < values.length; i++) {
            const structureTag = (values[i][2] || "").toString().trim().toUpperCase();
            if (structureTag && structureTag === term.toUpperCase()) {
              matchedRowIndices.push(i + 1);
            }
          }
          
          // Pass 2: Search in Column F (CORRECTED LOT ID No.) - index 3 in C:H
          if (matchedRowIndices.length === 0) {
            for (let i = 0; i < values.length; i++) {
              const correctedLotId = (values[i][3] || "").toString().trim().toUpperCase();
              if (correctedLotId && correctedLotId === term.toUpperCase()) {
                matchedRowIndices.push(i + 1);
              }
            }
          }

          // Pass 3: Search in Column C (LOT ID NO) - index 0 in C:H
          if (matchedRowIndices.length === 0) {
            for (let i = 0; i < values.length; i++) {
              const lotIdNo = (values[i][0] || "").toString().trim().toUpperCase();
              if (lotIdNo && lotIdNo === term.toUpperCase()) {
                matchedRowIndices.push(i + 1);
              }
            }
          }

          // Pass 4: Search in Column H (Dominant Lot ID No.) - index 5 in C:H
          if (matchedRowIndices.length === 0) {
            for (let i = 0; i < values.length; i++) {
              const dominantLotId = (values[i][5] || "").toString().trim().toUpperCase();
              if (dominantLotId && dominantLotId === term.toUpperCase()) {
                matchedRowIndices.push(i + 1);
              }
            }
          }
          
          if (matchedRowIndices.length > 0) {
            for (const rNum of matchedRowIndices) {
              targets.push({ lotId: term, rowNumber: rNum });
            }
          } else {
            missingTargets.push(term);
          }
        }

        if (targets.length === 0) {
          throw new Error(`None of the entered Structure Tags / Lot IDs were found in Columns C, E, F, or H of ${sheetName}: ${missingTargets.join(", ")}`);
        }
      } else if (isEntitlements) {
        // Fetch Columns C and D to locate row index (LOT ID NO / CONTROL NUMBER)
        const fetchResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!C:D")}`, {
          headers: {
            "Authorization": `Bearer ${googleToken}`
          }
        });

        if (!fetchResponse.ok) {
          const errText = await fetchResponse.text();
          throw new Error(`Failed to read spreadsheet columns C:D: ${errText}`);
        }

        const resultData = await fetchResponse.json();
        const values = resultData.values;
        if (!values || !Array.isArray(values)) {
          throw new Error("No data returned from spreadsheet Columns C:D.");
        }

        let searchTerms: string[] = [];
        if (isBulkMode) {
          searchTerms = bulkLotIds
            .split(/[,\n]+/)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);
          if (searchTerms.length === 0) {
            throw new Error("Please enter at least one Lot ID or Control Number to update in bulk.");
          }
        } else {
          const singleTerm = (singleLotInput.trim() || (selectedLot ? selectedLot.lotId : "")).trim();
          if (!singleTerm) {
            throw new Error("Please search or enter a target Lot ID or Control Number.");
          }
          searchTerms = [singleTerm];
        }

        const missingTargets: string[] = [];
        for (const term of searchTerms) {
          let matchedRowIndices: number[] = [];
          
          for (let i = 0; i < values.length; i++) {
            const lotIdNo = (values[i][0] || "").toString().trim().toUpperCase();
            const controlNo = (values[i][1] || "").toString().trim().toUpperCase();
            if (lotIdNo === term.toUpperCase() || controlNo === term.toUpperCase()) {
              matchedRowIndices.push(i + 1);
            }
          }
          
          if (matchedRowIndices.length > 0) {
            for (const rNum of matchedRowIndices) {
              targets.push({ lotId: term, rowNumber: rNum });
            }
          } else {
            missingTargets.push(term);
          }
        }

        if (targets.length === 0) {
          if (!isBulkMode) {
            isAppendMode = true;
            appendLotId = searchTerms[0] || "";
            nextEmptyRowIndex = values.length + 1;
          } else {
            throw new Error(`None of the entered Lot IDs / Control Numbers were found in Columns C or D of ${sheetName}: ${missingTargets.join(", ")}`);
          }
        }
      } else {
        // Fetch Column C to locate row index (LOT ID NO) for land_acquisition
        const fetchResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!C:C")}`, {
          headers: {
            "Authorization": `Bearer ${googleToken}`
          }
        });

        if (!fetchResponse.ok) {
          const errText = await fetchResponse.text();
          throw new Error(`Failed to read spreadsheet column C: ${errText}`);
        }

        const resultData = await fetchResponse.json();
        const values = resultData.values;
        if (!values || !Array.isArray(values)) {
          throw new Error("No data returned from spreadsheet Column C.");
        }

        if (isBulkMode) {
          const lotIdList = bulkLotIds
            .split(/[,\n]+/)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean);

          if (lotIdList.length === 0) {
            throw new Error("Please enter at least one Lot ID to update in bulk.");
          }

          const missingLots: string[] = [];
          for (const tid of lotIdList) {
            let rowIndex = -1;
            for (let i = 0; i < values.length; i++) {
              const cellVal = (values[i][0] || "").toString().trim().toUpperCase();
              if (cellVal === tid) {
                rowIndex = i;
                break;
              }
            }
            if (rowIndex !== -1) {
              targets.push({ lotId: tid, rowNumber: rowIndex + 1 });
            } else {
              missingLots.push(tid);
            }
          }

          if (targets.length === 0) {
            throw new Error(`None of the entered Lot IDs were found in Column C (LOT ID NO): ${missingLots.join(", ")}`);
          }
        } else {
          const targetLotId = selectedLot.lotId.trim().toLowerCase();
          let rowIndex = -1;
          for (let i = 0; i < values.length; i++) {
            const cellVal = (values[i][0] || "").toString().trim().toLowerCase();
            if (cellVal === targetLotId) {
              rowIndex = i;
              break;
            }
          }

          if (rowIndex === -1) {
            throw new Error(`Lot ID "${selectedLot.lotId}" was not found in Column C (LOT ID NO) of ${sheetName}.`);
          }
          targets.push({ lotId: selectedLot.lotId, rowNumber: rowIndex + 1 });
        }
      }

      // 2. Perform updates for each target row
      let totalCellsUpdated = 0;
      if (isAppendMode) {
        const newRow = Array(26).fill("");
        newRow[2] = appendLotId; // Col C (LOT ID NO)
        newRow[3] = appendLotId; // Col D (CONTROL NUMBER)
        newRow[9] = statusFields.entitlementsPaymentDate || ""; // Col J
        newRow[13] = statusFields.rentalSubsidyMultiplier || ""; // Col N
        newRow[14] = statusFields.rentalSubsidyAmount || ""; // Col O
        newRow[15] = statusFields.transpoRelocationMultiplier || ""; // Col P
        newRow[16] = statusFields.transpoRelocationAmount || ""; // Col Q
        newRow[17] = statusFields.foodRelocationMultiplier || ""; // Col R
        newRow[18] = statusFields.foodRelocationAmount || ""; // Col S
        newRow[19] = statusFields.utilitiesConnectionMultiplier || ""; // Col T
        newRow[20] = statusFields.utilitiesConnectionAmount || ""; // Col U
        newRow[21] = statusFields.inconvenienceAllowanceMultiplier || ""; // Col V
        newRow[22] = statusFields.inconvenienceAllowanceAmount || ""; // Col W
        newRow[23] = statusFields.specialAssistanceMultiplier || ""; // Col X
        newRow[24] = statusFields.specialAssistanceAmount || ""; // Col Y
        newRow[25] = statusFields.forIncomeLoss || ""; // Col Z

        // Write directly to the exact next empty row using PUT to avoid Google Sheets API append left-shifting quirks
        const targetRow = nextEmptyRowIndex > 0 ? nextEmptyRowIndex : 2; // Default fallback if not loaded
        const range = `${sheetName}!A${targetRow}:Z${targetRow}`;
        const appendResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${googleToken}`
          },
          body: JSON.stringify({
            values: [newRow]
          })
        });

        if (!appendResponse.ok) {
          const errorText = await appendResponse.text();
          throw new Error(`Failed to write new row to ${sheetName} at row ${targetRow}: ${errorText}`);
        }
        totalCellsUpdated = 14;
      } else {
        for (const target of targets) {
          const updates: { col: string; val: string }[] = [];

          if (isActualAmounts) {
            updates.push({ col: "F", val: statusFields.correctedLotId });
            updates.push({ col: "H", val: statusFields.dominantLotId });
            updates.push({ col: "AX", val: statusFields.sourceOfCostInfo });
            updates.push({ col: "AZ", val: statusFields.totalLotLandCost });
            
            const partition = actualsPartitions.find(p => p.rowNumber === target.rowNumber);
            if (partition) {
              updates.push({ col: "BA", val: partition.paymentStructureStatus });
              updates.push({ col: "BB", val: partition.totalPaidStructureCost });
              updates.push({ col: "BC", val: partition.paymentFenceStatus });
              updates.push({ col: "BD", val: partition.fenceOtherCost });
            } else {
              const isRowLotOnly = actualsIsLotOnly || (actualsPartitions.length > 0 && !partition);
              updates.push({ col: "BA", val: isRowLotOnly ? "N/A" : statusFields.paymentStructureStatus });
              updates.push({ col: "BB", val: isRowLotOnly ? "0" : statusFields.totalPaidStructureCost });
              updates.push({ col: "BC", val: isRowLotOnly ? "N/A" : statusFields.paymentFenceStatus });
              updates.push({ col: "BD", val: isRowLotOnly ? "0" : statusFields.fenceOtherCost });
            }
          } else if (isEntitlements) {
            updates.push({ col: "J", val: statusFields.entitlementsPaymentDate });
            updates.push({ col: "N", val: statusFields.rentalSubsidyMultiplier });
            updates.push({ col: "O", val: statusFields.rentalSubsidyAmount });
            updates.push({ col: "P", val: statusFields.transpoRelocationMultiplier });
            updates.push({ col: "Q", val: statusFields.transpoRelocationAmount });
            updates.push({ col: "R", val: statusFields.foodRelocationMultiplier });
            updates.push({ col: "S", val: statusFields.foodRelocationAmount });
            updates.push({ col: "T", val: statusFields.utilitiesConnectionMultiplier });
            updates.push({ col: "U", val: statusFields.utilitiesConnectionAmount });
            updates.push({ col: "V", val: statusFields.inconvenienceAllowanceMultiplier });
            updates.push({ col: "W", val: statusFields.inconvenienceAllowanceAmount });
            updates.push({ col: "X", val: statusFields.specialAssistanceMultiplier });
            updates.push({ col: "Y", val: statusFields.specialAssistanceAmount });
            updates.push({ col: "Z", val: statusFields.forIncomeLoss });
          } else {
            // Support G1-G7 groupings and previous strings for fallback compatibility
            if (updateCategory === "G1" || updateCategory === "NOT") {
              updates.push({ col: "BG", val: statusFields.notStatus });
              updates.push({ col: "BK", val: statusFields.notDateIssued });
            } else if (updateCategory === "G2" || updateCategory === "RFD_OTB_OTC" || updateCategory === "RFD" || updateCategory === "OTB" || updateCategory === "OTC") {
              updates.push({ col: "CJ", val: statusFields.rfdStatus });
              updates.push({ col: "CL", val: statusFields.rfdDateIssued });
              updates.push({ col: "CN", val: statusFields.rfdLoReplyStatus });
              updates.push({ col: "CO", val: statusFields.rfdLoDateReply });
              updates.push({ col: "CQ", val: statusFields.otbStatus });
              updates.push({ col: "CS", val: statusFields.otbDateIssued });
              updates.push({ col: "CW", val: statusFields.otbLoReplyStatus });
              updates.push({ col: "CY", val: statusFields.otbLoDateReply });
              updates.push({ col: "DA", val: statusFields.otcStatus });
              updates.push({ col: "DC", val: statusFields.otcDateIssued });
              updates.push({ col: "DG", val: statusFields.otcLoReplyStatus });
              updates.push({ col: "DI", val: statusFields.otcLoDateReply });
            } else if (updateCategory === "G3" || updateCategory === "DOAS_ADRI" || updateCategory === "DOAS" || updateCategory === "ADRI") {
              updates.push({ col: "DO", val: statusFields.doasStatus });
              updates.push({ col: "DQ", val: statusFields.doasDateSigned });
              updates.push({ col: "DS", val: statusFields.doasDateNotarized });
              updates.push({ col: "DU", val: statusFields.adriStatus });
              updates.push({ col: "DW", val: statusFields.adriDateSigned });
              updates.push({ col: "DZ", val: statusFields.adriDateNotarized });
            } else if (updateCategory === "G4" || updateCategory === "PTE_ENVI" || updateCategory === "PTE" || updateCategory === "ENVI") {
              updates.push({ col: "DK", val: statusFields.pteStatus });
              updates.push({ col: "DM", val: statusFields.pteDateSigned });
              updates.push({ col: "EB", val: statusFields.enviStatus });
              updates.push({ col: "EC", val: statusFields.enviDatePaid });
            } else if (updateCategory === "G5" || updateCategory === "PAYMENT") {
              updates.push({ col: "EH", val: statusFields.paymentStatus });
              updates.push({ col: "EI", val: statusFields.paymentDateOfPayment });
            } else if (updateCategory === "G6" || updateCategory === "ROW" || updateCategory === "RIGHT OF WAY STATUS") {
              updates.push({ col: "ER", val: statusFields.rowStatus });
              updates.push({ col: "ES", val: statusFields.rowDateSigned });
            } else if (updateCategory === "G7" || updateCategory === "HOL" || updateCategory === "HANDED OVER LOTS") {
              updates.push({ col: "EK", val: statusFields.handedOverStatus });
              updates.push({ col: "EL", val: statusFields.handedOverDate });
            }
          }

          // Execute batch/multiple updates
          if (isEntitlements && !isBulkMode) {
            // High-performance batched update for Entitlements: write J (1 call) and N:Z (1 call) to minimize API latency & prevent 429 rate limits
            // 1. Column J (Payment Date)
            const rangeJ = `${sheetName}!J${target.rowNumber}:J${target.rowNumber}`;
            const resJ = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(rangeJ)}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${googleToken}`
              },
              body: JSON.stringify({
                values: [[statusFields.entitlementsPaymentDate || ""]]
              })
            });
            if (!resJ.ok) {
              const err = await resJ.text();
              throw new Error(`Failed to update Payment Date at J${target.rowNumber}: ${err}`);
            }

            // 2. Columns N to Z (Multipliers & Amounts)
            const rangeNZ = `${sheetName}!N${target.rowNumber}:Z${target.rowNumber}`;
            const valuesNZ = [
              statusFields.rentalSubsidyMultiplier || "",
              statusFields.rentalSubsidyAmount || "",
              statusFields.transpoRelocationMultiplier || "",
              statusFields.transpoRelocationAmount || "",
              statusFields.foodRelocationMultiplier || "",
              statusFields.foodRelocationAmount || "",
              statusFields.utilitiesConnectionMultiplier || "",
              statusFields.utilitiesConnectionAmount || "",
              statusFields.inconvenienceAllowanceMultiplier || "",
              statusFields.inconvenienceAllowanceAmount || "",
              statusFields.specialAssistanceMultiplier || "",
              statusFields.specialAssistanceAmount || "",
              statusFields.forIncomeLoss || ""
            ];
            const resNZ = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(rangeNZ)}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${googleToken}`
              },
              body: JSON.stringify({
                values: [valuesNZ]
              })
            });
            if (!resNZ.ok) {
              const err = await resNZ.text();
              throw new Error(`Failed to update Entitlements values at N${target.rowNumber}:Z${target.rowNumber}: ${err}`);
            }
            totalCellsUpdated += 14;
          } else {
            // Cell-by-cell update fallback for actual amounts, land acquisition, or bulk mode
            for (const update of updates) {
              // In bulk mode, if a field is left empty on the form, do NOT overwrite the existing cell value with empty.
              if (isBulkMode && (update.val === undefined || update.val === null || update.val === "")) {
                continue;
              }

              const range = `${sheetName}!${update.col}${target.rowNumber}:${update.col}${target.rowNumber}`;
              const updateResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${googleToken}`
                },
                body: JSON.stringify({
                  values: [[update.val]]
                })
              });

              if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                throw new Error(`Failed to update Row ${target.rowNumber} (Cell ${update.col}${target.rowNumber}): ${errorText}`);
              }
              totalCellsUpdated++;
            }
          }
        }
      }

      // 3. Clear cache on server and reload data to immediately reflect changes in UI
      try {
        await fetch("/api/proxy/clear-cache", { method: "POST" });
        if (onRefreshData) {
          if (!isBulkMode && selectedLot && !isActualAmounts && !isAppendMode) {
            const updatedFields: Partial<LotData> = {};
            if (updateCategory === "G1" || updateCategory === "NOT") {
              updatedFields.statusNot = statusFields.notStatus;
              updatedFields.dateNot = statusFields.notDateIssued;
            } else if (updateCategory === "G2" || updateCategory === "RFD_OTB_OTC" || updateCategory === "RFD" || updateCategory === "OTB" || updateCategory === "OTC") {
              updatedFields.statusRfd = statusFields.rfdStatus;
              updatedFields.dateRfd = statusFields.rfdDateIssued;
              updatedFields.rfdReply = statusFields.rfdLoReplyStatus;
              updatedFields.rfdReplyDate = statusFields.rfdLoDateReply;
              updatedFields.statusOtb = statusFields.otbStatus;
              updatedFields.dateOtb = statusFields.otbDateIssued;
              updatedFields.otbReply = statusFields.otbLoReplyStatus;
              updatedFields.otbReplyDate = statusFields.otbLoDateReply;
              updatedFields.statusOtc = statusFields.otcStatus;
              updatedFields.dateOtc = statusFields.otcDateIssued;
              updatedFields.otcReply = statusFields.otcLoReplyStatus;
              updatedFields.otcReplyDate = statusFields.otcLoDateReply;
            } else if (updateCategory === "G3" || updateCategory === "DOAS_ADRI" || updateCategory === "DOAS" || updateCategory === "ADRI") {
              updatedFields.statusDoas = statusFields.doasStatus;
              updatedFields.dateDoas = statusFields.doasDateSigned;
            } else if (updateCategory === "G4" || updateCategory === "PTE_ENVI" || updateCategory === "PTE" || updateCategory === "ENVI") {
              updatedFields.statusPte = statusFields.pteStatus;
              updatedFields.datePte = statusFields.pteDateSigned;
            } else if (updateCategory === "G5" || updateCategory === "PAYMENT") {
              updatedFields.paymentStatus = statusFields.paymentStatus;
              updatedFields.datePaid = statusFields.paymentDateOfPayment;
            } else if (updateCategory === "G6" || updateCategory === "ROW" || updateCategory === "RIGHT OF WAY STATUS") {
              updatedFields.withCnoMoa = statusFields.rowStatus;
              updatedFields.dateCno = statusFields.rowDateSigned;
            } else if (updateCategory === "G7" || updateCategory === "HOL" || updateCategory === "HANDED OVER LOTS") {
              updatedFields.handedOver = statusFields.handedOverStatus;
              updatedFields.dateHo = statusFields.handedOverDate;
            }
            onRefreshData(selectedLot.lotId, updatedFields);
          } else {
            onRefreshData();
          }
        }
      } catch (cacheErr) {
        console.error("Failed to clear cache:", cacheErr);
      }

      // Success reporting
      const fileDisplayName = isEntitlements 
        ? "Other Entitlements" 
        : isActualAmounts 
          ? "Actual Amounts (CONSOLIDATED LIST)" 
          : "Land Acquisition File";

      if (isBulkMode) {
        setSubmitStatus({
          type: "success",
          message: `Successfully processed bulk status update for ${targets.length} target(s). Updated total of ${totalCellsUpdated} cells in ${fileDisplayName} spreadsheet!`
        });
        setNotification(`Successfully updated ${targets.length} targets in Google Sheets!`);
      } else {
        const targetLabel = isAppendMode 
          ? `New Target: "${appendLotId}"` 
          : isActualAmounts 
            ? `Target: "${singleLotInput || (selectedLot ? selectedLot.lotId : "")}"` 
            : `Lot ID "${selectedLot.lotId}"`;

        setSubmitStatus({
          type: "success",
          message: isAppendMode
            ? `Successfully appended new row to ${fileDisplayName} spreadsheet for "${appendLotId}"! Changes are live and permanent.`
            : `Successfully updated ${totalCellsUpdated} field(s) in ${fileDisplayName} spreadsheet for ${targetLabel}${targets[0] ? ` (Row ${targets[0].rowNumber})` : ''}! Changes are live and permanent.`
        });
        setNotification(isAppendMode ? `Successfully added "${appendLotId}" to Google Sheets!` : `Successfully updated ${targetLabel} in Google Sheets!`);
      }

      setTimeout(() => setNotification(null), 6000);
    } catch (err: any) {
      console.error("Status update error:", err);
      setSubmitStatus({
        type: "error",
        message: err.message || "An error occurred while updating the status."
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Dynamic Theme Styling Accents Integration (replaces old static colors)
  const themeAccent = useMemo(() => {
    const id = activeTheme.id;
    return {
      text: id === "blue" ? "text-blue-600 dark:text-blue-400" 
          : id === "emerald" ? "text-emerald-600 dark:text-emerald-400" 
          : id === "rose" ? "text-rose-600 dark:text-rose-400" 
          : id === "violet" ? "text-violet-600 dark:text-violet-400" 
          : "text-slate-700 dark:text-slate-300",
      textDarker: id === "blue" ? "text-indigo-650 text-indigo-600" 
          : id === "emerald" ? "text-emerald-700" 
          : id === "rose" ? "text-rose-700" 
          : id === "violet" ? "text-violet-700" 
          : "text-slate-800 dark:text-slate-100",
      text500: id === "blue" ? "text-blue-500" 
          : id === "emerald" ? "text-emerald-500" 
          : id === "rose" ? "text-rose-500" 
          : id === "violet" ? "text-violet-500" 
          : "text-slate-500 dark:text-slate-400",
      bg10: id === "blue" ? "bg-blue-500/10 text-blue-500 border-blue-500/10 dark:text-blue-400 dark:bg-blue-950/30" 
          : id === "emerald" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-950/30" 
          : id === "rose" ? "bg-rose-500/10 text-rose-500 border-rose-500/10 dark:text-rose-400 dark:bg-rose-950/30" 
          : id === "violet" ? "bg-violet-500/10 text-violet-500 border-violet-500/10 dark:text-violet-400 dark:bg-violet-950/30" 
          : "bg-slate-500/10 text-slate-400 border-slate-500/10 dark:bg-slate-900/30",
      bgPulse: id === "blue" ? "bg-blue-500 shadow-blue-500/15" 
          : id === "emerald" ? "bg-emerald-500 shadow-emerald-500/15" 
          : id === "rose" ? "bg-rose-500 shadow-rose-500/15" 
          : id === "violet" ? "bg-violet-500 shadow-violet-500/15" 
          : "bg-slate-600 shadow-slate-600/15",
      ring: id === "blue" ? "ring-blue-500/10" 
          : id === "emerald" ? "ring-emerald-555/10" 
          : id === "rose" ? "ring-rose-500/10" 
          : id === "violet" ? "ring-violet-500/10" 
          : "ring-slate-500/10",
      btnPrimary: id === "blue" ? "bg-blue-600 hover:bg-blue-550 shadow-blue-500/10"
          : id === "emerald" ? "bg-emerald-600 hover:bg-emerald-550 shadow-emerald-500/10"
          : id === "rose" ? "bg-rose-600 hover:bg-rose-550 shadow-rose-500/10"
          : id === "violet" ? "bg-violet-600 hover:bg-violet-550 shadow-violet-500/10"
          : "bg-slate-800 hover:bg-slate-700 shadow-slate-500/10",
      glowBg: id === "blue" ? "bg-blue-500/5"
          : id === "emerald" ? "bg-emerald-500/5"
          : id === "rose" ? "bg-rose-500/5"
          : id === "violet" ? "bg-violet-500/5"
          : "bg-slate-500/5",
      toastBg: id === "blue" ? "border-blue-900/30 text-blue-300"
          : id === "emerald" ? "border-emerald-900/30 text-emerald-300"
          : id === "rose" ? "border-rose-900/30 text-rose-300"
          : id === "violet" ? "border-violet-900/30 text-violet-300"
          : "border-slate-800 text-slate-300",
      toastBgBase: id === "blue" ? "bg-blue-950/25"
          : id === "emerald" ? "bg-emerald-950/25"
          : id === "rose" ? "bg-rose-950/25"
          : id === "violet" ? "bg-violet-950/25"
          : "bg-slate-900/20",
      ongoingBg: id === "blue" ? "bg-blue-505/5 border-blue-500/10"
          : id === "emerald" ? "bg-emerald-505/5 border-emerald-500/10"
          : id === "rose" ? "bg-rose-505/5 border-rose-500/10"
          : id === "violet" ? "bg-violet-505/5 border-violet-500/10"
          : "bg-slate-500/5 border-slate-500/10",
      ongoingBadge: id === "blue" ? "bg-blue-500/10 text-blue-500 border-blue-500/10"
          : id === "emerald" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/10"
          : id === "rose" ? "bg-rose-500/10 text-rose-500 border-rose-500/10"
          : id === "violet" ? "bg-violet-500/10 text-violet-500 border-violet-500/10"
          : "bg-slate-500/10 text-slate-400 border-slate-500/10",
      infoClass: id === "blue" ? activeTheme.isDark ? "bg-blue-950/20 border-blue-900/30 text-blue-300" : "bg-blue-50 border-blue-100 text-blue-800"
          : id === "emerald" ? activeTheme.isDark ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-300" : "bg-emerald-50 border-emerald-100 text-emerald-800"
          : id === "rose" ? activeTheme.isDark ? "bg-rose-950/20 border-rose-900/30 text-rose-300" : "bg-rose-50 border-rose-100 text-rose-800"
          : id === "violet" ? activeTheme.isDark ? "bg-violet-950/20 border-violet-900/30 text-violet-200" : "bg-violet-50 border-violet-100 text-violet-800"
          : activeTheme.isDark ? "bg-slate-950/20 border-slate-900/30 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-800"
    };
  }, [activeTheme]);

  const strokeColor = useMemo(() => {
    const id = activeTheme.id;
    if (id === "blue") return "#3b82f6";
    if (id === "emerald") return "#10b981";
    if (id === "rose") return "#f43f5e";
    if (id === "violet") return "#8b5cf6";
    return "#64748b"; // charcoal
  }, [activeTheme]);

  // Quick helper to show alerts
  const showNoticeToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 2500);
  };

  // Sync debouncer for search input (avoids heavy layout shifts during fast typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setVisibleCount(25); // reset slice count to keep it snappy
    }, 120);
    return () => clearTimeout(timer);
  }, [search]);

  // Load recently viewed lots on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("recent_lots_cache");
      if (stored) {
        setRecentLots(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Failed loading recent lots from cache", e);
    }
  }, []);

  const trackLotAccess = (lotId: string) => {
    if (!lotId) return;
    setRecentLots(prev => {
      const filtered = prev.filter(id => id !== lotId);
      const nextRecent = [lotId, ...filtered].slice(0, 5);
      try {
        localStorage.setItem("recent_lots_cache", JSON.stringify(nextRecent));
      } catch (err) {
        console.warn("localStorage write error:", err);
      }
      return nextRecent;
    });
  };

  // OPTIMIZATION 1: Single-pass database preprocessing
  // Pre-computes search string, progress bar & gathers dropdown options in ONE single array traversal! This bypasses expensive calculations during renders.
  const { preprocessedAll, cpOptions, currentStatusOptions, lguOptions, modeOptions, barangayOptionsMap } = useMemo<{
    preprocessedAll: PreprocessedLot[];
    cpOptions: string[];
    currentStatusOptions: string[];
    lguOptions: string[];
    modeOptions: string[];
    barangayOptionsMap: Record<string, Set<string>>;
  }>(() => {
    const cps = new Set<string>();
    const currentStatuses = new Set<string>();
    const lgus = new Set<string>();
    const modes = new Set<string>();
    const lguToBrgys: Record<string, Set<string>> = {};

    const list = data.map((d): PreprocessedLot => {
      // Collect select values
      if (d.cp) cps.add(d.cp);
      if (d.currentStatus) currentStatuses.add(d.currentStatus);
      if (d.lgu) {
        lgus.add(d.lgu);
        if (!lguToBrgys[d.lgu]) lguToBrgys[d.lgu] = new Set();
        if (d.barangay) lguToBrgys[d.lgu].add(d.barangay);
      }
      if (d.modeAcquisition) modes.add(d.modeAcquisition);

      // Evaluate progress percent as requested by user
      const deliveredNoT = (d.statusNot || "").toUpperCase().includes("DELIVERED") || (d.dateNot && d.dateNot !== "-" && d.dateNot !== "" && d.dateNot !== "No Data");
      const servedOTB = (d.statusOtb || "").toUpperCase().includes("DELIVERED") || (d.statusOtb || "").toUpperCase().includes("SERVED") || (d.statusOtb || "").toUpperCase().includes("ISSUED") || (d.dateOtb && d.dateOtb !== "-" && d.dateOtb !== "" && d.dateOtb !== "No Data");
      const hasOtbReply = (d.otbReply && d.otbReply !== "-" && d.otbReply !== "" && d.otbReply !== "No Data") || (d.otbReplyDate && d.otbReplyDate !== "-" && d.otbReplyDate !== "" && d.otbReplyDate !== "No Data");
      const hasReplyDate = d.otbReplyDate && d.otbReplyDate !== "-" && d.otbReplyDate !== "" && d.otbReplyDate !== "No Data";
      const signedDOAS = (d.statusDoas || "").toUpperCase().includes("SIGNED") || (d.dateDoas && d.dateDoas !== "-" && d.dateDoas !== "" && d.dateDoas !== "No Data");
      const paid = (d.paymentStatus || "").toUpperCase().includes("PAID") || (d.paymentStatus || "").toUpperCase().includes("FULLY PAID") || (d.datePaid && d.datePaid !== "-" && d.datePaid !== "" && d.datePaid !== "No Data");
      const handedOver = !!d.handedOver && d.handedOver !== "-" && d.handedOver !== "No Data" && d.handedOver !== "" && d.handedOver.toUpperCase() !== "PENDING";

      const completedCount = [
        deliveredNoT,
        servedOTB,
        hasOtbReply,
        hasReplyDate,
        signedDOAS,
        paid,
        handedOver
      ].filter(Boolean).length;

      const progressVal = Math.round((completedCount / 7) * 100);

      // Concatenate search tokens
      const searchTok = `${d.lotId || ""} ${d.ownerName || ""} ${d.controlNo || ""} ${d.barangay || ""} ${d.lgu || ""} ${d.station || ""} ${d.cp || ""}`.toLowerCase();

      return {
        ...d,
        _searchStr: searchTok,
        _progress: progressVal
      };
    });

    return {
      preprocessedAll: list,
      cpOptions: ["ALL", ...Array.from(cps)].sort(),
      currentStatusOptions: ["ALL", ...ALL_STATUS_OPTIONS],
      lguOptions: ["ALL", ...Array.from(lgus)].sort(),
      modeOptions: ["ALL", ...Array.from(modes)].sort(),
      barangayOptionsMap: lguToBrgys
    };
  }, [data]);

  const [isQuickSearchFocused, setIsQuickSearchFocused] = useState(false);

  const quickSearchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return preprocessedAll.filter(d => {
      return (
        d.lotId.toLowerCase().includes(query) ||
        (d.ownerName && d.ownerName.toLowerCase().includes(query)) ||
        (d.controlNo && d.controlNo.toLowerCase().includes(query))
      );
    }).slice(0, 10);
  }, [search, preprocessedAll]);

  // Dynamic Barangay list based on LGU cascade config
  const barangayOptions = useMemo(() => {
    if (filterLgu === "ALL") {
      const allBrgys = new Set<string>();
      Object.values(barangayOptionsMap as Record<string, Set<string>>).forEach((brgys) => {
        (brgys as Set<string>).forEach(b => allBrgys.add(b));
      });
      return ["ALL", ...Array.from(allBrgys)].sort();
    }
    const filteredBrgys = barangayOptionsMap[filterLgu] || new Set();
    return ["ALL", ...Array.from(filteredBrgys)].sort();
  }, [filterLgu, barangayOptionsMap]);

  // Clear all filters easily
  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setFilterCp("ALL");
    setFilterStatus("ALL");
    setFilterLgu("ALL");
    setFilterBarangay("ALL");
    setFilterMode("ALL");
    setGroupMode("NONE");
    setVisibleCount(25);
    showNoticeToast("System filters restored to default empty states.");
  };

  const hasActiveFilters = useMemo(() => {
    return (
      search !== "" ||
      filterCp !== "ALL" ||
      filterStatus !== "ALL" ||
      filterLgu !== "ALL" ||
      filterBarangay !== "ALL" ||
      filterMode !== "ALL"
    );
  }, [search, filterCp, filterStatus, filterLgu, filterBarangay, filterMode]);

  // OPTIMIZATION 2: instant filtering using the single searchable token
  const displayedLots = useMemo(() => {
    if (!preprocessedAll.length) return [];
    
    const term = debouncedSearch.toLowerCase().trim();
    
    return preprocessedAll.filter(d => {
      const matchesSearch = !term || d._searchStr.includes(term);
      const matchesCp = filterCp === "ALL" || d.cp === filterCp;
      const matchesStatus = filterStatus === "ALL" || satisfiesStatusFilter(d, filterStatus);
      const matchesLgu = filterLgu === "ALL" || d.lgu === filterLgu;
      const matchesBarangay = filterBarangay === "ALL" || d.barangay === filterBarangay;
      const matchesMode = filterMode === "ALL" || d.modeAcquisition === filterMode;

      return matchesSearch && matchesCp && matchesStatus && matchesLgu && matchesBarangay && matchesMode;
    });
  }, [preprocessedAll, debouncedSearch, filterCp, filterStatus, filterLgu, filterBarangay, filterMode]);

  // Grouped render categorization
  const groupedLots = useMemo<Record<string, PreprocessedLot[]> | null>(() => {
    if (groupMode === "NONE") return null;

    const groups: Record<string, PreprocessedLot[]> = {};
    displayedLots.forEach(lot => {
      let key = "UNASSIGNED";
      if (groupMode === "CP") key = lot.cp || "Unspecified CP";
      else if (groupMode === "RAP_CP") key = lot.rapCp || lot.cp || "Unspecified RAP CP";
      else if (groupMode === "LGU") key = lot.lgu || "Unspecified LGU";
      else if (groupMode === "RAP_LGU") key = lot.rapLgu || lot.lgu || "Unspecified RAP LGU";
      else if (groupMode === "BARANGAY") key = lot.siteAccessDate || "Unspecified Site Access Date";
      else if (groupMode === "STATUS") key = lot.currentStatus || "Unspecified Status";

      const upperKey = key.trim().toUpperCase();
      if (!groups[upperKey]) {
        groups[upperKey] = [];
      }
      groups[upperKey].push(lot);
    });

    return groups;
  }, [displayedLots, groupMode]);

  // Retrieve active selected lot
  const selectedLot = useMemo(() => {
    if (!preprocessedAll.length) return null;
    if (!selectedLotId) {
      return displayedLots[0] || preprocessedAll[0] || null;
    }
    const cleanId = selectedLotId.toString().trim().toUpperCase();
    const found = preprocessedAll.find(item => 
      item.id === selectedLotId || 
      (item.lotId && item.lotId.toString().trim().toUpperCase() === cleanId)
    );
    return found || displayedLots[0] || preprocessedAll[0] || null;
  }, [preprocessedAll, selectedLotId, displayedLots]);

  // Sync selectedLotId with incoming search trigger
  useEffect(() => {
    if (selectedLotIdFromSearch) {
      const cleanTarget = selectedLotIdFromSearch.toString().trim().toUpperCase();
      const matched = preprocessedAll.find(item => 
        (item.lotId && item.lotId.toString().trim().toUpperCase() === cleanTarget) ||
        item.id === selectedLotIdFromSearch
      );
      if (matched) {
        setSelectedLotId(matched.id);
        trackLotAccess(matched.lotId);
        // Clear filters to ensure the selected lot is visible in the sidebar list
        setFilterCp("ALL");
        setFilterStatus("ALL");
        setFilterLgu("ALL");
        setFilterBarangay("ALL");
        setFilterMode("ALL");
        setDebouncedSearch("");
        setSearch("");
      } else {
        setSelectedLotId(selectedLotIdFromSearch);
      }
    }
  }, [selectedLotIdFromSearch, preprocessedAll]);

  // Load and synchronize comments/notes from localStorage
  useEffect(() => {
    if (googleUser?.displayName) {
      setNoteAuthor(googleUser.displayName);
    }
  }, [googleUser]);

  useEffect(() => {
    if (!selectedLot?.lotId) {
      setNotesList([]);
      return;
    }
    try {
      const stored = localStorage.getItem(`gcr_notes_${selectedLot.lotId}`);
      if (stored) {
        setNotesList(JSON.parse(stored));
      } else {
        setNotesList([]);
      }
    } catch (e) {
      console.error("Failed to load notes", e);
      setNotesList([]);
    }
  }, [selectedLot?.lotId, noteCountTrigger]);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedLot?.lotId) return;

    const newNote = {
      id: Date.now().toString(),
      text: newNoteText.trim(),
      createdAt: new Date().toLocaleString(),
      author: noteAuthor.trim() || "Anonymous"
    };

    const updatedNotes = [newNote, ...notesList];
    setNotesList(updatedNotes);
    setNewNoteText("");

    try {
      localStorage.setItem(`gcr_notes_${selectedLot.lotId}`, JSON.stringify(updatedNotes));
      setNoteCountTrigger(prev => prev + 1);
      window.dispatchEvent(new CustomEvent("gcr_notes_changed", { detail: { lotId: selectedLot.lotId, notes: updatedNotes } }));
    } catch (err) {
      console.error("Failed to save notes", err);
    }
  };

  const handleDeleteNote = (id: string) => {
    if (!selectedLot?.lotId) return;
    const updatedNotes = notesList.filter(n => n.id !== id);
    setNotesList(updatedNotes);
    try {
      localStorage.setItem(`gcr_notes_${selectedLot.lotId}`, JSON.stringify(updatedNotes));
      setNoteCountTrigger(prev => prev + 1);
      window.dispatchEvent(new CustomEvent("gcr_notes_changed", { detail: { lotId: selectedLot.lotId, notes: updatedNotes } }));
    } catch (err) {
      console.error("Failed to save notes after deletion", err);
    }
  };

  // Synchronize singleLotInput when selectedLot changes
  useEffect(() => {
    if (selectedLot && !isBulkMode) {
      setSingleLotInput(selectedLot.lotId || "");
    } else if (!selectedLot && !isBulkMode) {
      setSingleLotInput("");
    }
  }, [selectedLot?.lotId, isBulkMode]);

  const prevLotIdForFieldsRef = useRef<string | null>(null);
  const prevUpdateFileRef = useRef<string | null>(null);

  // Prefill statusFields when a Lot is searched/selected or updateFile changes
  useEffect(() => {
    const currentLotId = selectedLot?.lotId || null;
    if (selectedLot && updateFile !== "actual_amounts") {
      if (currentLotId !== prevLotIdForFieldsRef.current || updateFile !== prevUpdateFileRef.current) {
        prevLotIdForFieldsRef.current = currentLotId;
        prevUpdateFileRef.current = updateFile;
        setStatusFields({
          notStatus: selectedLot.statusNot || "",
          notDateIssued: selectedLot.dateNot || "",
          rfdStatus: selectedLot.statusRfd || "",
          rfdDateIssued: selectedLot.dateRfd || "",
          rfdLoReplyStatus: selectedLot.rfdReply || "",
          rfdLoDateReply: selectedLot.rfdReplyDate || "",
          otbStatus: selectedLot.statusOtb || "",
          otbDateIssued: selectedLot.dateOtb || "",
          otbLoReplyStatus: selectedLot.otbReply || "",
          otbLoDateReply: selectedLot.otbReplyDate || "",
          otcStatus: selectedLot.statusOtc || "",
          otcDateIssued: selectedLot.dateOtc || "",
          otcLoReplyStatus: selectedLot.otcReply || "",
          otcLoDateReply: selectedLot.otcReplyDate || "",
          doasStatus: selectedLot.statusDoas || "",
          doasDateSigned: selectedLot.dateDoas || "",
          doasDateNotarized: "",
          adriStatus: "",
          adriDateSigned: "",
          adriDateNotarized: "",
          pteStatus: selectedLot.statusPte || "",
          pteDateSigned: selectedLot.datePte || "",
          enviStatus: "",
          enviDatePaid: "",
          paymentStatus: selectedLot.paymentStatus || "",
          paymentDateOfPayment: selectedLot.datePaid || "",
          rowStatus: selectedLot.withCnoMoa || "",
          rowDateSigned: selectedLot.dateCno || "",
          handedOverStatus: selectedLot.handedOver || "",
          handedOverDate: selectedLot.dateHo || "",
          sourceOfCostInfo: "",
          totalLotLandCost: "",
          paymentStructureStatus: "",
          totalPaidStructureCost: "",
          paymentFenceStatus: "",
          fenceOtherCost: "",
          structureOverallTotalCost: "",
          overallTotalCostLotStructure: "",
          correctedLotId: "",
          dominantLotId: "",
        });
      }
    } else {
      prevLotIdForFieldsRef.current = currentLotId;
      prevUpdateFileRef.current = updateFile;
    }
  }, [selectedLot?.lotId, updateFile]);

  // Real-time direct fetch of Actual Amounts from "CONSOLIDATED LIST" sheet
  useEffect(() => {
    let active = true;
    if (updateFile === "actual_amounts" && !isBulkMode) {
      const term = (singleLotInput || (selectedLot ? selectedLot.lotId : "")).trim();
      if (!term) {
        setStatusFields(prev => ({
          ...prev,
          sourceOfCostInfo: "",
          totalLotLandCost: "",
          paymentStructureStatus: "",
          totalPaidStructureCost: "",
          paymentFenceStatus: "",
          fenceOtherCost: "",
          structureOverallTotalCost: "",
          overallTotalCostLotStructure: "",
          correctedLotId: "",
          dominantLotId: "",
        }));
        setRawActualsIsLotOnly(false);
        setActualsPartitions([]);
        return;
      }

      const loadActuals = async () => {
        setIsFetchingActuals(true);
        try {
          const spreadsheetId = "18yHsrS2PHuYhoUtp_Q0ZRSviKoagJGc48hA9uHb-qvI";
          const sheetName = "CONSOLIDATED LIST";
          
          // Fetch Column C to BF for one-shot search indexing and detail retrieving
          const lookupRange = `${sheetName}!C:BF`;
          const lookupRes = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(lookupRange)}`, {
            headers: {
              "Authorization": `Bearer ${googleToken}`
            }
          });
          if (!lookupRes.ok) throw new Error("Failed to search spreadsheet");
          
          const lookupData = await lookupRes.json();
          const values = lookupData.values || [];
          
          const searchVal = term.toUpperCase();
          
          const getVal = (row: any[], colIndex: number): string => {
            return (row && row[colIndex] !== undefined) ? row[colIndex].toString().trim() : "";
          };
          
          // Helper to check if structure tag is valid
          const isValidStructureTag = (val: string): boolean => {
            if (!val) return false;
            const s = val.trim().toUpperCase();
            if (s === "" || s === "-" || s === "N/A" || s === "LOT ONLY" || s === "LOTONLY") return false;
            if (checkIfLotOnly(s)) return false;
            return true;
          };

          // Let's check if the searchVal matches Column E (Structure Tag, index 2 in C:BF)
          let isMatchedByStructureTag = false;
          let matchedRowIdx = -1;
          for (let i = 0; i < values.length; i++) {
            const colE = getVal(values[i], 2).toUpperCase();
            if (colE && colE === searchVal) {
              matchedRowIdx = i;
              isMatchedByStructureTag = true;
              break;
            }
          }

          if (!active) return;

          if (isMatchedByStructureTag && matchedRowIdx !== -1) {
            // Case 1: Search term matches Column E (Structure Tag)
            const matchedRow = values[matchedRowIdx];
            setRawActualsIsLotOnly(false);
            setActualsPartitions([]);

            setStatusFields(prev => ({
              ...prev,
              correctedLotId: getVal(matchedRow, 3), // Col F
              dominantLotId: getVal(matchedRow, 5), // Col H
              sourceOfCostInfo: getVal(matchedRow, 47), // Col AX
              totalLotLandCost: formatOnBlur(getVal(matchedRow, 49)), // Col AZ
              paymentStructureStatus: getVal(matchedRow, 50), // Col BA
              totalPaidStructureCost: formatOnBlur(getVal(matchedRow, 51)), // Col BB
              paymentFenceStatus: getVal(matchedRow, 52), // Col BC
              fenceOtherCost: formatOnBlur(getVal(matchedRow, 53)), // Col BD
              structureOverallTotalCost: getVal(matchedRow, 54), // Col BE
              overallTotalCostLotStructure: getVal(matchedRow, 55), // Col BF
            }));
          } else {
            // Case 2: Search term matches Column F (Corrected Lot ID, index 3 in C:BF)
            let matchedCorrectedLotIdRows: number[] = [];
            for (let i = 0; i < values.length; i++) {
              const colF = getVal(values[i], 3).toUpperCase();
              if (colF && colF === searchVal) {
                matchedCorrectedLotIdRows.push(i);
              }
            }

            if (matchedCorrectedLotIdRows.length > 0) {
              const validStructureRowIndexes = matchedCorrectedLotIdRows.filter(idx => {
                const colEVal = getVal(values[idx], 2);
                return isValidStructureTag(colEVal);
              });

              if (validStructureRowIndexes.length > 0) {
                // Not lot only: Build partitions from matching rows
                setRawActualsIsLotOnly(false);
                const partitions = validStructureRowIndexes.map((idx) => {
                  const r = values[idx];
                  const rowNum = idx + 1;
                  return {
                    rowNumber: rowNum,
                    structureTag: getVal(r, 2),
                    paymentStructureStatus: getVal(r, 50), // Col BA
                    totalPaidStructureCost: formatOnBlur(getVal(r, 51)), // Col BB
                    paymentFenceStatus: getVal(r, 52), // Col BC
                    fenceOtherCost: formatOnBlur(getVal(r, 53)), // Col BD
                    rowValues: r
                  };
                });

                if (!active) return;

                setActualsPartitions(partitions);

                const firstMatchedRow = values[validStructureRowIndexes[0]];
                setStatusFields(prev => ({
                  ...prev,
                  correctedLotId: getVal(firstMatchedRow, 3),
                  dominantLotId: getVal(firstMatchedRow, 5),
                  sourceOfCostInfo: getVal(firstMatchedRow, 47),
                  totalLotLandCost: formatOnBlur(getVal(firstMatchedRow, 49)),
                  paymentStructureStatus: "",
                  totalPaidStructureCost: "",
                  paymentFenceStatus: "",
                  fenceOtherCost: "",
                  structureOverallTotalCost: "",
                  overallTotalCostLotStructure: getVal(firstMatchedRow, 55),
                }));
              } else {
                // Lot only: populate metadata from the first matched row, disable structure fields
                setRawActualsIsLotOnly(true);
                setActualsPartitions([]);

                const firstMatchedRow = values[matchedCorrectedLotIdRows[0]];

                if (!active) return;

                setStatusFields(prev => ({
                  ...prev,
                  correctedLotId: getVal(firstMatchedRow, 3),
                  dominantLotId: getVal(firstMatchedRow, 5),
                  sourceOfCostInfo: getVal(firstMatchedRow, 47),
                  totalLotLandCost: formatOnBlur(getVal(firstMatchedRow, 49)),
                  paymentStructureStatus: "N/A",
                  totalPaidStructureCost: "0.00",
                  paymentFenceStatus: "N/A",
                  fenceOtherCost: "0.00",
                  structureOverallTotalCost: "0.00",
                  overallTotalCostLotStructure: getVal(firstMatchedRow, 55),
                }));
              }
            } else {
              // Case 3: Fallback check on Column C (index 0) or Column H (index 5)
              let fallbackRowIdx = -1;
              for (let i = 0; i < values.length; i++) {
                const colC = getVal(values[i], 0).toUpperCase();
                const colH = getVal(values[i], 5).toUpperCase();
                if (colC === searchVal || colH === searchVal) {
                  fallbackRowIdx = i;
                  break;
                }
              }

              if (fallbackRowIdx !== -1) {
                const fallbackRow = values[fallbackRowIdx];
                const colEValue = getVal(fallbackRow, 2);
                const hasNoStructure = !colEValue || 
                                       colEValue.toUpperCase() === "N/A" || 
                                       colEValue === "-" ||
                                       checkIfLotOnly(colEValue);
                setRawActualsIsLotOnly(hasNoStructure);
                setActualsPartitions([]);

                if (!active) return;

                setStatusFields(prev => ({
                  ...prev,
                  correctedLotId: getVal(fallbackRow, 3),
                  dominantLotId: getVal(fallbackRow, 5),
                  sourceOfCostInfo: getVal(fallbackRow, 47),
                  totalLotLandCost: formatOnBlur(getVal(fallbackRow, 49)),
                  paymentStructureStatus: hasNoStructure ? "N/A" : getVal(fallbackRow, 50),
                  totalPaidStructureCost: hasNoStructure ? "0.00" : formatOnBlur(getVal(fallbackRow, 51)),
                  paymentFenceStatus: hasNoStructure ? "N/A" : getVal(fallbackRow, 52),
                  fenceOtherCost: hasNoStructure ? "0.00" : formatOnBlur(getVal(fallbackRow, 53)),
                  structureOverallTotalCost: hasNoStructure ? "0.00" : formatOnBlur(getVal(fallbackRow, 54)),
                  overallTotalCostLotStructure: getVal(fallbackRow, 55),
                }));
              } else {
                // Clear fields if absolutely no match
                setStatusFields(prev => ({
                  ...prev,
                  sourceOfCostInfo: "",
                  totalLotLandCost: "",
                  paymentStructureStatus: "",
                  totalPaidStructureCost: "",
                  paymentFenceStatus: "",
                  fenceOtherCost: "",
                  structureOverallTotalCost: "",
                  overallTotalCostLotStructure: "",
                  correctedLotId: "",
                  dominantLotId: "",
                }));
                setRawActualsIsLotOnly(false);
                setActualsPartitions([]);
              }
            }
          }
        } catch (err) {
          console.error("Error fetching actual amounts row:", err);
        } finally {
          if (active) {
            setIsFetchingActuals(false);
          }
        }
      };

      loadActuals();
    }
    return () => {
      active = false;
    };
  }, [updateFile, isBulkMode, singleLotInput, selectedLot?.lotId, googleToken, checkIfLotOnly]);

  useEffect(() => {
    let active = true;
    if (updateFile === "entitlements" && !isBulkMode) {
      const term = (singleLotInput || (selectedLot ? selectedLot.lotId : "")).trim();
      if (!term) {
        setStatusFields(prev => ({
          ...prev,
          entitlementsPaymentDate: "",
          rentalSubsidyMultiplier: "",
          rentalSubsidyAmount: "",
          transpoRelocationMultiplier: "",
          transpoRelocationAmount: "",
          foodRelocationMultiplier: "",
          foodRelocationAmount: "",
          utilitiesConnectionMultiplier: "",
          utilitiesConnectionAmount: "",
          inconvenienceAllowanceMultiplier: "",
          inconvenienceAllowanceAmount: "",
          specialAssistanceMultiplier: "",
          specialAssistanceAmount: "",
          forIncomeLoss: "",
        }));
        return;
      }

      const loadEntitlements = async () => {
        setIsFetchingEntitlements(true);
        try {
          const spreadsheetId = "15MLklcCnFgaGTo_w_mM9Nb3qV3jWLfrK5i-hMAW5QMU";
          const sheetName = "OTHER ENTITLEMENTS";
          
          // Fetch Column C to Z for lookup
          const lookupRange = `${sheetName}!C:Z`;
          const lookupRes = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(lookupRange)}`, {
            headers: {
              "Authorization": `Bearer ${googleToken}`
            }
          });
          if (!lookupRes.ok) throw new Error("Failed to search entitlements sheet");
          
          const lookupData = await lookupRes.json();
          const values = lookupData.values || [];
          
          const searchVal = term.toUpperCase();
          
          const getVal = (row: any[], colIndex: number): string => {
            return (row && row[colIndex] !== undefined) ? row[colIndex].toString().trim() : "";
          };

          let matchedRowIdx = -1;
          for (let i = 0; i < values.length; i++) {
            const lotIdNo = getVal(values[i], 0).toUpperCase(); // Col C is index 0 in C:Z
            const controlNo = getVal(values[i], 1).toUpperCase(); // Col D is index 1 in C:Z
            if (lotIdNo === searchVal || controlNo === searchVal) {
              matchedRowIdx = i;
              break;
            }
          }

          if (!active) return;

          if (matchedRowIdx !== -1) {
            const row = values[matchedRowIdx];
            setStatusFields(prev => ({
              ...prev,
              entitlementsPaymentDate: getVal(row, 7), // Col J is index 7 in C:Z (C=0,D=1,E=2,F=3,G=4,H=5,I=6,J=7)
              rentalSubsidyMultiplier: getVal(row, 11), // Col N is index 11 in C:Z
              rentalSubsidyAmount: formatOnBlur(getVal(row, 12)), // Col O is index 12 in C:Z
              transpoRelocationMultiplier: getVal(row, 13), // Col P is index 13 in C:Z
              transpoRelocationAmount: formatOnBlur(getVal(row, 14)), // Col Q is index 14 in C:Z
              foodRelocationMultiplier: getVal(row, 15), // Col R is index 15 in C:Z
              foodRelocationAmount: formatOnBlur(getVal(row, 16)), // Col S is index 16 in C:Z
              utilitiesConnectionMultiplier: getVal(row, 17), // Col T is index 17 in C:Z
              utilitiesConnectionAmount: formatOnBlur(getVal(row, 18)), // Col U is index 18 in C:Z
              inconvenienceAllowanceMultiplier: getVal(row, 19), // Col V is index 19 in C:Z
              inconvenienceAllowanceAmount: formatOnBlur(getVal(row, 20)), // Col W is index 20 in C:Z
              specialAssistanceMultiplier: getVal(row, 21), // Col X is index 21 in C:Z
              specialAssistanceAmount: formatOnBlur(getVal(row, 22)), // Col Y is index 22 in C:Z
              forIncomeLoss: formatOnBlur(getVal(row, 23)), // Col Z is index 23 in C:Z
            }));
          } else {
            // Clear fields if no match found
            setStatusFields(prev => ({
              ...prev,
              entitlementsPaymentDate: "",
              rentalSubsidyMultiplier: "",
              rentalSubsidyAmount: "",
              transpoRelocationMultiplier: "",
              transpoRelocationAmount: "",
              foodRelocationMultiplier: "",
              foodRelocationAmount: "",
              utilitiesConnectionMultiplier: "",
              utilitiesConnectionAmount: "",
              inconvenienceAllowanceMultiplier: "",
              inconvenienceAllowanceAmount: "",
              specialAssistanceMultiplier: "",
              specialAssistanceAmount: "",
              forIncomeLoss: "",
            }));
          }
        } catch (err) {
          console.error("Error fetching entitlements row:", err);
        } finally {
          if (active) {
            setIsFetchingEntitlements(false);
          }
        }
      };

      loadEntitlements();
    }
    return () => {
      active = false;
    };
  }, [updateFile, isBulkMode, singleLotInput, selectedLot?.lotId, googleToken]);


  useEffect(() => {
    if (selectedTab === "update") {
      const timer = setTimeout(() => {
        const el = document.getElementById("update-sheet-status-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedTab]);

  const progressSteps = useMemo(() => {
    if (!selectedLot) return [];
    
    const d = selectedLot;
    const deliveredNoT = (d.statusNot || "").toUpperCase().includes("DELIVERED") || (d.dateNot && d.dateNot !== "-" && d.dateNot !== "" && d.dateNot !== "No Data");
    const servedOTB = (d.statusOtb || "").toUpperCase().includes("DELIVERED") || (d.statusOtb || "").toUpperCase().includes("SERVED") || (d.statusOtb || "").toUpperCase().includes("ISSUED") || (d.dateOtb && d.dateOtb !== "-" && d.dateOtb !== "" && d.dateOtb !== "No Data");
    const hasOtbReply = (d.otbReply && d.otbReply !== "-" && d.otbReply !== "" && d.otbReply !== "No Data") || (d.otbReplyDate && d.otbReplyDate !== "-" && d.otbReplyDate !== "" && d.otbReplyDate !== "No Data");
    const hasReplyDate = d.otbReplyDate && d.otbReplyDate !== "-" && d.otbReplyDate !== "" && d.otbReplyDate !== "No Data";
    const signedDOAS = (d.statusDoas || "").toUpperCase().includes("SIGNED") || (d.dateDoas && d.dateDoas !== "-" && d.dateDoas !== "" && d.dateDoas !== "No Data");
    const paid = (d.paymentStatus || "").toUpperCase().includes("PAID") || (d.paymentStatus || "").toUpperCase().includes("FULLY PAID") || (d.datePaid && d.datePaid !== "-" && d.datePaid !== "" && d.datePaid !== "No Data");
    const handedOver = !!d.handedOver && d.handedOver !== "-" && d.handedOver !== "No Data" && d.handedOver !== "" && d.handedOver.toUpperCase() !== "PENDING";

    return [
      { name: "NOT", done: deliveredNoT, color: strokeColor },
      { name: "OTB", done: servedOTB, color: strokeColor },
      { name: "OTB REPLY", done: hasOtbReply, color: strokeColor },
      { name: "DATE REPLY", done: hasReplyDate, color: strokeColor },
      { name: "DOAS", done: signedDOAS, color: strokeColor },
      { name: "PAID", done: paid, color: strokeColor },
      { name: "H/O", done: handedOver, color: strokeColor }
    ];
  }, [selectedLot, strokeColor]);

  // Milestone check calculation
  const getMilestoneDetails = (key: string, lot: PreprocessedLot) => {
    const valNorm = (lot.paymentStatus || "").toUpperCase();
    const statusNot = (lot.statusNot || "").toUpperCase();
    const statusRfd = (lot.statusRfd || "").toUpperCase();
    const statusOtb = (lot.statusOtb || "").toUpperCase();
    const statusOtc = (lot.statusOtc || "").toUpperCase();
    const statusDoas = (lot.statusDoas || "").toUpperCase();
    const statusPte = (lot.statusPte || "").toUpperCase();

    let completed = false;
    let ongoing = false;
    let desc = "Not Initiated";

    if (key === "NoT") {
      completed = statusNot.includes("DELIVERED") || !!lot.dateNot;
      desc = completed ? `Notice of Taking delivered/served on ${lot.dateNot}` : "NoT delivery index in progress";
    } else if (key === "RfD") {
      completed = statusRfd.includes("DELIVERED") || !!lot.dateRfd;
      desc = completed ? `Request for Donation served on ${lot.dateRfd}` : "Donation valuation assessment draft";
    } else if (key === "OTB") {
      completed = statusOtb.includes("DELIVERED") || !!lot.dateOtb;
      desc = completed ? `Offer to Buy delivered on ${lot.dateOtb}` : "Documentation appraisal checks pending";
    } else if (key === "OtbLoReply") {
      completed = !!lot.otbReply && lot.otbReply !== "-" && lot.otbReply !== "No Data" && lot.otbReply !== "";
      desc = completed ? `Landowner Reply: "${lot.otbReply}"` : "Awaiting response from Landowner";
    } else if (key === "OtbDateReply") {
      completed = !!lot.otbReplyDate && lot.otbReplyDate !== "-" && lot.otbReplyDate !== "No Data" && lot.otbReplyDate !== "";
      desc = completed ? `OTB Reply Date recorded on ${lot.otbReplyDate}` : "Date of reply pending confirmation";
    } else if (key === "OTC") {
      completed = statusOtc.includes("DELIVERED") || !!lot.dateOtc;
      desc = completed ? `Offer to Compensate served on ${lot.dateOtc}` : "Valuation and structural compensation pending";
    } else if (key === "DOAS") {
      completed = statusDoas.includes("SIGNED") || !!lot.dateDoas;
      desc = completed ? `Deed of Absolute Sale executed on ${lot.dateDoas}` : "Agreement review and notary pending";
    } else if (key === "PTE") {
      completed = statusPte.includes("SIGNED") || statusPte.includes("PTE") || !!lot.datePte;
      desc = completed ? `Permit to Enter authorization signed on ${lot.datePte}` : "Site layout access permission pending";
    } else if (key === "Payment") {
      completed = valNorm.includes("FULLY PAID") || !!lot.datePaid;
      ongoing = valNorm.includes("PARTIALLY") || valNorm.includes("PROCESS") || valNorm.includes("VOUCHER");
      desc = completed ? `Full payment transferred on ${lot.datePaid}` : ongoing ? `Voucher processing in progress: ${lot.paymentStatus}` : "Documents undergoing validation checkpoint";
    } else if (key === "Handover") {
      completed = !!lot.handedOver && lot.handedOver !== "-" && lot.handedOver !== "No Data" && lot.handedOver !== "";
      desc = completed ? `Site cleared & handed over on ${lot.handedOver}` : "Construction zone clearing pending";
    } else if (key === "CnoMoa") {
      completed = !!lot.withCnoMoa && lot.withCnoMoa !== "-" && lot.withCnoMoa !== "No Data" && lot.withCnoMoa !== "" && lot.withCnoMoa.toUpperCase() !== "NO";
      desc = completed ? `CNO / MOA processed, signed on ${lot.dateCno || lot.withCnoMoa}` : "Compromise Agreement / MOA process pending";
    } else if (key === "PartiallyPaid") {
      completed = valNorm.includes("PARTIALLY");
      desc = completed ? `Partially paid status: ${lot.paymentStatus}` : "No partial payments recorded";
    } else if (key === "Cno") {
      completed = !!lot.withCnoMoa && lot.withCnoMoa !== "-" && lot.withCnoMoa !== "No Data" && lot.withCnoMoa !== "" && lot.withCnoMoa.toUpperCase() !== "NO";
      desc = completed ? `With CNO / MOA processed on ${lot.dateCno || lot.withCnoMoa}` : "CNO / MOA not processed yet";
    }

    return { completed, ongoing, desc };
  };

  const timelineEvents = useMemo(() => {
    if (!selectedLot) return [];

    const events: Array<{
      id: string;
      date: Date;
      dateStr: string;
      type: "milestone" | "log";
      title: string;
      tag?: string;
      description: string;
      personnel?: string;
      remarks?: string;
      color: string;
      icon: any;
    }> = [];

    // Helper to parse dates
    const parseDateHelper = (dateStr: string | undefined | null): Date | null => {
      if (!dateStr || dateStr === "-" || dateStr === "No Data" || dateStr === "") return null;
      let parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) return parsed;
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1].substring(0, 3).toLowerCase();
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const months: Record<string, number> = {
          jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
          jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        if (months[monthStr] !== undefined && !isNaN(day) && !isNaN(year)) {
          return new Date(year, months[monthStr], day);
        }
      }
      return null;
    };

    // System milestones mapping
    const milestoneDefs = [
      { key: "NoT", title: "Notice of Taking Served", dateField: selectedLot.dateNot, icon: FileText, color: "#e05638", defaultDesc: "Notice of Taking delivered to landowner" },
      { key: "OTB", title: "Offer to Buy Served", dateField: selectedLot.dateOtb, icon: Handshake, color: "#e67e22", defaultDesc: "Offer to Buy delivered to landowner" },
      { key: "OtbLoReply", title: "OTB Reply Received", dateField: selectedLot.otbReplyDate, icon: Check, color: "#8cb127", defaultDesc: `Landowner replied: "${selectedLot.otbReply}"` },
      { key: "DOAS", title: "Deed of Absolute Sale Executed", dateField: selectedLot.dateDoas, icon: FileCheck, color: "#1a7bb9", defaultDesc: "DOAS signed and notarized" },
      { key: "Payment", title: "Full Payment Disbursed", dateField: selectedLot.datePaid, icon: Coins, color: "#70529d", defaultDesc: `Disbursement completed. Land Cost: ${selectedLot.actualLandCost ? formatCurrency(selectedLot.actualLandCost) : '—'}` },
      { key: "Handover", title: "Site Handover Completed", dateField: selectedLot.handedOver, icon: Flag, color: "#27ae60", defaultDesc: "Lot handed over to construction and engineering team" },
      { key: "PTE", title: "Permit to Enter Signed", dateField: selectedLot.datePte, icon: FileSignature, color: "#06b6d4", defaultDesc: "Permit to Enter executed" },
      { key: "Cno", title: "CNO/MOA Agreement Signed", dateField: selectedLot.dateCno, icon: FileSignature, color: "#6366f1", defaultDesc: "With Compromise Agreement / MOA" },
      { key: "Relocation", title: "Relocation Completed", dateField: selectedLot.relocationDate, icon: Compass, color: "#a855f7", defaultDesc: "Relocation requirements met" }
    ];

    milestoneDefs.forEach((m, idx) => {
      const details = getMilestoneDetails(m.key, selectedLot);
      const isCompleted = m.key === "Relocation" 
        ? (selectedLot.relocation || "").toUpperCase().includes("COMPLETED") || (selectedLot.relocation || "").toUpperCase().includes("YES")
        : details.completed;

      if (isCompleted && m.dateField && m.dateField !== "-" && m.dateField !== "No Data" && m.dateField !== "") {
        const dateObj = parseDateHelper(m.dateField);
        if (dateObj) {
          events.push({
            id: `milestone-${m.key}-${idx}`,
            date: dateObj,
            dateStr: m.dateField,
            type: "milestone",
            title: m.title,
            description: details.desc || m.defaultDesc,
            color: m.color,
            icon: m.icon
          });
        }
      }
    });

    // Historical accomplishments logs (weeklyUpdates)
    const normalizedLotId = (selectedLot.lotId || "").trim().toUpperCase();
    const normalizedId = (selectedLot.id || "").trim().toUpperCase();

    const lotLogs = weeklyUpdates.filter(u => {
      const logLotId = (u.lotId || "").trim().toUpperCase();
      return logLotId === normalizedLotId || logLotId === normalizedId;
    });

    lotLogs.forEach((log, idx) => {
      const dateObj = parseDateHelper(log.dateAccomplishment);
      if (dateObj) {
        events.push({
          id: `log-${idx}`,
          date: dateObj,
          dateStr: log.dateAccomplishment,
          type: "log",
          title: `Progress Action Logged`,
          tag: log.tag,
          description: log.accomplishment || "No accomplishment detailed",
          personnel: log.personnel,
          remarks: log.remarks,
          color: log.tag === "SC" ? "#10b981" : "#6366f1",
          icon: FileEdit
        });
      }
    });

    // Filtering
    let filtered = events;
    if (timelineFilter === "milestone") {
      filtered = events.filter(e => e.type === "milestone");
    } else if (timelineFilter === "log") {
      filtered = events.filter(e => e.type === "log");
    }

    // Sorting
    return filtered.sort((a, b) => {
      const diff = b.date.getTime() - a.date.getTime();
      return timelineSortOrder === "newest" ? diff : -diff;
    });

  }, [selectedLot, weeklyUpdates, timelineFilter, timelineSortOrder]);

  const progressWedges = useMemo(() => {
    if (!selectedLot) return [];

    const cx = 160;
    const cy = 112;
    const innerR = 68;
    
    // escalating radiuses for the 7 wedges representing a premium visual arc fan
    const radiuses = [84, 96, 108, 120, 132, 144, 160];
    const colors = [
      "#eab308", // Saturated Yellow (NOT)
      "#f97316", // Tangerine Orange (OTB)
      "#ef4444", // Crimson Red (OTB REPLY)
      "#a855f7", // Purple Accent (DATE REPLY)
      "#06b6d4", // Cyan Accent (DOAS)
      "#3b82f6", // Royal Blue (PAID)
      strokeColor // Theme Specific Accent Color (H/O)
    ];

    const numWedges = progressSteps.length;
    const totalSpan = 170; // Sweep from left to right covering 170 degrees
    const stepSpan = totalSpan / numWedges;
    const gap = 2; // Gap in degrees between segments

    const polarToCartes = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
      const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInDegrees), // In SVG, it's correct to use sin for y
      };
    };

    // Math.sin takes radians, so we convert correctly
    const polarToCartesianCorrect = (centerX: number, centerY: number, radius: number, angleDeg: number) => {
      const angleInRadians = (angleDeg * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
      };
    };

    return progressSteps.map((step, idx) => {
      // Offset start angle to place the fan in the top-half (dome)
      // 180 is horizontal left. Let's start at 185 and end at 355
      const startAngle = 185 + idx * stepSpan + gap / 2;
      const endAngle = 185 + (idx + 1) * stepSpan - gap / 2;
      const midAngle = (startAngle + endAngle) / 2;

      const outerR = radiuses[idx];

      // Outer arc endpoints
      const startOut = polarToCartesianCorrect(cx, cy, outerR, startAngle);
      const endOut = polarToCartesianCorrect(cx, cy, outerR, endAngle);
      
      // Inner arc endpoints
      const startIn = polarToCartesianCorrect(cx, cy, innerR, startAngle);
      const endIn = polarToCartesianCorrect(cx, cy, innerR, endAngle);

      const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

      // Draw clockwise outer arc, straight line down to inner radius, counter-clockwise inner arc back, close
      const path = [
        `M ${startIn.x} ${startIn.y}`,
        `L ${startOut.x} ${startOut.y}`,
        `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOut.x} ${endOut.y}`,
        `L ${endIn.x} ${endIn.y}`,
        `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startIn.x} ${startIn.y}`,
        "Z"
      ].join(" ");

      // Compute precise coordinates for labels placed inside the wedges
      const labelR = innerR + (outerR - innerR) / 2;
      const labelPos = polarToCartesianCorrect(cx, cy, labelR, midAngle);

      return {
        ...step,
        path,
        color: colors[idx],
        labelX: labelPos.x,
        labelY: labelPos.y,
        midAngle
      };
    });
  }, [selectedLot, progressSteps, strokeColor]);

  const circleProgressSteps = useMemo(() => {
    if (!selectedLot) return [];
    
    const d = selectedLot;
    const deliveredNoT = (d.statusNot || "").toUpperCase().includes("DELIVERED") || (d.dateNot && d.dateNot !== "-" && d.dateNot !== "" && d.dateNot !== "No Data");
    const servedOTB = (d.statusOtb || "").toUpperCase().includes("DELIVERED") || (d.statusOtb || "").toUpperCase().includes("SERVED") || (d.statusOtb || "").toUpperCase().includes("ISSUED") || (d.dateOtb && d.dateOtb !== "-" && d.dateOtb !== "" && d.dateOtb !== "No Data");
    const signedDOAS = (d.statusDoas || "").toUpperCase().includes("SIGNED") || (d.dateDoas && d.dateDoas !== "-" && d.dateDoas !== "" && d.dateDoas !== "No Data");
    const paid = (d.paymentStatus || "").toUpperCase().includes("PAID") || (d.paymentStatus || "").toUpperCase().includes("FULLY PAID") || (d.datePaid && d.datePaid !== "-" && d.datePaid !== "" && d.datePaid !== "No Data");
    const handedOver = !!d.handedOver && d.handedOver !== "-" && d.handedOver !== "No Data" && d.handedOver !== "" && d.handedOver.toUpperCase() !== "PENDING";

    return [
      { name: "NOT", done: deliveredNoT },
      { name: "OTB", done: servedOTB },
      { name: "DOAS", done: signedDOAS },
      { name: "PAID", done: paid },
      { name: "H/O", done: handedOver }
    ];
  }, [selectedLot]);

  const activeMilestoneStatus = useMemo(() => {
    if (!circleProgressSteps || circleProgressSteps.length === 0) return "PENDING";
    const completedSteps = circleProgressSteps.filter((s) => s.done);
    if (completedSteps.length === 0) return "PENDING";
    return completedSteps[completedSteps.length - 1].name;
  }, [circleProgressSteps]);

  const circleProgressWedges = useMemo(() => {
    if (!selectedLot) return [];

    const cx = 160;
    const cy = 112;
    const innerR = 90;
    
    // enlarged radiuses for the 5 wedges representing a premium visual arc fan (as requested)
    const radiuses = [112, 133, 154, 175, 196];
    const colors = [
      "#e05638", // NOT (Red-Orange)
      "#e67e22", // OTB (Orange)
      "#1a7bb9", // DOAS (Blue)
      "#70529d", // PAID (Violet)
      "#27ae60"  // H/O (Green)
    ];

    const numWedges = circleProgressSteps.length;
    const totalSpan = 170; // Sweep from left to right covering 170 degrees
    const stepSpan = totalSpan / numWedges;
    const gap = 2; // Gap in degrees between segments

    const polarToCartesianCorrect = (centerX: number, centerY: number, radius: number, angleDeg: number) => {
      const angleInRadians = (angleDeg * Math.PI) / 180.0;
      return {
        x: centerX + radius * Math.cos(angleInRadians),
        y: centerY + radius * Math.sin(angleInRadians)
      };
    };

    return circleProgressSteps.map((step, idx) => {
      const startAngle = 185 + idx * stepSpan + gap / 2;
      const endAngle = 185 + (idx + 1) * stepSpan - gap / 2;
      const midAngle = (startAngle + endAngle) / 2;

      const outerR = radiuses[idx];

      const startOut = polarToCartesianCorrect(cx, cy, outerR, startAngle);
      const endOut = polarToCartesianCorrect(cx, cy, outerR, endAngle);
      
      const startIn = polarToCartesianCorrect(cx, cy, innerR, startAngle);
      const endIn = polarToCartesianCorrect(cx, cy, innerR, endAngle);

      const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;

      // Draw clockwise outer arc, straight line down to inner radius, counter-clockwise inner arc back, close
      const path = [
        `M ${startIn.x} ${startIn.y}`,
        `L ${startOut.x} ${startOut.y}`,
        `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${endOut.x} ${endOut.y}`,
        `L ${endIn.x} ${endIn.y}`,
        `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${startIn.x} ${startIn.y}`,
        "Z"
      ].join(" ");

      // Compute precise coordinates for labels placed inside the wedges
      const labelR = innerR + (outerR - innerR) / 2;
      const labelPos = polarToCartesianCorrect(cx, cy, labelR, midAngle);

      return {
        ...step,
        path,
        color: colors[idx],
        labelX: labelPos.x,
        labelY: labelPos.y,
        midAngle
      };
    });
  }, [selectedLot, circleProgressSteps, strokeColor]);

  // Direct ID manual retrieval form lookup (selects the first item from the filtered suggestions)
  const handleRetrieveSearch = () => {
    if (quickSearchResults.length > 0) {
      const firstLot = quickSearchResults[0];
      setSelectedLotId(firstLot.id);
      trackLotAccess(firstLot.lotId);
      // reset filters to ensure it's fully accessible in layout
      setFilterCp("ALL");
      setFilterStatus("ALL");
      setFilterLgu("ALL");
      setFilterBarangay("ALL");
      setFilterMode("ALL");
      setSearch("");
      setDebouncedSearch("");
      setIsQuickSearchFocused(false);
      showNoticeToast(`Retrieved Lot ${firstLot.lotId}`);
    } else {
      showNoticeToast(`Control ID "${search}" not found.`);
    }
  };

  const copyFieldValue = (text: string | number, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Aesthetic Data display item with professional color combinations
  const getFieldIcon = (lbl: string) => {
    const lower = lbl.toLowerCase();
    if (lower.includes("station") || lower.includes("pier") || lower.includes("zone")) return <MapPin className="w-3.5 h-3.5" />;
    if (lower.includes("lgu") || lower.includes("barangay") || lower.includes("jurisdiction")) return <Building2 className="w-3.5 h-3.5" />;
    if (lower.includes("access date") || lower.includes("sad")) return <Calendar className="w-3.5 h-3.5" />;
    if (lower.includes("area") || lower.includes("dimension") || lower.includes("metric") || lower.includes("remaining")) return <Ruler className="w-3.5 h-3.5" />;
    if (lower.includes("cost") || lower.includes("appraisal") || lower.includes("value") || lower.includes("valuation") || lower.includes("price") || lower.includes("paid") || lower.includes("budget") || lower.includes("disbursement") || lower.includes("financial")) return <Coins className="w-3.5 h-3.5" />;
    if (lower.includes("control") || lower.includes("no") || lower.includes("cp") || lower.includes("package")) return <FileText className="w-3.5 h-3.5" />;
    if (lower.includes("owner") || lower.includes("classification") || lower.includes("title")) return <User className="w-3.5 h-3.5" />;
    return <Layers className="w-3.5 h-3.5" />;
  };

  const RenderField = ({ 
    label, 
    value, 
    isCurrency = false, 
    isArea = false, 
    actionLabel,
    variant = "slate"
  }: { 
    label: string; 
    value: any; 
    isCurrency?: boolean; 
    isArea?: boolean; 
    actionLabel?: string;
    variant?: "slate" | "indigo" | "emerald" | "amber" | "sky" | "violet" | "rose"
  }) => {
    const isEmpty = !value || value === "No Data" || value === "-" || value === "";
    const displayVal = isEmpty ? "—" : isCurrency ? formatCurrency(value) : isArea ? `${formatArea(value)} sq.m` : value;
    const isCopied = copiedField === label;

    // Direct mapping to the overall chosen theme accent
    const themeColorKey = (() => {
      const id = activeTheme.id;
      if (id === "blue") return "indigo";
      if (id === "emerald") return "emerald";
      if (id === "rose") return "rose";
      if (id === "violet") return "violet";
      return "slate"; // default / charcoal
    })();

    const sCol = (() => {
      if (themeColorKey === "indigo") return "#6366f1";
      if (themeColorKey === "emerald") return "#10b981";
      if (themeColorKey === "rose") return "#f43f5e";
      if (themeColorKey === "violet") return "#8b5cf6";
      return "#475569";
    })();

    const gradientColors = (() => {
      if (themeColorKey === "indigo") return { from: "#818cf8", to: "#4f46e5" };
      if (themeColorKey === "emerald") return { from: "#34d399", to: "#059669" };
      if (themeColorKey === "rose") return { from: "#fb7185", to: "#e11d48" };
      if (themeColorKey === "violet") return { from: "#a78bfa", to: "#7c3aed" };
      return { from: "#64748b", to: "#334155" }; // slate
    })();

    const shadowRgb = (() => {
      if (themeColorKey === "indigo") return "99, 102, 241";
      if (themeColorKey === "emerald") return "16, 185, 129";
      if (themeColorKey === "rose") return "244, 63, 94";
      if (themeColorKey === "violet") return "139, 92, 246";
      return "115, 115, 115";
    })();

     // Dynamic styles matching the selected active overall theme
     const currentStyle = {
       bg: activeTheme.isDark 
         ? (themeColorKey === "slate" 
             ? `bg-slate-900/35 border-slate-850/65 hover:border-slate-800 hover:bg-slate-850/45 text-slate-100 hover:shadow-[0_8px_20px_-6px_rgba(${shadowRgb},0.12)]`
             : `bg-${themeColorKey}-950/15 border-${themeColorKey}-900/40 hover:border-${themeColorKey}-500/30 hover:bg-${themeColorKey}-950/25 text-slate-105 hover:shadow-[0_8px_20px_-6px_rgba(${shadowRgb},0.12)]`)
         : (themeColorKey === "slate"
             ? `bg-slate-50/40 border-slate-200 text-slate-800 hover:bg-slate-100/40 hover:border-slate-300 hover:shadow-[0_8px_16px_-6px_rgba(${shadowRgb},0.04)]`
             : `bg-${themeColorKey}-50/30 border-${themeColorKey}-100/70 text-slate-800 hover:bg-${themeColorKey}-50/50 hover:border-${themeColorKey}-200/90 hover:shadow-[0_8px_16px_-6px_rgba(${shadowRgb},0.04)]`),
        label: "text-slate-500/85 dark:text-slate-400/85 font-extrabold uppercase tracking-[0.14em] text-[7.5px]",
        value: activeTheme.isDark 
          ? (themeColorKey === "slate" ? "text-slate-350" : `text-${themeColorKey}-400/95`)
          : (themeColorKey === "slate" ? "text-slate-600" : `text-${themeColorKey}-600/90`),
        icon: `text-${themeColorKey}-550 text-${themeColorKey}-500 dark:text-${themeColorKey}-400`,
        textClr: `text-${themeColorKey}-500 dark:text-${themeColorKey}-450`
      };

      const itemIcon = getFieldIcon(label);

      const getFieldMeta = (lbl: string) => {
        const lower = lbl.toLowerCase();
        
        // Geographical / Location details
        if (lower.includes("station")) return { num: "01", category: "GEO" };
        if (lower.includes("pier")) return { num: "02", category: "GEO" };
        if (lower.includes("lgu") || lower.includes("municipality")) return { num: "03", category: "JUR" };
        if (lower.includes("barangay")) return { num: "04", category: "BRGY" };
        if (lower.includes("access date")) return { num: "05", category: "ACCS" };
        if (lower.includes("zone")) return { num: "06", category: "ZONE" };

        // Core system details
        if (lower.includes("control no")) return { num: "01", category: "CTRL" };
        if (lower.includes("contract package") || lower.includes("cp")) return { num: "02", category: "PACK" };
        if (lower.includes("mode of acquisition") || lower.includes("acquisition")) return { num: "03", category: "MODE" };
        if (lower.includes("owner classification")) return { num: "04", category: "OWNR" };
        if (lower.includes("optimization") || lower.includes("harmonization")) return { num: "05", category: "OPTM" };

        // Area impact details
        if (lower.includes("prow impact")) return { num: "01", category: "PROW" };
        if (lower.includes("total area")) return { num: "02", category: "AREA" };
        if (lower.includes("affected area")) return { num: "03", category: "AFF" };
        if (lower.includes("remaining")) return { num: "04", category: "REM" };

        // Structure tags
        if (lower.includes("structure tag")) return { num: "01", category: "TAG" };
        if (lower.includes("use classification")) return { num: "02", category: "USE" };
        if (lower.includes("structure owner")) return { num: "03", category: "OWNR" };

        // Land & Appraisal Values
        if (lower.includes("appraisal year")) return { num: "01", category: "YEAR" };
        if (lower.includes("estimated land")) return { num: "02", category: "EST" };
        if (lower.includes("structure cost")) return { num: "03", category: "STR" };
        if (lower.includes("lbp appraisal")) return { num: "04", category: "LBP" };

        // Actual Finance details
        if (lower.includes("actual land")) return { num: "01", category: "LND" };
        if (lower.includes("actual structure")) return { num: "02", category: "STR" };
        if (lower.includes("actual corp") || lower.includes("tree")) return { num: "03", category: "VAL" };

        // Relocation & compliance details
        if (lower.includes("relocation required") || lower === "relocation") return { num: "01", category: "RELO" };
        if (lower.includes("scheduled relocation") || lower.includes("relocation date")) return { num: "02", category: "DATE" };
        if (lower.includes("denr")) return { num: "03", category: "DENR" };
        if (lower.includes("titling")) return { num: "04", category: "TITL" };
        if (lower.includes("cno") || lower.includes("moa")) return { num: "05", category: "CNO" };

        return { num: "01", category: "DATA" };
      };

      const meta = getFieldMeta(label);

      return (
        <div 
          className={cn(
            "group relative flex items-center pr-3 pl-2.5 py-1 rounded-xl border transition-all duration-300 shadow-3xs overflow-hidden min-h-[2.85rem] justify-center select-all cursor-default",
            "hover:-translate-y-0.5 hover:shadow-2xs",
            activeTheme.isDark 
              ? "bg-slate-900/35 border-slate-850/65 hover:border-slate-800 hover:bg-slate-850/45 text-slate-100" 
              : "bg-white border-slate-200/90 text-stone-850 hover:border-slate-300/90 hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.03)]"
          )}
          style={{ borderColor: `${gradientColors.from}3d` }}
        >
          {/* Left Solid colored capsule/tab on edge with vibrant gradient */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1.5 select-none pointer-events-none"
            style={{ 
              background: `linear-gradient(to bottom, ${gradientColors.from}, ${gradientColors.to})`, 
              opacity: 0.70,
              borderRadius: "0.75rem 0 0 0.75rem"
            }}
          />

          {/* Content Segment container shifted to clear the left color capsule bar */}
          <div className="flex items-center w-full min-w-0 pl-0.5 md:pl-1">
            
            {/* Index Counter Indicator */}
            <div className="flex flex-col items-center justify-center shrink-0 min-w-[1.6rem] text-center select-none">
              <span className={cn(
                "text-[12.5px] md:text-[14px] font-black tracking-tighter leading-none font-display",
                activeTheme.isDark ? "text-slate-300" : "text-slate-750"
              )}>
                {meta.num}
              </span>
              <span className="text-[6px] font-extrabold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5 leading-none">
                {meta.category}
              </span>
            </div>

            {/* Vertical Divider line between Info Code and Icon Circle */}
            <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800/80 mx-1.5 shrink-0" />

            {/* Concentric Circle Bubble Housing the Custom Field Icon */}
            <div className={cn(
              "w-6.5 h-6.5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 shadow-3xs mr-1.5 pointer-events-none",
              activeTheme.isDark 
                ? "bg-slate-950 border border-slate-850/60 ring-1 ring-slate-900/40 shadow-[0_2px_6px_rgba(0,0,0,0.3)]" 
                : "bg-stone-50/50 border border-slate-100 ring-1 ring-stone-100/50 shadow-[0_2px_6px_rgba(0,0,0,0.01)]"
            )}>
              {React.cloneElement(itemIcon, { className: "w-2.5 h-2.5 shrink-0", style: { color: gradientColors.from } })}
            </div>

            {/* Primary Label and Real-Time Value Details */}
            <div className="relative z-10 w-full min-w-0">
              <div className="flex justify-between items-center mb-0 select-none">
                <span className={cn(
                  isEmpty ? "text-slate-400 font-bold uppercase tracking-[0.14em] text-[7.5px]" : currentStyle.label
                )}>
                  {label}
                </span>
                
                {!isEmpty && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyFieldValue(displayVal, label);
                      showNoticeToast(`${label} copied to clipboard.`);
                    }}
                    className="p-0.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-500/10 cursor-pointer transition-all shrink-0"
                    title="Copy details"
                  >
                    {isCopied ? (
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                    ) : (
                      <Copy className={cn("w-2.5 h-2.5 opacity-85", currentStyle.icon)} />
                    )}
                  </button>
                )}
              </div>
              
              <div className="flex items-baseline justify-between mt-0 gap-1 min-w-0">
                <span className={cn(
                  "text-[10.5px] md:text-[11px] uppercase font-sans tracking-wide leading-tight truncate transition-colors duration-300",
                  isEmpty 
                    ? "text-slate-400 dark:text-slate-500 italic font-medium font-mono text-[9px]" 
                    : `${currentStyle.value} font-bold`
                )}>
                  {displayVal}
                </span>
                {isCopied && (
                  <span className="text-[6px] text-emerald-500 px-1 py-0.2 bg-emerald-500/15 rounded uppercase tracking-wider font-extrabold select-none shrink-0">
                    Copied
                  </span>
                )}
              </div>
            </div>
          </div>

        {/* Shimmer interaction effect */}
        <div className="absolute -inset-y-4 -inset-x-12 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1200 ease-out pointer-events-none" />
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-full mx-auto pb-16 font-sans select-none antialiased">
      
      {/* Dynamic Toast Feedback Block */}
      <AnimatePresence>
        {notification && createPortal(
          <motion.div 
            initial={{ opacity: 0, y: -24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -24, x: "-50%" }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-[10000] bg-slate-900/95 border border-slate-800 text-slate-200 text-[11px] font-black uppercase tracking-wider px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md print:hidden"
          >
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{notification}</span>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>      {/* EXQUISITE HEADER AND CONTROLLER PANEL - REPLACED WITH LANDOWNER PROFILE CARD */}
      {selectedLot ? (
        <header className={cn(
          "rounded-[2.2rem] border p-6 xl:p-8 shadow-sm relative overflow-visible transition-all duration-300 print:hidden",
          activeTheme.isDark ? "bg-slate-900 border-slate-850" : "bg-white border-stone-200"
        )}>
          {/* Watermark container to clip overflowing background decorative graphics */}
          <div className="absolute inset-0 rounded-[2.2rem] overflow-hidden pointer-events-none z-0">
            {/* Micro-Graphic watermark element */}
            <Compass className={cn("absolute -right-16 -top-16 w-60 h-60 rotate-12 select-none opacity-5", themeAccent.text)} />
          </div>

          <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6 w-full">
            {/* Left Portion: Enlarged ID Circle Profile & Identity Details filling the space on the left and middle */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start xl:items-center gap-6 flex-1 min-w-0 w-full">
              {/* Custom Radial Wedge Fan Infographic SVG - Now perfectly positioned as the main Lot ID Identity Circle */}
              <div className="relative shrink-0 select-none group/avatar transition-all duration-300 flex items-center justify-center w-full max-w-[410px] h-[255px] -mt-5 md:-mt-8" id="lot-id-avatar-circle">
                {/* Subtle ambient glow behind the entire SVG */}
                <div className="absolute inset-2 rounded-full blur-2xl opacity-[0.04] group-hover/avatar:opacity-[0.08] transition-opacity duration-500 pointer-events-none" style={{ backgroundColor: strokeColor }} />

                <svg className="w-full h-full relative z-10" viewBox="-60 -110 440 300" overflow="visible">
                  <defs>
                    {/* Subtle shadows for the wedges */}
                    <filter id="wedge-shadow" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
                    </filter>
                  </defs>

                  {/* Background Progress Guide Arcs for completeness */}
                  <circle cx="160" cy="112" r="198" fill="none" stroke={activeTheme.isDark ? "rgba(30,41,59,0.15)" : "rgba(226,232,240,0.35)"} strokeWidth="0.75" strokeDasharray="3 3" />
                  <circle cx="160" cy="112" r="90" fill="none" stroke={activeTheme.isDark ? "rgba(30,41,59,0.25)" : "rgba(226,232,240,0.5)"} strokeWidth="1" />

                  {/* Progress wedges rendered dynamically */}
                  {circleProgressWedges.map((wedge, idx) => {
                    const isActive = wedge.done;
                    return (
                      <g key={idx} className="transition-all duration-500 hover:opacity-95 cursor-pointer">
                        {/* Main wedge slice path */}
                        <path
                          d={wedge.path}
                          fill={isActive ? wedge.color : (activeTheme.isDark ? "rgba(30, 41, 59, 0.4)" : "rgba(241, 245, 249, 0.75)")}
                          stroke={isActive ? "rgba(255, 255, 255, 0.2)" : (activeTheme.isDark ? "rgba(15, 23, 42, 0.3)" : "rgba(203, 213, 225, 0.45)")}
                          strokeWidth="1.2"
                          filter={isActive ? "url(#wedge-shadow)" : undefined}
                          className="transition-all duration-500 ease-out"
                        />

                        {/* Miniature Label of the Checklist Stage inside/mid wedge - ENLARGED to 11px+ text for legibility */}
                        <text
                          x={wedge.labelX}
                          y={wedge.labelY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className={cn(
                            "text-[11.5px] sm:text-[12.5px] font-sans font-black tracking-tight transition-all duration-300 pointer-events-none select-none",
                            isActive
                              ? "fill-white/95 drop-shadow-[0_1.5px_1px_rgba(0,0,0,0.3)] font-black"
                              : (activeTheme.isDark ? "fill-slate-550" : "fill-stone-450")
                          )}
                        >
                          {wedge.name}
                        </text>

                        {/* Hover tooltip for quick viewing */}
                        <title>{`${wedge.name}: ${wedge.done ? "COMPLETED" : "PENDING"}`}</title>
                      </g>
                    );
                  })}

                  {/* Central Status Inner Circle and Core Badge group - BEAUTIFIED exactly like Lot ID design */}
                  <g transform="translate(0, 0)">
                    {/* Background thin progress track circle */}
                    <circle 
                      cx="160" 
                      cy="112" 
                      r="82" 
                      stroke={activeTheme.isDark ? "rgba(15, 23, 42, 0.4)" : "rgba(226, 232, 240, 0.75)"} 
                      strokeWidth="2.2" 
                      fill="none" 
                    />

                    {/* Outer Progress circle linked to the theme's strokeColor and lot progress, rotated to start at top */}
                    <g transform="rotate(-90 160 112)">
                      <circle 
                        cx="160" 
                        cy="112" 
                        r="82" 
                        stroke={strokeColor} 
                        strokeWidth="3.2" 
                        fill="none" 
                        strokeDasharray="515"
                        strokeDashoffset={515 - (515 * Math.round((circleProgressSteps.filter(s => s.done).length / 5) * 100)) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-out"
                      />
                    </g>

                    {/* Dynamic concentric decorative segmented bands precisely like the Lot ID circle */}
                    <g transform="rotate(-95 160 112)">
                      {/* Segment 1: Charcoal */}
                      <circle 
                        cx="160" 
                        cy="112" 
                        r="70" 
                        stroke={activeTheme.isDark ? "#1e293b" : "#334155"} 
                        strokeWidth="5" 
                        fill="none" 
                        strokeDasharray="130 309.8"
                        strokeDashoffset="0"
                      />
                      {/* Segment 2: White/Contrast */}
                      <circle 
                        cx="160" 
                        cy="112" 
                        r="70" 
                        stroke={activeTheme.isDark ? "#fafafa" : "#ffffff"} 
                        strokeWidth="5" 
                        fill="none" 
                        strokeDasharray="130 309.8"
                        strokeDashoffset="-146"
                      />
                      {/* Segment 3: Themed Accent color */}
                      <circle 
                        cx="160" 
                        cy="112" 
                        r="70" 
                        stroke={strokeColor} 
                        strokeWidth="5" 
                        fill="none" 
                        strokeDasharray="130 309.8"
                        strokeDashoffset="-292"
                      />
                    </g>

                    {/* Inner Solid Plate with the dark/light premium background face */}
                    <circle 
                      cx="160" 
                      cy="112" 
                      r="60" 
                      fill={activeTheme.isDark ? "#0f172a" : "#ffffff"} 
                      stroke={activeTheme.isDark ? "rgba(248, 250, 252, 0.05)" : "rgba(15, 23, 42, 0.05)"} 
                      strokeWidth="1" 
                      className="transition-all duration-300 shadow-inner" 
                    />

                    {/* ForeignObject perfectly centering the current LOT ID text inside the center core */}
                    <foreignObject x="94" y="44" width="132" height="132">
                      <div 
                        className="w-full h-full rounded-full flex flex-col items-center justify-center p-1 text-center select-none overflow-hidden relative cursor-pointer group/center"
                        onClick={() => {
                          copyFieldValue(selectedLot.lotId, "LOT_ID_CENTER");
                          showNoticeToast(`Control ID ${selectedLot.lotId} copied to clipboard.`);
                        }}
                        title="Click to Copy Lot ID"
                      >
                        {/* Inner slate background overlay layer */}
                        <div className={cn(
                          "absolute inset-0.5 rounded-full border transition-all duration-300 pointer-events-none group-hover/center:bg-slate-500/10",
                          activeTheme.isDark ? "border-white/[0.03] bg-slate-900/10" : "border-slate-900/[0.03] bg-stone-50/10"
                        )} />

                        <div className="relative z-10 flex flex-col items-center justify-center pb-0.5">
                          <span className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 scale-95 leading-none">
                            LOT ID
                          </span>
                          
                          {/* Real-time Lot ID value wrapping nicely in the center */}
                          <span 
                            className={cn(
                              "text-[20px] sm:text-[22px] font-black tracking-tight text-center mt-0.5 select-all font-display leading-none",
                              activeTheme.isDark ? "text-white" : "text-slate-900"
                            )}
                          >
                            {selectedLot.lotId}
                          </span>

                          {/* Dynamic milestone status pill requested by the user */}
                          <span 
                            className="text-[8.5px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-2 text-white leading-none shadow-3xs transition-all duration-300 transform group-hover/center:scale-105"
                            style={{ 
                              backgroundColor: 
                                activeMilestoneStatus === "H/O" ? "#27ae60" : 
                                activeMilestoneStatus === "PAID" ? "#70529d" : 
                                activeMilestoneStatus === "DOAS" ? "#1a7bb9" : 
                                activeMilestoneStatus === "OTB" ? "#e67e22" : 
                                activeMilestoneStatus === "NOT" ? "#e05638" : 
                                "#64748b" 
                            }}
                          >
                            {activeMilestoneStatus}
                          </span>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                </svg>

                {/* Embedded small Copy action button inside the avatar area next to circle */}
                <button
                  type="button"
                  onClick={() => {
                    copyFieldValue(selectedLot.lotId, "LOTID_BANNER");
                    showNoticeToast(`Lot Control No. ${selectedLot.lotId} copied to clipboard.`);
                  }}
                  className={cn(
                    "absolute bottom-2.5 right-[85px] p-1.5 rounded-full border shadow-md transition-all duration-300 transform scale-90 hover:scale-105 cursor-pointer z-20",
                    activeTheme.isDark 
                      ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850" 
                      : "bg-white border-stone-200 text-slate-650 hover:text-indigo-650 hover:bg-stone-50"
                  )}
                  title="Copy Lot ID"
                >
                  {copiedField === "LOTID_BANNER" || copiedField === "LOT_ID_CENTER" ? (
                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                  ) : (
                    <Copy className={cn("w-2.5 h-2.5", themeAccent.text)} />
                  )}
                </button>
              </div>

              {/* Identification details wrapping nicely inside the flex-1 middle area */}
              <div className="space-y-3 text-center lg:text-left flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 select-none font-mono text-[9px] font-extrabold font-black">
                  <span className={cn("px-3 py-1 uppercase tracking-widest rounded-full border shadow-3xs font-black", themeAccent.bg10)}>
                    {selectedLot.cp}
                  </span>
                  <span className={cn("px-3 py-1 rounded-full uppercase tracking-widest border font-black border-slate-550/10 shadow-3xs", activeTheme.isDark ? "bg-slate-950 text-slate-400" : "bg-stone-50/75 text-stone-600")}>
                    {selectedLot.station || "MAINLINE UNK"}
                  </span>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-550 uppercase tracking-widest rounded-full border border-amber-500/10 shadow-3xs font-black">
                    {selectedLot.lgu}
                  </span>
                  {selectedLot.zone && (
                    <span className={cn("px-3 py-1 uppercase tracking-widest rounded-full border font-black shadow-3xs", activeTheme.isDark ? "bg-slate-950/60 text-slate-400 border-slate-800" : "bg-stone-50 text-stone-500 border-stone-200")}>
                      ZONE {selectedLot.zone}
                    </span>
                  )}
                  {selectedLot.currentStatus && (
                    <span 
                      className={cn(
                        "px-3 py-1 uppercase tracking-widest rounded-full border shadow-3xs font-extrabold flex items-center gap-1.5 transition-all duration-300",
                        activeTheme.isDark ? "bg-slate-950/45" : "bg-stone-50"
                      )}
                      style={{
                        borderColor: `${strokeColor}44`,
                        color: strokeColor,
                        boxShadow: `0 2px 8px -2px ${strokeColor}15`
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse shrink-0" style={{ backgroundColor: strokeColor }} />
                      <span className="opacity-95">STATUS: {selectedLot.currentStatus}</span>
                    </span>
                  )}
                  {selectedLot.acquiredLots && (
                    <span 
                      className={cn(
                        "px-3 py-1 uppercase tracking-widest rounded-full border shadow-3xs font-extrabold flex items-center gap-1.5 transition-all duration-300",
                        activeTheme.isDark ? "bg-slate-950/45 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full inline-block bg-emerald-500 shrink-0" />
                      <span className="opacity-95">ACQUIRED LOTS (COL BS): {selectedLot.acquiredLots}</span>
                    </span>
                  )}
                </div>

                <div className="space-y-0.5">
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Registered Landowner / Titleholder
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <h1 className={cn(
                      "text-2.5xl font-black tracking-tight leading-tight transition-colors duration-300 font-display flex-1 min-w-0",
                      activeTheme.isDark ? "text-white" : "text-slate-900"
                    )}>
                      {selectedLot.ownerName || "— Unregistered No Name Owner —"}
                    </h1>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Portion: Custom Ribbon Chevron Step Timeline Indicator precisely matching user reference */}
            <div className="shrink-0 w-full xl:w-[48%] flex flex-col gap-3.5 select-none lg:ml-auto xl:pl-4" id="lot-checklist-step-ribbon-infographic">
              {/* Dynamic Overall Progress Header */}
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className={cn(
                    "text-[8.5px] font-black uppercase tracking-[0.18em]",
                    activeTheme.isDark ? "text-slate-550" : "text-stone-400"
                  )}>
                    Overall Acquisition Progress
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black tracking-tight text-indigo-650 dark:text-indigo-400 font-display">
                      {selectedLot._progress}%
                    </span>
                    <span className="text-[9px] font-black text-slate-500 uppercase dark:text-slate-400 font-mono">
                      COMPLETE
                    </span>
                  </div>
                </div>

                <div className={cn(
                  "px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider font-mono shadow-3xs flex items-center gap-1.5",
                  activeTheme.isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-white border-stone-200 text-stone-600"
                )}>
                  <Activity className="w-3 h-3 text-indigo-500 shrink-0" />
                  Mile {progressSteps.filter(s => s.done).length} of 7 Reached
                </div>
              </div>

              {/* Step Sequence Ribbons Row */}
              <div className="flex flex-row items-stretch gap-2 w-full overflow-x-auto pb-3.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 snap-x select-none">
                {progressSteps.map((step, idx) => {
                  const isDone = step.done;
                  const stepNumber = `0${idx + 1}`;
                  // Arrow ribbon shape via CSS clip-path polygon
                  const isFirst = idx === 0;
                  const clipPathStr = isFirst 
                    ? "polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%)" 
                    : "polygon(0% 0%, 82% 0%, 100% 50%, 82% 100%, 0% 100%, 15% 50%)";

                  // Saturated dynamic wedge theme colors corresponding perfectly to the left radial wedges
                  const colors = [
                    "#eab308", // Yellow (NoT)
                    "#f97316", // Orange (OTB)
                    "#ef4444", // Red (OTB REPLY)
                    "#a855f7", // Purple (DATE REPLY)
                    "#06b6d4", // Cyan (DOAS)
                    "#3b82f6", // Blue (PAID)
                    strokeColor // Theme Specific Accent (H/O)
                  ];
                  const stepColor = colors[idx] || strokeColor;

                  const stepDescriptions = [
                    "Notice of Taking",
                    "Offer to Buy",
                    "Reply Status",
                    "Reply Date",
                    "Deed of Sale",
                    "Payment Status",
                    "Handover Status"
                  ];

                  const icons = [
                    FileText,
                    Coins,
                    Check,
                    Calendar,
                    FileText,
                    Coins,
                    CheckCircle2
                  ];
                  const StepIcon = icons[idx] || FileText;

                  return (
                    <div 
                      key={idx} 
                      className={cn(
                        "flex-1 min-w-[108px] flex flex-col rounded-xl border overflow-hidden shadow-4xs snap-center transition-all duration-300 hover:scale-[1.015]",
                        activeTheme.isDark 
                          ? isDone ? "border-slate-800 bg-slate-900/50" : "border-slate-850/60 bg-slate-950/20 opacity-40 hover:opacity-60"
                          : isDone ? "border-stone-200 bg-white" : "border-stone-200/60 bg-stone-50/50 opacity-40 hover:opacity-60"
                      )}
                    >
                      {/* Ribbon Arrow Header */}
                      <div 
                        style={{ 
                          clipPath: clipPathStr, 
                          backgroundColor: isDone ? stepColor : undefined 
                        }}
                        className={cn(
                          "w-full text-center py-2.5 relative select-none",
                          isDone 
                            ? "text-white font-black" 
                            : activeTheme.isDark ? "bg-slate-850 text-slate-500 font-bold" : "bg-stone-200 text-stone-500 font-bold"
                        )}
                      >
                        <div className={cn(
                          "text-[9px] uppercase tracking-widest flex items-center justify-center gap-0.5",
                          isFirst ? "pr-1" : "pl-3.5 pr-1"
                        )}>
                          <span>STEP</span>
                          <span className="font-mono text-[9.5px] pr-1">{stepNumber}</span>
                        </div>
                      </div>

                      {/* Card Content Area containing Icon, Option Name, Description Subtitle precisely like the mockup */}
                      <div className="p-2 w-full flex flex-col items-center justify-center text-center flex-1 gap-2.5">
                        <div 
                          className={cn(
                            "p-1.5 rounded-full border shadow-4xs shrink-0 transition-transform duration-550",
                            isDone ? "border-slate-550/5 bg-slate-500/5" : "border-transparent"
                          )}
                          style={{ color: isDone ? stepColor : undefined }}
                        >
                          <StepIcon className="w-4 h-4" />
                        </div>

                        {/* Title text */}
                        <div className={cn(
                          "text-[10px] font-black tracking-tight uppercase leading-none font-sans mt-0.5",
                          isDone 
                            ? activeTheme.isDark ? "text-white" : "text-slate-850"
                            : "text-slate-400 dark:text-slate-650"
                        )}>
                          {step.name}
                        </div>

                        {/* Dynamic Custom Date / Meta values based on user's exact specification */}
                        <div className="w-full flex flex-col gap-1 select-all font-mono">
                          {idx === 0 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.dateNot && selectedLot.dateNot !== "-" && selectedLot.dateNot !== "No Data" && selectedLot.dateNot !== ""
                                ? activeTheme.isDark ? "text-indigo-400" : "text-indigo-650"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.dateNot || "—"}
                            </span>
                          )}
                          {idx === 1 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.dateOtb && selectedLot.dateOtb !== "-" && selectedLot.dateOtb !== "No Data" && selectedLot.dateOtb !== ""
                                ? activeTheme.isDark ? "text-indigo-400" : "text-indigo-650"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.dateOtb || "—"}
                            </span>
                          )}
                          {idx === 2 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.otbReply && selectedLot.otbReply !== "-" && selectedLot.otbReply !== "No Data" && selectedLot.otbReply !== ""
                                ? activeTheme.isDark ? "text-yellow-400" : "text-yellow-600"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.otbReply || "—"}
                            </span>
                          )}
                          {idx === 3 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.otbReplyDate && selectedLot.otbReplyDate !== "-" && selectedLot.otbReplyDate !== "No Data" && selectedLot.otbReplyDate !== ""
                                ? activeTheme.isDark ? "text-indigo-400" : "text-indigo-655"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.otbReplyDate || "—"}
                            </span>
                          )}
                          {idx === 4 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.dateDoas && selectedLot.dateDoas !== "-" && selectedLot.dateDoas !== "No Data" && selectedLot.dateDoas !== ""
                                ? activeTheme.isDark ? "text-indigo-400" : "text-indigo-655"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.dateDoas || "—"}
                            </span>
                          )}
                          {idx === 5 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.datePaid && selectedLot.datePaid !== "-" && selectedLot.datePaid !== "No Data" && selectedLot.datePaid !== ""
                                ? activeTheme.isDark ? "text-emerald-400" : "text-emerald-600"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.datePaid || "—"}
                            </span>
                          )}
                          {idx === 6 && (
                            <span className={cn(
                              "text-[10.5px] sm:text-[11px] font-black tracking-tight leading-normal truncate max-w-full px-0.5",
                              selectedLot.dateHo && selectedLot.dateHo !== "-" && selectedLot.dateHo !== "No Data" && selectedLot.dateHo !== ""
                                ? activeTheme.isDark ? "text-teal-400" : "text-teal-600"
                                : "text-slate-400 dark:text-slate-600"
                            )}>
                              {selectedLot.dateHo || "—"}
                            </span>
                          )}
                        </div>
 
                        {/* Complete/Pending Status Pill at the very bottom labeled as REMARKS */}
                        <div className="w-full flex items-center justify-center font-mono">
                          {isDone ? (
                            <span className="text-emerald-555 font-black uppercase flex items-center gap-0.5 justify-center text-[8.5px] tracking-wider leading-none">
                              <Check className="w-2.5 h-2.5 shrink-0 stroke-[3]" />
                              DONE
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-650 font-black text-[8.5px] tracking-wider leading-none">PENDING</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sleek Navigation Tabs updated with Snapshot Printout & Quick Find on the right */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mt-8 border-t border-slate-550/10 pt-5 select-none text-[9.5px] w-full">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "general", label: "Basic & Location", icon: MapPin },
                { key: "tech", label: "Technical Metrics", icon: Ruler },
                { key: "costs", label: "Costs & Appraisals", icon: Coins },
                { key: "milestones", label: "Acquisition Milestones", icon: Activity },
                { key: "supplemental", label: "Secure Vault Documents", icon: FileText },
                { key: "comments", label: `Comments & Notes (${notesList.length})`, icon: MessageSquare },
                { key: "update", label: "Update Sheet Status", icon: FileEdit }
              ].map((tab) => {
                const isSel = selectedTab === tab.key;
                const isUpdateTab = tab.key === "update";
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSelectedTab(tab.key as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden border",
                      isSel 
                        ? isUpdateTab
                          ? "bg-emerald-600 hover:bg-emerald-550 text-white shadow-md shadow-emerald-600/30 border-emerald-500 font-extrabold"
                          : `bg-gradient-to-r ${activeTheme.primaryGradient} text-white shadow-md ${activeTheme.primaryShadow} border-transparent font-extrabold` 
                        : isUpdateTab
                          ? "text-emerald-700 dark:text-emerald-300 hover:text-white bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300/80 dark:border-emerald-700/60 hover:bg-emerald-600 dark:hover:bg-emerald-600 font-extrabold shadow-xs"
                          : activeTheme.isDark 
                            ? "text-slate-400 hover:text-white bg-slate-900 border-slate-805 hover:bg-slate-850" 
                            : "text-stone-500 hover:text-indigo-650 bg-stone-50 border-stone-205 hover:bg-stone-100"
                    )}
                    aria-label={`View ${tab.label} content`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Quick Find Search box on the right */}
            <div className="xl:ml-auto w-full sm:w-auto">
              {/* Optimized Quick Search Component to prevent keystroke lag */}
              <QuickSearchBox
                preprocessedAll={preprocessedAll}
                activeTheme={activeTheme}
                onSelectLot={(lot) => {
                  setSelectedLotId(lot.id);
                  trackLotAccess(lot.lotId);
                  setFilterCp("ALL");
                  setFilterStatus("ALL");
                  setFilterLgu("ALL");
                  setFilterBarangay("ALL");
                  setFilterMode("ALL");
                }}
              />
            </div>
          </div>
        </header>
      ) : (
        <header className={cn(
          "rounded-[2.2rem] border p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative overflow-hidden transition-all duration-300 shadow-sm print:hidden",
          activeTheme.isDark ? "bg-slate-900 border-slate-850" : "bg-white border-stone-200"
        )}>
          <div className="text-center py-6 w-full">
            <span className="text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold text-xs">No Lot Data Selected or Matches Filters</span>
          </div>
        </header>
      )}

      {/* RECENTLY VIEWED PARCELS CONTROL CARD */}
      <div className={cn(
        "rounded-[1.6rem] border p-4.5 xl:p-5 shadow-sm select-none transition-all duration-300 relative overflow-hidden print:hidden",
        activeTheme.isDark 
          ? "bg-slate-950/80 border-slate-800/80 backdrop-blur-xl" 
          : "bg-white/95 border-stone-200/90 backdrop-blur-xl shadow-md shadow-stone-100/50"
      )}>
        {/* Subtle royal background glow accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

        {/* QUICK VIEW RECENTS LOGS ROW */}
        <div className="flex flex-col md:flex-row md:items-center gap-3.5 relative z-10 select-none">
          <div className="flex items-center gap-1.5 text-[9.5px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] shrink-0">
            <History className="w-4 h-4 shrink-0 text-indigo-500 dark:text-indigo-400" />
            RECENTLY VIEWED PARCELS:
          </div>
          {recentLots.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {recentLots.map(id => {
                const lotObj = preprocessedAll.find(x => x.lotId === id);
                const isSel = selectedLot?.lotId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      if (lotObj) setSelectedLotId(lotObj.id);
                    }}
                    className={cn(
                      "px-3.5 py-1.5 text-[9.5px] font-black uppercase tracking-wider font-mono rounded-xl border transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
                      isSel
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-xs shadow-indigo-500/20 font-extrabold"
                        : activeTheme.isDark
                          ? "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-slate-100 hover:border-slate-750"
                          : "bg-white border-stone-200 text-stone-750 hover:bg-stone-50 hover:text-stone-950 hover:border-stone-300"
                    )}
                  >
                    {id}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 italic uppercase tracking-wider">
              No recently viewed parcels yet. Select a parcel from the registry sidebar or maps to start tracking history!
            </span>
          )}
        </div>
      </div>

      {/* THREE MODULE SPLIT GRID DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:hidden">
        
        {/* SIDEBAR NAVIGATION REGISTRY */}
        {!isModalMode && (
          <aside className={cn(
            "lg:col-span-4 xl:col-span-3 rounded-[2.5rem] border shadow-md p-6 space-y-5 lg:sticky lg:top-4 transition-all duration-300 self-start",
            activeTheme.isDark ? "bg-slate-950 border-slate-800" : "bg-white border-stone-250"
          )}>
          {/* Senior-Friendly Quick Lookup Portal header */}
          <div className="border-b border-slate-550/10 pb-4 select-none">
            <div className="flex items-center gap-2 mb-1.5">
              <Search className="w-5 h-5 text-indigo-500 shrink-0" />
              <span className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                FIND PARCEL
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-450 uppercase tracking-wide leading-normal">
              Locate records instantly by typing landowner name, lot ID, or control no.
            </p>
          </div>

          {/* Large text hunt box */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
              Search Owner, Lot ID or Control No:
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Type here..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(
                  "w-full pl-11 pr-10 py-3.5 border rounded-2xl outline-none transition-all font-bold text-sm focus:ring-4 focus:ring-indigo-500/10",
                  activeTheme.isDark 
                    ? "bg-slate-900 text-slate-100 border-slate-800 focus:border-indigo-500 text-sm placeholder-slate-500" 
                    : "bg-stone-50 text-stone-900 border-stone-300 focus:border-indigo-500 focus:bg-white placeholder-stone-400"
                )}
              />
              {search && (
                <button 
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-150 shrink-0 cursor-pointer p-1.5 rounded-full hover:bg-slate-500/10"
                  title="Clear text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Groupings Mode switch (as-is in layout per feedback) */}
          <div className="border-t border-slate-550/10 pt-4 flex flex-col gap-2 select-none">
            <label className="text-[10.5px] font-black text-slate-705 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              📁 GROUP BY CATEGORY (Folders)
            </label>
            <select
              value={groupMode}
              onChange={(e) => { setGroupMode(e.target.value as any); setVisibleCount(25); }}
              className={cn(
                "w-full px-3 py-3 border rounded-xl text-xs font-bold outline-none cursor-pointer transition-all shadow-xs focus:ring-4 focus:ring-indigo-500/10",
                activeTheme.isDark 
                  ? "bg-slate-900 border-slate-800 text-slate-100 focus:border-indigo-550" 
                  : "bg-stone-50 border-stone-250 text-stone-800 focus:bg-white focus:border-stone-400"
              )}
            >
              <option value="NONE">No Folders (Plain List)</option>
              <option value="CP">Group by Contract Package (CP Folders)</option>
              <option value="RAP_CP">Group by RAP Contract Package (Column BQ Folders)</option>
              <option value="LGU">Group by Municipality (LGU Folders)</option>
              <option value="RAP_LGU">Group by RAP LGU (Column BR Folders)</option>
              <option value="BARANGAY">Group by Site Access Date (Date Folders)</option>
              <option value="STATUS">Group by Disbursement Status (Payment Folders)</option>
            </select>
          </div>

          {/* SINGLE SLICED INSTANT RESPONSIVE LIST */}
          <div className="space-y-1.5 max-h-[460px] overflow-y-auto custom-scrollbar pr-1 pt-4 border-t border-slate-550/10">
            {displayedLots.length === 0 ? (
              <div className="py-12 text-center text-slate-450 select-none">
                <AlertTriangle className="w-8 h-8 text-indigo-400/50 mx-auto mb-2 animate-pulse" />
                <p className="text-[11px] font-black tracking-wide uppercase">No lots matched</p>
                <p className="text-[9.5px] text-slate-500 mt-1 italic font-medium">Verify your filters</p>
              </div>
            ) : groupMode === "NONE" ? (
              <>
                {displayedLots.slice(0, visibleCount).map((lot) => {
                  const isSelected = selectedLot?.id === lot.id;
                  const isPaid = (lot.paymentStatus || "").toUpperCase().includes("FULLY PAID");
                  const isPartial = (lot.paymentStatus || "").toUpperCase().includes("PARTIALLY") || (lot.paymentStatus || "").toUpperCase().includes("WOP");
                  const isOtb = (lot.statusRfd || "").toUpperCase().includes("DELIVERED") || (lot.statusOtb || "").toUpperCase().includes("DELIVERED");
                  
                  return (
                    <button
                      key={lot.id}
                      type="button"
                      onClick={() => {
                        setSelectedLotId(lot.id);
                        trackLotAccess(lot.lotId);
                      }}
                      className={cn(
                        "w-full p-3 rounded-2xl border text-left cursor-pointer transition-all duration-200 group relative overflow-hidden select-none block",
                        isSelected 
                          ? "border-indigo-550 bg-indigo-500/5 shadow-inner" 
                          : activeTheme.isDark 
                            ? "bg-slate-900/40 border-slate-850 hover:bg-slate-900/85 hover:border-slate-800" 
                            : "bg-white border-stone-150 hover:bg-stone-50/50 hover:border-stone-200"
                      )}
                    >
                      {/* Active indicator bar */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                      )}

                      <div className="flex items-start justify-between gap-1.5">
                        <span className={cn(
                          "text-xs font-black font-mono tracking-tight",
                          isSelected ? "text-indigo-505" : activeTheme.isDark ? "text-slate-100" : "text-stone-850"
                        )}>
                          {lot.lotId}
                        </span>
                        
                        {/* Compact Badge status identifier */}
                        {isPaid ? (
                          <span className="text-[7px] font-extrabold tracking-widest bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-mono uppercase">PAID</span>
                        ) : isPartial ? (
                          <span className="text-[7px] font-extrabold tracking-widest bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded font-mono uppercase">PARTIAL</span>
                        ) : isOtb ? (
                          <span className="text-[7px] font-extrabold tracking-widest bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono uppercase">OTB</span>
                        ) : (
                          <span className="text-[7px] font-extrabold tracking-widest bg-slate-500/10 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">PENDING</span>
                        )}
                      </div>

                      <p className={cn(
                        "text-[9.5px] font-extrabold uppercase truncate mt-2 leading-none",
                        activeTheme.isDark ? "text-slate-300" : "text-stone-750"
                      )}>
                        {lot.ownerName || "— Unregistered —"}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-550/5 text-[8px] text-slate-450 font-mono">
                        <span className="truncate">
                          {lot.cp}
                          {lot.barangay && lot.barangay !== "-" && lot.barangay !== "No Data" && ` • ${lot.barangay}`}
                          {lot.controlNo && lot.controlNo !== "-" && lot.controlNo !== "No Data" && ` • CN: ${lot.controlNo}`}
                        </span>
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 transition-transform shrink-0",
                          isSelected ? "translate-x-0.5 text-indigo-500" : "text-slate-500 group-hover:translate-x-0.5"
                        )} />
                      </div>
                    </button>
                  );
                })}

                {/* Snappy Lazy-Load items controller */}
                {displayedLots.length > visibleCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + 25)}
                    className="w-full flex items-center justify-center p-2.5 rounded-xl border border-dashed border-slate-550/15 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-400 transition-all cursor-pointer mt-1"
                  >
                    Load More (+{Math.min(25, displayedLots.length - visibleCount)} matches)
                  </button>
                )}
              </>
            ) : (
              /* Structurally Foldered Categorized Rendering */
              (Object.entries(groupedLots || {}) as [string, PreprocessedLot[]][]).map(([groupTitle, groupItems]) => (
                <div key={groupTitle} className="mb-4">
                  {/* Folder container */}
                  <div className={cn(
                    "px-2.5 py-1.5 mb-1.5 rounded-xl text-[8.5px] font-black uppercase tracking-widest flex items-center justify-between border-l-2 select-none border-l-indigo-550",
                    activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-stone-100 border-stone-200 text-stone-600"
                  )}>
                    <span className="truncate">{groupTitle}</span>
                    <span className="shrink-0 font-mono text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.2 rounded font-black">
                      {groupItems.length}
                    </span>
                  </div>

                  <div className="space-y-1 pl-1 border-l border-slate-550/5 ml-1">
                    {groupItems.slice(0, 10).map((lot) => {
                      const isSelected = selectedLot?.id === lot.id;
                      const isPaid = (lot.paymentStatus || "").toUpperCase().includes("FULLY PAID");
                      const isPartial = (lot.paymentStatus || "").toUpperCase().includes("PARTIALLY") || (lot.paymentStatus || "").toUpperCase().includes("WOP");

                      return (
                        <button
                          key={lot.id}
                          type="button"
                          onClick={() => {
                            setSelectedLotId(lot.id);
                            trackLotAccess(lot.lotId);
                          }}
                          className={cn(
                            "w-full p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-150 group block relative select-none",
                            isSelected 
                              ? "border-indigo-550 bg-indigo-500/5" 
                              : activeTheme.isDark 
                                ? "bg-slate-900/10 border-slate-850 hover:bg-slate-900/40" 
                                : "bg-white border-stone-150 hover:bg-stone-50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className={cn(
                              "text-[10.5px] font-black font-mono tracking-tight",
                              isSelected ? "text-indigo-500" : activeTheme.isDark ? "text-slate-100" : "text-stone-750"
                            )}>
                              {lot.lotId}
                            </span>
                            {isPaid ? (
                              <span className="text-[6.5px] font-black bg-emerald-500/10 text-emerald-500 px-1 py-0.2 rounded uppercase">PAID</span>
                            ) : isPartial ? (
                              <span className="text-[6.5px] font-black bg-indigo-500/10 text-indigo-500 px-1 py-0.2 rounded uppercase">PARTIAL</span>
                            ) : (
                              <span className="text-[6.5px] font-black bg-slate-500/10 text-slate-400 px-1 py-0.2 rounded uppercase font-mono">PEND</span>
                            )}
                          </div>
                          <p className={cn(
                            "text-[8.5px] font-extrabold uppercase truncate mt-1 leading-none",
                            activeTheme.isDark ? "text-slate-400" : "text-stone-605"
                          )}>
                            {lot.ownerName || "— Unregistered —"}
                          </p>

                          <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-550/5 text-[7.5px] text-slate-450 font-mono">
                            <span className="truncate">
                              {lot.cp}
                              {lot.barangay && lot.barangay !== "-" && lot.barangay !== "No Data" && ` • ${lot.barangay}`}
                              {lot.controlNo && lot.controlNo !== "-" && lot.controlNo !== "No Data" && ` • CN: ${lot.controlNo}`}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                    {groupItems.length > 10 && (
                      <p className="text-[8px] font-bold text-slate-450 italic pl-2.5 pt-0.5 uppercase tracking-wide">
                        + {groupItems.length - 10} more in folder index. Filter search to narrow.
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
        )}

        {/* PROFILE WORKSPACE LAYOUT */}
        <main className={cn(isModalMode ? "lg:col-span-12 xl:col-span-12 w-full" : "lg:col-span-8 xl:col-span-9", "space-y-6")}>
          {selectedLot ? (
            <div className="space-y-6">
              {/* ACTIVE TAB WORKSPACE AREA */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  
                  {/* TAB 1: BASIC INFO & GEOGRAPHIC SCALE */}
                  {selectedTab === "general" && (
                    <motion.div
                      key="general"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {/* Location scope cards */}
                      <div className={cn(
                        "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                      )}>
                        <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-emerald-505" />
                          Geographical Location Settings
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-0.5">
                          <RenderField label="MAINLINE STATION" value={selectedLot.station} />
                          <RenderField label="PIER" value={selectedLot.pierNo} />
                        </div>
                        <RenderField label="LGU/ MUNICIPALITY JURISDICTION" value={selectedLot.lgu} />
                        <RenderField label="RAP LGU (COLUMN BR)" value={selectedLot.rapLgu || selectedLot.lgu} />
                        <RenderField label="BARANGAY" value={selectedLot.barangay} />
                        <RenderField label="SITE ACCESS DATE" value={selectedLot.siteAccessDate} />
                        <RenderField label="ZONE" value={selectedLot.zone} />
                      </div>

                      {/* Admin/Legal Profile Cards */}
                      <div className={cn(
                        "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                      )}>
                        <h3 className={cn("font-extrabold text-[9.5px] uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1", themeAccent.text500)}>
                          <Building2 className={cn("w-3.5 h-3.5 shrink-0", themeAccent.text500)} />
                          Administrative Profile
                        </h3>
                        <RenderField label="CONTROL NO." value={selectedLot.controlNo} />
                        <RenderField label="CONTRACT PACKAGE (CP)" value={selectedLot.cp} />
                        <RenderField label="RAP CP (COLUMN BQ)" value={selectedLot.rapCp || selectedLot.cp} />
                        <RenderField label="PRIMARY MODE OF ACQUISITION" value={selectedLot.modeAcquisition} />
                        {((selectedLot.modeAcquisition && selectedLot.modeAcquisition.toUpperCase().includes("EXPRO")) || selectedLot.exproStatus) && (
                          <RenderField label="EXPROPRIATION STATUS (COLUMN AT)" value={selectedLot.exproStatus || "N/A"} />
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <RenderField label="OWNER CLASSIFICATION" value={selectedLot.ownerClassification} />
                          <RenderField label="OPTIMIZATION CASES" value={selectedLot.optimizationCases || selectedLot.harmonization} />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 2: TECHNICAL SPATIAL GAUGE */}
                  {selectedTab === "tech" && (
                    <motion.div
                      key="tech"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {/* Spatial measurements profile */}
                      <div className={cn(
                        "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                      )}>
                        <h3 className={cn("font-extrabold text-[9.5px] uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1", themeAccent.text500)}>
                          <Ruler className={cn("w-3.5 h-3.5 shrink-0", themeAccent.text500)} />
                          Spatial Footprint Calculations
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-0.5">
                          <RenderField label="PROW Impact" value={selectedLot.prowImpact} />
                          <RenderField label="TOTAL AREA" value={selectedLot.totalArea} isArea />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-1">
                          <RenderField label="Affected Area" value={selectedLot.affectedArea} isArea />
                          <RenderField label="Remaining Lot Area" value={selectedLot.remainingArea} isArea />
                        </div>

                        {/* Interactive dynamic visual proportion scale graph */}
                        {selectedLot.totalArea > 0 && selectedLot.affectedArea > 0 && (
                          <div className="pt-2 border-t border-slate-550/10 space-y-1.5">
                            <div className="flex justify-between items-center text-[8px] font-black text-slate-400 uppercase tracking-widest">
                              <span>ROW Occupancy Footprint Ratio</span>
                              <span className={themeAccent.text500}>
                                {Math.round((selectedLot.affectedArea / selectedLot.totalArea) * 100)}% affected
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-850 overflow-hidden flex shadow-inner">
                              <div 
                                className="h-full bg-rose-500 transition-all duration-500" 
                                style={{ width: `${Math.min(100, (selectedLot.affectedArea / selectedLot.totalArea) * 100)}%` }} 
                                title="Affected Area portion"
                              />
                              <div 
                                className="h-full bg-emerald-500 transition-all duration-500" 
                                style={{ width: `${Math.max(0, 100 - (selectedLot.affectedArea / selectedLot.totalArea) * 100)}%` }} 
                                title="Remaining free portion"
                              />
                            </div>
                            <div className="flex justify-between text-[6.5px] font-black uppercase tracking-wider text-slate-500 pt-0.5">
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" /> Affected ROW footprint</span>
                              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" /> Remaining free spacing</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Overlying Buildings Info */}
                      {(() => {
                        const structures = parseStructureOverlay(selectedLot);
                        const hasStructures = structures.length > 0;
                        return (
                          <div className={cn(
                            "rounded-2xl border p-4 shadow-2xs relative overflow-hidden flex flex-col justify-between",
                            activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                          )}>
                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-550/10 pb-2 mb-2.5 select-none font-mono">
                                <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                  Structural Improvement overlay
                                </h3>
                                
                                {hasStructures && (
                                  <div className="flex items-center gap-1.5 self-start sm:self-auto font-mono text-[7px] font-black tracking-widest uppercase">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full border shrink-0",
                                      activeTheme.isDark 
                                        ? "bg-amber-950/30 text-amber-400 border-amber-900/40" 
                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                    )}>
                                      {structures.length} {structures.length === 1 ? "STRUCTURE" : "STRUCTURES"}
                                    </span>
                                    {(() => {
                                      const uniqueOwners = new Set(structures.map(s => s.owner).filter(o => o && o !== "—" && o !== "-")).size;
                                      if (uniqueOwners > 1) {
                                        return (
                                          <span className={cn(
                                            "px-2.5 py-1 rounded-full border shrink-0",
                                            activeTheme.isDark 
                                              ? "bg-indigo-950/30 text-indigo-400 border-indigo-900/40" 
                                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                          )}>
                                            {uniqueOwners} UNIQUE OWNERS
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                )}
                              </div>

                              {!hasStructures ? (
                                <div className="flex flex-col items-center justify-center text-center py-10 px-4 select-none">
                                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-850 flex items-center justify-center mb-3">
                                    <Layers className="w-4 h-4 text-slate-405 dark:text-slate-500 shrink-0" />
                                  </div>
                                  <span className="text-[10px] font-black text-slate-405 dark:text-slate-500 uppercase tracking-widest leading-normal mb-1">
                                    No Structures Registered
                                  </span>
                                  <p className="text-[9px] text-slate-400 max-w-xs leading-relaxed">
                                    No overlying physical buildings or structural clearance footprint recorded for this lot index profile.
                                  </p>
                                </div>
                              ) : (
                                <div className="overflow-x-auto -mx-6 px-6">
                                  <table className="w-full text-left border-collapse table-auto">
                                    <thead>
                                      <tr className="border-b border-slate-550/10 text-[8.5px] font-black tracking-[0.16em] text-slate-400/90 uppercase font-mono">
                                        <th className="pb-2.5 pl-2 pr-4 text-center w-8">#</th>
                                        <th className="pb-2.5 px-4 font-mono">Structure Tag</th>
                                        <th className="pb-2.5 px-4">Use / Classification</th>
                                        <th className="pb-2.5 pl-4 pr-2">Structure Owner</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-550/5">
                                      {structures.map((s, idxIndex) => (
                                        <tr 
                                          key={s.key} 
                                          className={cn(
                                            "group text-xs transition-colors duration-155",
                                            activeTheme.isDark ? "hover:bg-slate-850/20" : "hover:bg-slate-50/40"
                                          )}
                                        >
                                          <td className="py-3 px-2 text-center">
                                            <span className={cn(
                                              "inline-flex items-center justify-center w-[1.3rem] h-[1.3rem] rounded-full text-[8.5px] font-black font-mono shadow-3xs",
                                              activeTheme.isDark 
                                                ? "bg-slate-950 text-slate-400 border border-slate-855" 
                                                : "bg-slate-100 text-slate-705 border border-slate-200"
                                            )}>
                                              {s.key}
                                            </span>
                                          </td>
                                          <td className="py-3 px-4 font-mono font-bold tracking-tight text-slate-700 dark:text-slate-300">
                                            <span 
                                              className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-80 active:scale-[0.98]"
                                              onClick={() => {
                                                if (s.tag !== "—" && s.tag !== "-") {
                                                  navigator.clipboard.writeText(s.tag);
                                                  setCopiedField(`structure-tag-${idxIndex}`);
                                                  setTimeout(() => setCopiedField(null), 1500);
                                                }
                                              }}
                                              title="Click to copy tag code"
                                            >
                                              {s.tag}
                                              {s.tag !== "—" && s.tag !== "-" && (
                                                copiedField === `structure-tag-${idxIndex}` ? (
                                                  <Check className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                                ) : (
                                                  <Copy className="w-2.5 h-2.5 text-slate-455 dark:text-slate-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )
                                              )}
                                            </span>
                                          </td>
                                          <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-350">
                                            {s.use !== "—" && s.use !== "-" ? (
                                              <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-widest border font-mono shadow-3xs",
                                                (() => {
                                                  const lowerUse = s.use.toLowerCase();
                                                  if (lowerUse.includes("res") || lowerUse.includes("house") || lowerUse.includes("dwell")) {
                                                    return activeTheme.isDark 
                                                      ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/30" 
                                                      : "bg-emerald-50/80 text-emerald-700 border-emerald-100";
                                                  }
                                                  if (lowerUse.includes("com") || lowerUse.includes("shop") || lowerUse.includes("store")) {
                                                    return activeTheme.isDark 
                                                      ? "bg-indigo-950/20 text-indigo-400 border-indigo-900/30" 
                                                      : "bg-indigo-50/80 text-indigo-700 border-indigo-100";
                                                  }
                                                  return activeTheme.isDark 
                                                    ? "bg-slate-950 text-slate-400 border-slate-850" 
                                                    : "bg-slate-100/90 text-slate-620 border-slate-200";
                                                })()
                                              )}>
                                                {s.use}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 font-normal italic">—</span>
                                            )}
                                          </td>
                                          <td className="py-3 pl-4 pr-1 font-bold text-slate-800 dark:text-slate-200">
                                            {s.owner !== "—" && s.owner !== "-" ? (
                                              <div className="flex items-center gap-2">
                                                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate max-w-[200px]" title={s.owner}>
                                                  {s.owner}
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="text-slate-400 font-normal italic">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}

                  {/* TAB 3: APPRAISAL COSTS & ACTUALS DISBURSEMENT DIFFERENCES */}
                  {selectedTab === "costs" && (
                    <motion.div
                      key="costs"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {/* Appraisal valuations estimates */}
                      <div className={cn(
                        "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                      )}>
                        <h3 className={cn("font-extrabold text-[9.5px] uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1", themeAccent.text500)}>
                          <Coins className={cn("w-3.5 h-3.5 shrink-0", themeAccent.text500)} />
                          Estimated Valuations appraisals
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-0.5">
                          <RenderField label="Appraisal Year" value={selectedLot.appraisalYear} />
                          <RenderField label="ESTIMATED LAND COST" value={selectedLot.estimatedLandCost} isCurrency />
                        </div>
                        <RenderField label="STRUCTURE COST" value={selectedLot.estimatedStructureCost} isCurrency />
                        <RenderField label="LBP APPRAISAL VALUE" value={selectedLot.totalEstimatedCost} isCurrency />
                      </div>

                      {/* Actual clearances disbursements */}
                      <div className={cn(
                        "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                      )}>
                        <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1">
                          <Coins className="w-3.5 h-3.5 shrink-0 text-emerald-505" />
                          Actual Cleared Disbursements Paid
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-0.5">
                          <RenderField label="ACTUAL LAND COST" value={selectedLot.actualLandCost} isCurrency />
                          <RenderField label="ACTUAL STRUCTURE COST" value={selectedLot.actualStructureCost} isCurrency />
                        </div>
                        <RenderField label="ACTUAL CORP & TREE VALUATIONS" value={selectedLot.actualCropTree} />

                        {/* Variance gauge overview slider markup */}
                        {selectedLot.totalEstimatedCost > 0 && (
                          <div className="pt-2 border-t border-slate-550/10 space-y-1 select-none font-mono">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Actual Disbursement variance ratio</span>
                            <div className="flex justify-between items-center text-[10px] font-semibold">
                              <span className="text-slate-400">Total Clearance Payment:</span>
                              <span className={cn(
                                (selectedLot.paymentStatus || "").toUpperCase().includes("FULLY") ? "text-emerald-500" : "text-amber-500"
                              )}>
                                {formatCurrency((Number(selectedLot.actualLandCost) || 0) + (Number(selectedLot.actualStructureCost) || 0))}
                                {" "} / {formatCurrency(selectedLot.totalEstimatedCost)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 4: HISTORIC SEQUENCE MILESTONES ACTIONS PORTAL */}
                  {selectedTab === "milestones" && (
                    <motion.div
                      key="milestones"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-10"
                    >
                      {/* MAIN ACQUISITION TIMELINE CARD — UNIFORM THEME INFOGRAPHIC PANEL */}
                      <div className={cn(
                        "rounded-2xl border p-4 md:p-5 shadow-2xs relative overflow-visible",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60 text-slate-100" : "bg-white border-stone-200 text-slate-800"
                      )}>
                        
                        {/* Overall Progress & Status Header Segment */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-550/10 pb-3 mb-4 gap-3 select-none">
                          <div>
                            <span className="font-extrabold text-[9.5px] uppercase tracking-[0.25em] text-slate-450 select-none">
                              OVERALL ACQUISITION PROGRESS
                            </span>
                            {(() => {
                              const stepsKeys = ["NoT", "OTB", "OtbLoReply", "OtbDateReply", "DOAS", "Payment", "Handover"];
                              const doneCount = stepsKeys.filter(k => getMilestoneDetails(k, selectedLot).completed).length;
                              const percentage = Math.round((doneCount / stepsKeys.length) * 100);
                              return (
                                <div className="flex items-baseline gap-1.5 mt-0.5 select-none">
                                  <span className="font-black text-2xl md:text-3xl text-[#4f46e5] tracking-tighter leading-none">
                                    {percentage}%
                                  </span>
                                  <span className="font-extrabold text-[9.5px] tracking-widest text-slate-400 uppercase leading-none">
                                    COMPLETE
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          
                          {(() => {
                            const stepsKeys = ["NoT", "OTB", "OtbLoReply", "OtbDateReply", "DOAS", "Payment", "Handover"];
                            const doneCount = stepsKeys.filter(k => getMilestoneDetails(k, selectedLot).completed).length;
                            return (
                              <div className={cn(
                                "border px-4 py-2 rounded-full inline-flex items-center gap-2 shadow-2xs",
                                activeTheme.isDark 
                                  ? "border-slate-800 bg-slate-950 text-slate-350" 
                                  : "border-stone-200 bg-white text-slate-700"
                              )}>
                                <Sparkles className="w-3.5 h-3.5 text-[#4f46e5] animate-pulse" />
                                <span className="text-[10px] font-extrabold uppercase tracking-widest font-mono text-slate-500">
                                  MILE {doneCount} OF 7 REACHED
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Interactive Infographic 7-Step Vertical Process List */}
                        <div className="space-y-4 overflow-visible">
                          {(() => {
                            const mainSteps = [
                              { key: "NoT", num: "01", title: "NOT", color: "#e05638", icon: FileText, label: "Notice of Taking", valueField: selectedLot.dateNot },
                              { key: "OTB", num: "02", title: "OTB", color: "#e67e22", icon: Handshake, label: "Offer to Buy", valueField: selectedLot.dateOtb },
                              { key: "OtbLoReply", num: "03", title: "OTB REPLY", color: "#8cb127", icon: Check, label: "LO Reply", valueField: selectedLot.otbReply },
                              { key: "OtbDateReply", num: "04", title: "DATE REPLY", color: "#1a9c9f", icon: Calendar, label: "LO Response Date", valueField: selectedLot.otbReplyDate },
                              { key: "DOAS", num: "05", title: "DOAS", color: "#1a7bb9", icon: FileCheck, label: "DOAS Execution", valueField: selectedLot.dateDoas },
                              { key: "Payment", num: "06", title: "PAID", color: "#70529d", icon: Coins, label: "Payment Paid", valueField: selectedLot.datePaid },
                              { key: "Handover", num: "07", title: "H/O", color: "#27ae60", icon: Flag, label: "Handed Over", valueField: selectedLot.handedOver }
                            ];

                            return mainSteps.map((s) => {
                              const state = getMilestoneDetails(s.key, selectedLot);
                              const IconComp = s.icon;
                              const isActive = state.completed;
                              const isOngoing = state.ongoing;
                              const isFaded = !isActive && !isOngoing;
                              const sCol = (isActive || isOngoing) ? s.color : (activeTheme.isDark ? "#334155" : "#b8c5d6");

                              return (
                                <motion.div
                                  key={s.key}
                                  whileHover={{ x: 6, scale: 1.006 }}
                                  className={cn(
                                    "relative flex items-center w-full rounded-r-[2rem] rounded-l-xl overflow-visible shadow-3xs pl-24 min-h-[5.5rem] py-4 select-none border transition-all duration-300",
                                    activeTheme.isDark 
                                      ? "bg-slate-905 border-slate-850/80 text-slate-100" 
                                      : "bg-white border-stone-255 text-slate-805"
                                  )}
                                  style={{ borderLeft: `3px solid ${sCol}` }}
                                >
                                  {/* Left Side: Protruding Folded Ribbon */}
                                  <div 
                                    className="absolute left-[-10px] top-1/2 -translate-y-1/2 h-[3.4rem] w-20 rounded-r-full flex flex-col items-center justify-center text-white shadow-md z-15"
                                    style={{ backgroundColor: sCol }}
                                  >
                                    <IconComp className="w-5 h-5 text-white" />
                                    <span className="font-sans font-black text-[7.5px] text-center tracking-widest leading-none mt-1">STEP {s.num}</span>
                                    
                                    {/* Fold shadow triangle under */}
                                    <div 
                                      className="absolute left-0 bottom-[-6px] w-[10px] h-[6px]" 
                                      style={{ 
                                        backgroundColor: sCol,
                                        clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                                        filter: "brightness(0.55)"
                                      }} 
                                    />
                                  </div>

                                  {/* Center Content Segment */}
                                  <div className="flex-1 pr-14 md:pr-24">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <h4 
                                        className="text-[10px] md:text-[11.5px] font-black uppercase tracking-wider leading-none"
                                        style={{ color: sCol }}
                                      >
                                        {s.label}
                                      </h4>
                                      {isActive ? (
                                        <span className={cn(
                                          "text-[7px] font-mono font-black px-2 py-0.5 rounded-full border",
                                          activeTheme.isDark 
                                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/55" 
                                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                        )}>
                                          COMPLETED
                                        </span>
                                      ) : isOngoing ? (
                                        <span className={cn(
                                          "text-[7px] font-mono font-black px-2 py-0.5 rounded-full border animate-pulse",
                                          activeTheme.isDark 
                                            ? "bg-amber-950/40 text-amber-400 border-amber-900/55" 
                                            : "bg-amber-50 text-amber-600 border-amber-100"
                                        )}>
                                          ACTIVE STAGE
                                        </span>
                                      ) : (
                                        <span className={cn(
                                          "text-[7px] font-mono font-black px-2 py-0.5 rounded-full border",
                                          activeTheme.isDark 
                                            ? "bg-slate-950 text-slate-500 border-slate-850" 
                                            : "bg-slate-100 text-slate-400 border-slate-150"
                                        )}>
                                          PENDING
                                        </span>
                                      )}
                                    </div>
                                    <p className={cn(
                                      "text-[10px] md:text-[11.5px] font-bold mt-1.5 max-w-[650px] leading-relaxed",
                                      isFaded 
                                        ? activeTheme.isDark ? "text-slate-500" : "text-slate-400"
                                        : activeTheme.isDark ? "text-slate-300" : "text-stone-600"
                                    )}>
                                      {state.desc}
                                    </p>
                                  </div>

                                  {/* Right Side: Step Index Circle */}
                                  <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 select-none">
                                    <div 
                                      className="w-12 h-12 rounded-full flex items-center justify-center border transition-all duration-300"
                                      style={{ 
                                        borderColor: sCol,
                                        backgroundColor: isActive ? `${sCol}08` : "transparent"
                                      }}
                                    >
                                      <span 
                                        className="font-sans font-black text-xs md:text-sm tracking-tight"
                                        style={{ color: sCol }}
                                      >
                                        {s.num}
                                      </span>
                                    </div>
                                  </div>

                                </motion.div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* ADDITIONAL STATUS OVERVIEW ROW — Horizontal 3 ribbon sections */}
                      <div className={cn(
                        "rounded-2xl border p-4 md:p-5 shadow-2xs space-y-4 relative overflow-visible",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60 text-slate-100" : "bg-white border-stone-200 text-slate-800"
                      )}>
                        
                        <div className="flex items-center justify-between border-b border-slate-550/10 pb-2 select-none">
                          <div className="flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <h3 className="font-extrabold text-[9.5px] uppercase tracking-[0.24em] text-slate-500">
                              ADDITIONAL STATUS OVERVIEW ROW
                            </h3>
                          </div>
                          <span className={cn(
                            "text-[7px] tracking-[0.15em] font-black px-2.5 py-1 rounded-full border font-mono text-right",
                            activeTheme.isDark 
                              ? "bg-slate-950 border-slate-800 text-slate-500" 
                              : "bg-stone-50 border-stone-200 text-stone-500"
                          )}>
                            AUXILIARY INDICATORS
                          </span>
                        </div>

                        {/* Three clean sections with horizontal folding ribbons */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 select-none overflow-visible">
                          {[
                            { key: "PartiallyPaid", keyLabel: "PARTIALLY PAID", title: "Partially Paid", desc: "Displays partial voucher logs status", color: "#f59e0b", icon: Percent },
                            { key: "PTE", keyLabel: "WITH PTE", title: "With PTE", desc: "Shows signed Permit to Enter records", color: "#06b6d4", icon: Compass },
                            { key: "CnoMoa", keyLabel: "WITH CNO", title: "With CNO", desc: "Confirms signed CNO compromise agreements", color: "#6366f1", icon: FileSignature }
                          ].map((m) => {
                            const state = getMilestoneDetails(m.key, selectedLot);
                            const isActive = state.completed;
                            const activeColor = m.color;
                            const sCol = isActive ? activeColor : (activeTheme.isDark ? "#334155" : "#b8c5d6");
                            const IconComp = m.icon;

                            return (
                              <motion.div 
                                key={m.key} 
                                whileHover={{ scale: 1.018, y: -2 }}
                                className={cn(
                                  "relative flex w-full rounded-r-[2rem] rounded-l-xl overflow-visible shadow-3xs pl-24 h-[5.5rem] select-none border",
                                  activeTheme.isDark 
                                    ? "bg-slate-905 border-slate-850/80 text-slate-100" 
                                    : "bg-white border-stone-255 text-slate-805"
                                )}
                                style={{ borderLeft: `3px solid ${sCol}` }}
                              >
                                {/* Left Side: Protruding Folded Ribbon */}
                                <div 
                                  className="absolute left-[-10px] top-1/2 -translate-y-1/2 h-[3.2rem] w-20 rounded-r-full flex flex-col items-center justify-center text-white shadow-md z-15"
                                  style={{ backgroundColor: sCol }}
                                >
                                  <IconComp className="w-4 h-4 text-white" />
                                  <span className="font-sans font-black text-[6.5px] text-center tracking-widest leading-none mt-1">{m.keyLabel}</span>
                                  
                                  {/* Fold triangle under */}
                                  <div 
                                    className="absolute left-0 bottom-[-6px] w-[10px] h-[6px]" 
                                    style={{ 
                                      backgroundColor: sCol,
                                      clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                                      filter: "brightness(0.55)"
                                    }} 
                                  />
                                </div>

                                {/* Right Side Content Area */}
                                <div className="flex-1 p-3 flex flex-col justify-between min-w-0 pr-4">
                                  <div>
                                    <h4 
                                      className="text-[10px] md:text-[11px] font-black uppercase tracking-wider truncate"
                                      style={{ color: sCol }}
                                    >
                                      {m.title}
                                    </h4>
                                    <p className="text-[9px] font-bold text-slate-400 leading-tight truncate mt-0.5">
                                      {m.desc}
                                    </p>
                                    <p className={cn(
                                      "text-[9px] font-extrabold mt-1 truncate",
                                      activeTheme.isDark ? "text-slate-400" : "text-slate-500"
                                    )}>
                                      {state.desc}
                                    </p>
                                  </div>
                                  
                                  <div className="flex items-center justify-end">
                                    {isActive ? (
                                      <span className={cn(
                                        "text-[7px] font-mono font-black px-2 py-0.5 rounded-full border",
                                        activeTheme.isDark 
                                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/55" 
                                          : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                      )}>
                                        ACTIVE
                                      </span>
                                    ) : (
                                      <span className={cn(
                                        "text-[7px] font-mono font-black px-2 py-0.5 rounded-full border",
                                        activeTheme.isDark 
                                          ? "bg-slate-950 text-slate-500 border-slate-850" 
                                          : "bg-slate-100 text-slate-400 border-slate-150"
                                      )}>
                                        INACTIVE
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>

                      {/* CHRONOLOGICAL PROGRESS TIMELINE */}
                      <div className={cn(
                        "rounded-2xl border p-4 md:p-6 shadow-2xs space-y-6 relative overflow-visible mt-6",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60 text-slate-100" : "bg-white border-stone-200 text-slate-800"
                      )}>
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-550/10 pb-4 select-none">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-500 shrink-0 animate-pulse" />
                            <div>
                              <h3 className="font-extrabold text-[10px] md:text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-indigo-400">
                                Chronological Progress History
                              </h3>
                              <p className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                                Unified timeline combining system milestones & verified status logs
                              </p>
                            </div>
                          </div>
                          
                          {/* Filters & Sorting */}
                          <div className="flex flex-wrap items-center gap-2.5">
                            {/* Filter Selectors */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-stone-200 dark:border-slate-850">
                              <button
                                type="button"
                                onClick={() => setTimelineFilter("all")}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                  timelineFilter === "all"
                                    ? "bg-indigo-600 text-white shadow-3xs"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                All Events
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimelineFilter("milestone")}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                  timelineFilter === "milestone"
                                    ? "bg-indigo-600 text-white shadow-3xs"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                Milestones
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimelineFilter("log")}
                                className={cn(
                                  "px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer",
                                  timelineFilter === "log"
                                    ? "bg-indigo-600 text-white shadow-3xs"
                                    : "text-slate-400 hover:text-slate-200"
                                )}
                              >
                                Logs
                              </button>
                            </div>

                            {/* Sort Toggle */}
                            <button
                              type="button"
                              onClick={() => setTimelineSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-850 transition-colors text-[8px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer"
                            >
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                              {timelineSortOrder === "newest" ? "Newest First" : "Oldest First"}
                            </button>
                          </div>
                        </div>

                        {/* Timeline List */}
                        {timelineEvents.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Clock className="w-10 h-10 text-slate-300 dark:text-slate-700 animate-pulse mb-3" />
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                              No history events match the active filter criteria.
                            </p>
                          </div>
                        ) : (
                          <div className="relative pl-6 md:pl-8 border-l border-slate-200 dark:border-slate-800/80 space-y-6 select-none ml-2 md:ml-4">
                            {timelineEvents.map((evt, idx) => {
                              const IconComp = evt.icon;
                              return (
                                <motion.div
                                  key={evt.id}
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                                  className="relative flex flex-col md:flex-row gap-2 md:gap-4 group"
                                >
                                  {/* Timeline node bullet */}
                                  <div 
                                    className="absolute -left-[31px] md:-left-[39px] top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white dark:bg-slate-900 transition-transform duration-300 group-hover:scale-110 shadow-3xs"
                                    style={{ borderColor: evt.color }}
                                  >
                                    <IconComp className="w-3 h-3" style={{ color: evt.color }} />
                                  </div>

                                  {/* Left: Date Display */}
                                  <div className="md:w-32 shrink-0 pt-0.5">
                                    <span className="font-mono text-[9px] md:text-xs font-black tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-900">
                                      {evt.dateStr}
                                    </span>
                                  </div>

                                  {/* Right: Card content */}
                                  <div className={cn(
                                    "flex-1 rounded-xl border p-3 md:p-4 shadow-3xs transition-all duration-300 group-hover:shadow-2xs",
                                    activeTheme.isDark 
                                      ? "bg-slate-950/60 border-slate-850/50 hover:border-slate-800" 
                                      : "bg-stone-50/50 border-stone-200 hover:border-stone-300"
                                  )}>
                                    <div className="flex items-start justify-between gap-2.5 flex-wrap">
                                      <h4 className="font-bold text-xs md:text-sm tracking-tight text-slate-800 dark:text-slate-100">
                                        {evt.title}
                                      </h4>
                                      
                                      <div className="flex items-center gap-1.5">
                                        {evt.type === "milestone" ? (
                                          <span className={cn(
                                            "text-[7px] font-mono font-black px-2 py-0.5 rounded border tracking-wider",
                                            activeTheme.isDark 
                                              ? "bg-indigo-950/40 text-indigo-400 border-indigo-900/55" 
                                              : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                          )}>
                                            MILESTONE
                                          </span>
                                        ) : (
                                          <span className={cn(
                                            "text-[7px] font-mono font-black px-2 py-0.5 rounded border tracking-wider",
                                            activeTheme.isDark 
                                              ? "bg-teal-950/40 text-teal-400 border-teal-900/55" 
                                              : "bg-teal-50 text-teal-600 border-teal-100"
                                          )}>
                                            LOG [{evt.tag || 'LA'}]
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <p className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                                      {evt.description}
                                    </p>

                                    {/* Footer details for logs */}
                                    {evt.type === "log" && (evt.personnel || evt.remarks) && (
                                      <div className="mt-3 pt-2.5 border-t border-slate-200/50 dark:border-slate-850/50 flex flex-wrap gap-x-4 gap-y-1.5 text-[9px] font-extrabold text-slate-400">
                                        {evt.personnel && (
                                          <span className="flex items-center gap-1">
                                            <User className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                            Officer: <strong className="text-slate-500 dark:text-slate-300">{evt.personnel}</strong>
                                          </span>
                                        )}
                                        {evt.remarks && (
                                          <span className="flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                            Remarks: <span className="text-slate-500 dark:text-slate-300 italic">"{evt.remarks}"</span>
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}

                      </div>

                    </motion.div>
                  )}

                  {/* TAB 5: INCIDENTAL DATA VAULT AND DRIVE PORTAL */}
                  {selectedTab === "supplemental" && (
                    <motion.div
                      key="supplemental"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {/* Supplementary details */}
                      <div className={cn(
                        "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                        activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                      )}>
                        <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-violet-400 flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1">
                          <Compass className="w-3.5 h-3.5 shrink-0 text-violet-400 animate-spin-slow" />
                          Security & Relocation Compliance Status
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-0.5">
                          <RenderField label="Relocation Required Status" value={selectedLot.relocation} />
                          <RenderField label="Scheduled Relocation Date" value={selectedLot.relocationDate} />
                        </div>
                        <RenderField label="DENR Compliance Certification" value={selectedLot.denr} />
                        <RenderField label="Titling Progression Status Mode" value={selectedLot.titling} />
                        <RenderField label="CNO / MOA DATE SIGNED" value={selectedLot.dateCno} />
                      </div>

                      {/* Remarks & Connected Shared Document Storage */}
                      <div className="space-y-6">
                        {/* Audit Remarks Card */}
                        {(() => {
                          const remarksText = selectedLot.remarks || "";
                          const milestones: string[] = [];
                          const actions: string[] = [];
                          const entities: string[] = [];

                          if (remarksText) {
                            const textUpper = remarksText.toUpperCase();

                            // 1. Core milestones detection
                            if (textUpper.includes("FULLY PAID") || textUpper.includes("PAID") || textUpper.includes("PAID STATUS")) {
                              milestones.push("Payment Stage: Completed (Paid)");
                            }
                            if (textUpper.includes("FOR ECAR") || textUpper.includes("ECAR")) {
                              milestones.push("ECAR Status: Endorsed for processing");
                            }
                            if (textUpper.includes("OTB WAS REISSUED") || textUpper.includes("OTB REISSUED") || textUpper.includes("OTB ACCEPTED")) {
                              milestones.push("Offer to Buy (OtB): Reissued & Accepted");
                            }
                            if (textUpper.includes("REVISED NOT SENT")) {
                              milestones.push("NoT Status: Revised Notice of Taking sent");
                            }

                            // 2. Line by line scanning
                            const lines = remarksText.split('\n').map(l => l.trim()).filter(Boolean);
                            lines.forEach(line => {
                              let cleanLine = line
                                .replace(/^[-*•\s+]+/, '')
                                .replace(/^\d+[\s.)-]+\s*/, '')
                                .replace(/[📝✅❌⚠️📢📌🔔]/g, '')
                                .trim();

                              if (!cleanLine || cleanLine.length < 4) return;
                              const lineUpper = cleanLine.toUpperCase();

                              // Skip category headers
                              if (lineUpper.endsWith("REMARKS") || lineUpper === "STATUS:" || lineUpper === "STATUS") {
                                return;
                              }

                              // Pending Actions
                              if (
                                lineUpper.includes("WAITING") || 
                                lineUpper.includes("PENDING") || 
                                lineUpper.includes("PROCESSING") || 
                                lineUpper.includes("DRAFTING") || 
                                lineUpper.includes("REQUIREMENT") || 
                                (lineUpper.includes("DOAS") && lineUpper.includes("CH")) ||
                                lineUpper.includes("BEFORE")
                              ) {
                                actions.push(cleanLine);
                              } 
                              // Entities / Dates / People
                              else if (
                                lineUpper.includes("NEW OWNER") || 
                                lineUpper.includes("RECEIVED BY") || 
                                lineUpper.includes("C/O") || 
                                lineUpper.includes("MOTHER") || 
                                (lineUpper.includes("BY") && lineUpper.includes("ROLAND")) || 
                                lineUpper.includes("ADRIANO") || 
                                lineUpper.includes("JOAN")
                              ) {
                                entities.push(cleanLine);
                              } 
                              // Other statuses / milestones
                              else {
                                if (lineUpper.includes("PAID") || lineUpper.includes("ACCEPTED") || lineUpper.includes("REISSUED") || lineUpper.includes("SENT")) {
                                  milestones.push(cleanLine);
                                } else if (cleanLine.length > 8 && cleanLine.length < 160) {
                                  actions.push(cleanLine);
                                }
                              }
                            });
                          }

                          const uniqueMilestones = Array.from(new Set(milestones));
                          const uniqueActions = Array.from(new Set(actions));
                          const uniqueEntities = Array.from(new Set(entities));
                          const hasKeypoints = uniqueMilestones.length > 0 || uniqueActions.length > 0 || uniqueEntities.length > 0;

                          // 100% Automated Recommendation Engine based on Remarks Analysis
                          const autoRecs: { title: string; desc: string; badge: string; colorClass: string; icon: any }[] = [];
                          if (remarksText) {
                            const rText = remarksText.toLowerCase();

                            // 1. Legal / Expropriation / Court
                            if (rText.includes("expro") || rText.includes("court") || rText.includes("legal") || rText.includes("case") || rText.includes("filed") || rText.includes("atty") || rText.includes("lawyer")) {
                              autoRecs.push({
                                title: "Expedite Expropriation & Court Coordination",
                                desc: "Coordinate immediately with the Legal Division to speed up the drafting of the expropriation petition and secure the Writ of Possession (WOP) from the court.",
                                badge: "Legal Action",
                                colorClass: "rose",
                                icon: AlertTriangle
                              });
                            }

                            // 2. Estate / Heirs / Succession
                            if (rText.includes("heir") || rText.includes("deceased") || rText.includes("death") || rText.includes("dead") || rText.includes("estate") || rText.includes("extrajudicial") || rText.includes("ejs") || rText.includes("succession")) {
                              autoRecs.push({
                                title: "Facilitate Heir Estate Settlement (EJS)",
                                desc: "Request the heirs to submit the executed Extrajudicial Settlement (EJS) of Estate and monitor statutory publication progress to clear title ownership.",
                                badge: "Estate Settlement",
                                colorClass: "amber",
                                icon: User
                              });
                            }

                            // 3. Relocation / Tenants / LGU / Informal Occupants
                            if (rText.includes("reloc") || rText.includes("tenant") || rText.includes("informal") || rText.includes("lgu") || rText.includes("relocate") || rText.includes("occupant") || rText.includes("squatter")) {
                              autoRecs.push({
                                title: "Liaise with LGU for Tenant Relocation",
                                desc: "Coordinate with the Local Government Unit (LGU) and Social Development division to verify alternative housing availability for occupants and issue formal relocation notices.",
                                badge: "Relocation Track",
                                colorClass: "amber",
                                icon: Handshake
                              });
                            }

                            // 4. Valuation / Appraisal / Price / Offers
                            if (rText.includes("appraisal") || rText.includes("valuation") || rText.includes("cost") || rText.includes("price") || rText.includes("disapprove") || rText.includes("offer") || rText.includes("counter-offer") || rText.includes("payment")) {
                              autoRecs.push({
                                title: "Re-Negotiate Valuation & Offer to Buy",
                                desc: "Initiate direct owner negotiation using the updated Government Financial Institution (GFI) appraisal values or prepare an adjusted secondary Offer to Buy (OtB).",
                                badge: "Valuation & Settlement",
                                colorClass: "indigo",
                                icon: Coins
                              });
                            }

                            // 5. BIR / eCAR / Capital Gains Tax / DST
                            if (rText.includes("ecar") || rText.includes("car") || rText.includes("bir") || rText.includes("tax") || rText.includes("clearance") || rText.includes("cgt") || rText.includes("rpt")) {
                              autoRecs.push({
                                title: "Secure BIR eCAR & Clear Real Property Taxes",
                                desc: "Ensure real property tax (RPT) arrears are settled and follow up CGT/DST tax clearance with the BIR District Office for the prompt release of the eCAR.",
                                badge: "Tax & eCAR",
                                colorClass: "indigo",
                                icon: FileCheck
                              });
                            }

                            // 6. DOAS / Deed of Absolute Sale / Notarization
                            if (rText.includes("doas") || rText.includes("deed") || rText.includes("sale") || rText.includes("notarize") || rText.includes("signed")) {
                              autoRecs.push({
                                title: "Finalize Deed of Absolute Sale (DOAS)",
                                desc: "Review complete signature fields on the DOAS, align calendar schedules for notary public signing, and request the first payment check release.",
                                badge: "Deed of Sale",
                                colorClass: "emerald",
                                icon: FileSignature
                              });
                            }

                            // 7. Locator / Abroad / Missing / Unlocated Owner
                            if (rText.includes("abroad") || rText.includes("missing") || rText.includes("cannot locate") || rText.includes("unlocated") || rText.includes("overseas") || rText.includes("contact")) {
                              autoRecs.push({
                                title: "Locate Missing or Overseas Owners",
                                desc: "Collaborate with Barangay councils to track location coordinates, or schedule official statutory news publications to establish contact.",
                                badge: "Locator Strategy",
                                colorClass: "amber",
                                icon: Search
                              });
                            }

                            // 8. Survey / Technical / Boundary / Overlap
                            if (rText.includes("survey") || rText.includes("boundary") || rText.includes("technical") || rText.includes("overlap") || rText.includes("subdivision") || rText.includes("plan")) {
                              autoRecs.push({
                                title: "Resolve Technical Survey & Boundary Overlaps",
                                desc: "Instruct the geodetic survey team to perform a relocation survey to reconcile boundary discrepancies and draft the subdivided land plan.",
                                badge: "Technical Survey",
                                colorClass: "indigo",
                                icon: MapPin
                              });
                            }

                            // 9. Notice of Taking (NoT) Delivery
                            if (rText.includes("not") || rText.includes("notice") || rText.includes("notice of taking") || rText.includes("delivered") || rText.includes("received")) {
                              autoRecs.push({
                                title: "Deliver Outstanding Notice of Taking (NoT)",
                                desc: "Deliver the updated NoT package directly to the land owner and request a signed-received copy with identification proof.",
                                badge: "Notice of Taking",
                                colorClass: "indigo",
                                icon: FileText
                              });
                            }

                            // Fallback default recommendation
                            if (autoRecs.length === 0) {
                              autoRecs.push({
                                title: "Routine Acquisition Monitoring",
                                desc: "No complex caveats or critical hold-points detected in the remarks. Continue regular weekly updates and upload supporting documents to Google Drive.",
                                badge: "Routine Process",
                                colorClass: "emerald",
                                icon: FileCheck
                              });
                            }
                          }

                          return (
                            <div className={cn(
                              "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden transition-all duration-300",
                              activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                            )}>
                              <div className="flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 select-none">
                                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-slate-450 dark:text-slate-400">OVERALL REMARKS ANALYTICS</h3>
                              </div>

                              {/* Beautifully left-aligned text preserving spaces and line breaks */}
                              <div className={cn(
                                "p-5 rounded-2xl relative shadow-3xs whitespace-pre-wrap text-left font-sans text-xs md:text-[12.5px] leading-relaxed font-bold transition-all",
                                activeTheme.isDark 
                                  ? "bg-slate-950 border border-slate-850 text-slate-100" 
                                  : "bg-emerald-50/10 border border-stone-200 text-slate-800"
                              )}>
                                {selectedLot.remarks ? (
                                  selectedLot.remarks
                                ) : (
                                  <span className="text-slate-400 italic font-normal">
                                    No supplemental remarks or unresolved physical land clearance caveats recorded for this lot index profile.
                                  </span>
                                )}
                              </div>

                              {selectedLot.remarks && autoRecs.length > 0 && (
                                <div className="space-y-4 pt-2 border-t border-slate-550/10 animate-in fade-in duration-300">
                                  <div className="flex items-center gap-1.5 select-none">
                                    <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0 animate-pulse" />
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">RECOMMENDATIONS</h4>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3">
                                    {autoRecs.map((rec, index) => {
                                      const IconComponent = rec.icon;
                                      
                                      // Dynamic color configuration
                                      let bgClass = "bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/20";
                                      let textClass = "text-emerald-600 dark:text-emerald-400";
                                      let badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400";
                                      
                                      if (rec.colorClass === "rose") {
                                        bgClass = "bg-rose-50/40 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/20";
                                        textClass = "text-rose-600 dark:text-rose-400";
                                        badgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400";
                                      } else if (rec.colorClass === "amber") {
                                        bgClass = "bg-amber-50/40 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/20";
                                        textClass = "text-amber-600 dark:text-amber-450";
                                        badgeClass = "bg-amber-100 text-amber-850 dark:bg-amber-950 dark:text-amber-450";
                                      } else if (rec.colorClass === "indigo") {
                                        bgClass = "bg-indigo-50/40 border-indigo-100 dark:bg-indigo-950/10 dark:border-indigo-900/20";
                                        textClass = "text-indigo-600 dark:text-indigo-400";
                                        badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400";
                                      }

                                      return (
                                        <div 
                                          key={index} 
                                          className={cn(
                                            "p-4 rounded-2xl border flex flex-col gap-2.5 text-left shadow-3xs transition-all hover:translate-x-0.5 duration-200",
                                            bgClass
                                          )}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                              <div className={cn("p-1.5 rounded-lg bg-white/80 dark:bg-slate-900/80 shadow-3xs shrink-0", textClass)}>
                                                <IconComponent className="w-4 h-4" />
                                              </div>
                                              <span className="text-[12px] font-black tracking-tight text-slate-800 dark:text-slate-200">
                                                {rec.title}
                                              </span>
                                            </div>
                                            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider shrink-0", badgeClass)}>
                                              {rec.badge}
                                            </span>
                                          </div>
                                          <p className="text-[11px] leading-relaxed font-bold text-slate-600 dark:text-slate-350">
                                            {rec.desc}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Encrypted link badge */}
                        <div className={cn(
                          "rounded-2xl border p-4 shadow-2xs relative overflow-hidden transition-all duration-300",
                          activeTheme.isDark ? "bg-slate-950 border-slate-850 text-slate-100" : "bg-white border-stone-200"
                        )}>
                          <div className="flex items-center gap-1.5 mb-2 select-none">
                            <Lock className="w-3.5 h-3.5 text-emerald-505 shrink-0" />
                            <h3 className="font-extrabold text-[9px] uppercase tracking-widest text-slate-400 font-sans">Secure documents vault</h3>
                          </div>
                          
                          {selectedLot.folderLink && selectedLot.folderLink.includes("drive.google.com") ? (
                            <div className="space-y-4">
                              <p className="text-[10.5px] font-extrabold text-slate-405 leading-relaxed uppercase">
                                An active digital Google Drive folder is bound to this lot database ID. Log in with your corporate credential to open Deeds, surveyor coordinates, and land patents.
                              </p>
                              <a
                                href={selectedLot.folderLink}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  "flex items-center justify-between w-full text-white px-4 py-3 rounded-2xl transition-all font-black uppercase text-[9.5px] tracking-widest cursor-pointer hover:scale-[1.01] active:scale-[0.98] text-center shadow-lg",
                                  themeAccent.btnPrimary
                                )}
                              >
                                <span>Access Folder Documents</span>
                                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                              </a>
                            </div>
                          ) : (
                            <div className="text-center py-6 border border-dashed border-slate-550/10 rounded-2xl text-[9px] font-black text-slate-500 uppercase tracking-widest italic select-none">
                              No Drive Folder Connected to this Parcel
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 6: DIRECT UPDATE STATUS IN GOOGLE SHEETS */}
                  {selectedTab === "update" && (
                    <motion.div
                      key="update"
                      id="update-sheet-status-section"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="space-y-6"
                    >
                      <div className={cn(
                        "rounded-[2.5rem] border p-8 md:p-10 transition-all duration-300 shadow-md",
                        activeTheme.isDark ? "bg-[#0f172a] border-slate-800/80 text-slate-100" : "bg-white border-[#cbd5e1]/40 text-slate-800"
                      )}>

                        {!googleToken ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center space-y-5 max-w-md mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center border border-amber-500/20">
                              <Lock className="w-8 h-8 text-amber-500 animate-pulse" />
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-black text-sm uppercase tracking-wider text-slate-800 dark:text-slate-100">Google Sheets Integration</h4>
                              <p className="text-[11px] text-slate-450 dark:text-slate-400 leading-relaxed">
                                Connect your authorized account to synchronize updates directly to the project's live database masterlist files.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAuthLoading(true);
                                googleSignIn()
                                  .then((res) => {
                                    if (res) {
                                      setGoogleUser(res.user);
                                      setGoogleToken(res.accessToken);
                                    }
                                    setIsAuthLoading(false);
                                  })
                                  .catch((e) => {
                                    if (e && (e.code === "auth/popup-closed-by-user" || e.message?.includes("popup-closed-by-user"))) {
                                      console.warn("Manual Google sign in cancelled by user.");
                                    } else {
                                      console.error("Manual Google sign in error:", e);
                                    }
                                    setIsAuthLoading(false);
                                  });
                              }}
                              disabled={isAuthLoading}
                              className={cn(
                                "px-8 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white shadow-lg cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]",
                                themeAccent.btnPrimary
                              )}
                            >
                              {isAuthLoading ? "Connecting to Google..." : "Connect Google Account"}
                            </button>

                            {/* Informative Help Guide for Connection / Iframe / Popup issues */}
                            <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-left max-w-sm mt-2 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400 space-y-1.5 font-medium">
                              <div className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-wider text-blue-600 dark:text-blue-400">
                                <Info className="w-3.5 h-3.5 shrink-0" />
                                Connection Guide
                              </div>
                              <p>
                                1. <strong>Allow Popups:</strong> Google login requires a secure authentication popup. Please ensure your browser is not blocking popups for this tab.
                              </p>
                              <p>
                                2. <strong>Iframe Notice:</strong> If you are inside the AI Studio code preview, click the <strong>"Open in a new tab"</strong> button at the top-right of your screen first to bypass secure session restrictions.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                            {/* Left Column: Configuration & Controls */}
                            <div className="lg:col-span-4 bg-[#f8fafc] dark:bg-[#1e293b]/60 border border-slate-200 dark:border-slate-800/80 p-8 rounded-3xl flex flex-col justify-between shadow-xs min-h-[620px]">
                              <div className="space-y-6">
                                {/* 1. Target Lot IDs Input */}
                              <div className="space-y-1.5 text-left">
                                <label className="text-[10px] font-black text-slate-800 dark:text-slate-350 uppercase tracking-widest block">
                                  {updateFile === "actual_amounts" ? "Enter Target Structure Tag or Lot ID" : "Enter Target Lot IDs"} <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder={
                                    updateFile === "actual_amounts"
                                      ? (isBulkMode ? "e.g. ST-01, ST-02, 40133" : "e.g. ST-01 or 40133")
                                      : (isBulkMode ? "e.g. 10001, 10002, 10003" : "e.g. 10001")
                                  }
                                  value={isBulkMode ? bulkLotIds : singleLotInput}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (isBulkMode) {
                                      setBulkLotIds(val);
                                    } else {
                                      setSingleLotInput(val);
                                      // Dynamically search and update selectedLotId if exact match is found
                                      const trimmed = val.trim();
                                      const matched = preprocessedAll.find(
                                        (item) => (item.lotId || "").toString().toLowerCase() === trimmed.toLowerCase()
                                      );
                                      if (matched) {
                                        setSelectedLotId(matched.id);
                                      }
                                    }
                                  }}
                                  className={cn(
                                    "w-full px-4 py-3 border rounded-xl font-bold text-xs outline-none transition-all shadow-2xs",
                                    activeTheme.isDark 
                                      ? "bg-[#0f172a] text-slate-100 border-slate-750 focus:border-blue-500"
                                      : "bg-white text-slate-800 border-slate-250 focus:ring-4 focus:ring-blue-500/10"
                                  )}
                                />
                              </div>

                                {/* 2. Update Mode Toggle */}
                                <div className="space-y-2 text-left">
                                  <label className="text-[11px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-wider block">
                                    UPDATE MODE
                                  </label>
                                  <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                                    <button
                                      type="button"
                                      onClick={() => setIsBulkMode(false)}
                                      className={cn(
                                        "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer",
                                        !isBulkMode 
                                          ? "bg-[#2b60de] text-white shadow-md shadow-blue-500/20" 
                                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      SINGLE LOT
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsBulkMode(true)}
                                      className={cn(
                                        "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer",
                                        isBulkMode 
                                          ? "bg-[#2b60de] text-white shadow-md shadow-blue-500/20" 
                                          : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                      )}
                                    >
                                      BULK LOTS
                                    </button>
                                  </div>
                                </div>

                                {/* 3. Target Spreadsheet Selector */}
                                <div className="space-y-2 text-left">
                                  <label className="text-[11px] font-black text-slate-800 dark:text-slate-350 uppercase tracking-wider block">
                                    TARGET SPREADSHEET FILE
                                  </label>
                                  <select
                                    className={cn(
                                      "w-full px-4 py-3.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all shadow-2xs text-slate-805 dark:text-slate-100",
                                      activeTheme.isDark 
                                        ? "bg-[#0f172a] border-slate-750 focus:border-blue-500"
                                        : "bg-white border-slate-250 focus:ring-4 focus:ring-blue-500/10"
                                    )}
                                    value={updateFile}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setUpdateFile(val);
                                      if (val === "actual_amounts") {
                                        setUpdateCategory("actual_amounts_group");
                                      } else {
                                        setUpdateCategory("G1");
                                      }
                                    }}
                                  >
                                    <option value="land_acquisition" className="dark:bg-slate-900">Land Acquisition File (01. MASTERLIST)</option>
                                    <option value="expropriation" className="dark:bg-slate-900">Expropriation File (Expro_List_Automated data from Databased)</option>
                                    <option value="condominium" className="dark:bg-slate-900">Condominium File (CONDOMINIUMS MASTERLIST)</option>
                                    <option value="entitlements" className="dark:bg-slate-900">Entitlements (OTHER ENTITLEMENTS)</option>
                                    <option value="actual_amounts" className="dark:bg-slate-900">Actual Amounts (CONSOLIDATED LIST)</option>
                                  </select>

                                  {updateFile !== "land_acquisition" && updateFile !== "actual_amounts" && updateFile !== "entitlements" && (
                                    <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400 font-bold text-[10px] flex items-start gap-2 leading-relaxed">
                                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
                                      <span>
                                        Excel spreadsheet integration for this file is currently ongoing. Direct cell updates are enabled for Land Acquisition, Actual Amounts, and Entitlements Files.
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* 4. Category / Group Selector */}
                                {updateFile !== "actual_amounts" && updateFile !== "entitlements" && (
                                  <div className="space-y-2 text-left">
                                    <label className="text-[11px] font-black text-slate-800 dark:text-slate-350 uppercase tracking-wider block">
                                      SELECT PROCESS GROUP / CATEGORY TO UPDATE <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                      className={cn(
                                        "w-full px-4 py-3.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all shadow-2xs text-slate-805 dark:text-slate-100",
                                        activeTheme.isDark 
                                          ? "bg-[#0f172a] border-slate-750 focus:border-blue-500"
                                          : "bg-white border-slate-250 focus:ring-4 focus:ring-blue-500/10"
                                      )}
                                      value={updateCategory}
                                      onChange={(e) => setUpdateCategory(e.target.value)}
                                    >
                                      <option value="G1" className="dark:bg-slate-900">Notice of Taking (NoT)</option>
                                      <option value="G2" className="dark:bg-slate-900">Negotiation (RFD, OTB, OTC)</option>
                                      <option value="G3" className="dark:bg-slate-900">Agreements (DOAS, ADRI)</option>
                                      <option value="G4" className="dark:bg-slate-900">Permits & Environmental (PTE, ENVI)</option>
                                      <option value="G5" className="dark:bg-slate-900">Payment Status</option>
                                      <option value="G6" className="dark:bg-slate-900">Right of Way Status (CNO/MOA)</option>
                                      <option value="G7" className="dark:bg-slate-900">Handed Over Lots</option>
                                    </select>
                                  </div>
                                )}

                                {/* 5. Warning for Single mode with no selected parcel */}
                                {!isBulkMode && !selectedLot && updateFile !== "actual_amounts" && updateFile !== "entitlements" && (
                                  <div className="p-4 rounded-xl border border-dashed border-amber-300/60 dark:border-amber-800/40 bg-amber-50/45 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 text-[10px] font-medium leading-relaxed transition-all duration-300 shadow-xs text-left">
                                    <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-500 animate-pulse inline-block mr-1.5 align-middle" />
                                    <span>No active lot selected. Search and select a lot using Quick Search box first.</span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-6">
                                {/* 7. Action Button */}
                                <div className="flex justify-center pt-2">
                                  <button
                                    type="button"
                                    onClick={handleStatusUpdate}
                                    disabled={isUpdatingStatus || (updateFile !== "land_acquisition" && updateFile !== "actual_amounts" && updateFile !== "entitlements")}
                                    className={cn(
                                      "px-8 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] text-white border border-[#2b60de]/40",
                                      (isUpdatingStatus || (updateFile !== "land_acquisition" && updateFile !== "actual_amounts" && updateFile !== "entitlements")) 
                                        ? "bg-slate-400 dark:bg-slate-800 text-slate-300 dark:text-slate-500 cursor-not-allowed opacity-50 shadow-none border-none" 
                                        : "bg-[#2b60de] hover:bg-blue-700 shadow-blue-500/15"
                                    )}
                                  >
                                    {isUpdatingStatus ? (
                                      <RefreshCw className="w-4 h-4 animate-spin inline-block mr-2" />
                                    ) : null}
                                    {isUpdatingStatus ? "Updating Sheet..." : "RECORD STATUS UPDATE"}
                                  </button>
                                </div>

                                {/* 8. Authorization & Disconnect Status */}
                                {googleToken && (
                                  <div className="flex items-center justify-between bg-slate-100/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-2xl w-full">
                                    <div className="flex items-center gap-2 overflow-hidden text-left">
                                      <span className="w-2.5 h-2.5 bg-[#0055ff] rounded-full inline-block shrink-0 shadow-inner animate-pulse" />
                                      <span className="text-[10.5px] font-bold text-slate-805 dark:text-slate-200 tracking-tight truncate">
                                        Authorized as <strong className="font-extrabold text-slate-900 dark:text-slate-100">{googleUser?.email || "antoque2822@gmail.com"}</strong>
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => logoutGoogle()}
                                      className="text-[10.5px] font-black uppercase text-red-600 hover:text-red-800 transition-colors cursor-pointer shrink-0"
                                    >
                                      DISCONNECT
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right Column: Dynamic Input Fields */}
                            <div className="lg:col-span-8 space-y-6">
                              
                              {/* SUCCESS OR ERROR FEEDBACK FEED */}
                              {submitStatus && (
                                <div className={cn(
                                  "p-4 rounded-xl text-xs font-bold leading-relaxed shadow-xs transition-all duration-300 text-left",
                                  submitStatus.type === "success" 
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                )}>
                                  {submitStatus.message}
                                </div>
                              )}

                              {/* Actual Amounts (CONSOLIDATED LIST) Form */}
                              {(updateCategory === "actual_amounts_group" || updateFile === "actual_amounts") && (
                                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800/50 gap-2">
                                    <h4 className="text-[12px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 text-left">
                                      ACTUAL AMOUNTS (CONSOLIDATED LIST)
                                    </h4>
                                    
                                    {isFetchingActuals && (
                                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                                        <span>Fetching data...</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Auto-detected Lot Only Status Banner */}
                                  {actualsIsLotOnly && (
                                    <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-450">
                                          Auto-detected: No Affected Structure (Structure fields automatically disabled)
                                        </span>
                                      </div>
                                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest border border-emerald-500/20">
                                        Lot Only
                                      </span>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Column F - CORRECTED LOT ID No. */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        CORRECTED LOT ID NO. (BASED ON OFFER LETTER)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 40133-A"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.correctedLotId || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, correctedLotId: e.target.value })}
                                      />
                                    </div>

                                    {/* Column H - Dominant Lot ID No. */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        DOMINANT LOT ID NO. (STRUCTURE LOCATION)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 40133"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.dominantLotId || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, dominantLotId: e.target.value })}
                                      />
                                    </div>

                                    {/* Column AX - SOURCE OF COST INFORMATION */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        SOURCE OF COST INFORMATION
                                      </label>
                                      <select
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.sourceOfCostInfo || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, sourceOfCostInfo: e.target.value })}
                                      >
                                        <option value="">--Clear / Select--</option>
                                        <option value="Softcopy">Softcopy</option>
                                        <option value="Verbal or viber gc">Verbal or viber gc</option>
                                        <option value="From appendix">From appendix</option>
                                        <option value="Appraisal/Tracker">Appraisal/Tracker</option>
                                        <option value="SDAR">SDAR</option>
                                        <option value="N/A">N/A</option>
                                      </select>
                                    </div>

                                    {/* Column AZ - TOTAL LOT LAND COST */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        TOTAL LOT LAND COST
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 150000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.totalLotLandCost || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, totalLotLandCost: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, totalLotLandCost: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {actualsPartitions.length > 0 ? (
                                      <div className="col-span-1 sm:col-span-2 space-y-4">
                                        <div className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 text-left">
                                          AFFECTED STRUCTURES PARTITIONS ({actualsPartitions.length})
                                        </div>
                                        {actualsPartitions.map((part, idx) => (
                                          <div key={part.rowNumber} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/35 space-y-4 text-left">
                                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/65 dark:border-slate-800/60">
                                              <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                  STRUCTURE TAG
                                                </span>
                                                {part.structureTag}
                                              </span>
                                              <span className="text-[9px] font-mono text-slate-400">
                                                Row {part.rowNumber}
                                              </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                              {/* Column BA - PAYMENT STRUCTURE STATUS */}
                                              <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                                  PAYMENT STRUCTURE STATUS
                                                </label>
                                                <select
                                                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                                  value={part.paymentStructureStatus || ""}
                                                  onChange={(e) => {
                                                    const updated = [...actualsPartitions];
                                                    updated[idx] = { ...updated[idx], paymentStructureStatus: e.target.value };
                                                    setActualsPartitions(updated);
                                                  }}
                                                >
                                                  <option value="">--Clear / Select--</option>
                                                  <option value="PAID">PAID</option>
                                                  <option value="UNPAID">UNPAID</option>
                                                  <option value="N/A">N/A</option>
                                                </select>
                                              </div>

                                              {/* Column BB - TOTAL PAID STRUCTURE COST */}
                                              <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                                  TOTAL PAID STRUCTURE COST
                                                </label>
                                                <div className="relative">
                                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                                    ₱
                                                  </span>
                                                  <input
                                                    type="text"
                                                    placeholder="e.g. 250000"
                                                    className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                                    value={part.totalPaidStructureCost || ""}
                                                    onChange={(e) => {
                                                      const updated = [...actualsPartitions];
                                                      updated[idx] = { ...updated[idx], totalPaidStructureCost: formatAsTheyType(e.target.value) };
                                                      setActualsPartitions(updated);
                                                    }}
                                                    onBlur={(e) => {
                                                      const updated = [...actualsPartitions];
                                                      updated[idx] = { ...updated[idx], totalPaidStructureCost: formatOnBlur(e.target.value) };
                                                      setActualsPartitions(updated);
                                                    }}
                                                  />
                                                </div>
                                              </div>

                                              {/* Column BC - PAYMENT FENCE STATUS */}
                                              <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                                  PAYMENT FENCE STATUS
                                                </label>
                                                <select
                                                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                                  value={part.paymentFenceStatus || ""}
                                                  onChange={(e) => {
                                                    const updated = [...actualsPartitions];
                                                    updated[idx] = { ...updated[idx], paymentFenceStatus: e.target.value };
                                                    setActualsPartitions(updated);
                                                  }}
                                                >
                                                  <option value="">--Clear / Select--</option>
                                                  <option value="PAID">PAID</option>
                                                  <option value="UNPAID">UNPAID</option>
                                                  <option value="N/A">N/A</option>
                                                </select>
                                              </div>

                                              {/* Column BD - FENCE / Other COST */}
                                              <div className="space-y-1 text-left">
                                                <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                                  FENCE / Other COST (Linked to Main Tag)
                                                </label>
                                                <div className="relative">
                                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                                    ₱
                                                  </span>
                                                  <input
                                                    type="text"
                                                    placeholder="e.g. 50000"
                                                    className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                                    value={part.fenceOtherCost || ""}
                                                    onChange={(e) => {
                                                      const updated = [...actualsPartitions];
                                                      updated[idx] = { ...updated[idx], fenceOtherCost: formatAsTheyType(e.target.value) };
                                                      setActualsPartitions(updated);
                                                    }}
                                                    onBlur={(e) => {
                                                      const updated = [...actualsPartitions];
                                                      updated[idx] = { ...updated[idx], fenceOtherCost: formatOnBlur(e.target.value) };
                                                      setActualsPartitions(updated);
                                                    }}
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <>
                                        {/* Column BA - PAYMENT STRUCTURE STATUS */}
                                        <div className="space-y-1 text-left">
                                          <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                            PAYMENT STRUCTURE STATUS
                                          </label>
                                          <select
                                            disabled={actualsIsLotOnly}
                                            className={cn(
                                              "w-full px-4 py-3 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all",
                                              actualsIsLotOnly
                                                ? "bg-slate-100 dark:bg-slate-950 opacity-60 cursor-not-allowed text-slate-400"
                                                : "bg-[#e9ebf0] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 cursor-pointer focus:border-blue-500 dark:focus:border-blue-500"
                                            )}
                                            value={actualsIsLotOnly ? "N/A" : (statusFields.paymentStructureStatus || "")}
                                            onChange={(e) => setStatusFields({ ...statusFields, paymentStructureStatus: e.target.value })}
                                          >
                                            <option value="">--Clear / Select--</option>
                                            <option value="PAID">PAID</option>
                                            <option value="UNPAID">UNPAID</option>
                                            <option value="N/A">N/A</option>
                                          </select>
                                        </div>

                                        {/* Column BB - TOTAL PAID STRUCTURE COST */}
                                        <div className="space-y-1 text-left">
                                          <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                            TOTAL PAID STRUCTURE COST
                                          </label>
                                          <div className="relative">
                                            <span className={cn(
                                              "absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs",
                                              actualsIsLotOnly ? "text-slate-400 opacity-60" : "text-slate-500 dark:text-slate-400"
                                            )}>
                                              ₱
                                            </span>
                                            <input
                                              type="text"
                                              disabled={actualsIsLotOnly}
                                              placeholder="e.g. 250000"
                                              className={cn(
                                                "w-full pl-8 pr-4 py-3 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all",
                                                actualsIsLotOnly
                                                  ? "bg-slate-100 dark:bg-slate-950 opacity-60 cursor-not-allowed text-slate-400"
                                                  : "bg-[#e9ebf0] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                              )}
                                              value={actualsIsLotOnly ? "0.00" : (statusFields.totalPaidStructureCost || "")}
                                              onChange={(e) => setStatusFields({ ...statusFields, totalPaidStructureCost: formatAsTheyType(e.target.value) })}
                                              onBlur={(e) => setStatusFields({ ...statusFields, totalPaidStructureCost: formatOnBlur(e.target.value) })}
                                            />
                                          </div>
                                        </div>

                                        {/* Column BC - PAYMENT FENCE STATUS */}
                                        <div className="space-y-1 text-left">
                                          <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                            PAYMENT FENCE STATUS
                                          </label>
                                          <select
                                            disabled={actualsIsLotOnly}
                                            className={cn(
                                              "w-full px-4 py-3 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all",
                                              actualsIsLotOnly
                                                ? "bg-slate-100 dark:bg-slate-950 opacity-60 cursor-not-allowed text-slate-400"
                                                : "bg-[#e9ebf0] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 cursor-pointer focus:border-blue-500 dark:focus:border-blue-500"
                                            )}
                                            value={actualsIsLotOnly ? "N/A" : (statusFields.paymentFenceStatus || "")}
                                            onChange={(e) => setStatusFields({ ...statusFields, paymentFenceStatus: e.target.value })}
                                          >
                                            <option value="">--Clear / Select--</option>
                                            <option value="PAID">PAID</option>
                                            <option value="UNPAID">UNPAID</option>
                                            <option value="N/A">N/A</option>
                                          </select>
                                        </div>

                                        {/* Column BD - FENCE / Other COST */}
                                        <div className="space-y-1 text-left">
                                          <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                            FENCE / Other COST (Linked to Main Tag)
                                          </label>
                                          <div className="relative">
                                            <span className={cn(
                                              "absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs",
                                              actualsIsLotOnly ? "text-slate-400 opacity-60" : "text-slate-500 dark:text-slate-400"
                                            )}>
                                              ₱
                                            </span>
                                            <input
                                              type="text"
                                              disabled={actualsIsLotOnly}
                                              placeholder="e.g. 50000"
                                              className={cn(
                                                "w-full pl-8 pr-4 py-3 border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all",
                                                actualsIsLotOnly
                                                  ? "bg-slate-100 dark:bg-slate-950 opacity-60 cursor-not-allowed text-slate-400"
                                                  : "bg-[#e9ebf0] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                              )}
                                              value={actualsIsLotOnly ? "0.00" : (statusFields.fenceOtherCost || "")}
                                              onChange={(e) => setStatusFields({ ...statusFields, fenceOtherCost: formatAsTheyType(e.target.value) })}
                                              onBlur={(e) => setStatusFields({ ...statusFields, fenceOtherCost: formatOnBlur(e.target.value) })}
                                            />
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Other Entitlements Form */}
                              {updateFile === "entitlements" && (
                                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800/50 gap-2">
                                    <h4 className="text-[12px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 text-left">
                                      OTHER ENTITLEMENTS STATUS & PAYMENT
                                    </h4>
                                    
                                    {isFetchingEntitlements && (
                                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                                        <span>Fetching data...</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* ENTITLEMENTS PAYMENT DATE */}
                                    <div className="space-y-1 text-left sm:col-span-2">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        ENTITLEMENTS PAYMENT DATE (Col J)
                                      </label>
                                      <input
                                        type="date"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.entitlementsPaymentDate || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, entitlementsPaymentDate: e.target.value })}
                                      />
                                    </div>

                                    {/* RENTAL SUBSIDY MULTIPLIER */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        RENTAL SUBSIDY MULTIPLIER (Col N)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.rentalSubsidyMultiplier || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, rentalSubsidyMultiplier: e.target.value })}
                                      />
                                    </div>

                                    {/* RENTAL SUBSIDY AMOUNT */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        RENTAL SUBSIDY AMOUNT (Col O)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 15000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.rentalSubsidyAmount || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, rentalSubsidyAmount: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, rentalSubsidyAmount: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {/* TRANSPORTATION ASSISTANCE MULTIPLIER */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        TRANSPO ASSISTANCE MULTIPLIER (Col P)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.transpoRelocationMultiplier || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, transpoRelocationMultiplier: e.target.value })}
                                      />
                                    </div>

                                    {/* TRANSPORTATION ASSISTANCE AMOUNT */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        TRANSPO ASSISTANCE AMOUNT (Col Q)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 10000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.transpoRelocationAmount || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, transpoRelocationAmount: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, transpoRelocationAmount: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {/* FOOD RELOCATION MULTIPLIER */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        FOOD RELOCATION MULTIPLIER (Col R)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.foodRelocationMultiplier || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, foodRelocationMultiplier: e.target.value })}
                                      />
                                    </div>

                                    {/* FOOD RELOCATION AMOUNT */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        FOOD RELOCATION AMOUNT (Col S)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 5000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.foodRelocationAmount || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, foodRelocationAmount: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, foodRelocationAmount: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {/* UTILITIES CONNECTION MULTIPLIER */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        UTILITIES CONNECTION MULTIPLIER (Col T)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.utilitiesConnectionMultiplier || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, utilitiesConnectionMultiplier: e.target.value })}
                                      />
                                    </div>

                                    {/* UTILITIES CONNECTION AMOUNT */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        UTILITIES CONNECTION AMOUNT (Col U)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 3000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.utilitiesConnectionAmount || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, utilitiesConnectionAmount: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, utilitiesConnectionAmount: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {/* INCONVENIENCE ALLOWANCE MULTIPLIER */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        INCONVENIENCE ALLOWANCE MULTIPLIER (Col V)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.inconvenienceAllowanceMultiplier || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, inconvenienceAllowanceMultiplier: e.target.value })}
                                      />
                                    </div>

                                    {/* INCONVENIENCE ALLOWANCE AMOUNT */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        INCONVENIENCE ALLOWANCE AMOUNT (Col W)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 10000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.inconvenienceAllowanceAmount || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, inconvenienceAllowanceAmount: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, inconvenienceAllowanceAmount: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {/* SPECIAL ASSISTANCE MULTIPLIER */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                        SPECIAL ASSISTANCE MULTIPLIER (Col X)
                                      </label>
                                      <input
                                        type="text"
                                        placeholder="e.g. 1"
                                        className="w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        value={statusFields.specialAssistanceMultiplier || ""}
                                        onChange={(e) => setStatusFields({ ...statusFields, specialAssistanceMultiplier: e.target.value })}
                                      />
                                    </div>

                                    {/* SPECIAL ASSISTANCE AMOUNT */}
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        SPECIAL ASSISTANCE AMOUNT (Col Y)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 50000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.specialAssistanceAmount || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, specialAssistanceAmount: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, specialAssistanceAmount: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>

                                    {/* FOR INCOME LOSS */}
                                    <div className="space-y-1 text-left sm:col-span-2">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1 leading-normal">
                                        FOR INCOME LOSS AMOUNT (Col Z)
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500 dark:text-slate-400">
                                          ₱
                                        </span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 20000"
                                          className="w-full pl-8 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          value={statusFields.forIncomeLoss || ""}
                                          onChange={(e) => setStatusFields({ ...statusFields, forIncomeLoss: formatAsTheyType(e.target.value) })}
                                          onBlur={(e) => setStatusFields({ ...statusFields, forIncomeLoss: formatOnBlur(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G1: Notice of Taking (NoT) */}
                              {updateFile === "land_acquisition" && (updateCategory === "G1" || updateCategory === "NOT") && (
                                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                  <h4 className="text-[12px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                    NOTICE OF TAKING (NOT)
                                  </h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">NOTICE OF TAKING STATUS</label>
                                      <select
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={statusFields.notStatus}
                                        onChange={(e) => setStatusFields({ ...statusFields, notStatus: e.target.value })}
                                      >
                                        <option value="">--Clear / Select Status--</option>
                                        <option value="DELIVERED - F2F" className="dark:bg-slate-900">DELIVERED - F2F</option>
                                        <option value="DELIVERED - COURIER" className="dark:bg-slate-900">DELIVERED - COURIER</option>
                                        <option value="UNKNOWN/WITH ISSUES" className="dark:bg-slate-900">UNKNOWN/WITH ISSUES</option>
                                        <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                        <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                        <option value="FOR REVISION" className="dark:bg-slate-900">FOR REVISION</option>
                                        <option value="FOR ISSAUNCE" className="dark:bg-slate-900">FOR ISSAUNCE</option>
                                        <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">NOTICE OF TAKING DATE ISSUED</label>
                                      <input
                                        type="date"
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={formatToInputDate(statusFields.notDateIssued)}
                                        onChange={(e) => setStatusFields({ ...statusFields, notDateIssued: formatToSheetDate(e.target.value) })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G2: Negotiation (RFD, OTB, OTC) */}
                              {updateFile === "land_acquisition" && (updateCategory === "G2" || updateCategory === "RFD_OTB_OTC") && (
                                <div className="space-y-6">
                                  {/* Request for Donation (RFD) Section */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#2b60de] dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      REQUEST FOR DONATION (RFD)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">RFD STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.rfdStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, rfdStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                          <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                          <option value="DELIVERED" className="dark:bg-slate-900">DELIVERED</option>
                                          <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">RFD DATE ISSUED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.rfdDateIssued)}
                                          onChange={(e) => setStatusFields({ ...statusFields, rfdDateIssued: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">LO REPLY STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.rfdLoReplyStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, rfdLoReplyStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="NOT AMENABLE TO DONATE" className="dark:bg-slate-900">NOT AMENABLE TO DONATE</option>
                                          <option value="AMENABLE TO DONATE" className="dark:bg-slate-900">AMENABLE TO DONATE</option>
                                          <option value="30 DAYS REVIEW" className="dark:bg-slate-900">30 DAYS REVIEW</option>
                                          <option value="REJECTED" className="dark:bg-slate-900">REJECTED</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">LO DATE REPLY</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.rfdLoDateReply)}
                                          onChange={(e) => setStatusFields({ ...statusFields, rfdLoDateReply: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Offer to Buy (OTB) Section */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#10b981] dark:text-emerald-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      OFFER TO BUY (OTB)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">OTB STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.otbStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, otbStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                          <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                          <option value="DELIVERED" className="dark:bg-slate-900">DELIVERED</option>
                                          <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">OTB DATE ISSUED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.otbDateIssued)}
                                          onChange={(e) => setStatusFields({ ...statusFields, otbDateIssued: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">LO REPLY STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.otbLoReplyStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, otbLoReplyStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="ACCEPTED" className="dark:bg-slate-900">ACCEPTED</option>
                                          <option value="30 DAYS REVIEW" className="dark:bg-slate-900">30 DAYS REVIEW</option>
                                          <option value="REJECTED" className="dark:bg-slate-900">REJECTED</option>
                                          <option value="INCURABLE LOTS" className="dark:bg-slate-900">INCURABLE LOTS</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">LO DATE REPLY</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.otbLoDateReply)}
                                          onChange={(e) => setStatusFields({ ...statusFields, otbLoDateReply: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Offer to Compensate (OTC) or Offer to Buy (OTC) Section */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#ea580c] dark:text-orange-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      OFFER TO BUY (OTC)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">OTC STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.otcStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, otcStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                          <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                          <option value="DELIVERED" className="dark:bg-slate-900">DELIVERED</option>
                                          <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">OTC DATE ISSUED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.otcDateIssued)}
                                          onChange={(e) => setStatusFields({ ...statusFields, otcDateIssued: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">LO REPLY STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.otcLoReplyStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, otcLoReplyStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="ACCEPTED" className="dark:bg-slate-900">ACCEPTED</option>
                                          <option value="30 DAYS REVIEW" className="dark:bg-slate-900">30 DAYS REVIEW</option>
                                          <option value="REJECTED" className="dark:bg-slate-900">REJECTED</option>
                                          <option value="INCURABLE LOTS" className="dark:bg-slate-900">INCURABLE LOTS</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">LO DATE REPLY</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.otcLoDateReply)}
                                          onChange={(e) => setStatusFields({ ...statusFields, otcLoDateReply: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G3: Agreements (DOAS, ADRI) */}
                              {updateFile === "land_acquisition" && (updateCategory === "G3" || updateCategory === "DOAS_ADRI") && (
                                <div className="space-y-6">
                                  {/* Deed of Absolute Sale (DOAS) */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#2b60de] dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      DEED OF ABSOLUTE SALE (DOAS)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DOAS STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.doasStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, doasStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                          <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                          <option value="DRAFTED DOAS" className="dark:bg-slate-900">DRAFTED DOAS</option>
                                          <option value="DRAFTED EJSEAS" className="dark:bg-slate-900">DRAFTED EJSEAS</option>
                                          <option value="ISSUED DOAS" className="dark:bg-slate-900">ISSUED DOAS</option>
                                          <option value="ISSUED EJSEAS" className="dark:bg-slate-900">ISSUED EJSEAS</option>
                                          <option value="RE-ISSUED DOAS" className="dark:bg-slate-900">RE-ISSUED DOAS</option>
                                          <option value="RE-ISSUED EJSEAS" className="dark:bg-slate-900">RE-ISSUED EJSEAS</option>
                                          <option value="SIGNED DOAS" className="dark:bg-slate-900">SIGNED DOAS</option>
                                          <option value="SIGNED" className="dark:bg-slate-900">SIGNED</option>
                                          <option value="SIGNED EJSEAS" className="dark:bg-slate-900">SIGNED EJSEAS</option>
                                          <option value="NOTARIZED DOAS" className="dark:bg-slate-900">NOTARIZED DOAS</option>
                                          <option value="NOTARIZED EJSEAS" className="dark:bg-slate-900">NOTARIZED EJSEAS</option>
                                          <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                          <option value="REFUSED DOAS" className="dark:bg-slate-900">REFUSED DOAS</option>
                                          <option value="REFUSED EJSEAS" className="dark:bg-slate-900">REFUSED EJSEAS</option>
                                          <option value="EJSEAS" className="dark:bg-slate-900">EJSEAS</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE SIGNED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.doasDateSigned)}
                                          onChange={(e) => setStatusFields({ ...statusFields, doasDateSigned: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                      <div className="space-y-1 text-left sm:col-span-2">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE NOTARIZED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.doasDateNotarized)}
                                          onChange={(e) => setStatusFields({ ...statusFields, doasDateNotarized: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* ADRI Agreement */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#10b981] dark:text-emerald-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      ADRI AGREEMENT
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">ADRI STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.adriStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, adriStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                          <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                          <option value="SIGNED" className="dark:bg-slate-900">SIGNED</option>
                                          <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                          <option value="EJSEAS" className="dark:bg-slate-900">EJSEAS</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE SIGNED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.adriDateSigned)}
                                          onChange={(e) => setStatusFields({ ...statusFields, adriDateSigned: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                      <div className="space-y-1 text-left sm:col-span-2">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE NOTARIZED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.adriDateNotarized)}
                                          onChange={(e) => setStatusFields({ ...statusFields, adriDateNotarized: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G4: Permits & Environmental (PTE, ENVI) */}
                              {updateFile === "land_acquisition" && (updateCategory === "G4" || updateCategory === "PTE_ENVI") && (
                                <div className="space-y-6">
                                  {/* Permit to Enter (PTE) */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#2b60de] dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      PERMIT TO ENTER (PTE)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">PTE STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.pteStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, pteStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="FOR DRAFTING" className="dark:bg-slate-900">FOR DRAFTING</option>
                                          <option value="DRAFTED" className="dark:bg-slate-900">DRAFTED</option>
                                          <option value="SIGNED" className="dark:bg-slate-900">SIGNED</option>
                                          <option value="REFUSED" className="dark:bg-slate-900">REFUSED</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE SIGNED</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.pteDateSigned)}
                                          onChange={(e) => setStatusFields({ ...statusFields, pteDateSigned: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Environmental (ENVI) */}
                                  <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                    <h5 className="text-[12px] font-black uppercase tracking-widest text-[#10b981] dark:text-emerald-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                      ENVIRONMENTAL (ENVI)
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      <div className="space-y-1 text-left sm:col-span-2">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">ENVI STATUS</label>
                                        <select
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={statusFields.enviStatus}
                                          onChange={(e) => setStatusFields({ ...statusFields, enviStatus: e.target.value })}
                                        >
                                          <option value="">--Clear / Select Status--</option>
                                          <option value="CROPS AND TREES ADVANCE PAYMENT BY THE CONTRACTOR TO CLAIMANT" className="dark:bg-slate-900">CROPS AND TREES ADVANCE PAYMENT BY THE CONTRACTOR TO CLAIMANT</option>
                                          <option value="CROPS AND TREES PAID BY DOTr TO THE CONTRACTOR" className="dark:bg-slate-900">CROPS AND TREES PAID BY DOTr TO THE CONTRACTOR</option>
                                          <option value="CROPS AND TREES PAID BY DOTr TO LO" className="dark:bg-slate-900">CROPS AND TREES PAID BY DOTr TO LO</option>
                                        </select>
                                      </div>
                                      <div className="space-y-1 text-left sm:col-span-2">
                                        <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE PAID</label>
                                        <input
                                          type="date"
                                          className={cn(
                                            "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                          )}
                                          value={formatToInputDate(statusFields.enviDatePaid)}
                                          onChange={(e) => setStatusFields({ ...statusFields, enviDatePaid: formatToSheetDate(e.target.value) })}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G5: Payment Status */}
                              {updateFile === "land_acquisition" && (updateCategory === "G5" || updateCategory === "PAYMENT") && (
                                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                  <h5 className="text-[12px] font-black uppercase tracking-widest text-[#2b60de] dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                    PAYMENT STATUS DETAILS
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">PAYMENT STATUS</label>
                                      <select
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={statusFields.paymentStatus}
                                        onChange={(e) => setStatusFields({ ...statusFields, paymentStatus: e.target.value })}
                                      >
                                        <option value="">--Clear / Select Status--</option>
                                        <option value="FULLY PAID" className="dark:bg-slate-900">FULLY PAID</option>
                                        <option value="PARTIALLY PAID" className="dark:bg-slate-900">PARTIALLY PAID</option>
                                        <option value="ON-GOING PROCESSING" className="dark:bg-slate-900">ON-GOING PROCESSING</option>
                                        <option value="PAID WITH WOP" className="dark:bg-slate-900">PAID WITH WOP</option>
                                        <option value="PAYMENT CREDITED TO LBP" className="dark:bg-slate-900">PAYMENT CREDITED TO LBP</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE OF PAYMENT</label>
                                      <input
                                        type="date"
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={formatToInputDate(statusFields.paymentDateOfPayment)}
                                        onChange={(e) => setStatusFields({ ...statusFields, paymentDateOfPayment: formatToSheetDate(e.target.value) })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G6: Right of Way Status (CNO/MOA) */}
                              {updateFile === "land_acquisition" && (updateCategory === "G6" || updateCategory === "CNO_MOA") && (
                                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                  <h5 className="text-[12px] font-black uppercase tracking-widest text-[#2b60de] dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                    RIGHT OF WAY STATUS (CNO/MOA)
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 text-left sm:col-span-2">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">ROW STATUS</label>
                                      <select
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={statusFields.rowStatus}
                                        onChange={(e) => setStatusFields({ ...statusFields, rowStatus: e.target.value })}
                                      >
                                        <option value="">--Clear / Select Status--</option>
                                        <option value="With Certificate of No Objection (CNO)" className="dark:bg-slate-900">With Certificate of No Objection (CNO)</option>
                                        <option value="With Memorandum of Agreement (MOA)" className="dark:bg-slate-900">With Memorandum of Agreement (MOA)</option>
                                        <option value="With Use of RACK Agreement" className="dark:bg-slate-900">With Use of RACK Agreement</option>
                                        <option value="With Waiver of Rights" className="dark:bg-slate-900">With Waiver of Rights</option>
                                        <option value="With Affidavit of No Objection" className="dark:bg-slate-900">With Affidavit of No Objection</option>
                                        <option value="With Consent to Enter Property" className="dark:bg-slate-900">With Consent to Enter Property</option>
                                        <option value="With Deed of Donation / Undertaking" className="dark:bg-slate-900">With Deed of Donation / Undertaking</option>
                                        <option value="With Relocation Consent Form" className="dark:bg-slate-900">With Relocation Consent Form</option>
                                        <option value="With Barangay Certification (No Objection)" className="dark:bg-slate-900">With Barangay Certification (No Objection)</option>
                                        <option value="With Certification of No Pending Claim" className="dark:bg-slate-900">With Certification of No Pending Claim</option>
                                        <option value="With Quitclaim Document" className="dark:bg-slate-900">With Quitclaim Document</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1 text-left sm:col-span-2">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE SIGNED</label>
                                      <input
                                        type="date"
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={formatToInputDate(statusFields.rowDateSigned)}
                                        onChange={(e) => setStatusFields({ ...statusFields, rowDateSigned: formatToSheetDate(e.target.value) })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* G7: Handed Over Lots */}
                              {updateFile === "land_acquisition" && (updateCategory === "G7" || updateCategory === "HANDED_OVER_LOTS") && (
                                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800/85 bg-white dark:bg-slate-900 shadow-sm space-y-4">
                                  <h5 className="text-[12px] font-black uppercase tracking-widest text-[#2b60de] dark:text-blue-400 pb-2.5 border-b border-slate-150 dark:border-slate-800/50 text-left">
                                    HANDED OVER LOTS
                                  </h5>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">HANDED OVER STATUS</label>
                                      <select
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs cursor-pointer outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={statusFields.handedOverStatus}
                                        onChange={(e) => setStatusFields({ ...statusFields, handedOverStatus: e.target.value })}
                                      >
                                        <option value="">--Clear / Select Status--</option>
                                        <option value="HANDED OVER LOT" className="dark:bg-slate-900">HANDED OVER LOT</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1 text-left">
                                      <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">DATE HANDED OVER</label>
                                      <input
                                        type="date"
                                        className={cn(
                                          "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                        )}
                                        value={formatToInputDate(statusFields.handedOverDate)}
                                        onChange={(e) => setStatusFields({ ...statusFields, handedOverDate: formatToSheetDate(e.target.value) })}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* TAB 7: COMMENTS & LIGHTWEIGHT NOTES SECTION */}
                  {selectedTab === "comments" && (
                    <motion.div
                      key="comments"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.16 }}
                      className="grid grid-cols-1 lg:grid-cols-12 gap-4"
                    >
                      {/* Left: Input Form Card (Span 5) */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className={cn(
                          "rounded-2xl border p-4 shadow-2xs space-y-2 relative overflow-hidden",
                          activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                        )}>
                          <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-1">
                            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-500" />
                            Add Lot Note / Comment
                          </h3>

                          <form onSubmit={handleAddNote} className="space-y-4">
                            {/* Author Field */}
                            <div className="space-y-1.5 text-left">
                              <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                Author Name
                              </label>
                              <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  required
                                  value={noteAuthor}
                                  onChange={(e) => setNoteAuthor(e.target.value)}
                                  className={cn(
                                    "w-full pl-10 pr-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-bold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500"
                                  )}
                                  placeholder="Enter your name"
                                />
                              </div>
                            </div>

                            {/* Comment Text Field */}
                            <div className="space-y-1.5 text-left">
                              <label className="text-[9px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider px-1">
                                Note / Remark
                              </label>
                              <textarea
                                required
                                rows={4}
                                value={newNoteText}
                                onChange={(e) => setNewNoteText(e.target.value)}
                                className={cn(
                                  "w-full px-4 py-3 bg-[#e9ebf0] dark:bg-[#0f172a] border border-slate-300/60 dark:border-slate-800 rounded-xl font-semibold text-xs outline-none transition-all text-slate-800 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-500 resize-none"
                                )}
                                placeholder={`Write a note about Lot ${selectedLot.lotId}...`}
                              />
                            </div>

                            {/* Submit Button */}
                            <button
                              type="submit"
                              disabled={!newNoteText.trim()}
                              className={cn(
                                "w-full py-3.5 rounded-xl font-black text-[9px] uppercase tracking-widest text-white shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none disabled:scale-100",
                                `bg-gradient-to-r ${activeTheme.primaryGradient} ${activeTheme.primaryShadow}`
                              )}
                            >
                              <Save className="w-3.5 h-3.5" />
                              Save Note
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* Right: Notes list Card (Span 7) */}
                      <div className="lg:col-span-7 flex flex-col">
                        <div className={cn(
                          "rounded-2xl border p-4 shadow-2xs flex-1 flex flex-col relative overflow-hidden min-h-[280px]",
                          activeTheme.isDark ? "bg-slate-900/45 border-slate-850/60" : "bg-white border-stone-200"
                        )}>
                          <h3 className="font-extrabold text-[9.5px] uppercase tracking-widest text-emerald-555 flex items-center gap-1.5 border-b border-slate-550/10 pb-1.5 mb-2 shrink-0">
                            <FileCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                            Notes History for {selectedLot.lotId}
                          </h3>

                          {notesList.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3.5">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-850">
                                <MessageSquare className="w-6 h-6" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-650 dark:text-slate-400">No notes recorded yet</p>
                                <p className="text-[9.5px] text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                                  Any notes or remarks you leave here will be saved to your local database browser storage.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 flex flex-col gap-3 custom-scrollbar">
                              <AnimatePresence initial={false} mode="popLayout">
                                {notesList.map((note) => (
                                  <motion.div
                                    layout
                                    key={note.id}
                                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ 
                                      opacity: 0, 
                                      scale: 0.9, 
                                      y: 15,
                                      height: 0,
                                      marginTop: 0,
                                      marginBottom: 0,
                                      paddingTop: 0,
                                      paddingBottom: 0,
                                      borderWidth: 0,
                                      transition: { duration: 0.25, ease: "easeInOut" }
                                    }}
                                    transition={{ 
                                      type: "spring",
                                      stiffness: 400,
                                      damping: 32,
                                      mass: 0.7
                                    }}
                                    className={cn(
                                      "border p-4.5 rounded-2xl relative group transition-all duration-200 hover:shadow-2xs overflow-hidden",
                                      activeTheme.isDark 
                                        ? "bg-[#0b1329]/40 border-slate-800/80 hover:border-slate-700/80" 
                                        : "bg-stone-50 border-stone-200/60 hover:border-stone-300"
                                    )}
                                  >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <div className="flex items-center gap-2.5">
                                        {/* Avatar initials fallback */}
                                        <div className={cn(
                                          "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black uppercase text-white shadow-xs shrink-0",
                                          `bg-gradient-to-tr ${activeTheme.primaryGradient}`
                                        )}>
                                          {note.author.slice(0, 2)}
                                        </div>
                                        <div>
                                          <span className="text-[10.5px] font-black text-slate-800 dark:text-slate-200 block leading-tight">
                                            {note.author}
                                          </span>
                                          <span className="text-[8.5px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {note.createdAt}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Delete Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteNote(note.id)}
                                        className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                                        title="Delete Note"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Text Content */}
                                    <p className="text-[10.5px] font-medium text-slate-650 dark:text-slate-300 leading-relaxed whitespace-pre-wrap select-text pl-9 pr-2">
                                      {note.text}
                                    </p>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

            </div>
          ) : (
            <div className={cn(
              "border-2 border-dashed rounded-[2.5rem] p-24 text-center space-y-4",
              activeTheme.isDark ? "bg-slate-900/40 border-slate-800" : "bg-stone-50 border-stone-200"
            )}>
              <Layers className="w-10 h-10 text-slate-400 mx-auto animate-pulse" />
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-slate-400">No database record matching filter segment</p>
                <p className="text-[10.5px] text-slate-500 italic mt-1 uppercase tracking-wider max-w-xs mx-auto leading-relaxed">
                  Reset filters or adjust parcel parameters to view detailed appraisal statistics.
                </p>
              </div>
            </div>
          )}
        </main>

      </div>

      {/* Snapshot PDF print modal layout */}
      {showSummaryModal && selectedLot && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
          <div className={cn(
            "w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl rounded-[2.5rem] border transition-all",
            activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-stone-250 text-stone-900"
          )}>
            <div className="p-6 border-b flex items-center justify-between border-slate-550/10">
              <div>
                <h3 className="text-base font-black tracking-tight font-sans uppercase">Parcel Transaction Report</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Official Appraisal record segment: {selectedLot.lotId}</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-500/10 cursor-pointer text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div id="summary-content" className="flex-1 overflow-y-auto p-6 space-y-6 select-text custom-scrollbar">
              <div className={cn(
                "p-6 rounded-3xl border space-y-5",
                activeTheme.isDark ? "bg-slate-950/80 border-slate-800" : "bg-stone-50/50 border-stone-200"
              )}>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-405 block uppercase">Registered Landowner</span>
                    <span className="font-black uppercase">{selectedLot.ownerName || "No registered owner"}</span>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <span className="text-[9px] font-black text-slate-405 block uppercase">Contract Package</span>
                    <span className="font-black uppercase text-indigo-550">{selectedLot.cp}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-405 block uppercase">Registered land total size</span>
                    <span className="font-black font-mono">{formatArea(selectedLot.totalArea)} sq.m</span>
                  </div>
                  <div className="space-y-0.5 text-right">
                    <span className="text-[9px] font-black text-slate-405 block uppercase">Acquisition mode</span>
                    <span className="font-black uppercase">{selectedLot.modeAcquisition || "Unspecified"}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-405 block uppercase">Financial clearance segment</span>
                    <span className="font-black uppercase text-emerald-500">{selectedLot.paymentStatus || "PENDING"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-550/10 text-xs font-mono">
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">LGU municipality</span>
                    <span className="font-extrabold uppercase">{selectedLot.lgu || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">SITE ACCESS DATE</span>
                    <span className="font-extrabold uppercase">{selectedLot.siteAccessDate || "—"}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">PIER</span>
                    <span className="font-extrabold uppercase">{selectedLot.pierNo || "—"}</span>
                  </div>
                </div>

                <div className="border-t pt-4 border-slate-550/10 space-y-3">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest block">Row notices milestones clearance</span>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Notice of Taking (NoT):</span>
                      <span className="font-black">{selectedLot.dateNot || selectedLot.statusNot || "Pending"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Request for Donation (RfD):</span>
                      <span className="font-black">{selectedLot.dateRfd || selectedLot.statusRfd || "Pending"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Offer to Buy (OTB) served date:</span>
                      <span className="font-black">{selectedLot.dateOtb || selectedLot.statusOtb || "Pending"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Offer to Compensate (OTC):</span>
                      <span className="font-black">{selectedLot.dateOtc || selectedLot.statusOtc || "Pending"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Deed of Absolute Sale (DOAS):</span>
                      <span className="font-black">{selectedLot.dateDoas || selectedLot.statusDoas || "Pending"}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Permit to Enter (PTE):</span>
                      <span className="font-black">
                        {(() => {
                          const isPaid = (selectedLot.paymentStatus || "").toUpperCase().includes("PAID") || 
                                         (selectedLot.paymentStatus || "").toUpperCase().includes("FULLY PAID") || 
                                         (selectedLot.datePaid && selectedLot.datePaid !== "-" && selectedLot.datePaid !== "No Data" && selectedLot.datePaid !== "");
                          
                          const hasPteVal = (selectedLot.datePte && selectedLot.datePte !== "-" && selectedLot.datePte !== "No Data" && selectedLot.datePte !== "" && selectedLot.datePte.toUpperCase() !== "PENDING") ||
                                             (selectedLot.statusPte && selectedLot.statusPte !== "-" && selectedLot.statusPte !== "No Data" && selectedLot.statusPte !== "" && selectedLot.statusPte.toUpperCase() !== "PENDING");
                          
                          if (hasPteVal) {
                            return selectedLot.datePte || selectedLot.statusPte;
                          }
                          return isPaid ? "Not Applicable" : "Pending";
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-550/5 pb-1 gap-1">
                      <span className="text-slate-450 font-bold">Certificate of No Objection (CNO):</span>
                      <span className="font-black">
                        {(() => {
                          const isPaid = (selectedLot.paymentStatus || "").toUpperCase().includes("PAID") || 
                                         (selectedLot.paymentStatus || "").toUpperCase().includes("FULLY PAID") || 
                                         (selectedLot.datePaid && selectedLot.datePaid !== "-" && selectedLot.datePaid !== "No Data" && selectedLot.datePaid !== "");
                          
                          const hasCnoVal = (selectedLot.dateCno && selectedLot.dateCno !== "-" && selectedLot.dateCno !== "No Data" && selectedLot.dateCno !== "" && selectedLot.dateCno.toUpperCase() !== "PENDING") ||
                                             (selectedLot.withCnoMoa && selectedLot.withCnoMoa !== "-" && selectedLot.withCnoMoa !== "No Data" && selectedLot.withCnoMoa !== "" && selectedLot.withCnoMoa.toUpperCase() !== "PENDING" && selectedLot.withCnoMoa.toUpperCase() !== "NO");
                          
                          if (hasCnoVal) {
                            return selectedLot.dateCno || selectedLot.withCnoMoa;
                          }
                          return isPaid ? "Not Applicable" : "Pending";
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-1">
                      <span className="text-slate-450 font-bold">Payment Status (PAID):</span>
                      <span className="font-black text-emerald-555 dark:text-emerald-400">{selectedLot.datePaid || selectedLot.paymentStatus || "Pending"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={cn(
                "p-4 border rounded-2xl flex items-start gap-3",
                themeAccent.infoClass
              )}>
                <Info className={cn("w-5 h-5 shrink-0 mt-0.5", themeAccent.text500)} />
                <p className="text-[10px] font-bold leading-relaxed uppercase">
                  "This document is a system-generated preview audit snapshot. Subject to final physical coordinates verification by surveyor sub-group."
                </p>
              </div>
            </div>

            <div className="p-6 border-t flex items-center justify-end gap-3 border-slate-550/10">
              <button 
                type="button"
                onClick={() => window.print()}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer hover:scale-[1.02]",
                  activeTheme.isDark ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                <Printer className="w-4 h-4 shrink-0" />
                Print Preview Page
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
