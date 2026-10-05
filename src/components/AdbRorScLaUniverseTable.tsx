import React, { useState, useMemo, useEffect } from "react";
import { LotData } from "../types";
import { 
  RotateCcw, 
  Sparkles, 
  Printer, 
  Building2,
  BarChart3
} from "lucide-react";
import { cn } from "../lib/utils";
import { AdbChartV1Gantt } from "./AdbChartV1Gantt";

export interface ScLaUniverseRow {
  id: string;
  rapSection: string;
  cp: string;
  lgu: string;

  // LO RAP (Merged by rapSection for SQM)
  rapPrivateSqm: number;
  rapGovtSqm: number;
  rapTotalSqm: number;

  // Current Data (SQM)
  currentPrivateSqm: number;
  currentUnknownSqm: number;
  currentGovtNgaSqm: number;
  currentLguSqm: number;
  currentPnrSqm: number | string; // Numeric or string like "included in S03b Paranaque"
  currentRpSqm: number;
  currentTotalRowSqm?: number;

  // LOTS Data
  rapTotalLots: number;
  currentTotalLotsAcquisition: number;
  lotsPaid: number;
  lotsHandedOver: number;
  lotsToBeHandedOver?: number;
}

// Baseline data matching spreadsheet image
const INITIAL_ROWS: ScLaUniverseRow[] = [
  {
    id: "1",
    rapSection: "MANILA PO",
    cp: "S01",
    lgu: "MANILA 1",
    rapPrivateSqm: 9656,
    rapGovtSqm: 20178,
    rapTotalSqm: 29835,
    currentPrivateSqm: 8199,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 198,
    currentLguSqm: 1259,
    currentPnrSqm: 18036,
    currentRpSqm: 92,
    currentTotalRowSqm: 27784,
    rapTotalLots: 155,
    currentTotalLotsAcquisition: 126,
    lotsPaid: 1,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 1
  },
  {
    id: "2",
    rapSection: "MANILA 2",
    cp: "S02",
    lgu: "MANILA 2",
    rapPrivateSqm: 80107,
    rapGovtSqm: 178363,
    rapTotalSqm: 258470,
    currentPrivateSqm: 37988,
    currentUnknownSqm: 16,
    currentGovtNgaSqm: 17106,
    currentLguSqm: 5616,
    currentPnrSqm: 158082,
    currentRpSqm: 1046,
    currentTotalRowSqm: 219854,
    rapTotalLots: 605,
    currentTotalLotsAcquisition: 586,
    lotsPaid: 6,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 6
  },
  {
    id: "3",
    rapSection: "MANILA 2",
    cp: "S03a",
    lgu: "MANILA 2",
    rapPrivateSqm: 80107,
    rapGovtSqm: 178363,
    rapTotalSqm: 258470,
    currentPrivateSqm: 1311,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 0,
    currentLguSqm: 926,
    currentPnrSqm: 189197,
    currentRpSqm: 0,
    currentTotalRowSqm: 65302,
    rapTotalLots: 605,
    currentTotalLotsAcquisition: 7,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "4",
    rapSection: "MAKATI-BULI",
    cp: "S03a",
    lgu: "MAKATI",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 32353,
    currentUnknownSqm: 1009,
    currentGovtNgaSqm: 278,
    currentLguSqm: 0,
    currentPnrSqm: 189197,
    currentRpSqm: 699,
    currentTotalRowSqm: 97402,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 192,
    lotsPaid: 45,
    lotsHandedOver: 3,
    lotsToBeHandedOver: 42
  },
  {
    id: "5",
    rapSection: "MAKATI-BULI",
    cp: "S03a",
    lgu: "TAGUIG 1",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 8094,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 0,
    currentLguSqm: 0,
    currentPnrSqm: 189197,
    currentRpSqm: 20917,
    currentTotalRowSqm: 90077,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 207,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "6",
    rapSection: "MAKATI-BULI",
    cp: "S03b",
    lgu: "PARAÑAQUE",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 10832,
    currentUnknownSqm: 753,
    currentGovtNgaSqm: 14,
    currentLguSqm: 0,
    currentPnrSqm: 39104,
    currentRpSqm: 11109,
    currentTotalRowSqm: 61812,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 83,
    lotsPaid: 3,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 3
  },
  {
    id: "7",
    rapSection: "MAKATI-BULI",
    cp: "S03c",
    lgu: "PARAÑAQUE",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 14456,
    currentUnknownSqm: 1922,
    currentGovtNgaSqm: 16510,
    currentLguSqm: 118,
    currentPnrSqm: 156516,
    currentRpSqm: 5892,
    currentTotalRowSqm: 78027,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 46,
    lotsPaid: 6,
    lotsHandedOver: 2,
    lotsToBeHandedOver: 4
  },
  {
    id: "8",
    rapSection: "MAKATI-BULI",
    cp: "S03c",
    lgu: "TAGUIG 1",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 6440,
    currentUnknownSqm: 87,
    currentGovtNgaSqm: 196,
    currentLguSqm: 0,
    currentPnrSqm: 156516,
    currentRpSqm: 1184,
    currentTotalRowSqm: 47038,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 121,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "9",
    rapSection: "MAKATI-BULI",
    cp: "S03c",
    lgu: "TAGUIG 2",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 2975,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 0,
    currentLguSqm: 0,
    currentPnrSqm: 156516,
    currentRpSqm: 0,
    currentTotalRowSqm: 42104,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 40,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "10",
    rapSection: "MAKATI-BULI",
    cp: "S03c",
    lgu: "MUNTINLUPA 2",
    rapPrivateSqm: 187785,
    rapGovtSqm: 480405,
    rapTotalSqm: 648190,
    currentPrivateSqm: 26260,
    currentUnknownSqm: 256,
    currentGovtNgaSqm: 0,
    currentLguSqm: 3191,
    currentPnrSqm: 156516,
    currentRpSqm: 1585,
    currentTotalRowSqm: 70421,
    rapTotalLots: 770,
    currentTotalLotsAcquisition: 8,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "11",
    rapSection: "TUNNEL SECTION",
    cp: "S03b",
    lgu: "TAGUIG, PASAY",
    rapPrivateSqm: 10514,
    rapGovtSqm: 52262,
    rapTotalSqm: 62776,
    currentPrivateSqm: 1898,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 49475,
    currentLguSqm: 0,
    currentPnrSqm: "included in S03b Paranaque",
    currentRpSqm: 5085,
    currentTotalRowSqm: 56458,
    rapTotalLots: 42,
    currentTotalLotsAcquisition: 55,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "12",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S04",
    lgu: "MUNTINLUPA 1",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 24027,
    currentUnknownSqm: 617,
    currentGovtNgaSqm: 0,
    currentLguSqm: 674,
    currentPnrSqm: 988681,
    currentRpSqm: 0,
    currentTotalRowSqm: 166558,
    rapTotalLots: 253,
    currentTotalLotsAcquisition: 344,
    lotsPaid: 8,
    lotsHandedOver: 2,
    lotsToBeHandedOver: 6
  },
  {
    id: "13",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S05",
    lgu: "SAN PEDRO",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 18008,
    currentUnknownSqm: 46,
    currentGovtNgaSqm: 510,
    currentLguSqm: 4652,
    currentPnrSqm: 988681,
    currentRpSqm: 0,
    currentTotalRowSqm: 164456,
    rapTotalLots: 90,
    currentTotalLotsAcquisition: 116,
    lotsPaid: 13,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 13
  },
  {
    id: "14",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S05",
    lgu: "BIÑAN",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 9114,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 0,
    currentLguSqm: 0,
    currentPnrSqm: 988681,
    currentRpSqm: 0,
    currentTotalRowSqm: 150354,
    rapTotalLots: 123,
    currentTotalLotsAcquisition: 126,
    lotsPaid: 0,
    lotsHandedOver: 0,
    lotsToBeHandedOver: 0
  },
  {
    id: "15",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S05",
    lgu: "STA. ROSA",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 26707,
    currentUnknownSqm: 8,
    currentGovtNgaSqm: 90,
    currentLguSqm: 110,
    currentPnrSqm: 988681,
    currentRpSqm: 0,
    currentTotalRowSqm: 168155,
    rapTotalLots: 38,
    currentTotalLotsAcquisition: 292,
    lotsPaid: 4,
    lotsHandedOver: 2,
    lotsToBeHandedOver: 2
  },
  {
    id: "16",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S06",
    lgu: "CABUYAO",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 39628,
    currentUnknownSqm: 0,
    currentGovtNgaSqm: 256,
    currentLguSqm: 31,
    currentPnrSqm: 988681,
    currentRpSqm: 0,
    currentTotalRowSqm: 181155,
    rapTotalLots: 126,
    currentTotalLotsAcquisition: 173,
    lotsPaid: 2,
    lotsHandedOver: 2,
    lotsToBeHandedOver: 0
  },
  {
    id: "17",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S06",
    lgu: "CALAMBA",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 48170,
    currentUnknownSqm: 2383,
    currentGovtNgaSqm: 328,
    currentLguSqm: 14785,
    currentPnrSqm: 988681,
    currentRpSqm: 0,
    currentTotalRowSqm: 206908,
    rapTotalLots: 173,
    currentTotalLotsAcquisition: 237,
    lotsPaid: 10,
    lotsHandedOver: 6,
    lotsToBeHandedOver: 4
  },
  {
    id: "18",
    rapSection: "MUNTINLUPA-CALAMBA",
    cp: "S07",
    lgu: "BANLIC DEPOT",
    rapPrivateSqm: 376372,
    rapGovtSqm: 1002315,
    rapTotalSqm: 1378887,
    currentPrivateSqm: 247306,
    currentUnknownSqm: 116,
    currentGovtNgaSqm: 6886,
    currentLguSqm: 0,
    currentPnrSqm: 0,
    currentRpSqm: 0,
    currentTotalRowSqm: 395328,
    rapTotalLots: 0,
    currentTotalLotsAcquisition: 40,
    lotsPaid: 28,
    lotsHandedOver: 28,
    lotsToBeHandedOver: 0
  }
];

// Explicit merge maps strictly adhering to 23-row 13-column grid specification
const RAP_SECTION_SPANS_MAP: { [index: number]: number } = {
  0: 1,  // Row 5 (MANILA PO)
  1: 2,  // Row 6:7 (MANILA 2)
  3: 7,  // Row 8:14 (MAKATI-BULI)
  10: 1, // Row 15 (TUNNEL SECTION)
  11: 7  // Row 16:22 (MUNTINLUPA-CALAMBA)
};

const CP_SPANS_MAP: { [index: number]: number } = {
  0: 1,  // Row 5 (S01)
  1: 1,  // Row 6 (S02)
  2: 3,  // Row 7:9 (S03a)
  5: 1,  // Row 10 (S03b)
  6: 4,  // Row 11:14 (S03c)
  10: 1, // Row 15 (S03b)
  11: 1, // Row 16 (S04)
  12: 3, // Row 17:19 (S05 - SAN PEDRO, BIÑAN, STA. ROSA)
  15: 2, // Row 20:21 (S06 - CABUYAO, CALAMBA)
  17: 1  // Row 22 (S07 - BANLIC DEPOT)
};

const LO_RAP_SPANS_MAP: { [index: number]: number } = {
  0: 1,  // Row 5
  1: 2,  // Row 6:7
  3: 7,  // Row 8:14
  10: 1, // Row 15
  11: 7  // Row 16:22
};

const PNR_MERGE_MAP: { [index: number]: { count: number; val: number | string } } = {
  0: { count: 1, val: 18036 },                            // Row 5 (MANILA 1)
  1: { count: 1, val: 158082 },                           // Row 6 (MANILA 2)
  2: { count: 3, val: 189197 },                           // Row 7:9 (MANILA 2, MAKATI, TAGUIG 1)
  5: { count: 1, val: 39104 },                            // Row 10 (PARAÑAQUE)
  6: { count: 4, val: 156516 },                           // Row 11:14 (PARAÑAQUE, TAGUIG 1, TAGUIG 2, MUNTINLUPA 2)
  10: { count: 1, val: "included in S03b Paranaque" },   // Row 15 (TAGUIG, PASAY)
  11: { count: 6, val: 988681 },                          // Row 16:21 (MUNTINLUPA 1 to CALAMBA)
  17: { count: 1, val: 0 }                                // Row 22 (BANLIC DEPOT)
};

// LO RAP Total Lots merge mapping in LOTS view
const RAP_LOTS_MERGE_MAP: { [index: number]: { count: number; val: number } } = {
  0: { count: 1, val: 155 },
  1: { count: 2, val: 605 },
  3: { count: 7, val: 770 },
  10: { count: 1, val: 42 },
  11: { count: 1, val: 253 },
  12: { count: 1, val: 90 },
  13: { count: 1, val: 123 },
  14: { count: 1, val: 38 },
  15: { count: 1, val: 126 },
  16: { count: 2, val: 173 }
};

interface AdbRorScLaUniverseTableProps {
  data: LotData[];
}

export const AdbRorScLaUniverseTable: React.FC<AdbRorScLaUniverseTableProps> = ({ data }) => {
  const [rows, setRows] = useState<ScLaUniverseRow[]>(INITIAL_ROWS);
  const [selectedCp, setSelectedCp] = useState<string>("ALL");
  const [selectedLgu, setSelectedLgu] = useState<string>("ALL");
  const [displayMetric, setDisplayMetric] = useState<"sqm" | "lots" | "gantt">("sqm");

  // Inline editing state: { rowId, field }
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: keyof ScLaUniverseRow } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Extract unique CPs and LGUs from table rows for filters
  const cpOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.cp));
    return Array.from(set).sort();
  }, [rows]);

  const lguOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.lgu));
    return Array.from(set).sort();
  }, [rows]);

  // Auto-sync rows from data prop when data changes or loads
  useEffect(() => {
    if (data && data.length > 0) {
      handleAutomateFromData();
    }
  }, [data]);

  // Filter rows based on selected CP and LGU
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (selectedCp !== "ALL" && r.cp !== selectedCp) return false;
      if (selectedLgu !== "ALL" && r.lgu !== selectedLgu) return false;
      return true;
    });
  }, [rows, selectedCp, selectedLgu]);

  // Compute RAP Section rowSpans for Column 1
  const rapSectionSpans = useMemo(() => {
    if (selectedCp !== "ALL" || selectedLgu !== "ALL") {
      const spans: { [index: number]: number } = {};
      let i = 0;
      while (i < filteredRows.length) {
        const currentSection = filteredRows[i].rapSection;
        let count = 1;
        while (
          i + count < filteredRows.length &&
          filteredRows[i + count].rapSection === currentSection
        ) {
          count++;
        }
        spans[i] = count;
        i += count;
      }
      return spans;
    }

    const spans: { [index: number]: number } = {};
    for (let idx = 0; idx < filteredRows.length; idx++) {
      if (RAP_SECTION_SPANS_MAP[idx] !== undefined) {
        spans[idx] = RAP_SECTION_SPANS_MAP[idx];
      } else {
        let covered = false;
        for (const startStr of Object.keys(RAP_SECTION_SPANS_MAP)) {
          const s = Number(startStr);
          const count = RAP_SECTION_SPANS_MAP[s];
          if (idx > s && idx < s + count) {
            covered = true;
            break;
          }
        }
        if (!covered) {
          spans[idx] = 1;
        }
      }
    }
    return spans;
  }, [filteredRows, selectedCp, selectedLgu]);

  // Compute CP rowSpans for Column 2
  const cpSpans = useMemo(() => {
    if (selectedCp !== "ALL" || selectedLgu !== "ALL") {
      const spans: { [index: number]: number } = {};
      let i = 0;
      while (i < filteredRows.length) {
        const currentCp = filteredRows[i].cp;
        const currentRap = filteredRows[i].rapSection;
        let count = 1;
        while (
          i + count < filteredRows.length &&
          filteredRows[i + count].cp === currentCp &&
          filteredRows[i + count].rapSection === currentRap
        ) {
          count++;
        }
        spans[i] = count;
        i += count;
      }
      return spans;
    }

    const spans: { [index: number]: number } = {};
    for (let idx = 0; idx < filteredRows.length; idx++) {
      if (CP_SPANS_MAP[idx] !== undefined) {
        spans[idx] = CP_SPANS_MAP[idx];
      } else {
        let covered = false;
        for (const startStr of Object.keys(CP_SPANS_MAP)) {
          const s = Number(startStr);
          const count = CP_SPANS_MAP[s];
          if (idx > s && idx < s + count) {
            covered = true;
            break;
          }
        }
        if (!covered) {
          spans[idx] = 1;
        }
      }
    }
    return spans;
  }, [filteredRows, selectedCp, selectedLgu]);

  // Compute LO RAP rowSpans for Columns 4, 5, 6
  const loRapSpans = useMemo(() => {
    if (selectedCp !== "ALL" || selectedLgu !== "ALL") {
      return filteredRows.map(() => 1);
    }

    const spans: { [index: number]: number } = {};
    for (let idx = 0; idx < filteredRows.length; idx++) {
      if (LO_RAP_SPANS_MAP[idx] !== undefined) {
        spans[idx] = LO_RAP_SPANS_MAP[idx];
      } else {
        let covered = false;
        for (const startStr of Object.keys(LO_RAP_SPANS_MAP)) {
          const s = Number(startStr);
          const count = LO_RAP_SPANS_MAP[s];
          if (idx > s && idx < s + count) {
            covered = true;
            break;
          }
        }
        if (!covered) {
          spans[idx] = 1;
        }
      }
    }
    return spans;
  }, [filteredRows, selectedCp, selectedLgu]);

  // Compute PNR cell render info according to PNR_MERGE_MAP
  const pnrCellInfo = useMemo(() => {
    if (selectedCp !== "ALL" || selectedLgu !== "ALL") {
      return filteredRows.map(r => ({ render: true, count: 1, val: r.currentPnrSqm }));
    }
    const result: { render: boolean; count: number; val: number | string }[] = [];
    for (let idx = 0; idx < filteredRows.length; idx++) {
      if (PNR_MERGE_MAP[idx]) {
        result.push({ render: true, count: PNR_MERGE_MAP[idx].count, val: filteredRows[idx].currentPnrSqm !== undefined ? filteredRows[idx].currentPnrSqm : PNR_MERGE_MAP[idx].val });
      } else {
        let covered = false;
        for (const startStr of Object.keys(PNR_MERGE_MAP)) {
          const s = Number(startStr);
          const m = PNR_MERGE_MAP[s];
          if (idx > s && idx < s + m.count) {
            covered = true;
            break;
          }
        }
        if (covered) {
          result.push({ render: false, count: 0, val: 0 });
        } else {
          result.push({ render: true, count: 1, val: filteredRows[idx].currentPnrSqm });
        }
      }
    }
    return result;
  }, [filteredRows, selectedCp, selectedLgu]);

  // Compute LO RAP Total Lots cell render info for LOTS view
  const rapLotsCellInfo = useMemo(() => {
    if (selectedCp !== "ALL" || selectedLgu !== "ALL") {
      return filteredRows.map(r => ({ render: true, count: 1, val: r.rapTotalLots }));
    }
    const result: { render: boolean; count: number; val: number }[] = [];
    for (let idx = 0; idx < filteredRows.length; idx++) {
      if (RAP_LOTS_MERGE_MAP[idx]) {
        result.push({ render: true, count: RAP_LOTS_MERGE_MAP[idx].count, val: filteredRows[idx].rapTotalLots !== undefined ? filteredRows[idx].rapTotalLots : RAP_LOTS_MERGE_MAP[idx].val });
      } else {
        let covered = false;
        for (const startStr of Object.keys(RAP_LOTS_MERGE_MAP)) {
          const s = Number(startStr);
          const m = RAP_LOTS_MERGE_MAP[s];
          if (idx > s && idx < s + m.count) {
            covered = true;
            break;
          }
        }
        if (covered) {
          result.push({ render: false, count: 0, val: 0 });
        } else {
          result.push({ render: true, count: 1, val: filteredRows[idx].rapTotalLots });
        }
      }
    }
    return result;
  }, [filteredRows, selectedCp, selectedLgu]);

  // Compute Grand Totals for SQM view
  const sqmGrandTotals = useMemo(() => {
    const processedRapSections = new Set<string>();
    let rapPrivate = 0;
    let rapGovt = 0;
    let rapTotal = 0;

    let curPrivate = 0;
    let curUnknown = 0;
    let curGovtNga = 0;
    let curLgu = 0;
    let curPnr = 0;
    let curRp = 0;
    let curTotalRow = 0;

    // Fixed PNR values to avoid double counting merged cells:
    // 18036 + 158082 + 189197 + 39104 + 156516 + 988681 + 0 = 1549616
    const pnrValuesToSum = [18036, 158082, 189197, 39104, 156516, 988681, 0];
    curPnr = pnrValuesToSum.reduce((a, b) => a + b, 0);

    filteredRows.forEach(r => {
      if (!processedRapSections.has(r.rapSection)) {
        processedRapSections.add(r.rapSection);
        rapPrivate += Number(r.rapPrivateSqm) || 0;
        rapGovt += Number(r.rapGovtSqm) || 0;
        rapTotal += Number(r.rapTotalSqm) || 0;
      }

      const pVal = typeof r.currentPrivateSqm === "number" ? r.currentPrivateSqm : parseFloat(r.currentPrivateSqm as string) || 0;
      const uVal = typeof r.currentUnknownSqm === "number" ? r.currentUnknownSqm : parseFloat(r.currentUnknownSqm as string) || 0;
      const ngaVal = typeof r.currentGovtNgaSqm === "number" ? r.currentGovtNgaSqm : parseFloat(r.currentGovtNgaSqm as string) || 0;
      const lguVal = typeof r.currentLguSqm === "number" ? r.currentLguSqm : parseFloat(r.currentLguSqm as string) || 0;
      const pnrVal = typeof r.currentPnrSqm === "number" ? r.currentPnrSqm : parseFloat(r.currentPnrSqm as string) || 0;
      const rpVal = typeof r.currentRpSqm === "number" ? r.currentRpSqm : parseFloat(r.currentRpSqm as string) || 0;

      curPrivate += pVal;
      curUnknown += uVal;
      curGovtNga += ngaVal;
      curLgu += lguVal;
      curRp += rpVal;

      const rowSum = r.currentTotalRowSqm !== undefined ? r.currentTotalRowSqm : (pVal + uVal + ngaVal + lguVal + pnrVal + rpVal);
      curTotalRow += rowSum;
    });

    return {
      rapPrivate,
      rapGovt,
      rapTotal,
      curPrivate,
      curUnknown,
      curGovtNga,
      curLgu,
      curPnr,
      curRp,
      curTotalRow
    };
  }, [filteredRows]);

  // Compute Grand Totals for LOTS view
  const lotsGrandTotals = useMemo(() => {
    let rapLotsSum = 0;
    rapLotsCellInfo.forEach(info => {
      if (info.render) {
        rapLotsSum += Number(info.val) || 0;
      }
    });

    let currentLotsAcquisitionSum = 0;
    let lotsPaidSum = 0;
    let lotsHandedOverSum = 0;

    filteredRows.forEach(r => {
      currentLotsAcquisitionSum += Number(r.currentTotalLotsAcquisition) || 0;
      lotsPaidSum += Number(r.lotsPaid) || 0;
      lotsHandedOverSum += Number(r.lotsHandedOver) || 0;
    });

    const lotsToBeHandedOverSum = lotsPaidSum - lotsHandedOverSum;

    return {
      rapLotsSum,
      currentLotsAcquisitionSum,
      lotsPaidSum,
      lotsHandedOverSum,
      lotsToBeHandedOverSum
    };
  }, [filteredRows, rapLotsCellInfo]);

  // Handle start inline cell edit
  const handleCellClick = (rowId: string, field: keyof ScLaUniverseRow, currentVal: any) => {
    setEditingCell({ rowId, field });
    setEditValue(currentVal === undefined || currentVal === null ? "" : String(currentVal));
  };

  // Save inline cell edit
  const handleCellSave = () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;

    setRows(prevRows => {
      return prevRows.map(row => {
        if (row.id === rowId) {
          const isNumeric = typeof INITIAL_ROWS[0][field] === "number" && field !== "id";
          let updatedVal: any = editValue;
          if (isNumeric && editValue !== "") {
            const parsed = parseFloat(editValue.replace(/,/g, ""));
            if (!isNaN(parsed)) updatedVal = parsed;
          }

          const updatedRow = { ...row, [field]: updatedVal };

          // Sync LOTS calculation
          if (field === "lotsPaid" || field === "lotsHandedOver") {
            const p = Number(updatedRow.lotsPaid) || 0;
            const h = Number(updatedRow.lotsHandedOver) || 0;
            updatedRow.lotsToBeHandedOver = p - h;
          }

          // Recalculate row total for Current Data if a current data field was edited
          if (
            field === "currentPrivateSqm" ||
            field === "currentUnknownSqm" ||
            field === "currentGovtNgaSqm" ||
            field === "currentLguSqm" ||
            field === "currentPnrSqm" ||
            field === "currentRpSqm"
          ) {
            const p = typeof updatedRow.currentPrivateSqm === "number" ? updatedRow.currentPrivateSqm : parseFloat(updatedRow.currentPrivateSqm as string) || 0;
            const u = typeof updatedRow.currentUnknownSqm === "number" ? updatedRow.currentUnknownSqm : parseFloat(updatedRow.currentUnknownSqm as string) || 0;
            const nga = typeof updatedRow.currentGovtNgaSqm === "number" ? updatedRow.currentGovtNgaSqm : parseFloat(updatedRow.currentGovtNgaSqm as string) || 0;
            const lgu = typeof updatedRow.currentLguSqm === "number" ? updatedRow.currentLguSqm : parseFloat(updatedRow.currentLguSqm as string) || 0;
            const pnr = typeof updatedRow.currentPnrSqm === "number" ? updatedRow.currentPnrSqm : parseFloat(updatedRow.currentPnrSqm as string) || 0;
            const rp = typeof updatedRow.currentRpSqm === "number" ? updatedRow.currentRpSqm : parseFloat(updatedRow.currentRpSqm as string) || 0;

            updatedRow.currentTotalRowSqm = p + u + nga + lgu + pnr + rp;
          }

          return updatedRow;
        }
        return row;
      });
    });

    setEditingCell(null);
    setEditValue("");
  };

  const handleReset = () => {
    setRows(INITIAL_ROWS);
    setSelectedCp("ALL");
    setSelectedLgu("ALL");
    setEditingCell(null);
  };

  const handleAutomateFromData = () => {
    if (!data || data.length === 0) return;

    setRows(prevRows => {
      return prevRows.map(r => {
        const matchedLots = data.filter(lot => {
          const cpMatch = !lot.cp || lot.cp.toUpperCase().includes(r.cp.toUpperCase()) || r.cp.toUpperCase().includes(lot.cp.toUpperCase());
          const lguMatch = !lot.lgu || lot.lgu.toUpperCase().includes(r.lgu.toUpperCase()) || r.lgu.toUpperCase().includes(lot.lgu.toUpperCase());
          return cpMatch && lguMatch;
        });

        if (matchedLots.length === 0) return r;

        let pSum = 0;
        let uSum = 0;
        let ngaSum = 0;
        let lguSum = 0;
        let pnrSum = 0;
        let rpSum = 0;

        let paidCount = 0;
        let handedCount = 0;

        matchedLots.forEach(lot => {
          const area = Number(lot.affectedArea) || Number(lot.totalArea) || 0;
          const cls = (lot.ownerClassification || "").toUpperCase();
          const pStat = (lot.paymentStatus || "").toLowerCase();
          const pteStat = (lot.statusPte || "").toLowerCase();

          if (pStat.includes("paid")) paidCount++;
          if (pteStat.includes("issued") || pteStat.includes("signed") || lot.datePte) handedCount++;

          if (cls.includes("PRIVATE") || cls.includes("PRIVATELY")) {
            pSum += area;
          } else if (cls.includes("NGA") || cls.includes("GOVT-NGA")) {
            ngaSum += area;
          } else if (cls.includes("LGU")) {
            lguSum += area;
          } else if (cls.includes("PNR")) {
            pnrSum += area;
          } else if (cls.includes("RP") || cls.includes("REPUBLIC")) {
            rpSum += area;
          } else {
            uSum += area;
          }
        });

        const newPriv = pSum > 0 ? Math.round(pSum) : r.currentPrivateSqm;
        const newUnk = uSum > 0 ? Math.round(uSum) : r.currentUnknownSqm;
        const newNga = ngaSum > 0 ? Math.round(ngaSum) : r.currentGovtNgaSqm;
        const newLgu = lguSum > 0 ? Math.round(lguSum) : r.currentLguSqm;
        const newPnr = pnrSum > 0 ? Math.round(pnrSum) : r.currentPnrSqm;
        const newRp = rpSum > 0 ? Math.round(rpSum) : r.currentRpSqm;

        const pNum = typeof newPriv === "number" ? newPriv : 0;
        const uNum = typeof newUnk === "number" ? newUnk : 0;
        const ngaNum = typeof newNga === "number" ? newNga : 0;
        const lguNum = typeof newLgu === "number" ? newLgu : 0;
        const pnrNum = typeof newPnr === "number" ? newPnr : 0;
        const rpNum = typeof newRp === "number" ? newRp : 0;

        return {
          ...r,
          currentPrivateSqm: newPriv,
          currentUnknownSqm: newUnk,
          currentGovtNgaSqm: newNga,
          currentLguSqm: newLgu,
          currentPnrSqm: newPnr,
          currentRpSqm: newRp,
          currentTotalRowSqm: pNum + uNum + ngaNum + lguNum + pnrNum + rpNum,
          currentTotalLotsAcquisition: matchedLots.length || r.currentTotalLotsAcquisition,
          lotsPaid: paidCount || r.lotsPaid,
          lotsHandedOver: handedCount || r.lotsHandedOver,
          lotsToBeHandedOver: Math.max(0, (paidCount || r.lotsPaid) - (handedCount || r.lotsHandedOver))
        };
      });
    });
  };

  const formatNumber = (val: any) => {
    if (typeof val === "number") {
      return val === 0 ? "0" : val.toLocaleString();
    }
    return val || "";
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-md p-6 space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              ADB LARP Master Land Universe Matrix
            </span>
            <h1 className="text-xl font-black uppercase tracking-wider text-white">
              {displayMetric === "sqm" 
                ? "SC LA UNIVERSE" 
                : displayMetric === "lots" 
                ? "LOTS SUMMARY MATRIX" 
                : "GANTT LINEAR TRACK MATRIX (CHART_V1)"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleAutomateFromData}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95 border border-blue-400/40"
            title="Automate / Sync data from active Lot Database"
          >
            <Sparkles className="w-4 h-4 text-blue-200" />
            Automate from Lot Data
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 border border-slate-700"
            title="Reset to Original Spreadsheet Baseline"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Table
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-700" />
            Print Matrix
          </button>
        </div>
      </div>

      {/* Filter Control Bar & Toggle */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">CP:</span>
            <select
              value={selectedCp}
              onChange={e => setSelectedCp(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">ALL CPs</option>
              {cpOptions.map(cp => (
                <option key={cp} value={cp}>{cp}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">LGU:</span>
            <select
              value={selectedLgu}
              onChange={e => setSelectedLgu(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">ALL LGUs</option>
              {lguOptions.map(lgu => (
                <option key={lgu} value={lgu}>{lgu}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode Toggle: SQM vs LOTS vs GANTT */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setDisplayMetric("sqm")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5",
              displayMetric === "sqm" 
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            SC LA UNIVERSE (sqm)
          </button>
          <button
            type="button"
            onClick={() => setDisplayMetric("lots")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5",
              displayMetric === "lots" 
                ? "bg-slate-900 text-white shadow-xs" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            )}
          >
            LOTS (Total Lots)
          </button>
          <button
            type="button"
            onClick={() => setDisplayMetric("gantt")}
            className={cn(
              "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
              displayMetric === "gantt" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-blue-700 bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/60"
            )}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-300" />
            CHART_V1 (Gantt Chart)
          </button>
        </div>
      </div>

      {/* RENDER MODE 1: SQM TABLE (SC LA UNIVERSE) */}
      {displayMetric === "sqm" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-300 shadow-sm">
          <table className="w-full text-center text-xs border-collapse font-sans">
            <thead>
              {/* ROW 1: TOP CENTERED HEADER TITLE ROW A1:M1 */}
              <tr className="border-b border-slate-300 bg-slate-900 text-white">
                <th colSpan={13} className="text-center font-black text-white text-sm py-2.5 uppercase tracking-wider border border-slate-400">
                  SC LA UNIVERSE
                </th>
              </tr>

              {/* ROW 2: HEADER SUB-SECTION TOP (A2:A4, B2:B4, C2:C4, D2:F2, G2:M2) */}
              <tr className="bg-slate-100 text-slate-900 text-[11px] font-black uppercase border-b border-slate-300">
                <th rowSpan={3} className="p-2 border border-slate-300 text-slate-900 align-middle text-center bg-slate-200 font-black">
                  RAP SECTION
                </th>
                <th rowSpan={3} className="p-2 border border-slate-300 text-slate-900 align-middle text-center bg-slate-200 font-black">
                  CP
                </th>
                <th rowSpan={3} className="p-2 border border-slate-300 text-slate-900 align-middle text-center bg-slate-200 font-black">
                  LGU
                </th>

                <th colSpan={3} className="p-2 border border-slate-300 text-center text-emerald-950 bg-emerald-100 font-black text-xs">
                  Data from the LO RAP
                </th>

                <th colSpan={7} className="p-2 border border-slate-300 text-center text-blue-950 bg-blue-100 font-black text-xs">
                  Current Data
                </th>
              </tr>

              {/* ROW 3: SUB-HEADERS */}
              <tr className="bg-slate-50 text-slate-800 text-[10px] font-bold uppercase border-b border-slate-300 text-center">
                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-emerald-50 text-emerald-950 font-extrabold">
                  Privately-Owned Land (sqm)
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-emerald-50 text-emerald-950 font-extrabold">
                  Government-Owned Land (sqm)
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-emerald-200/90 text-emerald-950 font-black">
                  Total Right-of-Way for Land Acquisition (sqm)
                </th>

                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-blue-50 text-blue-950 font-extrabold">
                  Privately-Owned Land (sqm)
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-blue-50 text-blue-950 font-extrabold">
                  Unknown (sqm)
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-blue-50 text-blue-950 font-extrabold">
                  Government-NGA (sqm)
                </th>

                <th colSpan={3} className="p-2 border border-slate-300 text-center align-middle bg-blue-100/80 font-black text-blue-950">
                  Government-Owned Land (sqm)
                </th>

                <th rowSpan={2} className="p-2 border border-slate-300 text-center align-middle bg-blue-200/90 font-black text-blue-950">
                  Total Right-of-Way for Land Acquisition (sqm)
                </th>
              </tr>

              {/* ROW 4: Sub-columns under Government-Owned Land (sqm) */}
              <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-800 border-b border-slate-300 text-center">
                <th className="p-1.5 border border-slate-300 text-center bg-blue-50 text-blue-950 font-bold">LGU</th>
                <th className="p-1.5 border border-slate-300 text-center bg-blue-50 text-blue-950 font-bold">PNR</th>
                <th className="p-1.5 border border-slate-300 text-center bg-blue-50 text-blue-950 font-bold">RP</th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.map((row, index) => {
                const rapSpan = rapSectionSpans[index];
                const cpSpan = cpSpans[index];
                const loRapSpan = loRapSpans[index];
                const pnrInfo = pnrCellInfo[index];

                const pVal = typeof row.currentPrivateSqm === "number" ? row.currentPrivateSqm : parseFloat(row.currentPrivateSqm as string) || 0;
                const uVal = typeof row.currentUnknownSqm === "number" ? row.currentUnknownSqm : parseFloat(row.currentUnknownSqm as string) || 0;
                const ngaVal = typeof row.currentGovtNgaSqm === "number" ? row.currentGovtNgaSqm : parseFloat(row.currentGovtNgaSqm as string) || 0;
                const lguVal = typeof row.currentLguSqm === "number" ? row.currentLguSqm : parseFloat(row.currentLguSqm as string) || 0;
                const pnrVal = typeof row.currentPnrSqm === "number" ? row.currentPnrSqm : parseFloat(row.currentPnrSqm as string) || 0;
                const rpVal = typeof row.currentRpSqm === "number" ? row.currentRpSqm : parseFloat(row.currentRpSqm as string) || 0;

                const calculatedTotal = row.currentTotalRowSqm !== undefined ? row.currentTotalRowSqm : (pVal + uVal + ngaVal + lguVal + pnrVal + rpVal);

                return (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* RAP SECTION (Merged dynamically by contiguous RAP Section) */}
                    {rapSpan ? (
                      <td 
                        rowSpan={rapSpan}
                        className="p-2.5 font-bold border border-slate-300 align-middle text-center text-slate-900 bg-white"
                      >
                        {row.rapSection}
                      </td>
                    ) : null}

                    {/* CP (Merged dynamically by contiguous CP within RAP Section) */}
                    {cpSpan ? (
                      <td 
                        rowSpan={cpSpan}
                        className="p-2.5 text-center font-bold border border-slate-300 align-middle text-slate-900 bg-white"
                      >
                        {row.cp}
                      </td>
                    ) : null}

                    {/* LGU */}
                    <td className="p-2.5 text-center font-medium border border-slate-300 bg-white text-slate-800 align-middle">
                      {row.lgu}
                    </td>

                    {/* LO RAP: Privately-Owned Land (Merged per LO_RAP_SPANS_MAP) */}
                    {loRapSpan ? (
                      <td 
                        rowSpan={loRapSpan}
                        onClick={() => handleCellClick(row.id, "rapPrivateSqm", row.rapPrivateSqm)}
                        className="p-2.5 text-center font-medium border border-slate-300 align-middle cursor-pointer hover:bg-blue-50 transition-colors bg-white text-slate-800"
                      >
                        {editingCell?.rowId === row.id && editingCell?.field === "rapPrivateSqm" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => e.key === "Enter" && handleCellSave()}
                            autoFocus
                            className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                          />
                        ) : (
                          formatNumber(row.rapPrivateSqm)
                        )}
                      </td>
                    ) : null}

                    {/* LO RAP: Government-Owned Land (Merged per LO_RAP_SPANS_MAP) */}
                    {loRapSpan ? (
                      <td 
                        rowSpan={loRapSpan}
                        onClick={() => handleCellClick(row.id, "rapGovtSqm", row.rapGovtSqm)}
                        className="p-2.5 text-center font-medium border border-slate-300 align-middle cursor-pointer hover:bg-blue-50 transition-colors bg-white text-slate-800"
                      >
                        {editingCell?.rowId === row.id && editingCell?.field === "rapGovtSqm" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => e.key === "Enter" && handleCellSave()}
                            autoFocus
                            className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                          />
                        ) : (
                          formatNumber(row.rapGovtSqm)
                        )}
                      </td>
                    ) : null}

                    {/* LO RAP: Total Right-of-Way (Merged per LO_RAP_SPANS_MAP) -> DISTINCT EMERALD/GREEN COLOR */}
                    {loRapSpan ? (
                      <td 
                        rowSpan={loRapSpan}
                        onClick={() => handleCellClick(row.id, "rapTotalSqm", row.rapTotalSqm)}
                        className="p-2.5 text-center font-black border border-slate-300 align-middle cursor-pointer hover:bg-emerald-200 transition-colors bg-emerald-100/90 text-emerald-950 font-black"
                      >
                        {editingCell?.rowId === row.id && editingCell?.field === "rapTotalSqm" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => e.key === "Enter" && handleCellSave()}
                            autoFocus
                            className="w-full text-center p-1 bg-white border border-emerald-600 rounded-md font-extrabold text-slate-900"
                          />
                        ) : (
                          formatNumber(row.rapTotalSqm)
                        )}
                      </td>
                    ) : null}

                    {/* CURRENT DATA: Privately-Owned Land */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentPrivateSqm", row.currentPrivateSqm)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentPrivateSqm" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.currentPrivateSqm)
                      )}
                    </td>

                    {/* CURRENT DATA: Unknown */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentUnknownSqm", row.currentUnknownSqm)}
                      className="p-2.5 text-center font-medium text-slate-700 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentUnknownSqm" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.currentUnknownSqm)
                      )}
                    </td>

                    {/* CURRENT DATA: Government-NGA */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentGovtNgaSqm", row.currentGovtNgaSqm)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentGovtNgaSqm" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.currentGovtNgaSqm)
                      )}
                    </td>

                    {/* CURRENT DATA: LGU */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentLguSqm", row.currentLguSqm)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentLguSqm" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.currentLguSqm)
                      )}
                    </td>

                    {/* CURRENT DATA: PNR (MERGED PER SPREADSHEET SPEC) */}
                    {pnrInfo?.render ? (
                      <td 
                        rowSpan={pnrInfo.count}
                        onClick={() => handleCellClick(row.id, "currentPnrSqm", pnrInfo.val)}
                        className={cn(
                          "p-2.5 border border-slate-300 align-middle cursor-pointer hover:bg-blue-50 transition-colors relative text-center bg-white text-slate-800",
                          typeof pnrInfo.val === "string" ? "text-center text-[11px] font-semibold text-slate-700 italic" : "text-center"
                        )}
                      >
                        {editingCell?.rowId === row.id && editingCell?.field === "currentPnrSqm" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => e.key === "Enter" && handleCellSave()}
                            autoFocus
                            className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                          />
                        ) : (
                          formatNumber(pnrInfo.val)
                        )}
                      </td>
                    ) : null}

                    {/* CURRENT DATA: RP */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentRpSqm", row.currentRpSqm)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentRpSqm" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.currentRpSqm)
                      )}
                    </td>

                    {/* CURRENT DATA: Total Right-of-Way -> DISTINCT BLUE COLOR */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentTotalRowSqm", calculatedTotal)}
                      className="p-2.5 text-center font-black text-blue-950 border border-slate-300 bg-blue-100/90 cursor-pointer hover:bg-blue-200 transition-colors align-middle font-black"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentTotalRowSqm" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-600 rounded-md font-extrabold text-slate-900"
                        />
                      ) : (
                        formatNumber(calculatedTotal)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* GRAND TOTAL FOOTER ROW FOR SQM */}
            <tfoot>
              <tr className="bg-slate-200 text-slate-950 font-black text-xs border-t-2 border-slate-400">
                <td className="p-2.5 border border-slate-300 font-black bg-slate-300 text-center"></td>
                <td colSpan={2} className="p-2.5 uppercase tracking-wider text-center border border-slate-300 font-black bg-slate-800 text-white">
                  GRAND TOTAL:
                </td>

                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.rapPrivate.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.rapGovt.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 bg-emerald-200 font-black text-emerald-950 text-sm">
                  {sqmGrandTotals.rapTotal.toLocaleString()}
                </td>

                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.curPrivate.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.curUnknown.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.curGovtNga.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.curLgu.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.curPnr.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {sqmGrandTotals.curRp.toLocaleString()}
                </td>
                <td className="p-2.5 text-center border border-slate-300 bg-blue-200 font-black text-blue-950 text-sm">
                  {sqmGrandTotals.curTotalRow.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* RENDER MODE 2: LOTS TABLE (LOTS SUMMARY MATRIX) */}
      {displayMetric === "lots" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-300 shadow-sm">
          <table className="w-full text-center text-xs border-collapse font-sans">
            <thead>
              {/* TOP LEFT HEADER TITLE ROW MATCHING MATRIX */}
              <tr className="border-b border-slate-300 bg-slate-900 text-white">
                <th colSpan={8} className="text-center font-black text-white text-sm py-2.5 px-3 uppercase tracking-wider border border-slate-400">
                  LOTS
                </th>
              </tr>

              {/* LEVEL 1 HEADER ROW */}
              <tr className="bg-slate-100 text-slate-900 text-[10.5px] font-black uppercase border-b border-slate-300 text-center">
                <th rowSpan={2} className="p-2.5 border border-slate-300 text-slate-900 align-middle bg-slate-200 text-center">
                  RAP SECTION
                </th>
                <th rowSpan={2} className="p-2.5 border border-slate-300 text-center text-slate-900 align-middle bg-slate-200">
                  CP
                </th>
                <th rowSpan={2} className="p-2.5 border border-slate-300 text-slate-900 align-middle bg-slate-200 text-center">
                  LGU
                </th>

                <th className="p-2 border border-slate-300 text-center text-emerald-950 bg-emerald-100 font-black">
                  Data from the LO RAP
                </th>

                <th colSpan={4} className="p-2 border border-slate-300 text-center text-blue-950 bg-blue-100 font-black">
                  Current Data
                </th>
              </tr>

              {/* LEVEL 2 HEADER ROW */}
              <tr className="bg-slate-50 text-slate-800 text-[10px] font-bold uppercase border-b border-slate-300 text-center">
                <th className="p-2 border border-slate-300 text-center bg-emerald-200/90 text-emerald-950 font-black">
                  Total Lots
                </th>

                <th className="p-2 border border-slate-300 text-center bg-blue-50 text-blue-950 font-extrabold">
                  Total Lots for Acquisition
                </th>

                <th className="p-2 border border-slate-300 text-center bg-blue-50 text-blue-950 font-extrabold">
                  Total Paid
                </th>

                <th className="p-2 border border-slate-300 text-center bg-blue-50 text-blue-950 font-extrabold">
                  Total Handed-Over
                </th>

                <th className="p-2 border border-slate-300 text-center bg-blue-200/90 text-blue-950 font-black">
                  Total to be Handed-Over
                </th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-slate-200">
              {filteredRows.map((row, index) => {
                const rapSpan = rapSectionSpans[index];
                const cpSpan = cpSpans[index];
                const rapLotsInfo = rapLotsCellInfo[index];
                const toBeHanded = row.lotsToBeHandedOver !== undefined ? row.lotsToBeHandedOver : Math.max(0, row.lotsPaid - row.lotsHandedOver);

                return (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* RAP SECTION (Merged dynamically) */}
                    {rapSpan ? (
                      <td 
                        rowSpan={rapSpan}
                        className="p-2.5 font-bold text-slate-900 border border-slate-300 align-middle text-center bg-white"
                      >
                        {row.rapSection}
                      </td>
                    ) : null}

                    {/* CP (Merged dynamically) */}
                    {cpSpan ? (
                      <td 
                        rowSpan={cpSpan}
                        className="p-2.5 text-center font-bold text-slate-800 border border-slate-300 align-middle bg-white"
                      >
                        {row.cp}
                      </td>
                    ) : null}

                    {/* LGU */}
                    <td className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white align-middle">
                      {row.lgu}
                    </td>

                    {/* LO RAP: Total Lots (Merged) -> DISTINCT EMERALD COLOR */}
                    {rapLotsInfo?.render ? (
                      <td 
                        rowSpan={rapLotsInfo.count}
                        onClick={() => handleCellClick(row.id, "rapTotalLots", rapLotsInfo.val)}
                        className="p-2.5 text-center font-black text-emerald-950 border border-slate-300 align-middle bg-emerald-100/90 cursor-pointer hover:bg-emerald-200 transition-colors"
                      >
                        {editingCell?.rowId === row.id && editingCell?.field === "rapTotalLots" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={e => e.key === "Enter" && handleCellSave()}
                            autoFocus
                            className="w-full text-center p-1 bg-white border border-emerald-500 rounded-md font-bold text-slate-900"
                          />
                        ) : (
                          rapLotsInfo.val > 0 ? formatNumber(rapLotsInfo.val) : ""
                        )}
                      </td>
                    ) : null}

                    {/* CURRENT DATA: Total Lots for Acquisition */}
                    <td 
                      onClick={() => handleCellClick(row.id, "currentTotalLotsAcquisition", row.currentTotalLotsAcquisition)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "currentTotalLotsAcquisition" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.currentTotalLotsAcquisition)
                      )}
                    </td>

                    {/* Total Paid */}
                    <td 
                      onClick={() => handleCellClick(row.id, "lotsPaid", row.lotsPaid)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "lotsPaid" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.lotsPaid)
                      )}
                    </td>

                    {/* Total Handed-Over */}
                    <td 
                      onClick={() => handleCellClick(row.id, "lotsHandedOver", row.lotsHandedOver)}
                      className="p-2.5 text-center font-medium text-slate-800 border border-slate-300 bg-white cursor-pointer hover:bg-blue-50 transition-colors align-middle"
                    >
                      {editingCell?.rowId === row.id && editingCell?.field === "lotsHandedOver" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellSave}
                          onKeyDown={e => e.key === "Enter" && handleCellSave()}
                          autoFocus
                          className="w-full text-center p-1 bg-white border border-blue-500 rounded-md font-bold text-slate-900"
                        />
                      ) : (
                        formatNumber(row.lotsHandedOver)
                      )}
                    </td>

                    {/* Total to be Handed-Over -> DISTINCT BLUE COLOR */}
                    <td className="p-2.5 text-center font-black text-blue-950 border border-slate-300 bg-blue-100/90 align-middle">
                      {formatNumber(toBeHanded)}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* GRAND TOTAL FOOTER ROW FOR LOTS */}
            <tfoot>
              <tr className="bg-slate-200 text-slate-950 font-black text-xs border-t-2 border-slate-400">
                <td className="p-3 border border-slate-300 font-black bg-slate-300 text-center"></td>
                <td colSpan={2} className="p-3 uppercase tracking-wider text-center border border-slate-300 font-black bg-slate-800 text-white">
                  GRAND TOTAL:
                </td>

                <td className="p-3 text-center border border-slate-300 bg-emerald-200 font-black text-emerald-950 text-sm">
                  {lotsGrandTotals.rapLotsSum.toLocaleString()}
                </td>

                <td className="p-3 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {lotsGrandTotals.currentLotsAcquisitionSum.toLocaleString()}
                </td>

                <td className="p-3 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {lotsGrandTotals.lotsPaidSum.toLocaleString()}
                </td>

                <td className="p-3 text-center border border-slate-300 font-black bg-slate-200 text-slate-950">
                  {lotsGrandTotals.lotsHandedOverSum.toLocaleString()}
                </td>

                <td className="p-3 text-center border border-slate-300 bg-blue-200 font-black text-blue-950 text-sm">
                  {lotsGrandTotals.lotsToBeHandedOverSum.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* RENDER MODE 3: CHART_V1 GANTT LINEAR TRACK MATRIX */}
      {displayMetric === "gantt" && (
        <AdbChartV1Gantt data={data} />
      )}
    </div>
  );
};
