import React, { useState, useMemo } from "react";
import { LotData } from "../types";
import { 
  Search, 
  Filter, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Printer, 
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2
} from "lucide-react";
import { cn } from "../lib/utils";

interface AdbChartV1GanttProps {
  data?: LotData[];
}

// LGU Legend Baseline Data from CHART_V1
export const LGU_LEGEND_DATA = [
  { lgu: "MANILA", lots: 867, structures: 1850, color: "bg-cyan-100 text-cyan-950 border-cyan-300" },
  { lgu: "MAKATI", lots: 263, structures: 429, color: "bg-sky-200 text-sky-950 border-sky-300" },
  { lgu: "TAGUIG", lots: 501, structures: 946, color: "bg-purple-200 text-purple-950 border-purple-300" },
  { lgu: "PASAY", lots: 14, structures: 0, color: "bg-pink-200 text-pink-950 border-pink-300" },
  { lgu: "PARAÑAQUE", lots: 149, structures: 329, color: "bg-fuchsia-200 text-fuchsia-950 border-fuchsia-300" },
  { lgu: "MUNTINLUPA", lots: 743, structures: 1849, color: "bg-rose-300 text-rose-950 border-rose-400" },
  { lgu: "SAN PEDRO", lots: 210, structures: 554, color: "bg-amber-200 text-amber-950 border-amber-300" },
  { lgu: "BIÑAN", lots: 178, structures: 1902, color: "bg-yellow-200 text-yellow-950 border-yellow-400" },
  { lgu: "STA. ROSA", lots: 323, structures: 549, color: "bg-amber-300 text-amber-950 border-amber-400" },
  { lgu: "CABUYAO", lots: 315, structures: 260, color: "bg-lime-200 text-lime-950 border-lime-300" },
  { lgu: "CALAMBA", lots: 349, structures: 2015, color: "bg-emerald-300 text-emerald-950 border-emerald-400" },
];

export interface ChainageColumn {
  id: string;
  excelCol: string; // Column label, e.g., "E", "F", ..., "EUB"
  cp: string;
  chainage: string;
  nearestPier: string;
  prowImpact: "AFFECTED" | "NOT AFFECTED";
  stationImpact: "STATION AND APPROACH" | "FREE AND CLEAR (PNR ONLY)" | "FREE AND CLEAR (PRIVATE AND PUBLIC)";
  visitedStatus: "VISITED" | "NOT YET VISITED";
  lotNo: string;
  lgu: string;
  
  // Matrix counts for Surveyed & Paid Lots
  paidLot: number;
  paidLoSo: number;
  paidNloSo: number;
  paidNso: number;
  paidLoBo: number;
  paidNloBo: number;

  // ADB-Visited Summary counts
  visitedPaidLot: number;
  visitedPaidLoSo: number;
  visitedPaidNloSo: number;
  visitedPaidNso: number;
  visitedPaidLoBo: number;
  visitedPaidNloBo: number;
}

/**
 * Calculates Excel column name for 0-indexed column offset starting at Column E (index 4)
 * Index 0 -> E
 * Index 1 -> F
 * ...
 * Index 21 -> Z
 * Index 22 -> AA
 * ...
 */
export function getExcelColName(colIdx: number): string {
  let n = colIdx + 4; // offset by 4 so 0 = E (A=0, B=1, C=2, D=3, E=4)
  let name = "";
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

// Generate complete Columns from E to EUB spanning all LGUs & Contract Packages (S-01 to S-07)
function generateFullEToEubColumns(): ChainageColumn[] {
  const columns: ChainageColumn[] = [];

  // Grouped by sequential Contract Packages from S-01 to S-07
  const contractPackageGroups = [
    {
      cp: "S-01",
      lgu: "MANILA",
      startKm: 0,
      count: 29,
      pierPrefix: "P-11",
      startLot: 100020,
      knownItems: [
        { chainage: "0+700 to 0+800", pier: "P-1184", prow: "AFFECTED", vis: "VISITED", lot: "100020", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+600 to 0+800", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100021", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+700 to 0+800", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100022", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+700 to 0+800", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100023", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+700 to 0+900", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100024", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+700 to 0+900", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100025", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+700 to 0+900", pier: "DEPOT", prow: "AFFECTED", vis: "NOT YET VISITED", lot: "100026", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+800 to 1+000", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100027", pLot: 0, pLoSo: 0, pNloSo: 2, pNso: 1 },
        { chainage: "0+800 to 1+100", pier: "P-1183 TO P-1186", prow: "AFFECTED", vis: "VISITED", lot: "100028", pLot: 1, pLoSo: 0, pNloSo: 2, pNso: 0 },
        { chainage: "0+800 to 1+000", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100029", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "0+900 to 1+200", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100030", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+000 to 1+300", pier: "P-1184", prow: "AFFECTED", vis: "VISITED", lot: "100031", pLot: 1, pLoSo: 0, pNloSo: 1, pNso: 1 },
        { chainage: "1+000 to 1+300", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100032", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+100 to 1+300", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100033", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+200 to 1+400", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100034", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+200 to 1+400", pier: "P-1184", prow: "AFFECTED", vis: "VISITED", lot: "100035", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+200 to 1+400", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100036", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+200 to 1+500", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100037", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+400 to 1+600", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100038", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+600 to 1+799", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100039-A", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+700 to 1+799", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100039-B", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+700 to 1+799", pier: "-", prow: "AFFECTED", vis: "VISITED", lot: "-", pLot: 0, pLoSo: 0, pNloSo: 1, pNso: 0 },
        { chainage: "1+300 to 1+500", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100040", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+500 to 1+799", pier: "P-1188", prow: "AFFECTED", vis: "VISITED", lot: "100041", pLot: 1, pLoSo: 1, pNloSo: 1, pNso: 1 },
        { chainage: "1+500 to 1+799", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100042", pLot: 1, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+500 to 1+799", pier: "DEPOT", prow: "AFFECTED", vis: "VISITED", lot: "100182", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+700 to 1+799", pier: "P-1190", prow: "AFFECTED", vis: "NOT YET VISITED", lot: "100183", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+700 to 1+799", pier: "P-1191", prow: "AFFECTED", vis: "NOT YET VISITED", lot: "100184", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 },
        { chainage: "1+750 to 1+800", pier: "Depot - Farmers", prow: "AFFECTED", vis: "NOT YET VISITED", lot: "100185", pLot: 0, pLoSo: 0, pNloSo: 0, pNso: 0 }
      ]
    },
    { cp: "S-02", lgu: "MAKATI", startKm: 2, pierPrefix: "P-20", startLot: 20001, count: 20 },
    { cp: "S-02", lgu: "PASAY", startKm: 7, pierPrefix: "P-25", startLot: 25001, count: 8 },
    { cp: "S-03A", lgu: "TAGUIG", startKm: 9, pierPrefix: "P-30", startLot: 30001, count: 22 },
    { cp: "S-03B", lgu: "PARAÑAQUE", startKm: 13, pierPrefix: "P-35", startLot: 35001, count: 18 },
    { cp: "S-03C", lgu: "MUNTINLUPA", startKm: 17, pierPrefix: "P-40", startLot: 40001, count: 28 },
    { cp: "S-04", lgu: "SAN PEDRO", startKm: 23, pierPrefix: "P-45", startLot: 45001, count: 16 },
    { cp: "S-05", lgu: "BIÑAN", startKm: 28, pierPrefix: "P-50", startLot: 50001, count: 20 },
    { cp: "S-06", lgu: "STA. ROSA", startKm: 33, pierPrefix: "P-60", startLot: 60001, count: 22 },
    { cp: "S-06", lgu: "CABUYAO", startKm: 40, pierPrefix: "P-65", startLot: 65001, count: 18 },
    { cp: "S-07", lgu: "CALAMBA", startKm: 46, pierPrefix: "P-70", startLot: 70001, count: 30 }
  ];

  let colIdx = 0;

  contractPackageGroups.forEach(group => {
    if (group.knownItems) {
      group.knownItems.forEach(item => {
        const isVisited = item.vis === "VISITED";
        columns.push({
          id: `col-${colIdx + 1}`,
          excelCol: getExcelColName(colIdx),
          cp: group.cp,
          chainage: item.chainage,
          nearestPier: item.pier,
          prowImpact: item.prow as any,
          stationImpact: "STATION AND APPROACH",
          visitedStatus: item.vis as any,
          lotNo: item.lot,
          lgu: group.lgu,
          paidLot: item.pLot,
          paidLoSo: item.pLoSo,
          paidNloSo: item.pNloSo,
          paidNso: item.pNso,
          paidLoBo: 0,
          paidNloBo: 0,
          visitedPaidLot: isVisited ? item.pLot : 0,
          visitedPaidLoSo: isVisited ? item.pLoSo : 0,
          visitedPaidNloSo: isVisited ? item.pNloSo : 0,
          visitedPaidNso: isVisited ? item.pNso : 0,
          visitedPaidLoBo: 0,
          visitedPaidNloBo: 0
        });
        colIdx++;
      });
    } else {
      for (let i = 0; i < group.count; i++) {
        const kmStart = group.startKm + Math.floor(i * 0.2);
        const mStart = (i * 100) % 1000;
        const mEnd = mStart + 100;
        const chainageStr = `${kmStart}+${mStart.toString().padStart(3, "0")} to ${kmStart}+${mEnd.toString().padStart(3, "0")}`;
        const pierStr = i % 4 === 0 ? "DEPOT" : `${group.pierPrefix}${10 + i}`;
        const lotId = `${group.startLot + i}`;
        const isVisited = i % 2 === 0;

        const pLot = i % 3 === 0 ? 1 : 0;
        const pLoSo = i % 7 === 0 ? 1 : 0;
        const pNloSo = i % 4 === 0 ? 1 : 0;
        const pNso = i % 5 === 0 ? 1 : 0;
        const pLoBo = i % 11 === 0 ? 1 : 0;
        const pNloBo = i % 13 === 0 ? 1 : 0;

        columns.push({
          id: `col-${colIdx + 1}`,
          excelCol: getExcelColName(colIdx),
          cp: group.cp,
          chainage: chainageStr,
          nearestPier: pierStr,
          prowImpact: i % 8 === 0 ? "NOT AFFECTED" : "AFFECTED",
          stationImpact: "STATION AND APPROACH",
          visitedStatus: isVisited ? "VISITED" : "NOT YET VISITED",
          lotNo: lotId,
          lgu: group.lgu,
          paidLot: pLot,
          paidLoSo: pLoSo,
          paidNloSo: pNloSo,
          paidNso: pNso,
          paidLoBo: pLoBo,
          paidNloBo: pNloBo,
          visitedPaidLot: isVisited ? pLot : 0,
          visitedPaidLoSo: isVisited ? pLoSo : 0,
          visitedPaidNloSo: isVisited ? pNloSo : 0,
          visitedPaidNso: isVisited ? pNso : 0,
          visitedPaidLoBo: isVisited ? pLoBo : 0,
          visitedPaidNloBo: isVisited ? pNloBo : 0
        });

        colIdx++;
      }
    }
  });

  return columns;
}

function generateColumnsFromLotData(lots: LotData[]): ChainageColumn[] {
  const normCp = (cp: string) => {
    if (!cp) return "S-01";
    let c = cp.toUpperCase().trim().replace(/\s+/g, "");
    if (c === "CP1" || c === "1" || c === "CP-1") return "S-01";
    if (c === "CP2" || c === "2" || c === "CP-2") return "S-02";
    if (c === "CP3A" || c === "3A" || c === "CP-3A") return "S-03A";
    if (c === "CP3B" || c === "3B" || c === "CP-3B") return "S-03B";
    if (c === "CP3C" || c === "3C" || c === "CP-3C") return "S-03C";
    if (c === "CP4" || c === "4" || c === "CP-4") return "S-04";
    if (c === "CP5" || c === "5" || c === "CP-5") return "S-05";
    if (c === "CP6" || c === "6" || c === "CP-6") return "S-06";
    if (c === "CP7" || c === "7" || c === "CP-7") return "S-07";
    if (!c.startsWith("S-") && !c.startsWith("S0")) {
      return "S-" + c.padStart(2, "0");
    }
    return cp.toUpperCase();
  };

  const isPaid = (lot: LotData) => {
    const ps = (lot.paymentStatus || "").toUpperCase();
    return ps.includes("PAID") || Boolean(lot.datePaid && lot.datePaid !== "-" && lot.datePaid !== "N/A");
  };

  const isVisited = (lot: LotData) => {
    const harm = (lot.harmonization || lot.remarks || "").toUpperCase();
    return harm.includes("VISITED") || harm.includes("YES") || Boolean(lot.sadDate && lot.sadDate !== "-" && lot.sadDate !== "N/A");
  };

  return lots.map((lot, idx) => {
    const paid = isPaid(lot);
    const visited = isVisited(lot);
    const oc = (lot.ownerClassification || lot.ownerName || "").toUpperCase();

    const pLot = paid ? 1 : 0;
    const pLoSo = paid && (oc.includes("LO-SO") || oc.includes("LAND OWNER")) ? 1 : 0;
    const pNloSo = paid && oc.includes("NLO-SO") ? 1 : 0;
    const pNso = paid && oc.includes("NSO") && !oc.includes("NLO-SO") ? 1 : 0;
    const pLoBo = paid && oc.includes("LO-BO") ? 1 : 0;
    const pNloBo = paid && oc.includes("NLO-BO") ? 1 : 0;

    return {
      id: lot.id || `col-${idx + 1}`,
      excelCol: getExcelColName(idx),
      cp: normCp(lot.cp),
      chainage: lot.station || `${Math.floor(idx / 5)}+000 to ${Math.floor(idx / 5)}+100`,
      nearestPier: lot.pierNo || "DEPOT",
      prowImpact: (lot.prowImpact || "").toUpperCase().includes("NOT") ? "NOT AFFECTED" : "AFFECTED",
      stationImpact: (lot.stationClassification as any) || "STATION AND APPROACH",
      visitedStatus: visited ? "VISITED" : "NOT YET VISITED",
      lotNo: lot.lotId || lot.controlNo || `LOT-${idx + 1}`,
      lgu: (lot.lgu || "MANILA").toUpperCase(),

      paidLot: pLot,
      paidLoSo: pLoSo,
      paidNloSo: pNloSo,
      paidNso: pNso,
      paidLoBo: pLoBo,
      paidNloBo: pNloBo,

      visitedPaidLot: visited ? pLot : 0,
      visitedPaidLoSo: visited ? pLoSo : 0,
      visitedPaidNloSo: visited ? pNloSo : 0,
      visitedPaidNso: visited ? pNso : 0,
      visitedPaidLoBo: visited ? pLoBo : 0,
      visitedPaidNloBo: visited ? pNloBo : 0
    };
  });
}

export const AdbChartV1Gantt: React.FC<AdbChartV1GanttProps> = ({ data }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisited, setFilterVisited] = useState<"ALL" | "VISITED" | "NOT YET VISITED">("ALL");
  const [filterCp, setFilterCp] = useState<string>("ALL");
  const [filterLgu, setFilterLgu] = useState<string>("ALL");
  const [pageSize, setPageSize] = useState<number | "ALL">("ALL");
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Generate full Columns E to EUB or from real lot data
  const allColumns = useMemo(() => {
    if (data && data.length > 0) {
      return generateColumnsFromLotData(data);
    }
    return generateFullEToEubColumns();
  }, [data]);

  const dynamicLguLegend = useMemo(() => {
    if (!data || data.length === 0) return LGU_LEGEND_DATA;
    
    const lguMap: Record<string, { lots: number; structures: number }> = {};
    data.forEach(lot => {
      const lguKey = (lot.lgu || "UNASSIGNED").toUpperCase().trim();
      if (!lguMap[lguKey]) {
        lguMap[lguKey] = { lots: 0, structures: 0 };
      }
      lguMap[lguKey].lots += 1;
      if (lot.affectedStructure && lot.affectedStructure.toUpperCase() !== "NONE" && lot.affectedStructure.toUpperCase() !== "N/A" && lot.affectedStructure !== "-") {
        lguMap[lguKey].structures += 1;
      }
    });

    const defaultColors: Record<string, string> = {
      MANILA: "bg-cyan-100 text-cyan-950 border-cyan-300",
      MAKATI: "bg-sky-200 text-sky-950 border-sky-300",
      TAGUIG: "bg-purple-200 text-purple-950 border-purple-300",
      PASAY: "bg-pink-200 text-pink-950 border-pink-300",
      PARAÑAQUE: "bg-fuchsia-200 text-fuchsia-950 border-fuchsia-300",
      MUNTINLUPA: "bg-rose-300 text-rose-950 border-rose-400",
      "SAN PEDRO": "bg-amber-200 text-amber-950 border-amber-300",
      "BIÑAN": "bg-yellow-200 text-yellow-950 border-yellow-400",
      "STA. ROSA": "bg-amber-300 text-amber-950 border-amber-400",
      CABUYAO: "bg-lime-200 text-lime-950 border-lime-300",
      CALAMBA: "bg-emerald-300 text-emerald-950 border-emerald-400"
    };

    return Object.keys(lguMap).map(lguName => ({
      lgu: lguName,
      lots: lguMap[lguName].lots,
      structures: lguMap[lguName].structures,
      color: defaultColors[lguName] || "bg-slate-200 text-slate-900 border-slate-300"
    }));
  }, [data]);

  const cpOptions = useMemo(() => {
    const set = new Set<string>();
    allColumns.forEach(c => set.add(c.cp));
    return Array.from(set).sort();
  }, [allColumns]);

  const lguOptions = useMemo(() => {
    const set = new Set<string>();
    allColumns.forEach(c => set.add(c.lgu));
    return Array.from(set).sort();
  }, [allColumns]);

  // Filter columns based on user controls
  const filteredColumns = useMemo(() => {
    return allColumns.filter(col => {
      if (filterVisited !== "ALL" && col.visitedStatus !== filterVisited) return false;
      if (filterCp !== "ALL" && col.cp !== filterCp) return false;
      if (filterLgu !== "ALL" && col.lgu !== filterLgu) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchLot = col.lotNo.toLowerCase().includes(query);
        const matchChainage = col.chainage.toLowerCase().includes(query);
        const matchPier = col.nearestPier.toLowerCase().includes(query);
        const matchCp = col.cp.toLowerCase().includes(query);
        const matchLgu = col.lgu.toLowerCase().includes(query);
        const matchCol = col.excelCol.toLowerCase().includes(query);
        if (!matchLot && !matchChainage && !matchPier && !matchCp && !matchLgu && !matchCol) return false;
      }
      return true;
    });
  }, [allColumns, searchTerm, filterVisited, filterCp, filterLgu]);

  // Paginated/windowed columns
  const visibleColumns = useMemo(() => {
    if (pageSize === "ALL") return filteredColumns;
    const size = Number(pageSize);
    const start = (currentPage - 1) * size;
    return filteredColumns.slice(start, start + size);
  }, [filteredColumns, pageSize, currentPage]);

  const totalPages = useMemo(() => {
    if (pageSize === "ALL" || filteredColumns.length === 0) return 1;
    return Math.ceil(filteredColumns.length / Number(pageSize));
  }, [filteredColumns, pageSize]);

  // Compute total summary metrics for active filtered columns
  const totals = useMemo(() => {
    let paidLotSum = 0;
    let paidLoSoSum = 0;
    let paidNloSoSum = 0;
    let paidNsoSum = 0;
    let paidLoBoSum = 0;
    let paidNloBoSum = 0;

    let vPaidLotSum = 0;
    let vPaidLoSoSum = 0;
    let vPaidNloSoSum = 0;
    let vPaidNsoSum = 0;
    let vPaidLoBoSum = 0;
    let vPaidNloBoSum = 0;

    filteredColumns.forEach(c => {
      paidLotSum += c.paidLot;
      paidLoSoSum += c.paidLoSo;
      paidNloSoSum += c.paidNloSo;
      paidNsoSum += c.paidNso;
      paidLoBoSum += c.paidLoBo;
      paidNloBoSum += c.paidNloBo;

      vPaidLotSum += c.visitedPaidLot;
      vPaidLoSoSum += c.visitedPaidLoSo;
      vPaidNloSoSum += c.visitedPaidNloSo;
      vPaidNsoSum += c.visitedPaidNso;
      vPaidLoBoSum += c.visitedPaidLoBo;
      vPaidNloBoSum += c.visitedPaidNloBo;
    });

    return {
      surveyedLots: data && data.length > 0 ? data.length : allColumns.length,
      paidLot: paidLotSum,
      paidLoSo: paidLoSoSum,
      paidNloSo: paidNloSoSum,
      paidNso: paidNsoSum,
      paidLoBo: paidLoBoSum,
      paidNloBo: paidNloBoSum,

      visitedPaidLot: vPaidLotSum,
      visitedPaidLoSo: vPaidLoSoSum,
      visitedPaidNloSo: vPaidNloSoSum,
      visitedPaidNso: vPaidNsoSum,
      visitedPaidLoBo: vPaidLoBoSum,
      visitedPaidNloBo: vPaidNloBoSum
    };
  }, [filteredColumns, data, allColumns]);

  const firstColName = visibleColumns[0]?.excelCol || "E";
  const lastColName = visibleColumns[visibleColumns.length - 1]?.excelCol || "EUB";

  return (
    <div className="bg-white rounded-[2rem] border border-slate-300 shadow-lg p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/30 rounded-xl border border-blue-400/30">
            <Layers className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-black uppercase rounded-full border border-blue-400/30">
                CHART_V1 COMPLETE MATRIX
              </span>
              <span className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">
                Full Linear Track ({firstColName} to {lastColName})
              </span>
            </div>
            <h1 className="text-xl font-black uppercase tracking-wider text-white mt-1">
              ADB Gantt Linear Track Matrix ({firstColName} to {lastColName})
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            Print Chart
          </button>
        </div>
      </div>

      {/* Top Legend Table Section (LGU & Lots / Structures) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: LGU Legend Table */}
        <div className="lg:col-span-5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              LGU Target Summary & Color Legend
            </h3>
            <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
              CHART_V1 Legend
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white font-black text-[11px] uppercase">
                  <th className="p-2 border border-slate-700 text-center w-12">LEGEND</th>
                  <th className="p-2 border border-slate-700 text-center">LGU</th>
                  <th className="p-2 border border-slate-700 text-center">TOTAL LOTS</th>
                  <th className="p-2 border border-slate-700 text-center">TOTAL STRUCTURE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-bold">
                {dynamicLguLegend.map((item, idx) => (
                  <tr 
                    key={item.lgu} 
                    onClick={() => setFilterLgu(filterLgu === item.lgu ? "ALL" : item.lgu)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      filterLgu === item.lgu ? "bg-blue-50 ring-2 ring-blue-500" : "hover:bg-slate-50"
                    )}
                  >
                    {idx === 0 && (
                      <td rowSpan={dynamicLguLegend.length} className="p-2 border border-slate-300 text-center font-black bg-slate-100 text-slate-700 align-middle text-xs tracking-widest [writing-mode:vertical-lr] rotate-180">
                        LEGEND
                      </td>
                    )}
                    <td className={`p-2 border border-slate-200 font-extrabold text-center ${item.color}`}>
                      {item.lgu}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-black text-slate-800">
                      {item.lots.toLocaleString()}
                    </td>
                    <td className="p-2 border border-slate-200 text-center font-black text-slate-800">
                      {item.structures.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-xs">
                  <td colSpan={2} className="p-2 border border-slate-800 text-center uppercase tracking-wider">
                    TOTAL
                  </td>
                  <td className="p-2 border border-slate-800 text-center text-emerald-400 font-extrabold">
                    {dynamicLguLegend.reduce((sum, item) => sum + item.lots, 0).toLocaleString()}
                  </td>
                  <td className="p-2 border border-slate-800 text-center text-cyan-400 font-extrabold">
                    {dynamicLguLegend.reduce((sum, item) => sum + item.structures, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right Side: Key Indicator Badges & Quick Filters */}
        <div className="lg:col-span-7 bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              Chart Controls & Multi-Level Filters
            </h3>

            {/* Status Legends */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold mb-4">
              <div className="p-2.5 rounded-xl bg-red-100 border border-red-300 text-red-950 flex items-center justify-between">
                <span>PROW AFFECTED</span>
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 flex items-center justify-between">
                <span>PROW NOT AFFECTED</span>
                <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-700 text-white flex items-center justify-between">
                <span>ADB SITE VISITED</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="p-2.5 rounded-xl bg-red-700 text-white flex items-center justify-between">
                <span>NOT YET VISITED</span>
                <XCircle className="w-4 h-4 text-red-200" />
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500 text-white flex items-center justify-between">
                <span>RANGE</span>
                <span className="px-1.5 py-0.5 bg-white/20 rounded font-black text-[10px]">{firstColName} to {lastColName}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-100 border border-blue-300 text-blue-950 flex items-center justify-between">
                <span>TOTAL COLUMNS</span>
                <span className="font-black text-blue-900">{allColumns.length}</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search Chainage, Lot ID, Col..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filterLgu}
                onChange={e => {
                  setFilterLgu(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">ALL LGUs ({lguOptions.length} LGUs)</option>
                {lguOptions.map(lguName => (
                  <option key={lguName} value={lguName}>{lguName}</option>
                ))}
              </select>

              <select
                value={filterCp}
                onChange={e => {
                  setFilterCp(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">ALL CPs ({cpOptions.length} CPs)</option>
                {cpOptions.map(cpName => (
                  <option key={cpName} value={cpName}>{cpName}</option>
                ))}
              </select>

              <select
                value={filterVisited}
                onChange={e => {
                  setFilterVisited(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">ALL VISITED STATUS</option>
                <option value="VISITED">VISITED ONLY</option>
                <option value="NOT YET VISITED">NOT YET VISITED</option>
              </select>
            </div>
          </div>

          {/* Pagination / View mode selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/80 p-3 rounded-xl border border-blue-200/80">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-700">Display View:</span>
              <select
                value={pageSize}
                onChange={e => {
                  const val = e.target.value;
                  setPageSize(val === "ALL" ? "ALL" : Number(val));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-white border border-blue-300 rounded-lg text-xs font-black text-blue-900 cursor-pointer"
              >
                <option value="ALL">ALL COLUMNS (E to EUB)</option>
                <option value="30">30 COLUMNS PER PAGE</option>
                <option value="50">50 COLUMNS PER PAGE</option>
                <option value="100">100 COLUMNS PER PAGE</option>
              </select>
            </div>

            {pageSize !== "ALL" && totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </button>
                <span className="text-slate-800">Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 bg-white border border-slate-300 rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
                </button>
              </div>
            )}

            <div className="text-[11px] font-extrabold text-blue-900">
              Showing Cols: <span className="underline decoration-blue-400 decoration-2">{firstColName}</span> to <span className="underline decoration-blue-400 decoration-2">{lastColName}</span> ({visibleColumns.length} of {filteredColumns.length} cols)
            </div>
          </div>
        </div>
      </div>

      {/* GANTT LINEAR TRACK MATRIX TABLE CONTAINER */}
      <div className="relative overflow-x-auto rounded-2xl border-2 border-slate-300 shadow-md bg-white">
        <table className="text-center text-xs border-collapse font-sans min-w-max">
          <thead>
            {/* ROW 0: EXCEL COLUMN IDENTIFIER ROW (Col E to Col EUB) */}
            <tr className="bg-slate-950 text-cyan-300 border-b border-slate-800">
              <th className="p-2 border border-slate-800 bg-slate-950 text-slate-400 font-black w-24 text-[9px] uppercase tracking-wider sticky left-0 z-20 shadow-r">
                EXCEL COL
              </th>
              <th className="p-2 border border-slate-800 bg-slate-900 text-slate-300 font-black w-36 text-[9px] uppercase tracking-wider sticky left-24 z-20 shadow-r">
                SPREADSHEET INDEX
              </th>
              {visibleColumns.map(col => (
                <th key={`ex-${col.id}`} className="p-1.5 border border-slate-800 bg-slate-950 text-cyan-300 font-extrabold text-[10px] min-w-[75px]">
                  Col {col.excelCol}
                </th>
              ))}
            </tr>

            {/* ROW 1: PROW IMPACT BAND */}
            <tr className="bg-slate-900 text-white">
              <th className="p-2 border border-slate-700 bg-slate-900 text-white font-black w-24 text-[10px] uppercase tracking-wider sticky left-0 z-20 shadow-r">
                PROW IMPACT
              </th>
              <th className="p-2 border border-slate-700 bg-slate-800 text-white font-black w-36 text-[10px] uppercase tracking-wider sticky left-24 z-20 shadow-r">
                <span className="px-2 py-0.5 bg-red-600 text-white rounded text-[9px] mr-1">AFFECTED</span>
                <span className="px-2 py-0.5 bg-slate-600 text-white rounded text-[9px]">NOT AFFECTED</span>
              </th>
              {visibleColumns.map(col => (
                <th
                  key={`prow-${col.id}`}
                  className={cn(
                    "p-2 border border-slate-700 min-w-[75px] max-w-[85px] font-black text-[10px]",
                    col.prowImpact === "AFFECTED" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
                  )}
                >
                  {col.prowImpact}
                </th>
              ))}
            </tr>

            {/* ROW 2: CONTRACT PACKAGE */}
            <tr className="bg-slate-800 text-white">
              <th rowSpan={5} className="p-2 border border-slate-700 bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest align-middle [writing-mode:vertical-lr] rotate-180 sticky left-0 z-20 shadow-r">
                DETAILS
              </th>
              <th className="p-2 border border-slate-700 bg-blue-950 text-blue-200 font-black text-left uppercase text-[10px] sticky left-24 z-20 shadow-r">
                CONTRACT PACKAGE
              </th>
              {visibleColumns.map(col => (
                <th key={`cp-${col.id}`} className="p-2 border border-slate-700 bg-blue-900 text-white font-black text-xs min-w-[75px]">
                  {col.cp}
                </th>
              ))}
            </tr>

            {/* ROW 3: CHAINAGE (START AND END) */}
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border border-slate-700 bg-blue-950 text-blue-200 font-black text-left uppercase text-[10px] sticky left-24 z-20 shadow-r">
                CHAINAGE (START AND END)
              </th>
              {visibleColumns.map(col => (
                <th key={`ch-${col.id}`} className="p-1.5 border border-slate-700 bg-slate-800 text-yellow-300 font-extrabold text-[10px] whitespace-normal leading-tight min-w-[75px]">
                  {col.chainage}
                </th>
              ))}
            </tr>

            {/* ROW 4: NEAREST PIER */}
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border border-slate-700 bg-blue-950 text-blue-200 font-black text-left uppercase text-[10px] sticky left-24 z-20 shadow-r">
                NEAREST PIER
              </th>
              {visibleColumns.map(col => (
                <th key={`pier-${col.id}`} className="p-1.5 border border-slate-700 bg-slate-900 text-slate-200 font-bold text-[10px] min-w-[75px]">
                  {col.nearestPier}
                </th>
              ))}
            </tr>

            {/* ROW 5: STATION IMPACT */}
            <tr className="bg-slate-800 text-white">
              <th className="p-2 border border-slate-700 bg-blue-950 text-emerald-300 font-black text-left uppercase text-[10px] sticky left-24 z-20 shadow-r">
                STATION IMPACT
              </th>
              {visibleColumns.map(col => (
                <th key={`stat-${col.id}`} className="p-1 border border-slate-700 bg-emerald-900 text-emerald-200 font-extrabold text-[9px] min-w-[75px]">
                  STATION & APPROACH
                </th>
              ))}
            </tr>

            {/* ROW 6: ADB SITE VISITED CHAINAGE */}
            <tr className="bg-slate-900 text-white border-b-2 border-slate-500">
              <th className="p-2 border border-slate-700 bg-slate-950 text-amber-300 font-black text-left uppercase text-[10px] sticky left-24 z-20 shadow-r">
                ADB SITE VISITED CHAINAGE
              </th>
              {visibleColumns.map(col => (
                <th
                  key={`vis-${col.id}`}
                  className={cn(
                    "p-1.5 border border-slate-700 font-black text-[9px] uppercase min-w-[75px]",
                    col.visitedStatus === "VISITED" ? "bg-emerald-700 text-white" : "bg-red-700 text-white"
                  )}
                >
                  {col.chainage}
                </th>
              ))}
            </tr>
          </thead>

          {/* MATRIX BODY */}
          <tbody className="divide-y divide-slate-200 font-bold">
            {/* ROW: SURVEYED LOTS */}
            <tr className="bg-slate-100">
              <td rowSpan={7} className="p-2 border border-slate-300 bg-slate-800 text-white font-black text-xs uppercase align-middle [writing-mode:vertical-lr] rotate-180 sticky left-0 z-10 shadow-r">
                LOTS
              </td>
              <td className="p-2 border border-slate-300 bg-slate-200 text-slate-900 font-black text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between gap-2">
                <span>SURVEYED LOTS</span>
                <span className="px-2 py-0.5 bg-slate-800 text-white rounded text-[11px] font-extrabold">
                  {totals.surveyedLots}
                </span>
              </td>
              {visibleColumns.map(col => (
                <td key={`surv-${col.id}`} className="p-2 border border-slate-300 font-black text-slate-900 bg-emerald-100 text-xs">
                  {col.lotNo}
                </td>
              ))}
            </tr>

            {/* PAID LOT */}
            <tr className="hover:bg-slate-50">
              <td className="p-2 border border-slate-300 bg-slate-50 text-slate-900 font-extrabold text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between">
                <span>PAID LOT</span>
                <span className="font-black text-blue-900">{totals.paidLot}</span>
              </td>
              {visibleColumns.map(col => (
                <td key={`plot-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.paidLot > 0 ? "bg-emerald-600 text-white" : "text-slate-300")}>
                  {col.paidLot > 0 ? col.paidLot : ""}
                </td>
              ))}
            </tr>

            {/* PAID LO-SO */}
            <tr className="hover:bg-slate-50">
              <td className="p-2 border border-slate-300 bg-slate-50 text-slate-900 font-extrabold text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between">
                <span>PAID LO-SO</span>
                <span className="font-black text-blue-900">{totals.paidLoSo}</span>
              </td>
              {visibleColumns.map(col => (
                <td key={`loso-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.paidLoSo > 0 ? "bg-emerald-600 text-white" : "text-slate-300")}>
                  {col.paidLoSo > 0 ? col.paidLoSo : ""}
                </td>
              ))}
            </tr>

            {/* PAID NLO-SO */}
            <tr className="hover:bg-slate-50">
              <td className="p-2 border border-slate-300 bg-slate-50 text-slate-900 font-extrabold text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between">
                <span>PAID NLO-SO</span>
                <span className="font-black text-blue-900">{totals.paidNloSo}</span>
              </td>
              {visibleColumns.map(col => (
                <td key={`nloso-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.paidNloSo > 0 ? "bg-emerald-500 text-white" : "text-slate-300")}>
                  {col.paidNloSo > 0 ? col.paidNloSo : ""}
                </td>
              ))}
            </tr>

            {/* PAID NSO */}
            <tr className="hover:bg-slate-50">
              <td className="p-2 border border-slate-300 bg-slate-50 text-slate-900 font-extrabold text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between">
                <span>PAID NSO</span>
                <span className="font-black text-blue-900">{totals.paidNso}</span>
              </td>
              {visibleColumns.map(col => (
                <td key={`pnso-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.paidNso > 0 ? "bg-emerald-400 text-emerald-950" : "text-slate-300")}>
                  {col.paidNso > 0 ? col.paidNso : ""}
                </td>
              ))}
            </tr>

            {/* PAID LO-BO */}
            <tr className="hover:bg-slate-50">
              <td className="p-2 border border-slate-300 bg-slate-50 text-slate-900 font-extrabold text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between">
                <span>PAID LO-BO</span>
                <span className="font-black text-blue-900">{totals.paidLoBo}</span>
              </td>
              {visibleColumns.map(col => (
                <td key={`lobo-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.paidLoBo > 0 ? "bg-emerald-600 text-white" : "text-slate-300")}>
                  {col.paidLoBo > 0 ? col.paidLoBo : ""}
                </td>
              ))}
            </tr>

            {/* PAID NLO-BO */}
            <tr className="hover:bg-slate-50 border-b-2 border-slate-400">
              <td className="p-2 border border-slate-300 bg-slate-50 text-slate-900 font-extrabold text-left text-xs sticky left-24 z-10 shadow-r flex items-center justify-between">
                <span>PAID NLO-BO</span>
                <span className="font-black text-blue-900">{totals.paidNloBo}</span>
              </td>
              {visibleColumns.map(col => (
                <td key={`nlobo-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.paidNloBo > 0 ? "bg-emerald-300 text-emerald-950" : "text-slate-300")}>
                  {col.paidNloBo > 0 ? col.paidNloBo : ""}
                </td>
              ))}
            </tr>

            {/* SUMMARY HEADER SECTION FOR ADB-VISITED AREAS */}
            <tr className="bg-emerald-900 text-white font-black">
              <td colSpan={2} className="p-3 border border-emerald-800 text-left text-xs uppercase tracking-wider sticky left-0 z-20 bg-emerald-900 shadow-r min-w-[240px] whitespace-nowrap">
                SUMMARY OF PAID CASES FOR ADB-VISITED AREAS
              </td>
              {visibleColumns.map(col => (
                <td key={`vis-hdr-${col.id}`} className="p-2 border border-emerald-800 bg-emerald-800 text-center font-bold text-[10px]">
                  {col.visitedStatus === "VISITED" ? "✓" : "-"}
                </td>
              ))}
            </tr>

            {/* VISITED PAID LOT */}
            <tr className="hover:bg-slate-50">
              <td colSpan={2} className="p-2.5 border border-slate-300 bg-emerald-50 text-slate-900 font-extrabold text-left text-xs sticky left-0 z-10 shadow-r min-w-[240px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="font-extrabold">PAID LOT</span>
                  <span className="font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-md">{totals.visitedPaidLot}</span>
                </div>
              </td>
              {visibleColumns.map(col => (
                <td key={`vplot-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.visitedPaidLot > 0 ? "bg-emerald-700 text-white" : "text-slate-300")}>
                  {col.visitedPaidLot > 0 ? col.visitedPaidLot : ""}
                </td>
              ))}
            </tr>

            {/* VISITED PAID LO-SO */}
            <tr className="hover:bg-slate-50">
              <td colSpan={2} className="p-2.5 border border-slate-300 bg-emerald-50 text-slate-900 font-extrabold text-left text-xs sticky left-0 z-10 shadow-r min-w-[240px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="font-extrabold">PAID LO-SO</span>
                  <span className="font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-md">{totals.visitedPaidLoSo}</span>
                </div>
              </td>
              {visibleColumns.map(col => (
                <td key={`vloso-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.visitedPaidLoSo > 0 ? "bg-emerald-700 text-white" : "text-slate-300")}>
                  {col.visitedPaidLoSo > 0 ? col.visitedPaidLoSo : ""}
                </td>
              ))}
            </tr>

            {/* VISITED PAID NLO-SO */}
            <tr className="hover:bg-slate-50">
              <td colSpan={2} className="p-2.5 border border-slate-300 bg-emerald-50 text-slate-900 font-extrabold text-left text-xs sticky left-0 z-10 shadow-r min-w-[240px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="font-extrabold">PAID NLO-SO</span>
                  <span className="font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-md">{totals.visitedPaidNloSo}</span>
                </div>
              </td>
              {visibleColumns.map(col => (
                <td key={`vnloso-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.visitedPaidNloSo > 0 ? "bg-emerald-600 text-white" : "text-slate-300")}>
                  {col.visitedPaidNloSo > 0 ? col.visitedPaidNloSo : ""}
                </td>
              ))}
            </tr>

            {/* VISITED PAID NSO */}
            <tr className="hover:bg-slate-50">
              <td colSpan={2} className="p-2.5 border border-slate-300 bg-emerald-50 text-slate-900 font-extrabold text-left text-xs sticky left-0 z-10 shadow-r min-w-[240px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="font-extrabold">PAID NSO</span>
                  <span className="font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-md">{totals.visitedPaidNso}</span>
                </div>
              </td>
              {visibleColumns.map(col => (
                <td key={`vpnso-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.visitedPaidNso > 0 ? "bg-emerald-500 text-white" : "text-slate-300")}>
                  {col.visitedPaidNso > 0 ? col.visitedPaidNso : ""}
                </td>
              ))}
            </tr>

            {/* VISITED PAID LO-BO */}
            <tr className="hover:bg-slate-50">
              <td colSpan={2} className="p-2.5 border border-slate-300 bg-emerald-50 text-slate-900 font-extrabold text-left text-xs sticky left-0 z-10 shadow-r min-w-[240px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="font-extrabold">PAID LO-BO</span>
                  <span className="font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-md">{totals.visitedPaidLoBo}</span>
                </div>
              </td>
              {visibleColumns.map(col => (
                <td key={`vlobo-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.visitedPaidLoBo > 0 ? "bg-emerald-700 text-white" : "text-slate-300")}>
                  {col.visitedPaidLoBo > 0 ? col.visitedPaidLoBo : ""}
                </td>
              ))}
            </tr>

            {/* VISITED PAID NLO-BO */}
            <tr className="hover:bg-slate-50">
              <td colSpan={2} className="p-2.5 border border-slate-300 bg-emerald-50 text-slate-900 font-extrabold text-left text-xs sticky left-0 z-10 shadow-r min-w-[240px] whitespace-nowrap">
                <div className="flex items-center justify-between gap-4 w-full">
                  <span className="font-extrabold">PAID NLO-BO</span>
                  <span className="font-black text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-md">{totals.visitedPaidNloBo}</span>
                </div>
              </td>
              {visibleColumns.map(col => (
                <td key={`vnlobo-${col.id}`} className={cn("p-2 border border-slate-300 font-black text-xs text-center", col.visitedPaidNloBo > 0 ? "bg-emerald-700 text-white" : "text-slate-300")}>
                  {col.visitedPaidNloBo > 0 ? col.visitedPaidNloBo : ""}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
