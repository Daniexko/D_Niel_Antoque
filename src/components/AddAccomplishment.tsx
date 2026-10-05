import React, { useState, useEffect } from "react";
import { 
  Search, Save, Trash2, CheckCircle2, AlertCircle, User, Calendar, 
  LogIn, LogOut, Database, RefreshCw, Pencil, X, Clock, Coins, 
  Building2, MapPin, Activity, Filter, TrendingUp, Layers, 
  ShieldCheck, FileSpreadsheet, UserCheck, History, Sparkles, ChevronRight
} from "lucide-react";
import { cn } from "../lib/utils";
import { LotData, GoogleUser } from "../types";
import { ThemeConfig } from "../lib/theme";
import { initAuth, googleSignIn, logoutGoogle } from "../services/googleAuth";
import { updateAccomplishment, deleteAccomplishment } from "../services/dataService";
import { User as FirebaseUser } from "firebase/auth";

interface AddAccomplishmentProps {
  data: LotData[];
  currentUser?: GoogleUser;
  activeTheme: ThemeConfig;
}

interface AccomplishmentRecord {
  rowIndex: number; // 0-based row index in sheet
  date: string;
  lotId: string;
  cp: string;
  owner: string;
  handler: string;
  status: string;
  remarks: string;
  isLocal?: boolean;
}

export const STATUS_CATEGORIES = [
  {
    id: "not_only",
    label: "Notice of Taking (NOT Only)",
    statuses: ["DRAFTED NOT", "ISSUED NOT", "RE-ISSUED NOT", "REFUSED NOT"]
  },
  {
    id: "docs_collection",
    label: "Document Collection",
    statuses: ["COLLECTION OF DOCUMENTS"]
  },
  {
    id: "rfd_otb",
    label: "RFD / OTB (Lot Only Offer)",
    statuses: [
      "DRAFTED RFD/OTB",
      "ISSUED RFD/OTB",
      "RE-ISSUED RFD/OTB",
      "COLLECTION OF ACCEPTED RFD/OTB",
      "ISSUED AND COLLECTED ACCEPTED RFD/OTB",
      "COLLECTION OF REJECTED RFD/OTB",
      "REFUSED RFD/OTB"
    ]
  },
  {
    id: "rfd_otc",
    label: "RFD / OTC (Structure Only Offer)",
    statuses: [
      "DRAFTED RFD/OTC",
      "ISSUED RFD/OTC",
      "RE-ISSUED RFD/OTC",
      "COLLECTION OF ACCEPTED RFD/OTC",
      "ISSUED AND COLLECTED ACCEPTED RFD/OTC",
      "COLLECTION OF REJECTED RFD/OTC",
      "REFUSED RFD/OTC"
    ]
  },
  {
    id: "rfd_otb_otc",
    label: "RFD / OTB / OTC (Combined Lot & Structure Offer)",
    statuses: [
      "DRAFTED COMBINED RFD/OTB/OTC",
      "ISSUED COMBINED RFD/OTB/OTC",
      "RE-ISSUED COMBINED RFD/OTB/OTC",
      "COLLECTION OF ACCEPTED COMBINED RFD/OTB/OTC",
      "ISSUED AND COLLECTED ACCEPTED COMBINED RFD/OTB/OTC",
      "COLLECTION OF REJECTED COMBINED RFD/OTB/OTC",
      "REFUSED COMBINED RFD/OTB/OTC"
    ]
  },
  {
    id: "not_rfd_otb",
    label: "NOT / RFD / OTB (Combined Lot Only Offer)",
    statuses: [
      "DRAFTED COMBINED NOT/RFD/OTB",
      "ISSUED COMBINED NOT/RFD/OTB",
      "RE-ISSUED COMBINED NOT/RFD/OTB",
      "COLLECTION OF ACCEPTED NOT/RFD/OTB",
      "ISSUED AND  COLLECTED ACCEPTED NOT/RFD/OTB",
      "COLLECTION OF REJECTED NOT/RFD/OTB",
      "REFUSED NOT/RFD/OTB"
    ]
  },
  {
    id: "not_otb_otc",
    label: "NOT / OTB / OTC Combined Offer Letter (Lot & Structure)",
    statuses: [
      "DRAFTED COMBINED NOT/RFD/OTB/C",
      "ISSUED COMBINED NOT/RFD/OTB/C",
      "RE-ISSUED COMBINED NOT/RFD/OTB/C",
      "COLLECTION OF ACCEPTED NOT/RFD/OTB/C",
      "ISSUED AND COLLECTED ACCEPTED NOT/RFD/OTB/C",
      "COLLECTION OF REJECTED NOT/RFD/OTB/C",
      "REFUSED NOT/RFD/OTB/C"
    ]
  },
  {
    id: "doas",
    label: "Deed of Absolute Sale (DOAS)",
    statuses: ["DRAFTED DOAS", "ISSUED DOAS", "RE-ISSUED DOAS", "SIGNED DOAS", "NOTARIZED DOAS", "REFUSED DOAS"]
  },
  {
    id: "ejseas",
    label: "Extrajudicial Settlement with Sale (EJSEAS / EJEAS)",
    statuses: ["DRAFTED EJSEAS", "ISSUED EJSEAS", "RE-ISSUED EJSEAS", "SIGNED EJSEAS", "NOTARIZED EJSEAS", "REFUSED EJSEAS"]
  },
  {
    id: "adri",
    label: "Agreement to Deliver (ADRI)",
    statuses: ["DRAFTED ADRI", "ISSUED ADRI", "RE-ISSUED ADRI", "SIGNED ADRI", "NOTARIZED ADRI", "REFUSED ADRI"]
  },
  {
    id: "pte",
    label: "Permit to Enter (PTE)",
    statuses: ["DRAFTED PTE", "ISSUED PTE", "RE-ISSUED PTE", "SIGNED PTE", "NOTARIZED PTE", "REFUSED PTE"]
  },
  {
    id: "payment_prep",
    label: "Payment Preparation (LBP Account)",
    statuses: ["OPENED LBP ACCOUNT FOR LANDOWNER", "CREDITED PAYMENT TO LBP"]
  },
  {
    id: "payment_payout",
    label: "Payment / Payout Achievements",
    statuses: [
      "FULLY PAID",
      "PAID WITH WOP",
      "PAID ENTITLEMENTS",
      "PARTIALLY PAID",
      "CROPS AND TREES ADVANCED PAYMENT BY THE CONTRACTOR TO CLAIMANT",
      "CROPS AND TREES PAID BY DOTr TO THE CONTRACTOR",
      "CROPS AND TREES PAID BY DOTr TO LO"
    ]
  },
  {
    id: "gov_moa",
    label: "Government Permits (CNO/MOA)",
    statuses: ["SECURED CNO", "SECURED MOA"]
  },
  {
    id: "handover",
    label: "Property Handover",
    statuses: ["HANDED OVER LOT"]
  },
  {
    id: "other",
    label: "Other Transactions",
    statuses: ["OTHER"]
  }
];

export const AddAccomplishment: React.FC<AddAccomplishmentProps> = ({ data, currentUser, activeTheme }) => {
  const [search, setSearch] = useState("");
  const [selectedLot, setSelectedLot] = useState<LotData | null>(null);

  // 1. Pre-compute lookup map of lotId (lowercase) to LotData for O(1) lightning-fast performance
  const lotLookupMap = React.useMemo(() => {
    const map = new Map<string, LotData>();
    data.forEach(d => {
      if (d.lotId) {
        map.set(d.lotId.trim().toLowerCase(), d);
      }
    });
    return map;
  }, [data]);

  // Google Auth integration states
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Existing records from Google Sheet
  const [allAccomplishments, setAllAccomplishments] = useState<AccomplishmentRecord[]>([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  // Local/offline accomplishments fallback
  const [localAccomplishments, setLocalAccomplishments] = useState<AccomplishmentRecord[]>(() => {
    try {
      const stored = localStorage.getItem("gcr_local_accomplishments");
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.map((item: any) => ({ ...item, isLocal: true })) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  // Save local accomplishments to localStorage when updated
  useEffect(() => {
    try {
      localStorage.setItem("gcr_local_accomplishments", JSON.stringify(localAccomplishments));
    } catch (err) {
      console.error("Failed to save local accomplishments:", err);
    }
  }, [localAccomplishments]);

  // Combine Google Sheets accomplishments and local accomplishments
  const displayedAccomplishments = React.useMemo(() => {
    if (googleToken) {
      // If logged in, prioritize sheet achievements but allow any local ones that might be offline drafts
      return [...allAccomplishments, ...localAccomplishments];
    }
    return localAccomplishments;
  }, [googleToken, allAccomplishments, localAccomplishments]);

  // History filtering states
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");
  const [historyCpFilter, setHistoryCpFilter] = useState("");
  const [historyViewMode, setHistoryViewMode] = useState<"all" | "selected">("all");
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(25);

  // Automatically reset pagination when any filters or history mode change
  useEffect(() => {
    setVisibleHistoryCount(25);
  }, [historySearch, historyStatusFilter, historyCpFilter, historyViewMode, selectedLot]);

  // Sync selectedLot with the right-side timeline tab mode
  useEffect(() => {
    if (selectedLot) {
      setHistoryViewMode("selected");
    } else {
      setHistoryViewMode("all");
    }
  }, [selectedLot]);

  // Editing state
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [deletingRowIndex, setDeletingRowIndex] = useState<number | null>(null);

  // Bulk update states
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkLotIdsInput, setBulkLotIdsInput] = useState("");
  const [previewLot, setPreviewLot] = useState<LotData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const [formData, setFormData] = useState({
    handlerName: currentUser?.name || "",
    accomplishmentDate: new Date().toISOString().split('T')[0],
    lotId: "",
    owner: "",
    cp: "",
    status: "",
    remarks: ""
  });

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "warning" | "error" | "info" | "validation";
    missingFields?: string[];
  } | null>(null);

  // Live status update states
  const [formTab, setFormTab] = useState<"accomplishment" | "updateStatus">("accomplishment");
  const [updateFile, setUpdateFile] = useState<string>("land_acquisition");
  const [updateCategory, setUpdateCategory] = useState<string>("NOT");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Actual Amounts (CONSOLIDATED LIST) states
  const [actualsPartitions, setActualsPartitions] = useState<{
    rowNumber: number;
    structureTag: string;
    sourceOfCostInfo: string;
    totalLotLandCost: string;
    paymentStructureStatus: string;
    totalPaidStructureCost: string;
    paymentFenceStatus: string;
    fenceOtherCost: string;
  }[]>([{
    rowNumber: -1,
    structureTag: "LOT ONLY",
    sourceOfCostInfo: "",
    totalLotLandCost: "",
    paymentStructureStatus: "",
    totalPaidStructureCost: "",
    paymentFenceStatus: "",
    fenceOtherCost: ""
  }]);
  const [selectedActualIndex, setSelectedActualIndex] = useState<number>(0);
  const [isFetchingActuals, setIsFetchingActuals] = useState<boolean>(false);

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
  });

  // Prefill statusFields when a Lot is searched/selected
  useEffect(() => {
    if (selectedLot) {
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
      });
    }
  }, [selectedLot]);

  // Fetch Actual Amounts from CONSOLIDATED LIST whenever selectedLot and googleToken exist
  useEffect(() => {
    if (selectedLot && googleToken) {
      let isSubscribed = true;
      const loadActuals = async () => {
        setIsFetchingActuals(true);
        try {
          const spreadsheetId = "18yHsrS2PHuYhoUtp_Q0ZRSviKoagJGc48hA9uHb-qvI";
          const sheetName = "'CONSOLIDATED LIST'";
          const fetchResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!C:BD")}`, {
            headers: {
              "Authorization": `Bearer ${googleToken}`
            }
          });

          if (!fetchResponse.ok) {
            throw new Error("Failed to fetch CONSOLIDATED LIST spreadsheet data");
          }

          const resultData = await fetchResponse.json();
          const values = resultData.values || [];

          const getVal = (row: any[], index: number) => {
            return (row && row[index] !== undefined) ? row[index].toString().trim() : "";
          };

          const cleanLot = (str: string) => (str || "").toString().trim().toUpperCase().replace(/^LOT\s+/, "");
          const targetLotId = cleanLot(selectedLot.lotId);

          const matchedPartitions: {
            rowNumber: number;
            structureTag: string;
            sourceOfCostInfo: string;
            totalLotLandCost: string;
            paymentStructureStatus: string;
            totalPaidStructureCost: string;
            paymentFenceStatus: string;
            fenceOtherCost: string;
          }[] = [];

          for (let i = 0; i < values.length; i++) {
            const row = values[i];
            const colF = cleanLot(getVal(row, 3)); // Column F is index 3 in C:BD
            const colE = cleanLot(getVal(row, 2)); // Column E is index 2 in C:BD
            const colC = cleanLot(getVal(row, 0)); // Column C is index 0 in C:BD

            if (colF === targetLotId || colE === targetLotId || colC === targetLotId) {
              matchedPartitions.push({
                rowNumber: i + 1,
                structureTag: getVal(row, 2) || "LOT ONLY",
                sourceOfCostInfo: getVal(row, 47), // Col AX
                totalLotLandCost: getVal(row, 49), // Col AZ
                paymentStructureStatus: getVal(row, 50), // Col BA
                totalPaidStructureCost: getVal(row, 51), // Col BB
                paymentFenceStatus: getVal(row, 52), // Col BC
                fenceOtherCost: getVal(row, 53) // Col BD
              });
            }
          }

          if (!isSubscribed) return;

          if (matchedPartitions.length > 0) {
            setActualsPartitions(matchedPartitions);
            setSelectedActualIndex(0);
          } else {
            setActualsPartitions([{
              rowNumber: -1,
              structureTag: "LOT ONLY",
              sourceOfCostInfo: "",
              totalLotLandCost: "",
              paymentStructureStatus: "",
              totalPaidStructureCost: "",
              paymentFenceStatus: "",
              fenceOtherCost: ""
            }]);
            setSelectedActualIndex(0);
          }
        } catch (err) {
          console.error("Error loading actual amounts:", err);
        } finally {
          if (isSubscribed) setIsFetchingActuals(false);
        }
      };

      loadActuals();

      return () => {
        isSubscribed = false;
      };
    }
  }, [selectedLot, googleToken]);

  const saveActualAmountsToConsolidatedList = async () => {
    if (!googleToken || !selectedLot || actualsPartitions.length === 0) return;
    const spreadsheetId = "18yHsrS2PHuYhoUtp_Q0ZRSviKoagJGc48hA9uHb-qvI";
    const sheetName = "'CONSOLIDATED LIST'";

    const activePart = actualsPartitions[selectedActualIndex] || actualsPartitions[0];
    if (!activePart) return;

    let targetRow = activePart.rowNumber;

    const cleanLot = (str: string) => (str || "").toString().trim().toUpperCase().replace(/^LOT\s+/, "");
    const targetTerm = cleanLot(selectedLot.lotId);

    if (targetRow === -1) {
      const fetchResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!C:F")}`, {
        headers: { "Authorization": `Bearer ${googleToken}` }
      });
      if (fetchResponse.ok) {
        const resultData = await fetchResponse.json();
        const values = resultData.values || [];

        for (let i = 0; i < values.length; i++) {
          const colC = cleanLot(values[i][0]);
          const colE = cleanLot(values[i][2]);
          const colF = cleanLot(values[i][3]);
          if (colF === targetTerm || colC === targetTerm || colE === targetTerm) {
            targetRow = i + 1;
            break;
          }
        }
      }
    }

    if (targetRow === -1) {
      console.warn("Could not find row in CONSOLIDATED LIST for Lot ID:", selectedLot.lotId);
      return;
    }

    const updates = [
      { col: "AX", val: activePart.sourceOfCostInfo || "" },
      { col: "AZ", val: activePart.totalLotLandCost || "" },
      { col: "BA", val: activePart.paymentStructureStatus || "" },
      { col: "BB", val: activePart.totalPaidStructureCost || "" },
      { col: "BC", val: activePart.paymentFenceStatus || "" },
      { col: "BD", val: activePart.fenceOtherCost || "" },
    ];

    for (const update of updates) {
      const range = `${sheetName}!${update.col}${targetRow}`;
      const res = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(range)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${googleToken}`
        },
        body: JSON.stringify({
          values: [[update.val]]
        })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.error(`Failed to update CONSOLIDATED LIST cell ${update.col}${targetRow}:`, errJson);
      }
    }
  };

  const handleStatusUpdate = async () => {
    if (!googleToken) {
      setAlertModal({
        isOpen: true,
        title: "Google Sheet Connection Required",
        message: "Please sign in to your Google Account first to update live status directly in the Google Spreadsheet.",
        type: "warning"
      });
      return;
    }

    if (!selectedLot) {
      setAlertModal({
        isOpen: true,
        title: "No Lot Selected",
        message: "Please search and select a Lot ID first from the search bar in Step 1 before performing a status update.",
        type: "warning"
      });
      return;
    }

    setIsUpdatingStatus(true);
    setSubmitStatus(null);

    try {
      if (updateFile === "actual_amounts") {
        const spreadsheetId = "18yHsrS2PHuYhoUtp_Q0ZRSviKoagJGc48hA9uHb-qvI";
        const sheetName = "'CONSOLIDATED LIST'";

        const activePart = actualsPartitions[selectedActualIndex] || actualsPartitions[0];
        if (!activePart) {
          throw new Error("No structure tag partition selected.");
        }

        let targetRow = activePart.rowNumber;

        const cleanLot = (str: string) => (str || "").toString().trim().toUpperCase().replace(/^LOT\s+/, "");
        const targetTerm = cleanLot(selectedLot.lotId);

        if (targetRow === -1) {
          const fetchResponse = await fetch(`/api/sheets/${spreadsheetId}/values/${encodeURIComponent(sheetName + "!C:F")}`, {
            headers: { "Authorization": `Bearer ${googleToken}` }
          });
          if (!fetchResponse.ok) {
            throw new Error("Failed to search CONSOLIDATED LIST spreadsheet");
          }
          const resultData = await fetchResponse.json();
          const values = resultData.values || [];

          for (let i = 0; i < values.length; i++) {
            const colC = cleanLot(values[i][0]);
            const colE = cleanLot(values[i][2]);
            const colF = cleanLot(values[i][3]);
            if (colF === targetTerm || colC === targetTerm || colE === targetTerm) {
              targetRow = i + 1;
              break;
            }
          }
        }

        if (targetRow === -1) {
          throw new Error(`Lot ID "${selectedLot.lotId}" was not found in CONSOLIDATED LIST sheet.`);
        }

        const updates = [
          { col: "AX", val: activePart.sourceOfCostInfo || "" },
          { col: "AZ", val: activePart.totalLotLandCost || "" },
          { col: "BA", val: activePart.paymentStructureStatus || "" },
          { col: "BB", val: activePart.totalPaidStructureCost || "" },
          { col: "BC", val: activePart.paymentFenceStatus || "" },
          { col: "BD", val: activePart.fenceOtherCost || "" },
        ];

        for (const update of updates) {
          const range = `${sheetName}!${update.col}${targetRow}`;
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
            throw new Error(`Failed to update cell ${update.col}${targetRow}: ${errorText}`);
          }
        }

        setSubmitStatus({
          type: "success",
          message: `Successfully updated Actual Amounts in CONSOLIDATED LIST for Lot ID "${selectedLot.lotId}" (Structure Tag: "${activePart.structureTag}", Row ${targetRow})!`
        });

        await fetchSheetData();
        return;
      }

      const spreadsheetId = "15MLklcCnFgaGTo_w_mM9Nb3qV3jWLfrK5i-hMAW5QMU";
      const sheetName = "01.MASTERLIST";
      
      // Fetch Column C to locate row index (LOT ID NO)
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

      const rowNumber = rowIndex + 1; // Convert 0-based index to 1-based row number
      const updates: { col: string; val: string }[] = [];

      if (updateCategory === "NOT") {
        updates.push({ col: "BG", val: statusFields.notStatus });
        updates.push({ col: "BK", val: statusFields.notDateIssued });
      } else if (updateCategory === "RFD") {
        updates.push({ col: "CJ", val: statusFields.rfdStatus });
        updates.push({ col: "CL", val: statusFields.rfdDateIssued });
        updates.push({ col: "CN", val: statusFields.rfdLoReplyStatus });
        updates.push({ col: "CO", val: statusFields.rfdLoDateReply });
      } else if (updateCategory === "OTB") {
        updates.push({ col: "CQ", val: statusFields.otbStatus });
        updates.push({ col: "CS", val: statusFields.otbDateIssued });
        updates.push({ col: "CW", val: statusFields.otbLoReplyStatus });
        updates.push({ col: "CY", val: statusFields.otbLoDateReply });
      } else if (updateCategory === "OTC") {
        updates.push({ col: "DA", val: statusFields.otcStatus });
        updates.push({ col: "DC", val: statusFields.otcDateIssued });
        updates.push({ col: "DG", val: statusFields.otcLoReplyStatus });
        updates.push({ col: "DI", val: statusFields.otcLoDateReply });
      } else if (updateCategory === "DOAS" || updateCategory === "EJSEAS") {
        updates.push({ col: "DO", val: statusFields.doasStatus });
        updates.push({ col: "DQ", val: statusFields.doasDateSigned });
        updates.push({ col: "DS", val: statusFields.doasDateNotarized });
      } else if (updateCategory === "ADRI") {
        updates.push({ col: "DU", val: statusFields.adriStatus });
        updates.push({ col: "DW", val: statusFields.adriDateSigned });
        updates.push({ col: "DZ", val: statusFields.adriDateNotarized });
      } else if (updateCategory === "PTE") {
        updates.push({ col: "DK", val: statusFields.pteStatus });
        updates.push({ col: "DM", val: statusFields.pteDateSigned });
      } else if (updateCategory === "ENVI") {
        updates.push({ col: "EB", val: statusFields.enviStatus });
        updates.push({ col: "EC", val: statusFields.enviDatePaid });
      } else if (updateCategory === "PAYMENT") {
        updates.push({ col: "EH", val: statusFields.paymentStatus });
        updates.push({ col: "EI", val: statusFields.paymentDateOfPayment });
      } else if (updateCategory === "RIGHT OF WAY STATUS") {
        updates.push({ col: "ER", val: statusFields.rowStatus });
        updates.push({ col: "ES", val: statusFields.rowDateSigned });
      } else if (updateCategory === "HANDED OVER LOTS") {
        updates.push({ col: "EK", val: statusFields.handedOverStatus });
        updates.push({ col: "EL", val: statusFields.handedOverDate });
      }

      // Execute updates using live PUT requests to cell ranges
      for (const update of updates) {
        const range = `${sheetName}!${update.col}${rowNumber}:${update.col}${rowNumber}`;
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
          throw new Error(`Failed to update cell ${update.col}${rowNumber}: ${errorText}`);
        }
      }

      setSubmitStatus({
        type: "success",
        message: `Successfully updated ${updates.length} status field(s) in Land Acquisition spreadsheet for Lot ID "${selectedLot.lotId}" (Row ${rowNumber})! Note: It may take a few minutes for changes to propagate to cached charts/dashboard.`
      });

      // Optionally refresh the log history as well
      await fetchSheetData();
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

  // Track the logged in handler name if Google auth updates
  useEffect(() => {
    if (googleUser?.displayName) {
      setFormData(prev => ({ ...prev, handlerName: googleUser.displayName }));
    } else if (currentUser?.name) {
      setFormData(prev => ({ ...prev, handlerName: currentUser.name }));
    }
  }, [googleUser, currentUser]);

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

  // Fetch sheet data whenever token is available or changes
  useEffect(() => {
    if (googleToken) {
      fetchSheetData();
    } else {
      setAllAccomplishments([]);
    }
  }, [googleToken]);

  // Safely auto-sync offline accomplishments to Google Sheets when logged in
  useEffect(() => {
    const syncOfflineAccomplishments = async () => {
      if (googleToken && localAccomplishments.length > 0) {
        setIsSubmitting(true);
        setSubmitStatus({
          type: "success",
          message: `Synchronizing ${localAccomplishments.length} offline drafts to Google Sheets 'ACCOMPLISHMENT'...`
        });
        try {
          const bulkRows = localAccomplishments.map(rec => [
            rec.date,
            rec.lotId,
            rec.cp,
            rec.owner,
            rec.handler,
            rec.status,
            "",
            rec.remarks
          ]);

          const response = await fetch("/api/sheets/append", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${googleToken}`
            },
            body: JSON.stringify({
              spreadsheetId: "1z2GJlrTZ2dtiWm3NnTCW5vYTgmviopoCqFpecPJSbAE",
              range: "ACCOMPLISHMENT!A:H",
              values: bulkRows
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Failed to sync offline accomplishments.");
          }

          // Clear local accomplishments
          setLocalAccomplishments([]);
          localStorage.removeItem("gcr_local_accomplishments");

          setSubmitStatus({
            type: "success",
            message: `Successfully synchronized ${localAccomplishments.length} offline drafts to Google Sheets!`
          });

          await fetchSheetData();
        } catch (err: any) {
          console.error("Auto-sync failed:", err);
          setSubmitStatus({
            type: "error",
            message: `Auto-sync failed: ${err.message || err}. Offline drafts are preserved locally.`
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    };

    syncOfflineAccomplishments();
  }, [googleToken]);

  const fetchSheetData = async () => {
    if (!googleToken) return;
    setIsLoadingExisting(true);
    try {
      const response = await fetch(`/api/sheets/1z2GJlrTZ2dtiWm3NnTCW5vYTgmviopoCqFpecPJSbAE/values/ACCOMPLISHMENT!A:H?t=${Date.now()}`, {
        headers: {
          "Authorization": `Bearer ${googleToken}`
        }
      });
      if (response.ok) {
        const result = await response.json();
        const rows = result.values || [];
        
        // Parse rows. Skip header row (index 0)
        const parsed: AccomplishmentRecord[] = rows.map((row: string[], index: number) => {
          if (index === 0) return null;
          return {
            rowIndex: index, // 0-based index in the sheet representation
            date: row[0] || "",
            lotId: (row[1] || "").trim(),
            cp: row[2] || "",
            owner: row[3] || "",
            handler: row[4] || "",
            status: row[5] || "",
            remarks: row[7] || "",
            isLocal: false
          };
        }).filter(Boolean) as AccomplishmentRecord[];
        
        setAllAccomplishments(parsed);
      }
    } catch (err) {
      console.error("Error fetching sheet data:", err);
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    setSubmitStatus(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setGoogleToken(result.accessToken);
        setSubmitStatus({ type: "success", message: `Connected to Google Account: ${result.user.email}` });
      }
    } catch (err: any) {
      if (err && (err.code === "auth/popup-closed-by-user" || err.message?.includes("popup-closed-by-user"))) {
        console.warn("Google sign in cancelled by user.");
        setSubmitStatus({ type: "error", message: "Sign-in cancelled by user (popup closed)." });
      } else {
        console.error("Sign in failed:", err);
        setSubmitStatus({ type: "error", message: `Authentication failed: ${err.message || err}` });
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setGoogleToken(null);
      setAllAccomplishments([]);
      setSubmitStatus({ type: "success", message: "Disconnected from Google Sheets." });
    } catch (err: any) {
      console.error("Sign out failed:", err);
    }
  };

  const handleSearch = () => {
    if (!search.trim()) return;
    const lot = lotLookupMap.get(search.trim().toLowerCase());
    if (lot) {
      setSelectedLot(lot);
      setFormData(prev => ({
        ...prev,
        lotId: lot.lotId,
        owner: lot.ownerName,
        cp: lot.cp
      }));
      setHistoryViewMode("selected"); // Focus history feed on this lot!
      setSubmitStatus(null);
    } else {
      setAlertModal({
        isOpen: true,
        title: "Lot ID Not Found",
        message: `Lot ID "${search}" was not found in the Local Database. Please double-check the ID or format and try again.`,
        type: "error"
      });
    }
  };

  // Parse bulk input in real-time
  const parsedBulkLotIds = React.useMemo(() => {
    if (!bulkLotIdsInput.trim()) return [];
    // Split by comma, line break, spaces, or semicolons
    return Array.from(new Set(
      bulkLotIdsInput
        .split(/[\n,;\s]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0)
    ));
  }, [bulkLotIdsInput]);

  // Find valid and invalid Lot IDs from the database
  const bulkStatus = React.useMemo(() => {
    const valid: LotData[] = [];
    const invalid: string[] = [];

    parsedBulkLotIds.forEach(id => {
      const lot = lotLookupMap.get(id.toLowerCase());
      if (lot) {
        valid.push(lot);
      } else {
        invalid.push(id);
      }
    });

    return { valid, invalid };
  }, [parsedBulkLotIds, lotLookupMap]);

  // Quick select helper batches
  const selectSuggestionBatch = (type: "cp1" | "cp2" | "unpaid" | "draft") => {
    let selectedIds: string[] = [];
    if (type === "cp1") {
      selectedIds = data.filter(d => (d.cp || "").toUpperCase().includes("CP01")).slice(0, 6).map(d => d.lotId);
    } else if (type === "cp2") {
      selectedIds = data.filter(d => (d.cp || "").toUpperCase().includes("CP02")).slice(0, 6).map(d => d.lotId);
    } else if (type === "unpaid") {
      // Find lots that don't have "PAID" accomplishments in current history
      const paidLotIds = new Set(displayedAccomplishments.filter(a => a.status.toUpperCase().includes("PAID")).map(a => a.lotId.toLowerCase()));
      selectedIds = data.filter(d => !paidLotIds.has((d.lotId || "").toLowerCase())).slice(0, 6).map(d => d.lotId);
    } else {
      // General demo lots
      selectedIds = data.slice(2, 8).map(d => d.lotId);
    }
    setBulkLotIdsInput(selectedIds.join(", "));
  };

  const handleSave = async () => {
    const missing: string[] = [];
    if (!formData.handlerName?.trim()) {
      missing.push("Case Handler Name");
    }
    if (!formData.accomplishmentDate) {
      missing.push("Date of Accomplishment");
    }
    
    if (isBulkMode) {
      if (!bulkLotIdsInput?.trim()) {
        missing.push("Bulk Lot IDs");
      }
    } else {
      if (!formData.lotId?.trim()) {
        missing.push("Lot ID No. (Please select a lot)");
      }
    }
    
    if (!selectedCategory) {
      missing.push("Process Category / Phase");
    }
    if (!formData.status) {
      missing.push("Status of Accomplishment");
    }
    if (!formData.remarks?.trim()) {
      missing.push("Remarks / Milestone Notes");
    }

    if (missing.length > 0) {
      setAlertModal({
        isOpen: true,
        title: "Incomplete Required Fields",
        message: "You cannot record this accomplishment yet. Please review and fill out all required fields marked with a red asterisk (*).",
        type: "validation",
        missingFields: missing
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      if (isBulkMode) {
        const validLots = bulkStatus.valid;
        if (validLots.length === 0) {
          setAlertModal({
            isOpen: true,
            title: "No Valid Lot IDs",
            message: "None of the entered Lot IDs were found or verified. Please enter at least one valid, existing Lot ID.",
            type: "warning"
          });
          setIsSubmitting(false);
          return;
        }

        if (googleToken) {
          // Sync with Google Sheets
          const bulkRows = validLots.map(lot => [
            formData.accomplishmentDate, // A
            lot.lotId,                   // B
            lot.cp || "N/A",             // C
            lot.ownerName || "N/A",      // D
            formData.handlerName,        // E
            formData.status,             // F
            "",                          // G
            formData.remarks             // H
          ]);

          const response = await fetch("/api/sheets/append", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${googleToken}`
            },
            body: JSON.stringify({
              spreadsheetId: "1z2GJlrTZ2dtiWm3NnTCW5vYTgmviopoCqFpecPJSbAE",
              range: "ACCOMPLISHMENT!A:H",
              values: bulkRows
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to append bulk records to Google Sheets.");
          }

          setSubmitStatus({ 
            type: "success", 
            message: `Successfully synchronized ${validLots.length} accomplishment records to Google Sheets 'ACCOMPLISHMENT' in a single batch append!` 
          });
          
          await fetchSheetData();
        } else {
          // Offline local mode
          const newRecords: AccomplishmentRecord[] = validLots.map((lot, index) => ({
            rowIndex: 100000000 + Date.now() + index, // Use a very high base index so it's always >= 100M
            date: formData.accomplishmentDate,
            lotId: lot.lotId,
            cp: lot.cp || "N/A",
            owner: lot.ownerName || "N/A",
            handler: formData.handlerName || "Local User",
            status: formData.status,
            remarks: formData.remarks,
            isLocal: true
          }));

          setLocalAccomplishments(prev => [...newRecords, ...prev]);
          setSubmitStatus({ 
            type: "success", 
            message: `Successfully saved ${validLots.length} accomplishment records locally! Connect Google Sheets to sync future updates.` 
          });
        }

        // Reset form but keep handler
        setFormData(prev => ({
          ...prev,
          remarks: "",
          lotId: "",
          owner: "",
          cp: ""
        }));
        setBulkLotIdsInput("");
        setSelectedLot(null);
      } else {
        // Single Lot mode
        if (!formData.lotId) {
          setAlertModal({
            isOpen: true,
            title: "No Lot Selected",
            message: "Please search and select a Lot ID first from the search bar before recording your accomplishment.",
            type: "warning"
          });
          setIsSubmitting(false);
          return;
        }

        const rowValues = [
          formData.accomplishmentDate, // A
          formData.lotId,             // B
          formData.cp,                // C
          formData.owner,             // D
          formData.handlerName,       // E
          formData.status,            // F
          "",                         // G
          formData.remarks            // H
        ];

        if (googleToken) {
          if (editingRowIndex !== null && editingRowIndex < 100000000) {
            const range = `ACCOMPLISHMENT!A${editingRowIndex + 1}:H${editingRowIndex + 1}`;
            await updateAccomplishment(
              googleToken,
              "1z2GJlrTZ2dtiWm3NnTCW5vYTgmviopoCqFpecPJSbAE",
              range,
              rowValues
            );

            setSubmitStatus({ 
              type: "success", 
              message: `Accomplishment successfully updated in Google Sheet 'ACCOMPLISHMENT' (Row ${editingRowIndex + 1})!` 
            });
          } else {
            // Append mode: Either a new record (null) OR converting a local offline record (>= 100M) to live sheet
            const response = await fetch("/api/sheets/append", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${googleToken}`
              },
              body: JSON.stringify({
                spreadsheetId: "1z2GJlrTZ2dtiWm3NnTCW5vYTgmviopoCqFpecPJSbAE",
                range: "ACCOMPLISHMENT!A:H",
                values: [rowValues]
              })
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error || "Failed to append to spreadsheet.");
            }

            if (editingRowIndex !== null && editingRowIndex >= 100000000) {
              setLocalAccomplishments(prev => prev.filter(rec => rec.rowIndex !== editingRowIndex));
              setSubmitStatus({ 
                type: "success", 
                message: "Offline accomplishment successfully synchronized and appended to Google Sheet 'ACCOMPLISHMENT'!" 
              });
            } else {
              setSubmitStatus({ 
                type: "success", 
                message: `Accomplishment successfully recorded and appended to Google Sheet 'ACCOMPLISHMENT'!` 
              });
            }
          }

          // Save actual amounts & source of cost info to CONSOLIDATED LIST if available
          try {
            await saveActualAmountsToConsolidatedList();
          } catch (cErr) {
            console.warn("Could not sync actual amounts to CONSOLIDATED LIST:", cErr);
          }

          // Fetch fresh list of accomplishments
          await fetchSheetData();
        } else {
          if (editingRowIndex !== null) {
            // Edit local accomplishment
            setLocalAccomplishments(prev => prev.map(rec => {
              if (rec.rowIndex === editingRowIndex) {
                return {
                  ...rec,
                  date: formData.accomplishmentDate,
                  lotId: formData.lotId || "N/A",
                  cp: formData.cp || "N/A",
                  owner: formData.owner || "N/A",
                  handler: formData.handlerName || "Local User",
                  status: formData.status,
                  remarks: formData.remarks,
                  isLocal: true
                };
              }
              return rec;
            }));
            setSubmitStatus({ 
              type: "success", 
              message: "Local Accomplishment successfully updated in offline history!" 
            });
          } else {
            // Add local accomplishment
            const newRecord: AccomplishmentRecord = {
              rowIndex: 100000000 + Date.now(), // Generate unique local row index offset
              date: formData.accomplishmentDate,
              lotId: formData.lotId || "N/A",
              cp: formData.cp || "N/A",
              owner: formData.owner || "N/A",
              handler: formData.handlerName || "Local User",
              status: formData.status,
              remarks: formData.remarks,
              isLocal: true
            };
            setLocalAccomplishments(prev => [newRecord, ...prev]);
            setSubmitStatus({ 
              type: "success", 
              message: "Accomplishment successfully recorded in local history! Connect your Google Account above to synchronize to Google Sheets." 
            });
          }
        }

        // Reset form fields but keep handler
        setFormData(prev => ({
          ...prev,
          lotId: "",
          owner: "",
          cp: "",
          status: "",
          remarks: ""
        }));
        setSelectedLot(null);
        setSearch("");
        setEditingRowIndex(null);
      }
    } catch (err: any) {
      console.error("Failed to save accomplishment:", err);
      setSubmitStatus({ 
        type: "error", 
        message: `Failed to synchronize with Google Sheet: ${err.message || err}` 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRecord = (record: AccomplishmentRecord) => {
    // Automatically switch from Bulk Batch Mode to Single Lot Mode so the user can edit the selected record
    setIsBulkMode(false);

    setFormData({
      handlerName: record.handler,
      accomplishmentDate: record.date,
      lotId: record.lotId,
      owner: record.owner,
      cp: record.cp,
      status: record.status,
      remarks: record.remarks
    });

    // Detect and auto-populate the Process Category for the edited record's status
    const matchedCategory = STATUS_CATEGORIES.find(cat => 
      cat.statuses.includes(record.status) || 
      (record.status === "SIGNED" && cat.id === "doas")
    );
    if (matchedCategory) {
      setSelectedCategory(matchedCategory.id);
    } else {
      setSelectedCategory("");
    }

    // Find the lot object in our database so we can show its Affected status as well
    const lotObj = data.find(d => (d.lotId || "").trim().toLowerCase() === record.lotId.trim().toLowerCase());
    if (lotObj) {
      setSelectedLot(lotObj);
    }

    setEditingRowIndex(record.rowIndex);
    setSearch(record.lotId);
    setSubmitStatus({
      type: "success",
      message: `Loaded Row ${record.rowIndex + 1} for Editing. You can modify values below and click Update.`
    });
    // Scroll window smoothly to form
    const formElement = document.getElementById("accomplishment-form-card");
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  const handleDeleteRecord = async (record: AccomplishmentRecord) => {
    if (record.isLocal || record.rowIndex >= 100000000) {
      setLocalAccomplishments(prev => prev.filter(rec => rec.rowIndex !== record.rowIndex));
      setSubmitStatus({
        type: "success",
        message: "Successfully deleted local offline accomplishment record!"
      });
      setDeletingRowIndex(null);
      if (editingRowIndex === record.rowIndex) {
        setEditingRowIndex(null);
        setFormData(prev => ({
          ...prev,
          lotId: "",
          owner: "",
          cp: "",
          status: "",
          remarks: ""
        }));
      }
      return;
    }

    if (!googleToken) {
      setSubmitStatus({
        type: "error",
        message: "Google account connection is required to delete records from the live spreadsheet. Please authenticate via the sign-in button at the top of the dashboard."
      });
      setDeletingRowIndex(null);
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      await deleteAccomplishment(
        googleToken,
        "1z2GJlrTZ2dtiWm3NnTCW5vYTgmviopoCqFpecPJSbAE",
        "ACCOMPLISHMENT",
        record.rowIndex
      );

      setSubmitStatus({
        type: "success",
        message: `Successfully deleted Row ${record.rowIndex + 1} from Google Sheets!`
      });

      setDeletingRowIndex(null);

      // Clear edit mode if deleted record was being edited
      if (editingRowIndex === record.rowIndex) {
        setEditingRowIndex(null);
        setFormData(prev => ({
          ...prev,
          lotId: "",
          owner: "",
          cp: "",
          status: "",
          remarks: ""
        }));
      }

      // Clear matching local/offline accomplishment from memory if any exists to avoid duplicate views
      setLocalAccomplishments(prev => prev.filter(rec => {
        return !(
          rec.lotId.trim().toLowerCase() === record.lotId.trim().toLowerCase() &&
          rec.status.trim().toLowerCase() === record.status.trim().toLowerCase() &&
          rec.remarks.trim().toLowerCase() === record.remarks.trim().toLowerCase()
        );
      }));

      // Re-fetch spreadsheet to update indices
      await fetchSheetData();
    } catch (err: any) {
      console.error("Failed to delete record:", err);
      setSubmitStatus({
        type: "error",
        message: `Deletion failed: ${err.message || err}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingRowIndex(null);
    setFormData(prev => ({
      ...prev,
      lotId: "",
      owner: "",
      cp: "",
      status: "",
      remarks: ""
    }));
    setSelectedLot(null);
    setSelectedCategory("");
    setSubmitStatus(null);
  };

  const clearForm = () => {
    setFormData({
      handlerName: googleUser?.displayName || currentUser?.name || "",
      accomplishmentDate: new Date().toISOString().split('T')[0],
      lotId: "",
      owner: "",
      cp: "",
      status: "",
      remarks: ""
    });
    setSelectedLot(null);
    setSelectedCategory("");
    setSearch("");
    setEditingRowIndex(null);
    setSubmitStatus(null);
  };

  // Filter accomplishments belonging to either the searched Lot or the currently selected Lot ID for the detail card
  const searchTarget = (search.trim() || formData.lotId || "").trim().toLowerCase();
  
  const currentLotRecords = React.useMemo(() => {
    if (!searchTarget) return [];
    return displayedAccomplishments.filter(acc => acc.lotId.toLowerCase() === searchTarget);
  }, [displayedAccomplishments, searchTarget]);

  // Global filtered timeline accomplishments (sorted in reverse order: newest rows first)
  const filteredHistory = React.useMemo(() => {
    let list = [...displayedAccomplishments].reverse();

    if (historyViewMode === "selected" && selectedLot) {
      list = list.filter(acc => acc.lotId.toLowerCase() === selectedLot.lotId.toLowerCase());
    }

    const searchLower = historySearch.toLowerCase().trim();

    return list.filter(acc => {
      const matchText = 
        !searchLower || 
        acc.lotId.toLowerCase().includes(searchLower) ||
        acc.owner.toLowerCase().includes(searchLower) ||
        acc.handler.toLowerCase().includes(searchLower) ||
        acc.remarks.toLowerCase().includes(searchLower);
      
      const matchStatus = !historyStatusFilter || acc.status === historyStatusFilter;
      const matchCp = !historyCpFilter || acc.cp === historyCpFilter;

      return matchText && matchStatus && matchCp;
    });
  }, [displayedAccomplishments, historyViewMode, selectedLot, historySearch, historyStatusFilter, historyCpFilter]);

  // Sliced history list to render only a subset and avoid DOM overload lag
  const visibleHistory = React.useMemo(() => {
    return filteredHistory.slice(0, visibleHistoryCount);
  }, [filteredHistory, visibleHistoryCount]);

  // Calculate quick summary metrics for the Sheets logs
  const { totalLogsCount, uniqueLotsLogged, paidLogsCount } = React.useMemo(() => {
    const total = displayedAccomplishments.length;
    
    // Efficient single-pass computation of metrics
    const lotSet = new Set<string>();
    let paidCount = 0;
    
    displayedAccomplishments.forEach(a => {
      if (a.lotId) lotSet.add(a.lotId.toLowerCase());
      if (a.status && a.status.toLowerCase().includes("paid")) {
        paidCount++;
      }
    });

    return {
      totalLogsCount: total,
      uniqueLotsLogged: lotSet.size,
      paidLogsCount: paidCount
    };
  }, [displayedAccomplishments]);

  // Unique status and CP options for history filters - memoized to prevent expensive rebuilds
  const uniqueStatusOptions = React.useMemo(() => {
    const statuses = new Set<string>();
    displayedAccomplishments.forEach(a => {
      if (a.status) statuses.add(a.status);
    });
    return Array.from(statuses).filter(Boolean);
  }, [displayedAccomplishments]);

  const uniqueCpOptions = React.useMemo(() => {
    const cps = new Set<string>();
    displayedAccomplishments.forEach(a => {
      if (a.cp) cps.add(a.cp);
    });
    return Array.from(cps).filter(Boolean);
  }, [displayedAccomplishments]);

  // Currency helper
  const formatPHP = (amount: number | string | undefined) => {
    if (amount === undefined || amount === null) return "₱0.00";
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "₱0.00";
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
    return `₱${formatted}`;
  };

  // Helper for area progress
  const areaPercentage = selectedLot && selectedLot.totalArea > 0 
    ? Math.round((selectedLot.affectedArea / selectedLot.totalArea) * 100) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 pb-24">
      {/* Visual Header Banner with integrated statistics & connection dashboard */}
      <div className={cn(
        "relative rounded-3xl p-6 md:p-8 overflow-hidden border transition-all duration-300 shadow-xl",
        activeTheme.isDark 
          ? "bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/30 border-slate-850 shadow-black/40" 
          : "bg-gradient-to-br from-blue-50/70 via-sky-50/50 to-white border-blue-100/80 shadow-sky-100/30"
      )}>
        {/* Abstract background blobs */}
        <div className="absolute -right-12 -top-12 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-64 h-64 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 items-center">
          
          {/* Left Column: App Branding & Info */}
          <div className="lg:col-span-5 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white shadow-lg shadow-blue-500/20 shrink-0">
                  <Sparkles className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className={cn(
                    "text-[9px] font-black uppercase tracking-[0.25em] px-2.5 py-0.5 rounded-full border inline-block",
                    activeTheme.isDark 
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/20" 
                      : "bg-blue-50 text-blue-700 border-blue-100"
                  )}>
                    Sheets Live Synchronization
                  </span>
                  <h1 className={cn("text-2xl md:text-3xl font-black tracking-tight font-sans mt-0.5", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                    ADD ACCOMPLISHMENT
                  </h1>
                </div>
              </div>
              <p className={cn("text-xs font-medium leading-relaxed max-w-lg", activeTheme.isDark ? "text-slate-400" : "text-slate-600")}>
                Record, synchronize, and update lot transaction achievements directly into Google Sheets. Track structures, affected land parameters, and actual payouts in real-time.
              </p>
            </div>
          </div>

          {/* Right Column: Dynamic Status & Statistics Console */}
          <div className="lg:col-span-7 flex flex-col justify-center gap-4">
            
            {/* Stats capsules in a horizontal row - Expanded full width with premium alignment */}
            {googleToken && (
              <div className="grid grid-cols-3 gap-3 w-full">
                <div className={cn(
                  "py-4 px-3 rounded-2xl border text-center font-sans flex flex-col justify-center items-center shadow-md backdrop-blur-md transition-all hover:scale-[1.02] duration-300",
                  activeTheme.isDark 
                    ? "bg-slate-900/50 border-slate-800/80 shadow-black/35 hover:border-slate-700/80" 
                    : "bg-white border-slate-200/80 shadow-slate-100/60 hover:border-slate-300"
                )}>
                  <p className="text-xl sm:text-2xl font-black text-blue-500 leading-none mb-1.5">{totalLogsCount}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">Total Records</p>
                </div>
                <div className={cn(
                  "py-4 px-3 rounded-2xl border text-center font-sans flex flex-col justify-center items-center shadow-md backdrop-blur-md transition-all hover:scale-[1.02] duration-300",
                  activeTheme.isDark 
                    ? "bg-slate-900/50 border-slate-800/80 shadow-black/35 hover:border-slate-700/80" 
                    : "bg-white border-slate-200/80 shadow-slate-100/60 hover:border-slate-300"
                )}>
                  <p className="text-xl sm:text-2xl font-black text-indigo-500 leading-none mb-1.5">{uniqueLotsLogged}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">Unique Lots</p>
                </div>
                <div className={cn(
                  "py-4 px-3 rounded-2xl border text-center font-sans flex flex-col justify-center items-center shadow-md backdrop-blur-md transition-all hover:scale-[1.02] duration-300",
                  activeTheme.isDark 
                    ? "bg-slate-900/50 border-slate-800/80 shadow-black/35 hover:border-slate-700/80" 
                    : "bg-white border-slate-200/80 shadow-slate-100/60 hover:border-slate-300"
                )}>
                  <p className="text-xl sm:text-2xl font-black text-emerald-500 leading-none mb-1.5">{paidLogsCount}</p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.12em]">Paid Updates</p>
                </div>
              </div>
            )}

            {/* Bottom Row: Real-time Spreadsheet Connection info with Integrated Cloud Status Pill */}
            {googleToken ? (
              <div className={cn(
                "p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 font-sans backdrop-blur-sm shadow-md",
                activeTheme.isDark ? "bg-slate-950/50 border-slate-850 shadow-black/20" : "bg-white/80 border-slate-200 shadow-slate-100/40"
              )}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner",
                    activeTheme.isDark ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-600"
                  )}>
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={cn("text-[10px] font-black uppercase tracking-wider leading-none", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                        GOOGLE SHEETS LINK ACTIVE
                      </h4>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider shrink-0",
                        activeTheme.isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-100 text-emerald-700"
                      )}>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        SYNC ENABLED
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-medium text-slate-400 leading-none">
                      <span className="flex items-center gap-1 min-w-0">
                        <UserCheck className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate">Handler: <strong className={activeTheme.isDark ? "text-slate-300" : "text-slate-700"}>{googleUser?.displayName || "Connected Case Officer"}</strong></span>
                      </span>
                      <span className="text-slate-300 dark:text-slate-800 leading-none">•</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span>ID: ...PJSbAE</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={fetchSheetData}
                    disabled={isLoadingExisting}
                    className={cn(
                      "p-2.5 rounded-xl border cursor-pointer hover:bg-slate-500/10 transition-all flex items-center justify-center shrink-0 shadow-sm",
                      activeTheme.isDark ? "text-slate-400 border-slate-800 hover:text-white" : "text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                    title="Refresh Sheets"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isLoadingExisting && "animate-spin")} />
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-500/25 hover:border-rose-500/50 hover:bg-rose-500/10 text-rose-400 cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.01]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className={cn(
                "p-4 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 font-sans backdrop-blur-sm shadow-md",
                activeTheme.isDark ? "bg-slate-950/50 border-slate-850 shadow-black/20" : "bg-white/80 border-slate-200 shadow-slate-100/40"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-inner",
                    activeTheme.isDark ? "bg-amber-950/20 border-amber-900/40 text-amber-400" : "bg-amber-50 border-amber-100 text-amber-600"
                  )}>
                    <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className={cn("text-[10px] font-black uppercase tracking-wider leading-none", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                        GOOGLE SHEETS OFFLINE
                      </h4>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[8px] font-black uppercase tracking-wider shrink-0",
                        activeTheme.isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-amber-50 border-amber-100 text-amber-700"
                      )}>
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                        </span>
                        OFFLINE MODE
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold leading-none">
                      Sign in using Google workspace credentials to sync records in real-time.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSignIn}
                  disabled={isAuthLoading}
                  className={cn(
                    "py-2.5 px-5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer hover:scale-[1.01] transition-all flex items-center justify-center gap-1.5 shadow-md text-white font-bold shrink-0 self-end sm:self-auto",
                    activeTheme.isDark ? "bg-slate-200 text-slate-950 hover:bg-white" : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  {isAuthLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5" />
                  )}
                  {isAuthLoading ? "Connecting..." : "Connect Google Account"}
                </button>
              </div>
            )}

          </div>

        </div>
      </div>

      {/* Action Status Notification */}
      {submitStatus && (
        <div className={cn(
          "p-4 rounded-2xl border flex items-start gap-3 transition-all text-xs font-sans shadow-md animate-bounce",
          submitStatus.type === "success"
            ? (activeTheme.isDark ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-300" : "bg-emerald-50 border-emerald-150 text-emerald-900")
            : (activeTheme.isDark ? "bg-rose-950/20 border-rose-900/40 text-rose-300" : "bg-rose-50 border-rose-150 text-rose-900")
        )}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-black uppercase tracking-wider text-[10px]">
              {submitStatus.type === "success" ? "Operation Successful" : "Google Sheets Error"}
            </span>
            <p className="opacity-95 text-[11px] leading-relaxed">{submitStatus.message}</p>
          </div>
        </div>
      )}

      {/* Top Controls: Mode Switcher & Lot Search/Batch (Spans full width) */}
      {false && (
      <div className="space-y-8 max-w-7xl mx-auto w-full">
        
        {/* Mode Switcher Tabs */}
        <div className={cn(
          "p-1.5 rounded-[1.5rem] border flex items-center gap-1.5 backdrop-blur-md transition-all duration-300 shadow-md",
          activeTheme.isDark ? "bg-slate-900/60 border-slate-800/80 shadow-black/40" : "bg-slate-100/80 border-slate-200 shadow-slate-100"
        )}>
          <button
            onClick={() => { setIsBulkMode(false); setSubmitStatus(null); }}
            className={cn(
              "flex-1 py-3 px-4 rounded-[1.1rem] font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
              !isBulkMode 
                ? (activeTheme.isDark ? "bg-slate-200 text-slate-950 shadow-lg" : "bg-slate-900 text-white shadow-lg")
                : "text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
            )}
          >
            <User className="w-4 h-4" />
            Single Lot Mode
          </button>
          <button
            onClick={() => { setIsBulkMode(true); setSubmitStatus(null); }}
            className={cn(
              "flex-1 py-3 px-4 rounded-[1.1rem] font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
              isBulkMode 
                ? (activeTheme.isDark ? "bg-slate-200 text-slate-950 shadow-lg" : "bg-slate-900 text-white shadow-lg")
                : "text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
            )}
          >
            <Layers className="w-4 h-4" />
            Bulk Batch Mode
          </button>
        </div>

        {/* SINGLE MODE SEARCH */}
        {!isBulkMode && (
          <div className={cn(
            "backdrop-blur-xl border rounded-[2rem] shadow-lg p-6 space-y-4 transition-all duration-300 relative group overflow-hidden",
            activeTheme.isDark 
              ? "bg-slate-900/40 border-slate-800/80 shadow-black/20 hover:border-slate-700/80" 
              : "bg-white border-slate-200/80 shadow-slate-100 hover:border-slate-300"
          )}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
            
            <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-700/20">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                  Retrieve Reference Lot
                </h3>
              </div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                STEP 1 OF 2
              </span>
            </div>

            <div className="space-y-4 font-sans">
              <p className={cn("text-xs font-medium leading-relaxed", activeTheme.isDark ? "text-slate-400" : "text-slate-500")}>
                Search any valid Lot ID from the local records. This automatically fetches owner classifications, structures, and areas to protect sheet record integrity.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Lot-102, Lot-05"
                    className={cn(
                      "w-full pl-11 pr-4 py-3 border rounded-2xl outline-none transition-all font-bold text-sm",
                      activeTheme.isDark 
                        ? "bg-slate-950 text-slate-100 border-slate-850 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    )}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
                <button 
                  onClick={handleSearch}
                  className={cn(
                    "px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer hover:scale-[1.01] flex items-center justify-center gap-2",
                    activeTheme.isDark ? "bg-slate-200 hover:bg-white text-slate-950" : "bg-slate-900 text-white hover:bg-slate-800"
                  )}
                >
                  <Search className="w-4 h-4" />
                  Search Lot
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BULK MODE RETRIEVER CARD */}
        {isBulkMode && (
          <div className={cn(
            "backdrop-blur-xl border rounded-[2rem] shadow-lg p-6 space-y-5 transition-all duration-300 relative overflow-hidden",
            activeTheme.isDark 
              ? "bg-slate-900/40 border-slate-800/80 shadow-black/20" 
              : "bg-white border-slate-200/80 shadow-slate-100"
          )}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-700/20">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                  Bulk Lot ID Entry & Batcher
                </h3>
              </div>
              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                MULTIPLE UPDATE
              </span>
            </div>

            <div className="space-y-4 font-sans">
              <p className={cn("text-xs font-medium leading-relaxed", activeTheme.isDark ? "text-slate-400" : "text-slate-500")}>
                Type or paste multiple Lot IDs. Separate with commas, spaces, or line breaks. This validates reference properties instantly and prepares batched updates.
              </p>

              {/* Quick Presets / Suggestion Buttons */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                  ✨ Suggested Bulk Batches (Lot IDs)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => selectSuggestionBatch("cp1")}
                    className="px-3 py-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    📦 CP01 Lots
                  </button>
                  <button
                    onClick={() => selectSuggestionBatch("cp2")}
                    className="px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    📦 CP02 Lots
                  </button>
                  <button
                    onClick={() => selectSuggestionBatch("unpaid")}
                    className="px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-black text-amber-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    ⏳ Unpaid/Pending Lots
                  </button>
                  <button
                    onClick={() => selectSuggestionBatch("draft")}
                    className="px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                  >
                    📋 Sample Batch
                  </button>
                </div>
              </div>

              {/* Bulk Textarea */}
              <div className="space-y-1">
                <textarea
                  rows={4}
                  placeholder="e.g. Lot-01, Lot-102, Lot-05, Lot-08 (Or paste list of IDs here...)"
                  className={cn(
                    "w-full px-4 py-3 border rounded-2xl outline-none transition-all font-mono font-bold text-sm tracking-wide",
                    activeTheme.isDark 
                      ? "bg-slate-950 text-emerald-400 border-slate-850 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                      : "bg-slate-50 border-slate-200 text-indigo-950 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                  )}
                  value={bulkLotIdsInput}
                  onChange={(e) => setBulkLotIdsInput(e.target.value)}
                />
              </div>

              {/* Real-Time Validator Output */}
              {parsedBulkLotIds.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-dashed border-slate-700/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">
                      Real-time Lot Resolver ({parsedBulkLotIds.length} parsed)
                    </span>
                  </div>

                  {/* Valid badges */}
                  {bulkStatus.valid.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                        ✓ Recognized Lots ({bulkStatus.valid.length} - Click to Preview Details)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bulkStatus.valid.map(lot => (
                          <button
                            key={lot.lotId}
                            onClick={() => setPreviewLot(lot)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all hover:scale-[1.03] cursor-pointer",
                              previewLot?.lotId === lot.lotId
                                ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md"
                                : "bg-emerald-500/5 border-emerald-500/30 text-emerald-500 hover:border-emerald-500"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {lot.lotId}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invalid badges */}
                  {bulkStatus.invalid.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
                        ✕ Unrecognized / Invalid Lots ({bulkStatus.invalid.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {bulkStatus.invalid.map(id => (
                          <span
                            key={id}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/5 border border-rose-500/30 text-rose-500 flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      )}

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Mode Switcher, Search/Batcher, and Form (Col-Span 6) */}
        <div className="lg:col-span-6 space-y-8">

          {/* Mode Switcher Tabs */}
          <div className={cn(
            "p-1.5 rounded-[1.5rem] border flex items-center gap-1.5 backdrop-blur-md transition-all duration-300 shadow-md",
            activeTheme.isDark ? "bg-slate-900/60 border-slate-800/80 shadow-black/40" : "bg-slate-100/80 border-slate-200 shadow-slate-100"
          )}>
            <button
              onClick={() => { setIsBulkMode(false); setSubmitStatus(null); }}
              className={cn(
                "flex-1 py-3 px-4 rounded-[1.1rem] font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
                !isBulkMode 
                  ? (activeTheme.isDark ? "bg-slate-200 text-slate-950 shadow-lg" : "bg-slate-900 text-white shadow-lg")
                  : "text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              <User className="w-4 h-4" />
              Single Lot Mode
            </button>
            <button
              onClick={() => { setIsBulkMode(true); setSubmitStatus(null); }}
              className={cn(
                "flex-1 py-3 px-4 rounded-[1.1rem] font-black text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
                isBulkMode 
                  ? (activeTheme.isDark ? "bg-slate-200 text-slate-950 shadow-lg" : "bg-slate-900 text-white shadow-lg")
                  : "text-slate-400 hover:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              <Layers className="w-4 h-4" />
              Bulk Batch Mode
            </button>
          </div>

          {/* SINGLE MODE SEARCH */}
          {!isBulkMode && (
            <div className={cn(
              "backdrop-blur-xl border rounded-[2rem] shadow-lg p-6 space-y-4 transition-all duration-300 relative group overflow-hidden",
              activeTheme.isDark 
                ? "bg-slate-900/40 border-slate-800/80 shadow-black/20 hover:border-slate-700/80" 
                : "bg-white border-slate-200/80 shadow-slate-100 hover:border-slate-300"
            )}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none group-hover:scale-110 transition-transform duration-500" />
              
              <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-700/20">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                    Retrieve Reference Lot
                  </h3>
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  STEP 1 OF 2
                </span>
              </div>

              <div className="space-y-4 font-sans">
                <p className={cn("text-xs font-medium leading-relaxed", activeTheme.isDark ? "text-slate-400" : "text-slate-500")}>
                  Search any valid Lot ID from the local records. This automatically fetches owner classifications, structures, and areas to protect sheet record integrity.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Lot-102, Lot-05"
                      className={cn(
                        "w-full pl-11 pr-4 py-3 border rounded-2xl outline-none transition-all font-bold text-sm",
                        activeTheme.isDark 
                          ? "bg-slate-950 text-slate-100 border-slate-850 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                          : "bg-slate-50 border-slate-200 text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                      )}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <button 
                    onClick={handleSearch}
                    className={cn(
                      "px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-md transition-all cursor-pointer hover:scale-[1.01] flex items-center justify-center gap-2",
                      activeTheme.isDark ? "bg-slate-200 hover:bg-white text-slate-950" : "bg-slate-900 text-white hover:bg-slate-800"
                    )}
                  >
                    <Search className="w-4 h-4" />
                    Search Lot
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BULK MODE RETRIEVER CARD */}
          {isBulkMode && (
            <div className={cn(
              "backdrop-blur-xl border rounded-[2rem] shadow-lg p-6 space-y-5 transition-all duration-300 relative overflow-hidden",
              activeTheme.isDark 
                ? "bg-slate-900/40 border-slate-800/80 shadow-black/20" 
                : "bg-white border-slate-200/80 shadow-slate-100"
            )}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-700/20">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-500" />
                  <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                    Bulk Lot ID Entry & Batcher
                  </h3>
                </div>
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                  MULTIPLE UPDATE
                </span>
              </div>

              <div className="space-y-4 font-sans">
                <p className={cn("text-xs font-medium leading-relaxed", activeTheme.isDark ? "text-slate-400" : "text-slate-500")}>
                  Type or paste multiple Lot IDs. Separate with commas, spaces, or line breaks. This validates reference properties instantly and prepares batched updates.
                </p>

                {/* Quick Presets / Suggestion Buttons */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1">
                    ✨ Suggested Bulk Batches (Lot IDs)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => selectSuggestionBatch("cp1")}
                      className="px-3 py-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 text-[10px] font-black text-blue-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      📦 CP01 Lots
                    </button>
                    <button
                      onClick={() => selectSuggestionBatch("cp2")}
                      className="px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      📦 CP02 Lots
                    </button>
                    <button
                      onClick={() => selectSuggestionBatch("unpaid")}
                      className="px-3 py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] font-black text-amber-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      ⏳ Unpaid/Pending Lots
                    </button>
                    <button
                      onClick={() => selectSuggestionBatch("draft")}
                      className="px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-wider cursor-pointer transition-all hover:scale-[1.02]"
                    >
                      📋 Sample Batch
                    </button>
                  </div>
                </div>

                {/* Bulk Textarea */}
                <div className="space-y-1">
                  <textarea
                    rows={4}
                    placeholder="e.g. Lot-01, Lot-102, Lot-05, Lot-08 (Or paste list of IDs here...)"
                    className={cn(
                      "w-full px-4 py-3 border rounded-2xl outline-none transition-all font-mono font-bold text-sm tracking-wide",
                      activeTheme.isDark 
                        ? "bg-slate-950 text-emerald-400 border-slate-850 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                        : "bg-slate-50 border-slate-200 text-indigo-950 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
                    )}
                    value={bulkLotIdsInput}
                    onChange={(e) => setBulkLotIdsInput(e.target.value)}
                  />
                </div>

                {/* Real-Time Validator Output */}
                {parsedBulkLotIds.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-dashed border-slate-700/10">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase">
                        Real-time Lot Resolver ({parsedBulkLotIds.length} parsed)
                      </span>
                    </div>

                    {/* Valid badges */}
                    {bulkStatus.valid.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                          ✓ Recognized Lots ({bulkStatus.valid.length} - Click to Preview Details)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {bulkStatus.valid.map(lot => (
                            <button
                              key={lot.lotId}
                              onClick={() => setPreviewLot(lot)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all hover:scale-[1.03] cursor-pointer",
                                previewLot?.lotId === lot.lotId
                                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md"
                                  : "bg-emerald-500/5 border-emerald-500/30 text-emerald-500 hover:border-emerald-500"
                              )}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {lot.lotId}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invalid badges */}
                    {bulkStatus.invalid.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
                          ✕ Unrecognized / Invalid Lots ({bulkStatus.invalid.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {bulkStatus.invalid.map(id => (
                            <span
                              key={id}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/5 border border-rose-500/30 text-rose-500 flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              {id}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INTERACTIVE POPUP PREVIEW MODAL/CARD FOR BULK LOTS */}
          {isBulkMode && previewLot && (
            <div className={cn(
              "p-6 rounded-[2rem] border transition-all duration-300 relative overflow-hidden animate-in fade-in slide-in-from-top-4",
              activeTheme.isDark 
                ? "bg-gradient-to-b from-indigo-950/20 to-slate-950/80 border-indigo-500/30 shadow-xl" 
                : "bg-indigo-50/10 border-indigo-200/50 shadow-md"
            )}>
              <button
                onClick={() => setPreviewLot(null)}
                className="absolute top-4 right-4 p-1 rounded-full hover:bg-slate-500/10 text-slate-400 hover:text-slate-300 cursor-pointer transition-colors animate-pulse"
                title="Close Preview"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded">
                    QUICK PREVIEW
                  </span>
                  <span className="text-xs font-bold text-slate-400">CP: {previewLot.cp || "N/A"}</span>
                </div>
                
                <div>
                  <h4 className={cn("text-lg font-black tracking-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                    {previewLot.lotId} — {previewLot.ownerName}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Location: <strong>{previewLot.barangay || "N/A"}, {previewLot.lgu || "N/A"}</strong> | Station: <strong>{previewLot.station || "N/A"}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className={cn("p-3 rounded-xl border", activeTheme.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150")}>
                    <p className="text-[9px] font-black text-slate-400 uppercase">AFFECTED LAND AREA</p>
                    <p className={cn("font-bold text-sm mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                      {previewLot.affectedArea} / {previewLot.totalArea} m²
                    </p>
                  </div>
                  <div className={cn("p-3 rounded-xl border", activeTheme.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150")}>
                    <p className="text-[9px] font-black text-slate-400 uppercase">ESTIMATED VALUATION</p>
                    <p className="font-bold text-sm text-emerald-500 mt-0.5">
                      {formatPHP(previewLot.totalEstimatedCost)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* PREMIUM MILESTONE SUBMISSION FORM */}
          <div 
            id="accomplishment-form-card"
            className={cn(
              "backdrop-blur-xl border rounded-[2.5rem] shadow-xl p-8 space-y-8 transition-colors relative",
              activeTheme.isDark 
                ? "bg-slate-900/40 border-slate-800/80 shadow-black/30" 
                : "bg-white border-slate-200 shadow-slate-100"
            )}
          >
            {/* Dynamic header depending on Edit vs Append mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 border-dashed border-slate-700/20 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                  {editingRowIndex !== null ? `EDIT ACCOMPLISHMENT DETAILS (ROW ${editingRowIndex + 1})` : "FORM TRANSACTION PANEL"}
                </h3>
              </div>
              {editingRowIndex !== null ? (
                <button
                  onClick={cancelEdit}
                  className="text-xs font-bold text-rose-400 flex items-center gap-1 hover:text-rose-300 cursor-pointer bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 hover:scale-[1.02] transition-all"
                >
                  <X className="w-3.5 h-3.5" /> CANCEL EDIT MODE
                </button>
              ) : (
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  STEP 2 OF 2
                </span>
              )}
            </div>

            {/* Visual Tab Switcher (Sleek Segmented Control) */}
            {editingRowIndex === null && (
              <div className={cn(
                "p-1 rounded-2xl flex items-center gap-1 border",
                activeTheme.isDark ? "bg-slate-950/80 border-slate-800/60" : "bg-slate-50 border-slate-200"
              )}>
                <button
                  onClick={() => { setFormTab("accomplishment"); setSubmitStatus(null); }}
                  className={cn(
                    "flex-1 py-2.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer",
                    formTab === "accomplishment"
                      ? (activeTheme.isDark ? "bg-blue-600 text-white shadow-md shadow-blue-900/40" : "bg-blue-500 text-white shadow-md shadow-blue-500/20")
                      : (activeTheme.isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Record Accomplishment
                </button>
                <button
                  onClick={() => { setFormTab("updateStatus"); setUpdateFile("actual_amounts"); setSubmitStatus(null); }}
                  className={cn(
                    "flex-1 py-2.5 px-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer",
                    formTab === "updateStatus"
                      ? (activeTheme.isDark ? "bg-blue-600 text-white shadow-md shadow-blue-900/40" : "bg-blue-500 text-white shadow-md shadow-blue-500/20")
                      : (activeTheme.isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700")
                  )}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Update Status
                </button>
              </div>
            )}

            {formTab === "updateStatus" && editingRowIndex === null ? (
              /* STATUS UPDATES FORM CONTENT */
              <div className="space-y-6 font-sans">
                {/* File Dropdown Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                    Select Spreadsheet File to Update <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className={cn(
                      "w-full px-4 py-3 border rounded-xl font-bold text-sm cursor-pointer outline-none transition-all",
                      activeTheme.isDark 
                        ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500"
                        : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                    )}
                    value={updateFile}
                    onChange={(e) => setUpdateFile(e.target.value)}
                  >
                    <option value="land_acquisition">Land Acquisition File (01.MASTERLIST)</option>
                    <option value="expropriation" disabled>Expropriation File (Expro_List...) [Ongoing]</option>
                    <option value="condominium" disabled>Condominium File (CONDOMINIUMS MASTERLIST) [Ongoing]</option>
                    <option value="entitlements" disabled>Entitlements File (OTHER ENTITLEMENTS) [Ongoing]</option>
                    <option value="actual_amounts">Actual Amounts (CONSOLIDATED LIST)</option>
                  </select>
                </div>

                {/* Selected Lot Verification Card */}
                <div className={cn(
                  "p-4 rounded-2xl border flex flex-col gap-2",
                  selectedLot
                    ? (activeTheme.isDark ? "bg-slate-950/60 border-slate-800" : "bg-blue-50/50 border-blue-100")
                    : (activeTheme.isDark ? "bg-rose-950/20 border-rose-900/50 text-rose-300" : "bg-rose-50 border-rose-100 text-rose-700")
                )}>
                  {selectedLot ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Target Lot Verified</span>
                        <span className="text-xs font-bold text-blue-500">CP {selectedLot.cp || "N/A"}</span>
                      </div>
                      <p className={cn("font-bold text-sm", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                        {selectedLot.lotId} — {selectedLot.ownerName}
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-[10px] text-slate-400 mt-1">
                        <div>Control No: <strong className={cn(activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>{selectedLot.controlNo || "N/A"}</strong></div>
                        <div>LGU: <strong className={cn(activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>{selectedLot.lgu || "N/A"}</strong></div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-start gap-2.5 p-1">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider">No Target Lot Selected</p>
                        <p className="text-[11px] leading-relaxed mt-0.5 opacity-90 font-bold">
                          Please use the search box in Step 1 (Retrieve Reference Lot) to search and verify a Lot ID before editing database columns.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedLot && (
                  <>
                    {updateFile === "actual_amounts" ? (
                      /* ACTUAL AMOUNTS (CONSOLIDATED LIST) FORM */
                      <div className={cn(
                        "p-6 rounded-2xl border space-y-6",
                        activeTheme.isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"
                      )}>
                        <div className="flex items-center justify-between pb-3 border-b border-dashed border-slate-700/20">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                              <Coins className="w-4 h-4 text-emerald-500" />
                              Actual Amounts (CONSOLIDATED LIST)
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              Updating amounts & statuses for Lot ID: <strong className="text-blue-500">{selectedLot.lotId}</strong>
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                            No Validation Required
                          </span>
                        </div>

                        {isFetchingActuals ? (
                          <div className="flex items-center justify-center py-8 text-slate-400 gap-2 text-xs font-bold">
                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                            Loading Structure Tags from CONSOLIDATED LIST...
                          </div>
                        ) : (
                          <>
                            {/* Structure Tag Selector (Column E) */}
                            <div className="space-y-2.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-blue-500" />
                                Select Structure Tag (Column E) to Edit / Update Amount:
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {actualsPartitions.map((part, idx) => {
                                  const isSelected = selectedActualIndex === idx;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedActualIndex(idx)}
                                      className={cn(
                                        "px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer border shadow-sm",
                                        isSelected
                                          ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30"
                                          : (activeTheme.isDark
                                              ? "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100")
                                      )}
                                    >
                                      <CheckCircle2 className={cn("w-3.5 h-3.5", isSelected ? "opacity-100 text-white" : "opacity-30")} />
                                      <span>{part.structureTag || "LOT ONLY"}</span>
                                      {part.rowNumber > 0 && (
                                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-mono", isSelected ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500")}>
                                          Row {part.rowNumber}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Active Structure Tag Form Inputs */}
                            {actualsPartitions[selectedActualIndex] && (() => {
                              const currentPart = actualsPartitions[selectedActualIndex];
                              const updatePartField = (field: string, val: string) => {
                                const copy = [...actualsPartitions];
                                copy[selectedActualIndex] = { ...copy[selectedActualIndex], [field]: val };
                                setActualsPartitions(copy);
                              };

                              return (
                                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                      Editing Amounts for Tag: <strong className="text-emerald-500">{currentPart.structureTag}</strong>
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* SOURCE OF COST INFORMATION */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        SOURCE OF COST INFORMATION
                                      </label>
                                      <select
                                        className={cn(
                                          "w-full px-3.5 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                          activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                        )}
                                        value={currentPart.sourceOfCostInfo || ""}
                                        onChange={(e) => updatePartField("sourceOfCostInfo", e.target.value)}
                                      >
                                        <option value="">-- Clear / Select Source --</option>
                                        <option value="Softcopy">Softcopy</option>
                                        <option value="Verbal or viber gc">Verbal or viber gc</option>
                                        <option value="From appendix">From appendix</option>
                                        <option value="Appraisal/Tracker">Appraisal/Tracker</option>
                                        <option value="SDAR">SDAR</option>
                                        <option value="N/A">N/A</option>
                                      </select>
                                    </div>

                                    {/* TOTAL LOT LAND COST (Land Amount) */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        TOTAL LOT LAND COST / LAND AMOUNT
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">₱</span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 150000"
                                          className={cn(
                                            "w-full pl-8 pr-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all",
                                            activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                          )}
                                          value={currentPart.totalLotLandCost || ""}
                                          onChange={(e) => updatePartField("totalLotLandCost", e.target.value)}
                                        />
                                      </div>
                                    </div>

                                    {/* PAYMENT STRUCTURE STATUS */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        PAYMENT STRUCTURE STATUS
                                      </label>
                                      <select
                                        className={cn(
                                          "w-full px-3.5 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                          activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                        )}
                                        value={currentPart.paymentStructureStatus || ""}
                                        onChange={(e) => updatePartField("paymentStructureStatus", e.target.value)}
                                      >
                                        <option value="">-- Clear / Select Status --</option>
                                        <option value="UNPAID">UNPAID</option>
                                        <option value="PAID">PAID</option>
                                        <option value="N/A">N/A</option>
                                      </select>
                                    </div>

                                    {/* STRUCTURE AMOUNT */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        STRUCTURE AMOUNT
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">₱</span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 250000"
                                          className={cn(
                                            "w-full pl-8 pr-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all",
                                            activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                          )}
                                          value={currentPart.totalPaidStructureCost || ""}
                                          onChange={(e) => updatePartField("totalPaidStructureCost", e.target.value)}
                                        />
                                      </div>
                                    </div>

                                    {/* PAYMENT FENCE STATUS */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        PAYMENT FENCE STATUS
                                      </label>
                                      <select
                                        className={cn(
                                          "w-full px-3.5 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                          activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                        )}
                                        value={currentPart.paymentFenceStatus || ""}
                                        onChange={(e) => updatePartField("paymentFenceStatus", e.target.value)}
                                      >
                                        <option value="">-- Clear / Select Status --</option>
                                        <option value="UNPAID">UNPAID</option>
                                        <option value="PAID">PAID</option>
                                        <option value="N/A">N/A</option>
                                      </select>
                                    </div>

                                    {/* FENCE / OTHER AMOUNT */}
                                    <div className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        FENCE / OTHER AMOUNT
                                      </label>
                                      <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">₱</span>
                                        <input
                                          type="text"
                                          placeholder="e.g. 50000"
                                          className={cn(
                                            "w-full pl-8 pr-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all",
                                            activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                          )}
                                          value={currentPart.fenceOtherCost || ""}
                                          onChange={(e) => updatePartField("fenceOtherCost", e.target.value)}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Category Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            Select Category / Process Column to Update <span className="text-rose-500">*</span>
                          </label>
                          <select
                            className={cn(
                              "w-full px-4 py-3 border rounded-xl font-bold text-sm cursor-pointer outline-none transition-all",
                              activeTheme.isDark 
                                ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500"
                                : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                            )}
                            value={updateCategory}
                            onChange={(e) => setUpdateCategory(e.target.value)}
                          >
                            <option value="NOT">Notice of Taking (NoT)</option>
                            <option value="RFD">Request for Donation (RFD)</option>
                            <option value="OTB">Offer to Buy (OTB)</option>
                            <option value="OTC">Offer to Compensate (OTC)</option>
                            <option value="DOAS">Deed of Absolute Sale (DOAS)</option>
                            <option value="EJSEAS">Extrajudicial Settlement with Sale (EJSEAS)</option>
                            <option value="ADRI">ADRI Agreement</option>
                            <option value="PTE">Permit to Enter (PTE)</option>
                            <option value="ENVI">Environmental (ENVI)</option>
                            <option value="PAYMENT">Payment Status</option>
                            <option value="RIGHT OF WAY STATUS">Right of Way Status (CNO/MOA)</option>
                            <option value="HANDED OVER LOTS">Handed Over Lots</option>
                          </select>
                        </div>

                    {/* Dynamic Inputs Based on updateCategory */}
                    <div className={cn(
                      "p-6 rounded-2xl border space-y-5",
                      activeTheme.isDark ? "bg-slate-950/30 border-slate-800/80" : "bg-slate-50 border-slate-150"
                    )}>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 pb-2 border-b border-dashed border-slate-800/20">
                        Edit Column Values for Category: {updateCategory}
                      </h4>

                      {updateCategory === "NOT" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">NoT STATUS (Col BG)</label>
                            <select
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.notStatus}
                              onChange={(e) => setStatusFields({ ...statusFields, notStatus: e.target.value })}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="DELIVERED - F2F">DELIVERED - F2F</option>
                              <option value="DELIVERED - COURIER">DELIVERED - COURIER</option>
                              <option value="UNKNOWN/WITH ISSUES">UNKNOWN/WITH ISSUES</option>
                              <option value="FOR DRAFTING">FOR DRAFTING</option>
                              <option value="DRAFTED">DRAFTED</option>
                              <option value="FOR REVISION">FOR REVISION</option>
                              <option value="FOR ISSAUNCE">FOR ISSAUNCE</option>
                              <option value="REFUSED">REFUSED</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">NoT DATE ISSUED (Col BK)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.notDateIssued}
                              onChange={(e) => setStatusFields({ ...statusFields, notDateIssued: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "RFD" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">RFD STATUS (Col CJ)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.rfdStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, rfdStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="FOR DRAFTING">FOR DRAFTING</option>
                                <option value="DRAFTED">DRAFTED</option>
                                <option value="DELIVERED">DELIVERED</option>
                                <option value="REFUSED">REFUSED</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">RFD DATE ISSUED (Col CL)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.rfdDateIssued}
                                onChange={(e) => setStatusFields({ ...statusFields, rfdDateIssued: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">RFD LO REPLY STATUS (Col CN)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.rfdLoReplyStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, rfdLoReplyStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="NOT AMENABLE TO DONATE">NOT AMENABLE TO DONATE</option>
                                <option value="AMENABLE TO DONATE">AMENABLE TO DONATE</option>
                                <option value="30 DAYS REVIEW">30 DAYS REVIEW</option>
                                <option value="REJECTED">REJECTED</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">RFD LO DATE REPLY (Col CO)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.rfdLoDateReply}
                                onChange={(e) => setStatusFields({ ...statusFields, rfdLoDateReply: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {updateCategory === "OTB" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTB STATUS (Col CQ)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otbStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, otbStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="FOR DRAFTING">FOR DRAFTING</option>
                                <option value="DRAFTED">DRAFTED</option>
                                <option value="DELIVERED">DELIVERED</option>
                                <option value="REFUSED">REFUSED</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTB DATE ISSUED (Col CS)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otbDateIssued}
                                onChange={(e) => setStatusFields({ ...statusFields, otbDateIssued: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTB LO REPLY STATUS (Col CW)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otbLoReplyStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, otbLoReplyStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="ACCEPTED">ACCEPTED</option>
                                <option value="30 DAYS REVIEW">30 DAYS REVIEW</option>
                                <option value="REJECTED">REJECTED</option>
                                <option value="INCURABLE LOTS">INCURABLE LOTS</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTB LO DATE REPLY (Col CY)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otbLoDateReply}
                                onChange={(e) => setStatusFields({ ...statusFields, otbLoDateReply: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {updateCategory === "OTC" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTC STATUS (Col DA)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otcStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, otcStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="FOR DRAFTING">FOR DRAFTING</option>
                                <option value="DRAFTED">DRAFTED</option>
                                <option value="DELIVERED">DELIVERED</option>
                                <option value="REFUSED">REFUSED</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTC DATE ISSUED (Col DC)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otcDateIssued}
                                onChange={(e) => setStatusFields({ ...statusFields, otcDateIssued: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTC LO REPLY STATUS (Col DG)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otcLoReplyStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, otcLoReplyStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="ACCEPTED">ACCEPTED</option>
                                <option value="30 DAYS REVIEW">30 DAYS REVIEW</option>
                                <option value="REJECTED">REJECTED</option>
                                <option value="INCURABLE LOTS">INCURABLE LOTS</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">OTC LO DATE REPLY (Col DI)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.otcLoDateReply}
                                onChange={(e) => setStatusFields({ ...statusFields, otcLoDateReply: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {(updateCategory === "DOAS" || updateCategory === "EJSEAS") && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">
                                {updateCategory === "EJSEAS" ? "EJSEAS STATUS (Col DO)" : "DOAS STATUS (Col DO)"}
                              </label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.doasStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, doasStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="FOR DRAFTING">FOR DRAFTING</option>
                                <option value="DRAFTED">DRAFTED</option>
                                <option value="DRAFTED DOAS">DRAFTED DOAS</option>
                                <option value="DRAFTED EJSEAS">DRAFTED EJSEAS</option>
                                <option value="ISSUED DOAS">ISSUED DOAS</option>
                                <option value="ISSUED EJSEAS">ISSUED EJSEAS</option>
                                <option value="RE-ISSUED DOAS">RE-ISSUED DOAS</option>
                                <option value="RE-ISSUED EJSEAS">RE-ISSUED EJSEAS</option>
                                <option value="SIGNED DOAS">SIGNED DOAS</option>
                                <option value="SIGNED">SIGNED</option>
                                <option value="SIGNED EJSEAS">SIGNED EJSEAS</option>
                                <option value="NOTARIZED DOAS">NOTARIZED DOAS</option>
                                <option value="NOTARIZED EJSEAS">NOTARIZED EJSEAS</option>
                                <option value="REFUSED">REFUSED</option>
                                <option value="REFUSED DOAS">REFUSED DOAS</option>
                                <option value="REFUSED EJSEAS">REFUSED EJSEAS</option>
                                <option value="EJSEAS">EJSEAS</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">
                                {updateCategory === "EJSEAS" ? "EJSEAS DATE SIGNED (Col DQ)" : "DOAS DATE SIGNED (Col DQ)"}
                              </label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.doasDateSigned}
                                onChange={(e) => setStatusFields({ ...statusFields, doasDateSigned: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">
                              {updateCategory === "EJSEAS" ? "EJSEAS DATE NOTARIZED (Col DS)" : "DOAS DATE NOTARIZED (Col DS)"}
                            </label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.doasDateNotarized}
                              onChange={(e) => setStatusFields({ ...statusFields, doasDateNotarized: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "ADRI" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">ADRI STATUS (Col DU)</label>
                              <select
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.adriStatus}
                                onChange={(e) => setStatusFields({ ...statusFields, adriStatus: e.target.value })}
                              >
                                <option value="">-- Clear / Select Status --</option>
                                <option value="FOR DRAFTING">FOR DRAFTING</option>
                                <option value="DRAFTED">DRAFTED</option>
                                <option value="SIGNED">SIGNED</option>
                                <option value="REFUSED">REFUSED</option>
                                <option value="EJSEAS">EJSEAS</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase">ADRI DATE SIGNED (Col DW)</label>
                              <input
                                type="date"
                                className={cn(
                                  "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                                )}
                                value={statusFields.adriDateSigned}
                                onChange={(e) => setStatusFields({ ...statusFields, adriDateSigned: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">ADRI DATE NOTARIZED (Col DZ)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.adriDateNotarized}
                              onChange={(e) => setStatusFields({ ...statusFields, adriDateNotarized: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "PTE" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">PTE STATUS (Col DK)</label>
                            <select
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.pteStatus}
                              onChange={(e) => setStatusFields({ ...statusFields, pteStatus: e.target.value })}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="FOR DRAFTING">FOR DRAFTING</option>
                              <option value="DRAFTED">DRAFTED</option>
                              <option value="SIGNED">SIGNED</option>
                              <option value="REFUSED">REFUSED</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">DATE PTE SIGNED (Col DM)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.pteDateSigned}
                              onChange={(e) => setStatusFields({ ...statusFields, pteDateSigned: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "ENVI" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">ENVI STATUS (Col EB)</label>
                            <select
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.enviStatus}
                              onChange={(e) => setStatusFields({ ...statusFields, enviStatus: e.target.value })}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="CROPS AND TREES ADVANCE PAYMENT BY THE CONTRACTOR TO CLAIMANT">CROPS & TREES ADVANCE BY CONTRACTOR</option>
                              <option value="CROPS AND TREES PAID BY DOTr TO THE CONTRACTOR">CROPS & TREES PAID BY DOTr TO CONTRACTOR</option>
                              <option value="CROPS AND TREES PAID BY DOTr TO LO">CROPS & TREES PAID BY DOTr TO LO</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">ENVI DATE PAID (Col EC)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.enviDatePaid}
                              onChange={(e) => setStatusFields({ ...statusFields, enviDatePaid: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "PAYMENT" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">PAYMENT STATUS (Col EH)</label>
                            <select
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.paymentStatus}
                              onChange={(e) => setStatusFields({ ...statusFields, paymentStatus: e.target.value })}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="FULLY PAID">FULLY PAID</option>
                              <option value="PARTIALLY PAID">PARTIALLY PAID</option>
                              <option value="ON-GOING PROCESSING">ON-GOING PROCESSING</option>
                              <option value="PAID WITH WOP">PAID WITH WOP</option>
                              <option value="PAYMENT CREDITED TO LBP">PAYMENT CREDITED TO LBP</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">DATE OF PAYMENT (Col EI)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.paymentDateOfPayment}
                              onChange={(e) => setStatusFields({ ...statusFields, paymentDateOfPayment: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "RIGHT OF WAY STATUS" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">CNO / MOA STATUS (Col ER)</label>
                            <select
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.rowStatus}
                              onChange={(e) => setStatusFields({ ...statusFields, rowStatus: e.target.value })}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="With Certificate of No Objection (CNO)">With Certificate of No Objection (CNO)</option>
                              <option value="With Memorandum of Agreement (MOA)">With Memorandum of Agreement (MOA)</option>
                              <option value="With Use of RACK Agreement">With Use of RACK Agreement</option>
                              <option value="With Waiver of Rights">With Waiver of Rights</option>
                              <option value="With Affidavit of No Objection">With Affidavit of No Objection</option>
                              <option value="With Consent to Enter Property">With Consent to Enter Property</option>
                              <option value="With Deed of Donation / Undertaking">With Deed of Donation / Undertaking</option>
                              <option value="With Relocation Consent Form">With Relocation Consent Form</option>
                              <option value="With Barangay Certification (No Objection)">With Barangay Certification (No Objection)</option>
                              <option value="With Certification of No Pending Claim">With Certification of No Pending Claim</option>
                              <option value="With Quitclaim Document">With Quitclaim Document</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">DATE SIGNED (Col ES)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.rowDateSigned}
                              onChange={(e) => setStatusFields({ ...statusFields, rowDateSigned: e.target.value })}
                            />
                          </div>
                        </div>
                      )}

                      {updateCategory === "HANDED OVER LOTS" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">HANDED OVER LOT STATUS (Col EK)</label>
                            <select
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.handedOverStatus}
                              onChange={(e) => setStatusFields({ ...statusFields, handedOverStatus: e.target.value })}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="HANDED OVER LOT">HANDED OVER LOT</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase">DATE OF HANDED OVER (Col EL)</label>
                            <input
                              type="date"
                              className={cn(
                                "w-full px-3 py-2 border rounded-xl font-bold text-xs outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-white text-slate-800 border-slate-200"
                              )}
                              value={statusFields.handedOverDate}
                              onChange={(e) => setStatusFields({ ...statusFields, handedOverDate: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

                {/* Status Update Action Buttons */}
                <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t", activeTheme.isDark ? "border-slate-800" : "border-slate-100")}>
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    * Modifies specific database column values live in the sheet.
                  </p>
                  
                  <div className="flex items-center gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLot) {
                          setSelectedLot({ ...selectedLot });
                        } else {
                          setStatusFields({
                            notStatus: "", notDateIssued: "", rfdStatus: "", rfdDateIssued: "", rfdLoReplyStatus: "", rfdLoDateReply: "",
                            otbStatus: "", otbDateIssued: "", otbLoReplyStatus: "", otbLoDateReply: "", otcStatus: "", otcDateIssued: "",
                            otcLoReplyStatus: "", otcLoDateReply: "", doasStatus: "", doasDateSigned: "", doasDateNotarized: "",
                            adriStatus: "", adriDateSigned: "", adriDateNotarized: "", pteStatus: "", pteDateSigned: "",
                            enviStatus: "", enviDatePaid: "", paymentStatus: "", paymentDateOfPayment: "", rowStatus: "", rowDateSigned: "",
                            handedOverStatus: "", handedOverDate: ""
                          });
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer",
                        activeTheme.isDark ? "text-slate-400 hover:bg-slate-800/40 hover:text-white" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                      Reset Fields
                    </button>
                    <button
                      type="button"
                      onClick={handleStatusUpdate}
                      disabled={isUpdatingStatus || !selectedLot}
                      className={cn(
                        "flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all cursor-pointer hover:scale-[1.01] text-white",
                        isUpdatingStatus || !selectedLot ? "bg-slate-400 cursor-not-allowed opacity-70" : activeTheme.primaryBg + " " + activeTheme.primaryShadow
                      )}
                    >
                      {isUpdatingStatus ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {isUpdatingStatus ? "Updating..." : "Record Status Update"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ORIGINAL ACCOMPLISHMENT FORM FIELDS */
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                  
                  {/* Field A: Case Handler */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                      Case Handler Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Case Handler / Employee Name"
                        className={cn(
                          "w-full pl-10 pr-4 py-3 border rounded-xl font-bold text-sm outline-none transition-all",
                          activeTheme.isDark 
                            ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" 
                            : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400"
                        )}
                        value={formData.handlerName}
                        onChange={(e) => setFormData({...formData, handlerName: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  {/* Field B: Date */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      Date of Accomplishment <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        className={cn(
                          "w-full pl-10 pr-4 py-3 border rounded-xl font-bold text-sm outline-none transition-all",
                          activeTheme.isDark 
                            ? "bg-slate-950 text-slate-100 border-slate-850 focus:border-blue-500" 
                            : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400"
                        )}
                        value={formData.accomplishmentDate}
                        onChange={(e) => setFormData({...formData, accomplishmentDate: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  {/* SINGLE MODE READ-ONLY FIELDS */}
                  {!isBulkMode && (
                    <>
                      {/* Field C: Lot ID (Read-only) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lot ID No.</label>
                        <input
                          type="text"
                          readOnly
                          placeholder="Will populate after Search"
                          className={cn(
                            "w-full px-4 py-3 border rounded-xl font-bold text-sm transition-colors",
                            activeTheme.isDark 
                              ? "bg-slate-950 text-slate-400 border-slate-850" 
                              : "bg-slate-100 text-slate-500 border-slate-150"
                          )}
                          value={formData.lotId}
                        />
                      </div>

                      {/* Field D: Owner (Read-only) */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Registered Owner</label>
                        <input
                          type="text"
                          readOnly
                          placeholder="Will populate after Search"
                          className={cn(
                            "w-full px-4 py-3 border rounded-xl font-bold text-sm truncate transition-colors",
                            activeTheme.isDark 
                              ? "bg-slate-950 text-slate-400 border-slate-850" 
                              : "bg-slate-100 text-slate-500 border-slate-150"
                          )}
                          value={formData.owner}
                        />
                      </div>

                      {/* Field E: Contract Package */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contract Package</label>
                        <input
                          type="text"
                          readOnly
                          placeholder="Will populate after Search"
                          className={cn(
                            "w-full px-4 py-3 border rounded-xl font-bold text-sm transition-colors",
                            activeTheme.isDark 
                              ? "bg-slate-950 text-slate-400 border-slate-850" 
                              : "bg-slate-100 text-slate-500 border-slate-150"
                          )}
                          value={formData.cp}
                        />
                      </div>
                    </>
                  )}

                  {/* Field F1: Process Category */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-500" />
                      Process Category / Phase <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      required
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl font-bold text-sm cursor-pointer outline-none transition-all",
                        activeTheme.isDark 
                          ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500"
                          : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                      )}
                      value={selectedCategory}
                      onChange={(e) => {
                        const catId = e.target.value;
                        setSelectedCategory(catId);
                        const matched = STATUS_CATEGORIES.find(c => c.id === catId);
                        if (matched && matched.statuses.length > 0) {
                          setFormData(prev => ({ ...prev, status: matched.statuses[0] }));
                        } else {
                          setFormData(prev => ({ ...prev, status: "" }));
                        }
                      }}
                    >
                      <option value="">-- SELECT PHASE / CATEGORY --</option>
                      {STATUS_CATEGORIES.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Field F2: Dynamic Specific Status */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      Status of Accomplishment <span className="text-rose-500">*</span>
                    </label>
                    <select 
                      id="Status"
                      name="Status"
                      required
                      disabled={!selectedCategory}
                      className={cn(
                        "w-full px-4 py-3 border rounded-xl font-bold text-sm cursor-pointer outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                        activeTheme.isDark 
                          ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500"
                          : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                      )}
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                      {!selectedCategory ? (
                        <option value="">-- Choose Category First --</option>
                      ) : (
                        <>
                          <option value="" disabled>-- SELECT STATUS --</option>
                          {(STATUS_CATEGORIES.find(c => c.id === selectedCategory)?.statuses || []).map(st => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                          {selectedCategory === "doas" && formData.status === "SIGNED" && (
                            <option value="SIGNED">SIGNED (Legacy)</option>
                          )}
                        </>
                      )}
                    </select>
                  </div>

                  {/* CONSOLIDATED COST & STATUS INFORMATION (Placed directly after Status of Accomplishment) */}
                  <div className={cn(
                    "p-4 rounded-2xl border space-y-4 col-span-full",
                    activeTheme.isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50/90 border-slate-200"
                  )}>
                    <div className="flex items-center justify-between pb-2 border-b border-dashed border-slate-300 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                          Consolidated Cost & Status Information
                        </span>
                        {isFetchingActuals && (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500 ml-1" />
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                        CONSOLIDATED LIST (No Validation Required)
                      </span>
                    </div>

                    {/* Structure Tag Selector (Column E) */}
                    {actualsPartitions.length > 1 && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-blue-500" />
                          Select Structure Tag (Column E):
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {actualsPartitions.map((part, idx) => {
                            const isSelected = selectedActualIndex === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedActualIndex(idx)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer border shadow-sm",
                                  isSelected
                                    ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-500/30"
                                    : (activeTheme.isDark
                                        ? "bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800"
                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100")
                                )}
                              >
                                <CheckCircle2 className={cn("w-3.5 h-3.5", isSelected ? "opacity-100 text-white" : "opacity-30")} />
                                <span>{part.structureTag || "LOT ONLY"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(() => {
                      const currentPart = actualsPartitions[selectedActualIndex] || actualsPartitions[0] || {
                        rowNumber: -1,
                        structureTag: "LOT ONLY",
                        sourceOfCostInfo: "",
                        totalLotLandCost: "",
                        paymentStructureStatus: "",
                        totalPaidStructureCost: "",
                        paymentFenceStatus: "",
                        fenceOtherCost: ""
                      };

                      const updatePartField = (field: string, val: string) => {
                        const copy = actualsPartitions.length > 0 ? [...actualsPartitions] : [{
                          rowNumber: -1,
                          structureTag: "LOT ONLY",
                          sourceOfCostInfo: "",
                          totalLotLandCost: "",
                          paymentStructureStatus: "",
                          totalPaidStructureCost: "",
                          paymentFenceStatus: "",
                          fenceOtherCost: ""
                        }];
                        const targetIdx = selectedActualIndex < copy.length ? selectedActualIndex : 0;
                        copy[targetIdx] = { ...copy[targetIdx], [field]: val };
                        setActualsPartitions(copy);
                      };

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* SOURCE OF COST INFORMATION */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              SOURCE OF COST INFORMATION
                            </label>
                            <select
                              className={cn(
                                "w-full px-3.5 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500" : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                              )}
                              value={currentPart.sourceOfCostInfo || ""}
                              onChange={(e) => updatePartField("sourceOfCostInfo", e.target.value)}
                            >
                              <option value="">-- Clear / Select Source --</option>
                              <option value="Softcopy">Softcopy</option>
                              <option value="Verbal or viber gc">Verbal or viber gc</option>
                              <option value="From appendix">From appendix</option>
                              <option value="Appraisal/Tracker">Appraisal/Tracker</option>
                              <option value="SDAR">SDAR</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </div>

                          {/* TOTAL LOT LAND COST */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              TOTAL LOT LAND COST / LAND AMOUNT
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">₱</span>
                              <input
                                type="text"
                                placeholder="e.g. 150000"
                                className={cn(
                                  "w-full pl-8 pr-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500" : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                                )}
                                value={currentPart.totalLotLandCost || ""}
                                onChange={(e) => updatePartField("totalLotLandCost", e.target.value)}
                              />
                            </div>
                          </div>

                          {/* PAYMENT STRUCTURE STATUS */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              PAYMENT STRUCTURE STATUS
                            </label>
                            <select
                              className={cn(
                                "w-full px-3.5 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500" : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                              )}
                              value={currentPart.paymentStructureStatus || ""}
                              onChange={(e) => updatePartField("paymentStructureStatus", e.target.value)}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="UNPAID">UNPAID</option>
                              <option value="PAID">PAID</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </div>

                          {/* STRUCTURE AMOUNT */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              STRUCTURE AMOUNT
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">₱</span>
                              <input
                                type="text"
                                placeholder="e.g. 250000"
                                className={cn(
                                  "w-full pl-8 pr-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500" : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                                )}
                                value={currentPart.totalPaidStructureCost || ""}
                                onChange={(e) => updatePartField("totalPaidStructureCost", e.target.value)}
                              />
                            </div>
                          </div>

                          {/* PAYMENT FENCE STATUS */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              PAYMENT FENCE STATUS
                            </label>
                            <select
                              className={cn(
                                "w-full px-3.5 py-2.5 border rounded-xl font-bold text-xs cursor-pointer outline-none transition-all",
                                activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500" : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                              )}
                              value={currentPart.paymentFenceStatus || ""}
                              onChange={(e) => updatePartField("paymentFenceStatus", e.target.value)}
                            >
                              <option value="">-- Clear / Select Status --</option>
                              <option value="UNPAID">UNPAID</option>
                              <option value="PAID">PAID</option>
                              <option value="N/A">N/A</option>
                            </select>
                          </div>

                          {/* FENCE / OTHER AMOUNT */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              FENCE / OTHER AMOUNT
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">₱</span>
                              <input
                                type="text"
                                placeholder="e.g. 50000"
                                className={cn(
                                  "w-full pl-8 pr-4 py-2.5 border rounded-xl font-bold text-xs outline-none transition-all",
                                  activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800 focus:border-blue-500" : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10"
                                )}
                                value={currentPart.fenceOtherCost || ""}
                                onChange={(e) => updatePartField("fenceOtherCost", e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>

                {/* Field G: Remarks */}
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1">
                    Remarks / Milestone Notes <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    placeholder="Describe milestone achievements, folder links, missing files, or other relevant observations..."
                    rows={4}
                    className={cn(
                      "w-full px-4 py-3 border rounded-2xl font-bold text-sm outline-none transition-all",
                      activeTheme.isDark 
                        ? "bg-slate-950 text-slate-100 border-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" 
                        : "bg-white text-slate-800 border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
                    )}
                    value={formData.remarks}
                    onChange={(e) => setFormData({...formData, remarks: e.target.value})}
                  />
                </div>

                {/* Action Buttons */}
                <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t font-sans", activeTheme.isDark ? "border-slate-800" : "border-slate-100")}>
                  
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    * Input validates field formats before syncing.
                  </p>

                  <div className="flex items-center gap-3 justify-end">
                    <button 
                      type="button"
                      onClick={clearForm}
                      className={cn(
                        "flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer",
                        activeTheme.isDark ? "text-slate-400 hover:bg-slate-800/40 hover:text-white" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      )}
                    >
                      <Trash2 className="w-4 h-4" />
                      Reset
                    </button>
                    <button 
                      type="button"
                      onClick={handleSave}
                      disabled={isSubmitting}
                      className={cn(
                        "flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all cursor-pointer hover:scale-[1.01] text-white",
                        isSubmitting ? "bg-slate-400 cursor-not-allowed opacity-70" : activeTheme.primaryBg + " " + activeTheme.primaryShadow
                      )}
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {isSubmitting ? "Processing..." : isBulkMode ? `Batch Record (${bulkStatus.valid.length} Lots)` : editingRowIndex !== null ? "Update Milestone" : "Record Accomplishment"}
                    </button>
                  </div>

                </div>
              </>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Timeline / History List (Col-Span 6) */}
        <div className="lg:col-span-6 space-y-8">

          {/* Bento Block 2: BEAUTIFUL AFFECTED ASSETS & LOT DETAILS CARD ("MGA AFFECTED") */}
          {selectedLot ? (
            <div className={cn(
              "backdrop-blur-xl border rounded-[2rem] shadow-xl p-6 space-y-6 transition-all duration-300 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4",
              activeTheme.isDark 
                ? "bg-gradient-to-b from-slate-900/60 to-slate-950/80 border-blue-900/30 shadow-black/30" 
                : "bg-gradient-to-b from-blue-50/20 to-white border-blue-100/80 shadow-blue-100/20"
            )}>
              {/* Highlight ribbon */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-dashed border-slate-700/20">
                <div className="space-y-1">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border",
                    activeTheme.isDark 
                      ? "bg-blue-500/10 text-blue-300 border-blue-500/20" 
                      : "bg-blue-100/50 text-blue-700 border-blue-200/50"
                  )}>
                    AFFECTED ASSET DETAILS
                  </span>
                  <h3 className={cn("text-lg font-black tracking-tight font-sans", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                    {selectedLot.lotId} / {selectedLot.ownerName}
                  </h3>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Contract Package</span>
                  <span className={cn("text-xs font-black uppercase", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                    {selectedLot.cp || "N/A"}
                  </span>
                </div>
              </div>

              {/* Grid of details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Section A: Affected Land & Geography */}
                <div className={cn(
                  "p-4 rounded-2xl border font-sans space-y-3",
                  activeTheme.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150"
                )}>
                  <div className="flex items-center gap-2 border-b pb-2 border-dashed border-slate-700/10">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span className={cn("text-[10px] font-black uppercase tracking-wider", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                      Technical & Geography
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Station</p>
                      <p className={cn("font-bold mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.station || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">LGU & Barangay</p>
                      <p className={cn("font-bold mt-0.5 truncate", activeTheme.isDark ? "text-slate-200" : "text-slate-800")} title={`${selectedLot.barangay}, ${selectedLot.lgu}`}>
                        {selectedLot.barangay || "N/A"}, {selectedLot.lgu || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">PROW Impact</p>
                      <p className={cn("font-bold mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.prowImpact || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Zone</p>
                      <p className={cn("font-bold mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.zone || "N/A"}</p>
                    </div>
                  </div>

                  {/* Area Progress Bar */}
                  <div className="pt-2 border-t border-slate-700/10 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-400">Land Affected Area Ratio</span>
                      <span className={cn("font-bold", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                        {areaPercentage}% ({selectedLot.affectedArea} / {selectedLot.totalArea} m²)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-700/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all duration-500" 
                        style={{ width: `${Math.min(100, areaPercentage)}%` }} 
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 italic">Remaining undisturbed: {selectedLot.remainingArea} m²</p>
                  </div>
                </div>

                {/* Section B: Affected Structure & Improvement */}
                <div className={cn(
                  "p-4 rounded-2xl border font-sans space-y-3",
                  activeTheme.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150"
                )}>
                  <div className="flex items-center gap-2 border-b pb-2 border-dashed border-slate-700/10">
                    <Building2 className="w-4 h-4 text-blue-500" />
                    <span className={cn("text-[10px] font-black uppercase tracking-wider", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>
                      Affected Structural Assets
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase">Is Structure Affected?</p>
                      <span className={cn(
                        "inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1",
                        selectedLot.affectedStructure?.toLowerCase() === "yes" || selectedLot.affectedStructure?.toLowerCase() === "y"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-500/10 text-slate-400 border border-slate-500/10"
                      )}>
                        {selectedLot.affectedStructure || "NO"}
                      </span>
                    </div>

                    {(selectedLot.affectedStructure?.toLowerCase() === "yes" || selectedLot.affectedStructure?.toLowerCase() === "y" || selectedLot.useStructure) && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Structure Use</p>
                          <p className={cn("font-bold mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.useStructure || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase">Structure Owner</p>
                          <p className={cn("font-bold mt-0.5 truncate", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.ownerStructure || "N/A"}</p>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-700/10 grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-400">Acquisition Mode:</span>
                        <p className={cn("font-bold", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.modeAcquisition || "Negotiation"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400">EJSE Status:</span>
                        <p className={cn("font-bold", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{selectedLot.ejse || "None"}</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Section C: Financial Costs / Appraisal block */}
              <div className={cn(
                "p-4 rounded-2xl border font-sans grid grid-cols-3 gap-2",
                activeTheme.isDark ? "bg-slate-950/20 border-slate-800/60" : "bg-slate-100/50 border-slate-200/50"
              )}>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Est. Land Cost</span>
                  <span className={cn("text-xs font-bold flex items-center gap-1 mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                    <Coins className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    {formatPHP(selectedLot.estimatedLandCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Est. Structure Cost</span>
                  <span className={cn("text-xs font-bold flex items-center gap-1 mt-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    {formatPHP(selectedLot.estimatedStructureCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase block">Total Estimated Valuation</span>
                  <span className={cn("text-xs font-black text-emerald-500 flex items-center gap-1 mt-0.5")}>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0 animate-pulse" />
                    {formatPHP(selectedLot.totalEstimatedCost)}
                  </span>
                </div>
              </div>

              {/* Status Log reference info */}
              {currentLotRecords.length > 0 && (
                <div className="flex items-center gap-2 text-[10px] text-blue-400">
                  <History className="w-3.5 h-3.5 animate-spin" />
                  <span>This lot has <strong>{currentLotRecords.length}</strong> previous history updates in Google Sheets. See right sidebar timeline.</span>
                </div>
              )}
            </div>
          ) : (
            <div className={cn(
              "p-8 rounded-[2rem] border border-dashed text-center font-sans space-y-2.5",
              activeTheme.isDark ? "bg-slate-900/10 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"
            )}>
              <FileSpreadsheet className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold uppercase tracking-wider">No Lot Profile Selected</p>
              <p className="text-[11px] max-w-sm mx-auto leading-relaxed opacity-80">
                Please enter and search a Lot ID above to display the affected property, structures, layout area, and appraisal profiles before adding accomplishment milestones.
              </p>
            </div>
          )}

          {/* REAL-TIME PREVIOUSLY ADDED HISTORY TIMELINE */}
          <div className={cn(
            "backdrop-blur-xl border rounded-[2rem] shadow-xl p-6 space-y-5 transition-colors duration-300 relative overflow-hidden",
            activeTheme.isDark 
              ? "bg-slate-900/40 border-slate-800/80 shadow-black/30" 
              : "bg-white border-slate-200 shadow-slate-100"
          )}>
            
            {/* Header / Title */}
            <div className="flex items-center justify-between border-b pb-3 border-dashed border-slate-700/20">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                  History / Activity Feed
                </h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Real-Time Sheet
              </span>
            </div>

            {/* View Mode Tabs (All vs Selected Lot) */}
            {selectedLot && (
              <div className={cn(
                "p-1 rounded-xl border flex items-center gap-1 text-[10px] font-black uppercase tracking-wider",
                activeTheme.isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode("selected")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg transition-all duration-200 cursor-pointer text-center",
                    historyViewMode === "selected"
                      ? (activeTheme.isDark ? "bg-slate-850 text-indigo-400 font-black" : "bg-white text-indigo-600 shadow-sm font-black")
                      : "text-slate-400 hover:text-slate-300"
                  )}
                >
                  Lot {selectedLot.lotId} ({currentLotRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryViewMode("all")}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg transition-all duration-200 cursor-pointer text-center",
                    historyViewMode === "all"
                      ? (activeTheme.isDark ? "bg-slate-850 text-indigo-400 font-black" : "bg-white text-indigo-600 shadow-sm font-black")
                      : "text-slate-400 hover:text-slate-300"
                  )}
                >
                  All History ({displayedAccomplishments.length})
                </button>
              </div>
            )}

            {/* Quick Filter Inputs */}
            {displayedAccomplishments.length > 0 && (
              <div className="space-y-3 pt-1">
                {/* Text Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter by Lot, Handler, Owner..."
                    className={cn(
                      "w-full pl-9 pr-3 py-2 border rounded-xl outline-none transition-all font-bold text-xs",
                      activeTheme.isDark 
                        ? "bg-slate-950 text-slate-100 border-slate-850 focus:border-blue-500" 
                        : "bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-400"
                    )}
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>

                {/* Dropdown Filters row */}
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <select 
                    className={cn(
                      "px-2 py-1.5 border rounded-lg font-bold outline-none cursor-pointer",
                      activeTheme.isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200"
                    )}
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    {uniqueStatusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>

                  <select 
                    className={cn(
                      "px-2 py-1.5 border rounded-lg font-bold outline-none cursor-pointer",
                      activeTheme.isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200"
                    )}
                    value={historyCpFilter}
                    onChange={(e) => setHistoryCpFilter(e.target.value)}
                  >
                    <option value="">All CPs</option>
                    {uniqueCpOptions.map(cp => (
                      <option key={cp} value={cp}>{cp}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* List entries or timeline */}
            {!googleToken && displayedAccomplishments.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs italic font-semibold font-sans space-y-2">
                <p>Authentication required to display past sheet accomplishments.</p>
                <p className="text-[10px] uppercase font-black not-italic text-blue-500">Connect Google Sheets above</p>
              </div>
            ) : isLoadingExisting ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400 font-sans">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-400">Loading spreadsheet data...</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs italic font-semibold font-sans">
                {displayedAccomplishments.length === 0 
                  ? "No recorded accomplishment records found."
                  : "No history updates match active filters."}
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar font-sans">
                {visibleHistory.map((rec) => {
                  const isBeingEdited = editingRowIndex === rec.rowIndex;
                  return (
                    <div 
                      key={rec.rowIndex}
                      className={cn(
                        "p-4 rounded-2xl border transition-all relative overflow-hidden group hover:scale-[1.005]",
                        isBeingEdited
                          ? (activeTheme.isDark ? "bg-blue-950/20 border-blue-800/80 ring-1 ring-blue-500/30" : "bg-blue-50/70 border-blue-200 ring-1 ring-blue-500/20")
                          : (activeTheme.isDark ? "bg-slate-900 border-slate-850 hover:border-slate-800" : "bg-slate-50/50 border-slate-150 hover:border-slate-250")
                      )}
                    >
                      {/* Accent highlight left */}
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-[3px]",
                        rec.status.toLowerCase().includes("paid")
                          ? "bg-emerald-500"
                          : rec.status.toLowerCase().includes("drafted")
                          ? "bg-amber-400"
                          : "bg-blue-500"
                      )} />

                      <div className="space-y-2 pl-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase">
                              Row {rec.rowIndex + 1}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[8px] font-bold uppercase",
                              activeTheme.isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"
                            )}>
                              {rec.cp || "N/A"}
                            </span>
                          </div>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider truncate max-w-[140px]",
                            rec.status.toLowerCase().includes("paid")
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : rec.status.toLowerCase().includes("drafted")
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          )}>
                            {rec.status}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className={cn("text-xs font-black tracking-tight cursor-pointer hover:underline", activeTheme.isDark ? "text-slate-100" : "text-slate-800")} onClick={() => { setSearch(rec.lotId); handleSearch(); }}>
                              {rec.lotId}
                            </span>
                            <span className="text-[9px] text-slate-400">/</span>
                            <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]" title={rec.owner}>
                              {rec.owner}
                            </span>
                          </div>

                          <p className={cn("text-xs font-bold leading-normal italic py-0.5", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                            "{rec.remarks || "No comments added"}"
                          </p>

                          <div className="flex items-center justify-between text-[9px] font-semibold text-slate-400 border-t border-slate-700/10 pt-1.5 mt-1">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3 text-blue-500" />
                              <span className="truncate max-w-[80px]" title={rec.handler}>{rec.handler}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-indigo-400" />
                              <span>{rec.date}</span>
                            </div>
                          </div>
                        </div>

                        {/* Edit/Delete inline operations */}
                        {deletingRowIndex === rec.rowIndex ? (
                          <div className={cn(
                            "flex flex-col gap-2 p-2 rounded-xl border mt-2 text-center",
                            activeTheme.isDark ? "bg-rose-950/20 border-rose-900/40 text-rose-300" : "bg-rose-50 border-rose-150 text-rose-900"
                          )}>
                            <p className="text-[9px] font-black uppercase tracking-wider">
                              Confirm delete row {rec.rowIndex + 1}?
                            </p>
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleDeleteRecord(rec)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded text-[8px] uppercase tracking-wider cursor-pointer"
                              >
                                {isSubmitting ? "Deleting..." : "Yes, Delete"}
                              </button>
                              <button
                                onClick={() => setDeletingRowIndex(null)}
                                className="px-2.5 py-1 bg-slate-500 hover:bg-slate-600 active:bg-slate-700 text-white font-bold rounded text-[8px] uppercase tracking-wider cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 border-t pt-1.5 border-dashed border-slate-700/10 opacity-70 group-hover:opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditRecord(rec)}
                              className={cn(
                                "px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 cursor-pointer transition-colors",
                                activeTheme.isDark ? "text-blue-400 hover:bg-blue-500/10" : "text-blue-600 hover:bg-blue-50"
                              )}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => setDeletingRowIndex(rec.rowIndex)}
                              className="px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-0.5 cursor-pointer text-rose-400 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Show Load More history records if there are more filtered updates */}
                {filteredHistory.length > visibleHistoryCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleHistoryCount(prev => prev + 25)}
                    className={cn(
                      "w-full py-2.5 mt-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border flex items-center justify-center gap-1.5",
                      activeTheme.isDark 
                        ? "bg-slate-950 hover:bg-slate-900 text-indigo-400 border-slate-850 hover:border-slate-800" 
                        : "bg-slate-50 hover:bg-slate-100 text-indigo-600 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-pulse shrink-0" />
                    Load More History ({filteredHistory.length - visibleHistoryCount} remaining)
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

      </div> {/* Close Main Grid Workspace */}

      {/* Policy Notice Bar */}
      <div className={cn(
        "border rounded-3xl p-5 flex items-start gap-4 transition-all font-sans",
        activeTheme.isDark 
          ? "bg-blue-950/20 border-blue-900/30 text-blue-100" 
          : "bg-blue-50/50 border-blue-100 text-blue-900"
      )}>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border", activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-blue-200/50")}>
          <ShieldCheck className="w-5 h-5 text-blue-500" />
        </div>
        <div className="space-y-0.5">
          <p className={cn("text-[10px] font-black uppercase tracking-widest", activeTheme.isDark ? "text-blue-300" : "text-blue-900")}>Official Field Logs Policy</p>
          <p className={cn("text-[11px] font-medium leading-relaxed opacity-80", activeTheme.isDark ? "text-blue-200" : "text-blue-800")}>
            By recording accomplishments, you submit authorized updates to the database representing completed processes. Ensure documentation collection dates comply with your CP guidelines.
          </p>
        </div>
      </div>

      {/* POPUP ALERT MODAL */}
      {alertModal && alertModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Subtle semi-transparent backdrop without blur */}
          <div 
            className="absolute inset-0 bg-slate-950/20 transition-opacity duration-200"
            onClick={() => setAlertModal(null)}
          />
          
          {/* Compact Modal Card */}
          <div className={cn(
            "relative w-full max-w-sm p-5 rounded-2xl border shadow-xl transition-all duration-200 transform scale-100 animate-in zoom-in-95 duration-150",
            activeTheme.isDark 
              ? "bg-slate-900 border-slate-800 text-slate-100 shadow-black/60" 
              : "bg-white border-slate-200 text-slate-800 shadow-slate-300/30"
          )}>
            {/* Header row with Title and Close */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                  alertModal.type === "validation" || alertModal.type === "warning"
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                    : alertModal.type === "error"
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-500"
                      : "bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
                )}>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <h3 className={cn(
                  "text-xs font-black uppercase tracking-wider leading-none",
                  activeTheme.isDark ? "text-slate-150" : "text-slate-900"
                )}>
                  {alertModal.title}
                </h3>
              </div>
              <button 
                onClick={() => setAlertModal(null)}
                className={cn(
                  "p-1 rounded-md border cursor-pointer hover:bg-slate-500/10 transition-all text-slate-400 hover:text-slate-300 shrink-0",
                  activeTheme.isDark ? "border-slate-800" : "border-slate-200"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description Message */}
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-3.5">
              {alertModal.message}
            </p>

            {/* Missing Fields list (validation type only) */}
            {alertModal.type === "validation" && alertModal.missingFields && alertModal.missingFields.length > 0 && (
              <div className={cn(
                "p-3 rounded-xl border mb-4 space-y-2",
                activeTheme.isDark ? "bg-slate-950/40 border-slate-850" : "bg-slate-50 border-slate-150"
              )}>
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-400">
                  Required:
                </p>
                <ul className="grid grid-cols-1 gap-1.5">
                  {alertModal.missingFields.map((field, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-[10px] font-bold text-rose-500 uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Buttons row */}
            <div className="flex justify-end">
              <button
                onClick={() => setAlertModal(null)}
                className={cn(
                  "py-2 px-5 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer shadow-sm transition-all active:scale-[0.98] duration-150 text-white font-bold",
                  alertModal.type === "validation" || alertModal.type === "warning"
                    ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/15"
                    : alertModal.type === "error"
                      ? "bg-rose-500 hover:bg-rose-600 shadow-rose-500/15"
                      : "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/15"
                )}
              >
                Close Alert
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
