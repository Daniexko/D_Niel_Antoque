import React, { useMemo, useState, useEffect } from "react";
import { format, isWithinInterval, startOfWeek, endOfWeek, subWeeks, isSameWeek } from "date-fns";
import ExcelJS from "exceljs";
import { 
  Search, 
  Calendar as CalendarIcon, 
  RefreshCcw, 
  FileDown, 
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  SlidersHorizontal,
  Eye,
  EyeOff,
  BarChart3,
  PieChart as PieChartIcon,
  ChevronDown
} from "lucide-react";
import { WeeklyUpdate } from "../types";
import { cn } from "../lib/utils";
import { ThemeConfig } from "../lib/theme";
import { motion, AnimatePresence } from "motion/react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

interface WeeklyUpdatesProps {
  data: WeeklyUpdate[];
  loading: boolean;
  onRefresh: () => void;
  activeTheme: ThemeConfig;
  onSelectLot?: (lotId: string) => void;
}

type SortKey = "dateAccomplishment" | "lotId" | "accomplishment" | "tag";
type SortOrder = "asc" | "desc";

const getPersonnelAvatar = (name: string) => {
  const trimmed = (name || "").trim().toUpperCase();
  if (!trimmed) return { initials: "?", colorClass: "bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400" };
  const parts = trimmed.split(/\s+/);
  const initials = parts.length > 1 ? (parts[0][0] + parts[1][0]) : parts[0][0];
  
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = trimmed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/10" },
    { bg: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 border border-blue-100 dark:border-blue-500/10" },
    { bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/10" },
    { bg: "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300 border border-purple-100 dark:border-purple-500/10" },
    { bg: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300 border border-pink-100 dark:border-pink-500/10" },
    { bg: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 border border-amber-100 dark:border-amber-500/10" },
    { bg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 border border-cyan-100 dark:border-cyan-500/10" },
  ];
  const color = colors[Math.abs(hash) % colors.length];
  return { initials: initials.substring(0, 2), colorClass: color.bg };
};

const renderHighlightedText = (text: string, searchQuery: string, activeTheme: any) => {
  if (!searchQuery || !text) return <>{text}</>;
  
  const textStr = String(text);
  const textLower = textStr.toLowerCase();
  const queryLower = searchQuery.toLowerCase();
  if (!textLower.includes(queryLower)) {
    return <>{textStr}</>;
  }
  
  const escapedSearch = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedSearch})`, 'gi');
  const parts = textStr.split(regex);
  
  return (
    <>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark 
            key={index} 
            className={cn(
              "px-0.5 py-px rounded font-black",
              activeTheme.isDark 
                ? "bg-amber-500/30 text-amber-200" 
                : "bg-amber-200 text-amber-950"
            )}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

export const splitTags = (tagStr: string): string[] => {
  if (!tagStr) return [];
  return tagStr.split(/[\s,;\n\r]+/).map(t => t.trim()).filter(t => t.length > 0);
};

export const MILESTONES = [
  {
    key: "not_issued",
    label: "NoT Issued",
    color: "blue",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("NOT") && (u.includes("ISSUED") || u.includes("RE-ISSUED") || u.includes("REISSUED")) && !u.includes("OTB") && !u.includes("OTC") && !u.includes("RFD");
    }
  },
  {
    key: "otb_issued",
    label: "OTB Issued",
    color: "indigo",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return (u.includes("OTB") && (u.includes("ISSUED") || u.includes("RE-ISSUED") || u.includes("REISSUED"))) || u.includes("ISSUED COMBINED") || u.includes("ISSUED RFD/OTB") || u.includes("ISSUED RFD/OTC");
    }
  },
  {
    key: "otb_accepted",
    label: "OTB Accepted",
    color: "emerald",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("ACCEPTED") && (u.includes("OTB") || u.includes("OTC") || u.includes("COMBINED") || u.includes("RFD") || u.includes("COLLECTION"));
    }
  },
  {
    key: "otb_rejected",
    label: "OTB Rejected",
    color: "rose",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("REJECTED") || u.includes("REFUSED");
    }
  },
  {
    key: "doas_signed",
    label: "DOAS Signed",
    color: "amber",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("DOAS") && (u.includes("SIGNED") || u.includes("NOTARIZED"));
    }
  },
  {
    key: "ejeas_signed",
    label: "EJEAs Signed",
    color: "teal",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return (u.includes("EJEAS") || u.includes("EJSEAS")) && (u.includes("SIGNED") || u.includes("NOTARIZED"));
    }
  },
  {
    key: "adri_signed",
    label: "ADRI Signed",
    color: "violet",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("ADRI") && (u.includes("SIGNED") || u.includes("NOTARIZED"));
    }
  },
  {
    key: "pte_issued",
    label: "PTE Issued",
    color: "sky",
    matches: (text: string) => {
      const u = text.toUpperCase();
      const hasPte = u.includes("PTE") || u.includes("PERMIT TO ENTER");
      if (!hasPte) return false;
      if (u.includes("REFUSED") || u.includes("REJECTED")) return false;
      return u.includes("ISSUED") || u.includes("SIGNED") || u.includes("NOTARIZED") || u.includes("RE-ISSUED") || u.includes("REISSUED") || u.includes("EXECUTED") || u.includes("GRANTED") || u.includes("OBTAINED") || u.includes("COLLECTED");
    }
  },
  {
    key: "with_moa",
    label: "With MOA",
    color: "orange",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("MOA") || u.includes("SECURED MOA");
    }
  },
  {
    key: "with_cno",
    label: "With CNO",
    color: "purple",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("CNO") || u.includes("SECURED CNO");
    }
  },
  {
    key: "partially_paid",
    label: "Partially Paid",
    color: "yellow",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("PARTIALLY PAID") || u.includes("PARTIAL PAID");
    }
  },
  {
    key: "paid_with_wop",
    label: "Paid with WOP",
    color: "red",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("PAID WITH WOP") || u.includes("WOP PAID");
    }
  },
  {
    key: "fully_paid",
    label: "Fully Paid",
    color: "green",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u === "PAID" || u.includes("FULLY PAID") || u.includes("PAID ENTITLEMENTS");
    }
  },
  {
    key: "handed_over_lots",
    label: "Handed Over Lots",
    color: "cyan",
    matches: (text: string) => {
      const u = text.toUpperCase();
      return u.includes("HANDED OVER") || u === "HO" || u.includes("HANDOVER");
    }
  }
];

const MILESTONE_COLORS: Record<string, string> = {
  not_issued: "#3B82F6",      // Blue
  otb_issued: "#6366F1",      // Indigo
  otb_accepted: "#10B981",    // Emerald
  otb_rejected: "#F43F5E",    // Rose
  doas_signed: "#F59E0B",     // Amber
  ejeas_signed: "#14B8A6",    // Teal
  adri_signed: "#8B5CF6",     // Violet
  pte_issued: "#0EA5E9",      // Sky
  with_moa: "#F97316",        // Orange
  with_cno: "#A855F7",        // Purple
  partially_paid: "#EAB308",  // Yellow
  paid_with_wop: "#EF4444",   // Red
  fully_paid: "#22C55E",      // Green
  handed_over_lots: "#06B6D4" // Cyan
};

export const WeeklyUpdates: React.FC<WeeklyUpdatesProps> = ({ data, loading, onRefresh, activeTheme, onSelectLot }) => {
  const [search, setSearch] = useState("");
  const [cpFilter, setCpFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [timeFrameFilter, setTimeFrameFilter] = useState<"current" | "previous" | "all">("current");
  const [sortKey, setSortKey] = useState<SortKey>("dateAccomplishment");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showMilestoneChart, setShowMilestoneChart] = useState(false);
  const [activeChartCategory, setActiveChartCategory] = useState<"milestones" | "structureTags">("milestones");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  const [hideZeroMilestones, setHideZeroMilestones] = useState(false);
  const [sortByCount, setSortByCount] = useState(false);

  // Automatically reset selected filters when activeChartCategory changes
  useEffect(() => {
    setSelectedMilestone(null);
    setSelectedTag(null);
  }, [activeChartCategory]);

  // Automatically reset time-frame filter to "all" if user sets a custom date range
  useEffect(() => {
    if (dateRange.start || dateRange.end) {
      setTimeFrameFilter("all");
    }
  }, [dateRange.start, dateRange.end]);

  const parseDateSafely = (dateStr: string) => {
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

  // Pre-parse and memoize entry and accomplishment dates once when raw data changes
  const memoizedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      _parsedEntryDate: parseDateSafely(item.dateEntry),
      _parsedAccomplishmentDate: parseDateSafely(item.dateAccomplishment)
    }));
  }, [data]);

  // Reset page when filters change to avoid empty pages
  useEffect(() => {
    setCurrentPage(1);
  }, [search, cpFilter, statusFilter, timeFrameFilter, dateRange, pageSize, selectedMilestone]);

  // Stats calculation
  const stats = useMemo(() => {
    let current = 0;
    let prev = 0;
    let total = 0;

    memoizedData.forEach(item => {
      const d = item._parsedEntryDate;
      if (d && !isNaN(d.getTime())) {
        const today = new Date();
        if (isSameWeek(d, today, { weekStartsOn: 1 })) current++;
        else if (isSameWeek(d, subWeeks(today, 1), { weekStartsOn: 1 })) prev++;
      }

      let matchesDateRange = true;
      if (dateRange.start || dateRange.end) {
        const dEntry = item._parsedEntryDate;
        if (!dEntry) {
          matchesDateRange = false;
        } else {
          const dateVal = new Date(dEntry.getFullYear(), dEntry.getMonth(), dEntry.getDate());
          if (dateRange.start) {
            const startD = new Date(dateRange.start);
            const startVal = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
            if (dateVal < startVal) {
              matchesDateRange = false;
            }
          }
          if (dateRange.end) {
            const endD = new Date(dateRange.end);
            const endVal = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
            if (dateVal > endVal) {
              matchesDateRange = false;
            }
          }
        }
      }

      if (matchesDateRange) {
        total++;
      }
    });

    return { current, prev, total };
  }, [memoizedData, dateRange.start, dateRange.end]);

  // Data scoped only by time-frame (current week, previous week, or all dates)
  const timeFrameScopedData = useMemo(() => {
    return memoizedData.filter(item => {
      let matchesWeek = true;
      const d = item._parsedEntryDate;

      if (timeFrameFilter === "current") {
        if (!d) {
          matchesWeek = false;
        } else {
          const now = new Date();
          matchesWeek = isWithinInterval(d, { 
            start: startOfWeek(now, { weekStartsOn: 1 }), 
            end: endOfWeek(now, { weekStartsOn: 1 }) 
          });
        }
      } else if (timeFrameFilter === "previous") {
        if (!d) {
          matchesWeek = false;
        } else {
          const now = new Date();
          const prevWeek = subWeeks(now, 1);
          matchesWeek = isWithinInterval(d, { 
            start: startOfWeek(prevWeek, { weekStartsOn: 1 }), 
            end: endOfWeek(prevWeek, { weekStartsOn: 1 }) 
          });
        }
      }

      let matchesDateRange = true;
      if (dateRange.start || dateRange.end) {
        const dEntry = item._parsedEntryDate;
        if (!dEntry) {
          matchesDateRange = false;
        } else {
          // Normalize the date to avoid timezone offset shifts (compare pure date values)
          const dateVal = new Date(dEntry.getFullYear(), dEntry.getMonth(), dEntry.getDate());

          if (dateRange.start) {
            const startD = new Date(dateRange.start);
            const startVal = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate());
            if (dateVal < startVal) {
              matchesDateRange = false;
            }
          }
          if (dateRange.end) {
            const endD = new Date(dateRange.end);
            const endVal = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate());
            if (dateVal > endVal) {
              matchesDateRange = false;
            }
          }
        }
      }

      return matchesWeek && matchesDateRange;
    });
  }, [memoizedData, timeFrameFilter, dateRange]);

  // Extract unique contract package classification values dynamically based on active time-frame scope
  const uniqueCPs = useMemo(() => {
    const cps = new Set<string>();
    timeFrameScopedData.forEach(item => {
      if (item.cp && item.cp.trim()) {
        cps.add(item.cp.trim());
      }
    });
    return Array.from(cps).sort();
  }, [timeFrameScopedData]);

  // Extract unique accomplishment status values dynamically based on active time-frame scope
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    timeFrameScopedData.forEach(item => {
      if (item.accomplishment && item.accomplishment.trim()) {
        statuses.add(item.accomplishment.trim());
      }
    });
    return Array.from(statuses).sort();
  }, [timeFrameScopedData]);

  const trendChartData = useMemo(() => {
    const now = new Date();
    // Anchor week is subWeeks(now, 1) if "previous" is selected, otherwise now
    const anchorDate = timeFrameFilter === "previous" ? subWeeks(now, 1) : now;

    const weeks = [3, 2, 1, 0].map(weeksAgo => {
      const targetDate = subWeeks(anchorDate, weeksAgo);
      const start = startOfWeek(targetDate, { weekStartsOn: 1 });
      const end = endOfWeek(targetDate, { weekStartsOn: 1 });
      
      // Count accomplishments in this week
      const count = memoizedData.filter(item => {
        const d = item._parsedAccomplishmentDate || item._parsedEntryDate;
        if (!d || isNaN(d.getTime())) return false;
        
        // Also respect CP filter if applied, to keep the chart dynamically reactive to CP selection!
        const matchesCP = !cpFilter || item.cp.trim().toLowerCase() === cpFilter.trim().toLowerCase();
        
        return matchesCP && isWithinInterval(d, { start, end });
      }).length;

      return {
        weekLabel: `Wk of ${format(start, "MMM dd")}`,
        accomplishments: count,
        weeksAgo
      };
    });

    return weeks;
  }, [memoizedData, timeFrameFilter, cpFilter]);

  const trendAnalysis = useMemo(() => {
    if (trendChartData.length < 4) return { text: "No Data", color: "text-slate-500 bg-slate-50 border-slate-200" };
    const latestVal = trendChartData[3].accomplishments;
    const previousVal = trendChartData[2].accomplishments;
    const diff = latestVal - previousVal;

    if (diff > 0) {
      const pct = previousVal > 0 ? ((diff / previousVal) * 100).toFixed(0) : "100";
      return {
        text: `▲ Growth: +${diff} accomplished (+${pct}%) this week`,
        color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/80 dark:text-emerald-400"
      };
    } else if (diff < 0) {
      const pct = previousVal > 0 ? ((Math.abs(diff) / previousVal) * 100).toFixed(0) : "100";
      return {
        text: `▼ Stagnation: -${Math.abs(diff)} accomplished (-${pct}%) this week`,
        color: "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/80 dark:text-amber-400"
      };
    } else {
      return {
        text: `Stable: No change in accomplishments this week`,
        color: "text-slate-700 bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-800/80 dark:text-slate-400"
      };
    }
  }, [trendChartData]);

  const diff = useMemo(() => {
    if (trendChartData.length < 4) return 0;
    return trendChartData[3].accomplishments - trendChartData[2].accomplishments;
  }, [trendChartData]);

  // Automatically reset filters if they are no longer within the dynamic options
  const cpsString = uniqueCPs.join(",");
  const statusesString = uniqueStatuses.join(",");

  useEffect(() => {
    const currentCPs = cpsString ? cpsString.split(",") : [];
    if (cpFilter && !currentCPs.includes(cpFilter)) {
      setCpFilter("");
    }
  }, [cpsString, cpFilter]);

  useEffect(() => {
    if (statusFilter && statusFilter.toLowerCase() === "issued") return;
    const currentStatuses = statusesString ? statusesString.split(",") : [];
    if (statusFilter && !currentStatuses.includes(statusFilter)) {
      setStatusFilter("");
    }
  }, [statusesString, statusFilter]);

  // Dynamic Milestone status counts based on active search, CP and time-frame filters
  const milestoneCounts = useMemo(() => {
    const counts: Record<string, number> = {
      not_issued: 0,
      otb_issued: 0,
      otb_accepted: 0,
      otb_rejected: 0,
      doas_signed: 0,
      ejeas_signed: 0,
      adri_signed: 0,
      pte_issued: 0,
      with_moa: 0,
      with_cno: 0,
      partially_paid: 0,
      paid_with_wop: 0,
      fully_paid: 0,
      handed_over_lots: 0
    };

    timeFrameScopedData.forEach(item => {
      const searchLower = search.trim().toLowerCase();
      const matchesSearch = !search || (
        [
          String(item.lotId),
          String(item.tag || ""),
          String(item.cp),
          String(item.owner),
          String(item.personnel),
          String(item.accomplishment),
          String(item.remarks || ""),
          String(item.dateAccomplishment)
        ].some(v => v.toLowerCase().includes(searchLower))
      );

      const matchesCP = !cpFilter || item.cp.trim().toLowerCase() === cpFilter.trim().toLowerCase();

      if (matchesSearch && matchesCP) {
        const accText = item.accomplishment || "";
        MILESTONES.forEach(m => {
          if (m.matches(accText)) {
            counts[m.key]++;
          }
        });
      }
    });

    return counts;
  }, [timeFrameScopedData, search, cpFilter]);

  const chartData = useMemo(() => {
    let data = MILESTONES.map(m => ({
      key: m.key,
      name: m.label,
      count: milestoneCounts[m.key] || 0,
      color: MILESTONE_COLORS[m.key] || "#6366F1"
    }));

    if (hideZeroMilestones) {
      data = data.filter(d => d.count > 0);
    }

    if (sortByCount) {
      data = [...data].sort((a, b) => b.count - a.count);
    }

    return data;
  }, [milestoneCounts, hideZeroMilestones, sortByCount]);

  const top10StructureTags = useMemo(() => {
    const counts: Record<string, number> = {};

    timeFrameScopedData.forEach(item => {
      const searchLower = search.trim().toLowerCase();
      const matchesSearch = !search || (
        [
          String(item.lotId),
          String(item.tag || ""),
          String(item.cp),
          String(item.owner),
          String(item.personnel),
          String(item.accomplishment),
          String(item.remarks || ""),
          String(item.dateAccomplishment)
        ].some(v => v.toLowerCase().includes(searchLower))
      );

      const matchesCP = !cpFilter || item.cp.trim().toLowerCase() === cpFilter.trim().toLowerCase();

      if (matchesSearch && matchesCP) {
        const tags = splitTags(item.tag || "");
        tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    const colors = [
      "#6366F1", "#3B82F6", "#10B981", "#F59E0B", "#14B8A6", 
      "#8B5CF6", "#F43F5E", "#0EA5E9", "#ED64A6", "#319795"
    ];

    let sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    if (hideZeroMilestones) {
      sorted = sorted.filter(d => d.count > 0);
    }

    return sorted
      .slice(0, 10)
      .map((item, idx) => ({
        key: item.name,
        name: item.name,
        count: item.count,
        color: colors[idx % colors.length]
      }));
  }, [timeFrameScopedData, search, cpFilter, hideZeroMilestones]);

  const currentChartData = useMemo(() => {
    if (activeChartCategory === "structureTags") {
      return top10StructureTags;
    }
    return chartData;
  }, [activeChartCategory, chartData, top10StructureTags]);

  // Dynamic Issued status count based on active search, CP and time-frame filters
  const issuedCount = useMemo(() => {
    return milestoneCounts.otb_issued;
  }, [milestoneCounts]);

  const filteredData = useMemo(() => {
    return timeFrameScopedData.filter(item => {
      const searchLower = search.trim().toLowerCase();
      const matchesSearch = !search || (
        [
          String(item.lotId),
          String(item.tag || ""),
          String(item.cp),
          String(item.owner),
          String(item.personnel),
          String(item.accomplishment),
          String(item.remarks || ""),
          String(item.dateAccomplishment)
        ].some(v => v.toLowerCase().includes(searchLower))
      );
      
      const matchesCP = !cpFilter || item.cp.trim().toLowerCase() === cpFilter.trim().toLowerCase();
      
      let matchesStatus = !statusFilter || (
        statusFilter.toLowerCase() === "issued"
          ? item.accomplishment.trim().toLowerCase().includes("issued")
          : item.accomplishment.trim().toLowerCase() === statusFilter.trim().toLowerCase()
      );

      // Apply selected milestone filter if active
      if (activeChartCategory === "milestones" && selectedMilestone) {
        const milestone = MILESTONES.find(m => m.key === selectedMilestone);
        if (milestone) {
          matchesStatus = matchesStatus && milestone.matches(item.accomplishment || "");
        }
      }

      // Apply selected tag filter if active
      let matchesTag = true;
      if (activeChartCategory === "structureTags" && selectedTag) {
        const tags = splitTags(item.tag || "").map(t => t.toLowerCase());
        matchesTag = tags.includes(selectedTag.trim().toLowerCase());
      }
      
      return matchesSearch && matchesCP && matchesStatus && matchesTag;
    });
  }, [timeFrameScopedData, search, cpFilter, statusFilter, selectedMilestone, selectedTag, activeChartCategory]);

  const sortedAndFilteredData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortKey === "dateAccomplishment") {
        const dA = a._parsedAccomplishmentDate;
        const dB = b._parsedAccomplishmentDate;
        const timeA = dA ? dA.getTime() : 0;
        const timeB = dB ? dB.getTime() : 0;
        return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      }

      if (sortKey === "lotId") {
        const numA = parseFloat(a.lotId);
        const numB = parseFloat(b.lotId);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortOrder === "asc" ? numA - numB : numB - numA;
        }
        valA = String(a.lotId).toLowerCase();
        valB = String(b.lotId).toLowerCase();
      } else if (sortKey === "accomplishment") {
        valA = String(a.accomplishment).toLowerCase();
        valB = String(b.accomplishment).toLowerCase();
      } else if (sortKey === "tag") {
        valA = String(a.tag || "").toLowerCase();
        valB = String(b.tag || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredData.slice(start, start + pageSize);
  }, [sortedAndFilteredData, currentPage, pageSize]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 group-hover/header:text-slate-600 transition-colors shrink-0" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold shrink-0" />
    );
  };

  const handleDownloadExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Weekly Accomplishments");

      // Define columns
      worksheet.columns = [
        { header: "Date Accomplished", key: "dateAccomplishment", width: 22 },
        { header: "Lot ID", key: "lotId", width: 15 },
        { header: "Structure Tag", key: "tag", width: 18 },
        { header: "Contract Package (CP)", key: "cp", width: 15 },
        { header: "Registered Owner", key: "owner", width: 30 },
        { header: "Personnel", key: "personnel", width: 25 },
        { header: "Accomplishment / Status", key: "accomplishment", width: 35 },
        { header: "Remarks", key: "remarks", width: 40 },
        { header: "Date Entered", key: "dateEntry", width: 22 }
      ];

      // Style header row
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E293B" } // Slate-800
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 28;

      // Add data rows
      sortedAndFilteredData.forEach(item => {
        const row = worksheet.addRow({
          dateAccomplishment: item.dateAccomplishment || "",
          lotId: item.lotId || "",
          tag: item.tag || "",
          cp: item.cp || "",
          owner: item.owner || "",
          personnel: item.personnel || "",
          accomplishment: item.accomplishment || "",
          remarks: item.remarks || "",
          dateEntry: item.dateEntry || ""
        });

        // Add soft borders and alignments
        row.alignment = { vertical: "middle" };
        row.height = 22;
      });

      // Style border and alignments for headers and values
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } }
          };
          if (rowNumber > 1) {
            cell.font = { name: "Arial", size: 10 };
          }
        });
      });

      // Write to buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `Weekly_Accomplishments_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating Excel:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section with page title and actions */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2 border-b border-slate-100 dark:border-slate-800/40">
        <div className="flex items-start gap-4">
          <div className="h-12 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500 shrink-0 self-center" />
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className={cn("text-2xl font-black tracking-tight font-sans uppercase", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                Weekly Accomplishments
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/25">
                Field Logs
              </span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Real-time monitoring, audit logs, and field validation reports
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm shadow-emerald-500/10 hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin")} />
            <span>Refresh Logs</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadExcel}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-xs transition-all cursor-pointer border",
              activeTheme.isDark 
                ? "bg-slate-800 border-slate-750 text-slate-100 hover:bg-slate-750" 
                : "bg-slate-900 border-slate-950 text-white hover:bg-black"
            )}
          >
            <FileDown className="w-4 h-4 text-sky-400" />
            <span>Export Masterlist</span>
          </motion.button>
        </div>
      </header>

      {/* Mini Stats Panel (Horizontal Row with Beautiful Accents and Staggered Hover) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Current Week */}
        <motion.div 
          whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setTimeFrameFilter("current");
            setDateRange({ start: "", end: "" });
          }}
          className={cn(
            "p-5.5 rounded-3xl border flex items-center justify-between transition-all relative overflow-hidden cursor-pointer",
            timeFrameFilter === "current"
              ? activeTheme.isDark
                ? "bg-blue-950/20 border-blue-500 shadow-md shadow-blue-500/10"
                : "bg-blue-50/20 border-blue-400 shadow-md shadow-blue-500/5"
              : activeTheme.isDark 
                ? "bg-slate-900/40 border-slate-800/85 text-slate-150 hover:bg-slate-900/60" 
                : "bg-white border-slate-200 text-slate-800 hover:shadow-md hover:shadow-slate-100/50"
          )}
        >
          <div className={cn(
            "absolute top-0 left-0 h-full w-1.5 transition-all",
            timeFrameFilter === "current" ? "w-2.5 bg-blue-500" : "bg-blue-500"
          )} />
          <div className="pl-1">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1.5 transition-colors",
              timeFrameFilter === "current" ? "text-blue-500 font-black" : "text-slate-400 dark:text-slate-500"
            )}>Current Week</p>
            <p className={cn("text-3xl font-black font-mono tracking-tighter leading-none", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
              {stats.current}
            </p>
            <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider block mt-2">Active Field Updates</span>
          </div>
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shadow-3xs shrink-0", activeTheme.isDark ? "bg-blue-950/45 text-blue-400 border border-blue-900/30" : "bg-blue-50 text-blue-600 border border-blue-100")}>
            <CalendarIcon className={cn("w-5 h-5", timeFrameFilter === "current" && "animate-pulse")} />
          </div>
        </motion.div>

        {/* Card 2: Previous Week */}
        <motion.div 
          whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setTimeFrameFilter("previous");
            setDateRange({ start: "", end: "" });
          }}
          className={cn(
            "p-5.5 rounded-3xl border flex items-center justify-between transition-all relative overflow-hidden cursor-pointer",
            timeFrameFilter === "previous"
              ? activeTheme.isDark
                ? "bg-amber-950/20 border-amber-500 shadow-md shadow-amber-500/10"
                : "bg-amber-50/20 border-amber-400 shadow-md shadow-amber-500/5"
              : activeTheme.isDark 
                ? "bg-slate-900/40 border-slate-800/85 text-slate-150 hover:bg-slate-900/60" 
                : "bg-white border-slate-200 text-slate-800 hover:shadow-md hover:shadow-slate-100/50"
          )}
        >
          <div className={cn(
            "absolute top-0 left-0 h-full w-1.5 transition-all",
            timeFrameFilter === "previous" ? "w-2.5 bg-amber-500" : "bg-amber-500"
          )} />
          <div className="pl-1">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1.5 transition-colors",
              timeFrameFilter === "previous" ? "text-amber-500 font-black" : "text-slate-400 dark:text-slate-500"
            )}>Previous Week</p>
            <p className={cn("text-3xl font-black font-mono tracking-tighter leading-none", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
              {stats.prev}
            </p>
            <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider block mt-2">Verified Progress Logs</span>
          </div>
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shadow-3xs shrink-0", activeTheme.isDark ? "bg-amber-950/45 text-amber-400 border border-amber-900/30" : "bg-amber-50 text-amber-600 border border-amber-100")}>
            <Clock className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Card 3: Overall Total */}
        <motion.div 
          whileHover={{ y: -5, scale: 1.01, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setTimeFrameFilter("all");
            setDateRange({ start: "", end: "" });
          }}
          className={cn(
            "p-5.5 rounded-3xl border flex items-center justify-between transition-all relative overflow-hidden cursor-pointer",
            timeFrameFilter === "all"
              ? activeTheme.isDark
                ? "bg-emerald-950/20 border-emerald-500 shadow-md shadow-emerald-500/10"
                : "bg-emerald-50/20 border-emerald-400 shadow-md shadow-emerald-500/5"
              : activeTheme.isDark 
                ? "bg-slate-900/40 border-slate-800/85 text-slate-150 hover:bg-slate-900/60" 
                : "bg-white border-slate-200 text-slate-800 hover:shadow-md hover:shadow-slate-100/50"
          )}
        >
          <div className={cn(
            "absolute top-0 left-0 h-full w-1.5 transition-all",
            timeFrameFilter === "all" ? "w-2.5 bg-emerald-500" : "bg-emerald-500"
          )} />
          <div className="pl-1">
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest mb-1.5 transition-colors",
              timeFrameFilter === "all" ? "text-emerald-500 font-black" : "text-slate-400 dark:text-slate-500"
            )}>Overall Total</p>
            <p className={cn("text-3xl font-black font-mono tracking-tighter leading-none", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
              {stats.total}
            </p>
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider block mt-2">Cumulative Records Logged</span>
          </div>
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center shadow-3xs shrink-0", activeTheme.isDark ? "bg-emerald-950/45 text-emerald-400 border border-emerald-900/30" : "bg-emerald-50 text-emerald-600 border border-emerald-100")}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </motion.div>
      </div>



      {/* Milestone Summaries Bento Grid */}
      <div className={cn(
        "p-6 rounded-[2rem] border transition-all shadow-xs space-y-6",
        activeTheme.isDark 
          ? "bg-slate-900/30 border-slate-800/80 text-slate-100" 
          : "bg-white border-slate-200"
      )}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center border border-indigo-500/20">
              <TrendingUp className="w-4 h-4 text-indigo-500 animate-pulse" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#1E3A8A] dark:text-slate-200">
                Weekly Accomplishments Milestone Tracker
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Monitor key real estate lot milestone counts dynamically filtered in real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMilestoneChart(!showMilestoneChart)}
              className={cn(
                "text-[10px] font-black uppercase px-4 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02]",
                showMilestoneChart
                  ? "bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/10"
                  : activeTheme.isDark
                    ? "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-950/70"
                    : "bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100"
              )}
            >
              {showMilestoneChart ? <SlidersHorizontal className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
              {showMilestoneChart ? "Show Grid View" : "Show Chart View"}
            </button>
            {selectedMilestone && (
              <button
                onClick={() => setSelectedMilestone(null)}
                className="text-[10px] font-black uppercase text-rose-500 hover:text-rose-600 transition-all hover:scale-105 cursor-pointer bg-rose-500/5 px-3 py-2 rounded-xl border border-rose-500/10"
              >
                Clear Filter [x]
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {!showMilestoneChart ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3.5"
            >
              {MILESTONES.map((m) => {
                const isActive = selectedMilestone === m.key;
                const count = milestoneCounts[m.key] || 0;
                const colorValue = MILESTONE_COLORS[m.key] || "#6366F1";
                return (
                  <motion.button
                    key={m.key}
                    whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setSelectedMilestone(isActive ? null : m.key);
                      setStatusFilter(""); // Clear dropdown status filter to avoid conflicts
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl border text-center transition-all relative overflow-hidden flex flex-col justify-between items-center h-[115px] cursor-pointer w-full shadow-xs",
                      isActive
                        ? activeTheme.isDark
                          ? "bg-slate-900 border-2"
                          : "bg-white border-2"
                        : activeTheme.isDark
                          ? "bg-slate-950/45 border-slate-800/70 hover:border-slate-700 hover:bg-slate-950/85 text-slate-300"
                          : "bg-white border-slate-150 hover:border-slate-300 hover:bg-slate-50/50 text-slate-750"
                    )}
                    style={{
                      borderColor: isActive ? colorValue : undefined,
                      boxShadow: isActive ? `0 10px 15px -3px ${colorValue}1A, 0 4px 6px -4px ${colorValue}1A` : undefined
                    }}
                  >
                    {/* Top colored accent bar */}
                    <div 
                      className="absolute top-0 left-0 w-full h-1" 
                      style={{ backgroundColor: colorValue }}
                    />

                    {/* Circle Indicator + Category Name */}
                    <div className="flex flex-col items-center gap-1.5 w-full justify-center text-center mt-1">
                      <span 
                        className="w-2 h-2 rounded-full shrink-0" 
                        style={{ 
                          backgroundColor: colorValue,
                          boxShadow: count > 0 ? `0 0 8px ${colorValue}` : undefined,
                        }}
                      />
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest block truncate text-center max-w-full leading-tight",
                        isActive ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"
                      )}>
                        {m.label}
                      </span>
                    </div>

                    {/* Centered Large Metric Number */}
                    <div className="flex items-center justify-center w-full my-1">
                      <span className={cn(
                        "text-2.5xl font-black font-mono leading-none tracking-tight text-center transition-transform",
                        count > 0 ? "scale-105" : "opacity-30 text-slate-400"
                      )}
                      style={{ color: count > 0 ? (activeTheme.isDark ? "#f8fafc" : "#0f172a") : undefined }}
                      >
                        {count}
                      </span>
                    </div>

                    {/* Bottom Micro State Label */}
                    <div className="w-full text-center flex justify-center mt-0.5">
                      {isActive ? (
                        <span 
                          className="text-[7px] font-black uppercase px-2 py-0.5 rounded-full text-white tracking-widest shadow-xs"
                          style={{ backgroundColor: colorValue }}
                        >
                          Filtering
                        </span>
                      ) : (
                        <span className="text-[7.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block text-center">
                          {count > 0 ? "Click to View" : "No Data"}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="chart"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Chart custom configuration panel */}
              <div className={cn(
                "p-4 rounded-2xl border flex flex-wrap gap-4 items-center justify-between text-xs transition-colors",
                activeTheme.isDark 
                  ? "bg-slate-950/60 border-slate-800/80 text-slate-300" 
                  : "bg-slate-50 border-slate-150 text-slate-700"
              )}>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Chart Category Toggle */}
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-xl border",
                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  )}>
                    <button
                      onClick={() => setActiveChartCategory("milestones")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[9px] transition-all flex items-center gap-1.5 cursor-pointer",
                        activeChartCategory === "milestones"
                          ? "bg-indigo-500 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      Milestones
                    </button>
                    <button
                      onClick={() => setActiveChartCategory("structureTags")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[9px] transition-all flex items-center gap-1.5 cursor-pointer",
                        activeChartCategory === "structureTags"
                          ? "bg-indigo-500 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      Top 10 Structure Tags
                    </button>
                  </div>

                  {/* Chart Type Toggle */}
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-xl border",
                    activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                  )}>
                    <button
                      onClick={() => setChartType("bar")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[9px] transition-all flex items-center gap-1.5 cursor-pointer",
                        chartType === "bar"
                          ? "bg-indigo-500 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      Bar Chart
                    </button>
                    <button
                      onClick={() => setChartType("pie")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg font-black uppercase tracking-wider text-[9px] transition-all flex items-center gap-1.5 cursor-pointer",
                        chartType === "pie"
                          ? "bg-indigo-500 text-white shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <PieChartIcon className="w-3.5 h-3.5" />
                      Donut Chart
                    </button>
                  </div>

                  {/* Hide Empty Toggle */}
                  <button
                    onClick={() => setHideZeroMilestones(!hideZeroMilestones)}
                    className={cn(
                      "px-3 py-2 rounded-xl font-black transition-all flex items-center gap-2 border cursor-pointer text-[9px] uppercase tracking-wider",
                      hideZeroMilestones
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : activeTheme.isDark
                          ? "bg-slate-950/20 border-slate-800 text-slate-400 hover:text-slate-200"
                          : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50"
                    )}
                  >
                    {hideZeroMilestones ? <EyeOff className="w-3.5 h-3.5 text-amber-500" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                    {hideZeroMilestones ? "Hiding 0 counts" : "Show All"}
                  </button>

                  {/* Sort Order Toggle */}
                  <button
                    onClick={() => setSortByCount(!sortByCount)}
                    className={cn(
                      "px-3 py-2 rounded-xl font-black transition-all flex items-center gap-2 border cursor-pointer text-[9px] uppercase tracking-wider",
                      sortByCount
                        ? "bg-teal-500/10 text-teal-500 border-teal-500/20"
                        : activeTheme.isDark
                          ? "bg-slate-950/20 border-slate-800 text-slate-400 hover:text-slate-200"
                          : "bg-white border-slate-200 text-slate-550 hover:bg-slate-50"
                    )}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {sortByCount ? "Ranked by Count" : "Chronological"}
                  </button>
                </div>

                <div className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-500/5 px-3 py-1.5 rounded-xl border border-indigo-500/10">
                  Total Events: {(Object.values(milestoneCounts) as number[]).reduce((a, b) => a + b, 0)}
                </div>
              </div>

              {/* Chart Display Area */}
              <div className={cn(
                "p-5 rounded-2xl border transition-colors",
                activeTheme.isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/40 border-slate-150"
              )}>
                <div className="mb-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span className="font-semibold tracking-wide">
                    {activeChartCategory === "structureTags" ? (
                      selectedTag 
                        ? `Active Structure Tag: ${selectedTag}`
                        : "Interactive Chart: Click any structure tag to filter updates below."
                    ) : (
                      selectedMilestone 
                        ? `Active Milestone: ${MILESTONES.find(m => m.key === selectedMilestone)?.label}`
                        : "Interactive Chart: Click any section to filter updates below."
                    )}
                  </span>
                  {(activeChartCategory === "structureTags" ? selectedTag : selectedMilestone) && (
                    <button 
                      onClick={() => activeChartCategory === "structureTags" ? setSelectedTag(null) : setSelectedMilestone(null)}
                      className="text-indigo-500 hover:underline font-black uppercase tracking-wider text-[10px]"
                    >
                      Reset Filter ×
                    </button>
                  )}
                </div>

                {chartType === "bar" ? (
                  <ResponsiveContainer width="100%" height={450}>
                    <BarChart
                      layout="vertical"
                      data={currentChartData}
                      margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                      onClick={(state) => {
                        if (state && state.activeLabel) {
                          if (activeChartCategory === "milestones") {
                            const clickedMilestone = MILESTONES.find(m => m.label === state.activeLabel);
                            if (clickedMilestone) {
                              setSelectedMilestone(selectedMilestone === clickedMilestone.key ? null : clickedMilestone.key);
                              setStatusFilter("");
                            }
                          } else {
                            const clickedTag = top10StructureTags.find(t => t.name === state.activeLabel);
                            if (clickedTag) {
                              setSelectedTag(selectedTag === clickedTag.name ? null : clickedTag.name);
                            }
                          }
                        }
                      }}
                    >
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        horizontal={false} 
                        vertical={true} 
                        stroke={activeTheme.isDark ? "#1e293b" : "#e2e8f0"} 
                        opacity={0.5} 
                      />
                      <XAxis 
                        type="number"
                        stroke={activeTheme.isDark ? "#64748b" : "#475569"} 
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis 
                        type="category"
                        dataKey="name" 
                        stroke={activeTheme.isDark ? "#94a3b8" : "#475569"} 
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        width={120}
                      />
                      <Tooltip
                        cursor={{ fill: activeTheme.isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.02)" }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            const isSelected = activeChartCategory === "structureTags"
                              ? selectedTag === d.key
                              : selectedMilestone === d.key;
                            return (
                              <div className={cn(
                                "p-3 rounded-xl border shadow-lg text-xs space-y-1",
                                activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-150" : "bg-white border-slate-200 text-slate-800"
                              )}>
                                <p className="font-bold">{d.name}</p>
                                <p className="font-mono text-indigo-500 font-extrabold">Count: {d.count}</p>
                                <p className="text-[10px] text-slate-400">
                                  {isSelected ? "Click to clear filter" : "Click to filter updates"}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={16}>
                        {currentChartData.map((entry, index) => {
                          const isSelected = activeChartCategory === "structureTags"
                            ? selectedTag === entry.key
                            : selectedMilestone === entry.key;
                          const hasSelected = activeChartCategory === "structureTags"
                            ? !!selectedTag
                            : !!selectedMilestone;
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.color} 
                              style={{
                                cursor: "pointer",
                                filter: hasSelected && !isSelected ? "grayscale(85%) opacity(35%)" : "none",
                                transition: "all 0.2s"
                              }}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    <div className="md:col-span-7 h-[400px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={currentChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={85}
                            outerRadius={135}
                            paddingAngle={3}
                            dataKey="count"
                            onClick={(data, index) => {
                              if (data && data.payload) {
                                const key = data.payload.key;
                                if (activeChartCategory === "milestones") {
                                  setSelectedMilestone(selectedMilestone === key ? null : key);
                                  setStatusFilter("");
                                } else {
                                  setSelectedTag(selectedTag === key ? null : key);
                                }
                              }
                            }}
                          >
                            {currentChartData.map((entry, index) => {
                              const isSelected = activeChartCategory === "structureTags"
                                ? selectedTag === entry.key
                                : selectedMilestone === entry.key;
                              const hasSelected = activeChartCategory === "structureTags"
                                ? !!selectedTag
                                : !!selectedMilestone;
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.color} 
                                  style={{
                                    cursor: "pointer",
                                    filter: hasSelected && !isSelected ? "grayscale(85%) opacity(35%)" : "none",
                                    transition: "all 0.2s"
                                  }}
                                />
                              );
                            })}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                const isSelected = activeChartCategory === "structureTags"
                                  ? selectedTag === d.key
                                  : selectedMilestone === d.key;
                                return (
                                  <div className={cn(
                                    "p-3 rounded-xl border shadow-lg text-xs space-y-1",
                                    activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-150" : "bg-white border-slate-200 text-slate-800"
                                  )}>
                                    <p className="font-bold">{d.name}</p>
                                    <p className="font-mono text-indigo-500 font-extrabold">Count: {d.count}</p>
                                    <p className="text-[10px] text-slate-400">
                                      {isSelected ? "Click to clear filter" : "Click to filter updates"}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* Interactive Legend sidebar */}
                    <div className="md:col-span-5 flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-2 px-1">
                        {activeChartCategory === "structureTags" ? "Top 10 Structure Tags" : "Milestone Breakdown"}
                      </span>
                      {currentChartData.map((entry, idx) => {
                        const isSelected = activeChartCategory === "structureTags"
                          ? selectedTag === entry.key
                          : selectedMilestone === entry.key;
                        return (
                          <button
                            key={`${entry.key}-${idx}`}
                            onClick={() => {
                              if (activeChartCategory === "milestones") {
                                setSelectedMilestone(isSelected ? null : entry.key);
                                setStatusFilter("");
                              } else {
                                setSelectedTag(isSelected ? null : entry.key);
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer hover:scale-[1.01]",
                              isSelected
                                ? activeTheme.isDark
                                  ? "bg-slate-900 border-indigo-500 text-white"
                                  : "bg-indigo-50/50 border-indigo-300 text-indigo-950"
                                : activeTheme.isDark
                                  ? "bg-slate-950/20 border-slate-850 hover:border-slate-750 hover:bg-slate-950/60 text-slate-300"
                                  : "bg-white border-slate-150 hover:border-slate-250 hover:bg-slate-50 text-slate-700"
                            )}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: entry.color }} />
                              <span className="truncate">{entry.name}</span>
                            </div>
                            <span className="font-mono font-black shrink-0 text-right ml-2 text-indigo-500 dark:text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-md">
                              {entry.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Horizontal Filters Bar (Custom Grid) */}
      <div className={cn(
        "p-6 rounded-[2.2rem] border transition-all shadow-sm flex flex-col gap-5",
        activeTheme.isDark 
          ? "bg-slate-900/40 backdrop-blur-md border-slate-800/80 text-slate-100" 
          : "bg-white border-slate-150 shadow-[0_12px_40px_rgba(0,0,0,0.03)]"
      )}>
        {/* Dynamic Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "p-2 rounded-xl border flex items-center justify-center",
              activeTheme.isDark 
                ? "bg-slate-950 border-slate-800 text-blue-400" 
                : "bg-blue-50 border-blue-100 text-blue-600"
            )}>
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className={cn(
                "text-xs font-black uppercase tracking-wider font-sans",
                activeTheme.isDark ? "text-slate-200" : "text-slate-800"
              )}>
                Filter & Search Ledger
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Refine the weekly progress updates and accomplishment reports below
              </p>
            </div>
          </div>

          {/* Quick Clear All Button */}
          {(search || cpFilter || statusFilter || timeFrameFilter !== "all" || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setSearch("");
                setCpFilter("");
                setStatusFilter("");
                setTimeFrameFilter("all");
                setDateRange({ start: "", end: "" });
                setSelectedMilestone(null);
              }}
              className="self-start sm:self-center flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer active:scale-95"
            >
              Reset All Filters
            </button>
          )}
        </div>

        {/* Inputs Grid with Perfect Alignment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 gap-6 items-start">
          {/* Col 1: Search Keywords (xl:col-span-3) */}
          <div className="space-y-2.5 xl:col-span-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-500" />
              <span>Search Keywords</span>
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search weekly updates..." 
                className={cn(
                  "w-full pl-9 pr-4 h-[38px] rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-semibold text-xs border",
                  activeTheme.isDark 
                    ? "bg-slate-950 border-slate-800 text-slate-100 focus:border-blue-500/50" 
                    : "bg-slate-50 border-slate-150 text-slate-700 focus:border-slate-300 focus:bg-white"
                )}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Col 2: Contract Package (xl:col-span-2) */}
          <div className="space-y-2.5 xl:col-span-2">
            <div className="flex items-center justify-between h-[15px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                <span>Contract Package</span>
              </span>
              {cpFilter && (
                <button
                  onClick={() => setCpFilter("")}
                  className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                >
                  Clear ×
                </button>
              )}
            </div>
            <div className="relative">
              <select 
                className={cn(
                  "w-full px-4 h-[38px] rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-xs cursor-pointer appearance-none pr-10 border transition-all",
                  activeTheme.isDark 
                    ? "bg-slate-950 border-slate-800 text-slate-300 focus:border-blue-500/50" 
                    : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100/50 focus:bg-white focus:border-slate-300"
                )}
                value={cpFilter}
                onChange={(e) => setCpFilter(e.target.value)}
              >
                <option value="">All Contract Packages</option>
                {uniqueCPs.map(cp => (
                  <option key={cp} value={cp}>{cp}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Col 3: Accomplishment Status (xl:col-span-2) */}
          <div className="space-y-2.5 xl:col-span-2">
            <div className="flex items-center justify-between h-[15px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Accomplishment Status</span>
              </span>
              {statusFilter && (
                <button
                  onClick={() => {
                    setStatusFilter("");
                    setSelectedMilestone(null);
                  }}
                  className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                >
                  Clear ×
                </button>
              )}
            </div>
            <div className="relative">
              <select 
                className={cn(
                  "w-full px-4 h-[38px] rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-xs cursor-pointer appearance-none pr-10 border transition-all",
                  activeTheme.isDark 
                    ? "bg-slate-950 border-slate-800 text-slate-300 focus:border-blue-500/50" 
                    : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100/50 focus:bg-white focus:border-slate-300"
                )}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setSelectedMilestone(null);
                }}
              >
                <option value="">All Statuses</option>
                {statusFilter && statusFilter.toLowerCase() === "issued" && (
                  <option value="issued">All Issued Statuses (Active)</option>
                )}
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Col 4: Time-frame Scope (xl:col-span-2) */}
          <div className="space-y-2.5 xl:col-span-2">
            <div className="flex items-center justify-between h-[15px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Time-frame Scope</span>
              </span>
              {timeFrameFilter !== "all" && (
                <button
                  onClick={() => setTimeFrameFilter("all")}
                  className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                >
                  Clear ×
                </button>
              )}
            </div>
            <div className="relative">
              <select 
                className={cn(
                  "w-full px-4 h-[38px] rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none font-bold text-xs cursor-pointer appearance-none pr-10 border transition-all",
                  activeTheme.isDark 
                    ? "bg-slate-950 border-slate-800 text-slate-300 focus:border-blue-500/50" 
                    : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100/50 focus:bg-white focus:border-slate-300"
                )}
                value={timeFrameFilter}
                onChange={(e) => {
                  const val = e.target.value as "current" | "previous" | "all";
                  setTimeFrameFilter(val);
                  if (val !== "all") {
                    setDateRange({ start: "", end: "" });
                  }
                }}
              >
                <option value="all">All Dates</option>
                <option value="current">Current Week Only</option>
                <option value="previous">Previous Week Only</option>
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Col 5: Custom Date Range (xl:col-span-3) */}
          <div className="space-y-2.5 xl:col-span-3">
            <div className="flex items-center justify-between h-[15px]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-rose-500" />
                <span>Custom Date Range</span>
              </span>
              {(dateRange.start || dateRange.end) && (
                <button
                  type="button"
                  onClick={() => setDateRange({ start: "", end: "" })}
                  className="text-[9px] font-extrabold uppercase tracking-wider text-amber-500 hover:text-amber-600 transition-colors cursor-pointer"
                >
                  Clear Dates ×
                </button>
              )}
            </div>
            
            {/* Elegant side-by-side date picker boxes with floating labels */}
            <div className="grid grid-cols-2 gap-2.5 h-[38px]">
              {/* From Date input */}
              <div className="relative flex items-center h-full">
                <input 
                  type="date" 
                  className={cn(
                    "w-full pl-3 pr-2 h-full rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-semibold text-[10px] border cursor-pointer",
                    activeTheme.isDark 
                      ? "bg-slate-950 border-slate-800 text-slate-150 focus:border-blue-500/50" 
                      : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100/50 focus:bg-white focus:border-slate-300"
                  )}
                  value={dateRange.start}
                  onChange={(e) => {
                    setDateRange(prev => ({ ...prev, start: e.target.value }));
                    setTimeFrameFilter("all");
                  }}
                />
                <span className={cn(
                  "absolute left-2.5 -top-1.5 px-1 text-[8px] font-black uppercase tracking-wider pointer-events-none select-none transition-colors",
                  activeTheme.isDark ? "bg-[#0d1527] text-slate-500" : "bg-white text-slate-400"
                )}>From</span>
              </div>

              {/* To Date input */}
              <div className="relative flex items-center h-full">
                <input 
                  type="date" 
                  className={cn(
                    "w-full pl-3 pr-2 h-full rounded-xl focus:ring-2 focus:ring-blue-500/10 outline-none transition-all font-semibold text-[10px] border cursor-pointer",
                    activeTheme.isDark 
                      ? "bg-slate-950 border-slate-800 text-slate-150 focus:border-blue-500/50" 
                      : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100/50 focus:bg-white focus:border-slate-300"
                  )}
                  value={dateRange.end}
                  onChange={(e) => {
                    setDateRange(prev => ({ ...prev, end: e.target.value }));
                    setTimeFrameFilter("all");
                  }}
                />
                <span className={cn(
                  "absolute left-2.5 -top-1.5 px-1 text-[8px] font-black uppercase tracking-wider pointer-events-none select-none transition-colors",
                  activeTheme.isDark ? "bg-[#0d1527] text-slate-500" : "bg-white text-slate-400"
                )}>To</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Width Redesigned Table View */}
      <div className={cn(
        "backdrop-blur-md border rounded-[2rem] shadow-xl overflow-hidden transition-all",
        activeTheme.isDark 
          ? "bg-slate-900/30 border-slate-800/80 shadow-black/20" 
          : "bg-white border-slate-200 shadow-slate-200/10"
      )}>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className={cn(
                "select-none border-b",
                activeTheme.isDark ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50/70 border-slate-150"
              )}>
                <th 
                  onClick={() => handleSort("dateAccomplishment")}
                  className={cn(
                    "px-6 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer transition-colors group/header",
                    activeTheme.isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-100/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span className={cn(sortKey === "dateAccomplishment" && (activeTheme.isDark ? "text-blue-400" : "text-blue-600"))}>Date Accomplished</span>
                    {renderSortIndicator("dateAccomplishment")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("lotId")}
                  className={cn(
                    "px-6 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer transition-colors group/header",
                    activeTheme.isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-100/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span className={cn(sortKey === "lotId" && (activeTheme.isDark ? "text-blue-400" : "text-blue-600"))}>Lot ID</span>
                    {renderSortIndicator("lotId")}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("tag")}
                  className={cn(
                    "px-6 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer transition-colors group/header",
                    activeTheme.isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-100/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span className={cn(sortKey === "tag" && (activeTheme.isDark ? "text-blue-400" : "text-blue-600"))}>Structure Tag</span>
                    {renderSortIndicator("tag")}
                  </div>
                </th>
                <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[90px]">CP</th>
                <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[240px]">Registered Owner</th>
                <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[170px]">Personnel</th>
                <th 
                  onClick={() => handleSort("accomplishment")}
                  className={cn(
                    "px-6 py-4.5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer transition-colors group/header max-w-[180px]",
                    activeTheme.isDark ? "hover:bg-slate-800/30" : "hover:bg-slate-100/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 justify-start">
                    <span className={cn(sortKey === "accomplishment" && (activeTheme.isDark ? "text-blue-400" : "text-blue-600"))}>Accomplishment / Status</span>
                    {renderSortIndicator("accomplishment")}
                  </div>
                </th>
                <th className="px-6 py-4.5 text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[300px]">Remarks</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y", activeTheme.isDark ? "divide-slate-850/60" : "divide-slate-150/50")}>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <RefreshCcw className="w-10 h-10 text-indigo-500 animate-spin" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Updating Records...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedAndFilteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No matching records found</p>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginatedData.map((row, i) => {
                    const accomplishmentUpper = (row.accomplishment || "").toUpperCase();
                    const isPaid = accomplishmentUpper.includes("PAID") || accomplishmentUpper.includes("FULLY PAID");
                    const isPte = accomplishmentUpper.includes("PTE") || accomplishmentUpper.includes("PERMIT TO ENTER");
                    const isNot = accomplishmentUpper.includes("NOT") || accomplishmentUpper.includes("NOTICE");
                    const isDoas = accomplishmentUpper.includes("DOAS") || accomplishmentUpper.includes("DEED OF ABSOLUTE SALE");

                    let badgeColorClass = "";
                    let IconComponent = CheckCircle2;
                    if (isPaid) {
                      badgeColorClass = activeTheme.isDark 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200/60";
                      IconComponent = CheckCircle2;
                    } else if (isPte) {
                      badgeColorClass = activeTheme.isDark 
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25" 
                        : "bg-cyan-50 text-cyan-700 border border-cyan-200/60";
                      IconComponent = Clock;
                    } else if (isDoas) {
                      badgeColorClass = activeTheme.isDark 
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/25" 
                        : "bg-amber-50 text-amber-700 border border-amber-200/60";
                      IconComponent = FileDown;
                    } else if (isNot) {
                      badgeColorClass = activeTheme.isDark 
                        ? "bg-purple-500/10 text-purple-400 border border-purple-500/25" 
                        : "bg-purple-50 text-purple-700 border border-purple-200/60";
                      IconComponent = Filter;
                    } else {
                      badgeColorClass = activeTheme.isDark 
                        ? "bg-slate-800 text-slate-300 border border-slate-700" 
                        : "bg-slate-100 text-slate-600 border border-slate-200/60";
                      IconComponent = Clock;
                    }

                    return (
                      <motion.tr 
                        key={`${row.lotId}-${row.dateAccomplishment}-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.3) }}
                        className={cn(
                          "group transition-all duration-200 border-b",
                          activeTheme.isDark 
                            ? "hover:bg-slate-850/40 border-slate-800/40" 
                            : "hover:bg-blue-50/20 border-slate-50"
                        )}
                      >
                        {/* Timeline Date representation */}
                        <td className="px-6 py-4.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-2 w-2 shrink-0">
                              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isPaid ? "bg-emerald-400" : "bg-indigo-400")}></span>
                              <span className={cn("relative inline-flex rounded-full h-2 w-2", isPaid ? "bg-emerald-500" : "bg-indigo-500")}></span>
                            </span>
                            <span className={cn("text-xs md:text-sm font-extrabold tracking-tight", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                              {renderHighlightedText(row.dateAccomplishment, search, activeTheme)}
                            </span>
                          </div>
                        </td>

                        {/* Lot ID Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectLot && onSelectLot(row.lotId)}
                            title={`Click to view Lot ${row.lotId} in Quick Search & Profile`}
                            className={cn(
                              "text-xs font-mono font-black px-2.5 py-1 rounded-xl border shadow-3xs transition-all text-left",
                              onSelectLot ? "cursor-pointer hover:scale-105 active:scale-95" : "",
                              activeTheme.isDark 
                                ? "text-slate-300 bg-slate-950/80 border-slate-850 hover:bg-blue-600 hover:text-white hover:border-blue-500" 
                                : "text-slate-600 bg-slate-100 border-slate-200/45 hover:bg-blue-600 hover:text-white hover:border-blue-500"
                            )}
                          >
                            {renderHighlightedText(row.lotId, search, activeTheme)}
                          </button>
                        </td>

                        {/* Structure Tag */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {row.tag ? (
                            <div className="flex flex-col gap-1.5 items-start">
                              {splitTags(row.tag).map((tag, tIdx) => (
                                <span 
                                  key={tIdx}
                                  className={cn(
                                    "text-xs font-mono font-bold block",
                                    activeTheme.isDark ? "text-slate-200" : "text-slate-800"
                                  )}
                                >
                                  {renderHighlightedText(tag, search, activeTheme)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-600 font-mono italic">-</span>
                          )}
                        </td>

                        {/* CP Code */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "text-[10.5px] font-black uppercase tracking-tight px-2.5 py-1 rounded-lg border",
                            activeTheme.isDark 
                              ? "text-blue-400 bg-blue-950/20 border-blue-900/30" 
                              : "text-blue-700 bg-blue-50/60 border-blue-100"
                          )}>
                            {renderHighlightedText(row.cp, search, activeTheme)}
                          </span>
                        </td>

                        {/* Owner detail with custom focus styling */}
                        <td className="px-6 py-4 whitespace-normal max-w-[240px] break-words">
                          <p className={cn(
                            "text-xs md:text-sm font-extrabold transition-colors uppercase leading-snug tracking-tight",
                            activeTheme.isDark ? "text-slate-200 group-hover:text-blue-400" : "text-slate-800 group-hover:text-indigo-600"
                          )}>
                            {renderHighlightedText(row.owner, search, activeTheme)}
                          </p>
                        </td>

                        {/* Personnel circular dynamic initial avatars! */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const avatar = getPersonnelAvatar(row.personnel);
                            return (
                              <div className="flex items-center gap-3">
                                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black uppercase shrink-0 shadow-3xs", avatar.colorClass)}>
                                  {avatar.initials}
                                </div>
                                <span className={cn("text-xs md:text-sm font-semibold whitespace-normal max-w-[120px] break-words leading-snug", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                                  {renderHighlightedText(row.personnel, search, activeTheme)}
                                </span>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Custom visual status indicator - fully filled rectangular cell */}
                        <td className={cn(
                          "px-6 py-4 whitespace-normal max-w-[180px] break-words text-center align-middle font-black uppercase tracking-wider text-[10px] transition-colors duration-150",
                          isPaid && (activeTheme.isDark ? "bg-emerald-950/60 text-emerald-400" : "bg-emerald-100 text-emerald-800"),
                          isPte && (activeTheme.isDark ? "bg-cyan-950/60 text-cyan-400" : "bg-cyan-100 text-cyan-800"),
                          isDoas && (activeTheme.isDark ? "bg-amber-950/60 text-amber-400" : "bg-amber-100/90 text-amber-800"),
                          isNot && (activeTheme.isDark ? "bg-purple-950/60 text-purple-400" : "bg-purple-100 text-purple-800"),
                          !isPaid && !isPte && !isDoas && !isNot && (activeTheme.isDark ? "bg-slate-850 text-slate-300" : "bg-slate-100 text-slate-700")
                        )}>
                          <div className="flex items-center justify-center gap-1.5">
                            <IconComponent className="w-3.5 h-3.5 shrink-0" />
                            <span>{renderHighlightedText(row.accomplishment, search, activeTheme)}</span>
                          </div>
                        </td>

                        {/* Sticky note styled remarks field */}
                        <td className="px-6 py-4 whitespace-normal max-w-[300px] break-words">
                          <div className={cn(
                            "p-3 rounded-xl border max-w-[300px] shadow-3xs hover:shadow-2xs transition-all duration-200",
                            activeTheme.isDark 
                              ? "bg-slate-950/40 border-slate-850/60 text-slate-300" 
                              : "bg-slate-50/50 border-slate-150/60 text-slate-600"
                          )}>
                            <p className="text-xs font-semibold leading-relaxed italic">
                              "{row.remarks ? renderHighlightedText(row.remarks, search, activeTheme) : "No supplementary remarks recorded"}"
                            </p>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className={cn(
            "flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4.5 border-t transition-all",
            activeTheme.isDark 
              ? "bg-slate-950/40 border-slate-800/60" 
              : "bg-slate-50/40 border-slate-150"
          )}>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="text-slate-400">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className={cn(
                  "px-2 py-1.5 rounded-lg border outline-none font-bold text-xs cursor-pointer focus:ring-1 focus:ring-indigo-500",
                  activeTheme.isDark 
                    ? "bg-slate-900 border-slate-800 text-slate-300" 
                    : "bg-white border-slate-200 text-slate-600"
                )}
              >
                {[15, 25, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-slate-400">
                Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, sortedAndFilteredData.length)} of {sortedAndFilteredData.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={cn(
                  "p-2 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  activeTheme.isDark
                    ? "bg-slate-900 border-slate-850 text-slate-300 hover:bg-slate-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className={cn(
                "px-3.5 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider",
                activeTheme.isDark
                  ? "bg-slate-900/40 border-slate-800 text-slate-300"
                  : "bg-white border-slate-200 text-slate-700"
              )}>
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={cn(
                  "p-2 rounded-lg border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  activeTheme.isDark
                    ? "bg-slate-900 border-slate-850 text-slate-300 hover:bg-slate-800"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer counter block with status info */}
      <div className={cn(
        "flex items-center justify-between px-6 py-4.5 rounded-[2rem] shadow-sm border",
        activeTheme.isDark 
          ? "bg-slate-950/60 border-slate-850 text-slate-100" 
          : "bg-slate-900 text-white border-transparent"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
            Showing <span className={cn(activeTheme.isDark ? "text-emerald-400 font-black" : "text-emerald-300 font-black")}>{filteredData.length}</span> of <span className={cn(activeTheme.isDark ? "text-emerald-400 font-black" : "text-emerald-300 font-black")}>{data.length}</span> updates
          </p>
        </div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] hidden sm:block">
          Internal Records System v2.1
        </p>
      </div>
    </div>
  );
};
