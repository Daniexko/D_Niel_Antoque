import React, { useState, useMemo, useRef } from "react";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { 
  Upload, 
  FileSpreadsheet, 
  Table, 
  Filter, 
  CheckSquare, 
  Square, 
  Search, 
  SlidersHorizontal, 
  Download, 
  Printer, 
  Copy, 
  RotateCcw, 
  BarChart3, 
  PieChart, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  Layers, 
  Info, 
  Check, 
  FileText, 
  LayoutGrid, 
  X, 
  ArrowUpDown, 
  Plus,
  Zap,
  Eye,
  HelpCircle
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { LotData } from "../types";
import { cn } from "../lib/utils";

interface HelpStep {
  title: string;
  desc: string;
  taglish: string;
}

interface HelpGuideProps {
  title: string;
  steps: HelpStep[];
  accentColor?: "blue" | "emerald" | "amber" | "purple";
}

const HelpGuide: React.FC<HelpGuideProps> = ({ title, steps }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-xs mb-4">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between cursor-pointer font-bold text-[#1E3A8A]"
      >
        <span className="flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
          <HelpCircle className="w-4 h-4 text-blue-600" />
          {title}
        </span>
        <span className="text-[10px] text-blue-600 underline font-semibold">
          {isOpen ? "Hide Instructions" : "Show Instructions & Taglish Guide"}
        </span>
      </div>

      {isOpen && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-blue-100">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-white p-3 rounded-xl border border-blue-100 space-y-1">
              <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">{step.title}</h5>
              <p className="text-[10px] text-slate-600 leading-relaxed">{step.desc}</p>
              <p className="text-[10px] italic text-blue-700 font-medium bg-blue-50/60 p-1.5 rounded-lg border border-blue-100">{step.taglish}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CustomReportGeneratorProps {
  systemData?: LotData[];
  onNavigateTab?: (tab: string) => void;
}

export const CustomReportGenerator: React.FC<CustomReportGeneratorProps> = ({
  systemData = [],
  onNavigateTab
}) => {
  // File state
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeStr, setFileSizeStr] = useState<string>("");
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Configuration state
  const [selectedGroupCol, setSelectedGroupCol] = useState<string>("");
  const [selectedSubGroupCol, setSelectedSubGroupCol] = useState<string>("");
  const [selectedHeaders, setSelectedHeaders] = useState<string[]>([]);
  const [metricCol, setMetricCol] = useState<string>("");
  const [metricFunc, setMetricFunc] = useState<"COUNT" | "SUM" | "AVG" | "MIN" | "MAX">("COUNT");
  const [filterKeyword, setFilterKeyword] = useState<string>("");
  const [columnSearch, setColumnSearch] = useState<string>("");
  const [activeViewMode, setActiveViewMode] = useState<"table" | "chart" | "pivot">("pivot");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");
  
  // Multi-sheet Excel State
  const [availableSheets, setAvailableSheets] = useState<{ name: string; rowCount: number }[]>([]);
  const [currentSheetName, setCurrentSheetName] = useState<string | null>(null);
  const workbookRef = useRef<ExcelJS.Workbook | null>(null);

  // Drilldown & Catalog state
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);
  const [copiedHeadersSuccess, setCopiedHeadersSuccess] = useState<boolean>(false);
  const [showHeaderCatalog, setShowHeaderCatalog] = useState<boolean>(true);
  const [catalogSearch, setCatalogSearch] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detailed Header Info Analysis
  const headerInfoList = useMemo(() => {
    if (!allHeaders.length || !rawData.length) return [];
    return allHeaders.map((header, index) => {
      let nonBlankCount = 0;
      let numericCount = 0;
      let sampleVal = "";

      for (let i = 0; i < rawData.length; i++) {
        const val = rawData[i][header];
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          nonBlankCount++;
          if (!sampleVal) sampleVal = String(val);
          if (!isNaN(Number(val)) && String(val).trim() !== "") {
            numericCount++;
          }
        }
      }

      let inferredType = "Text / Categorical";
      if (nonBlankCount > 0 && numericCount / nonBlankCount > 0.8) {
        inferredType = "Numeric / Math";
      }

      return {
        colIndex: index + 1,
        headerName: header,
        nonBlankCount,
        blankCount: rawData.length - nonBlankCount,
        fillPercentage: rawData.length > 0 ? (nonBlankCount / rawData.length) * 100 : 0,
        sampleVal: sampleVal || "(All Blank)",
        inferredType
      };
    });
  }, [allHeaders, rawData]);

  // Filtered Header Catalog List
  const filteredCatalogList = useMemo(() => {
    if (!catalogSearch) return headerInfoList;
    const q = catalogSearch.toLowerCase();
    return headerInfoList.filter(
      h => h.headerName.toLowerCase().includes(q) || h.sampleVal.toLowerCase().includes(q) || String(h.colIndex).includes(q)
    );
  }, [headerInfoList, catalogSearch]);

  // Copy list of detected header column names
  const handleCopyHeaderNames = () => {
    if (!allHeaders.length) return;
    const text = allHeaders.map((h, i) => `Column ${i + 1}: ${h}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedHeadersSuccess(true);
    setTimeout(() => setCopiedHeadersSuccess(false), 2500);
  };

  // Export Header Catalog to CSV
  const handleExportHeaderCatalogCSV = () => {
    if (!headerInfoList.length) return;
    const csvRows = headerInfoList.map(h => ({
      "Column Index": `Col ${h.colIndex}`,
      "Header Column Name": h.headerName,
      "Inferred Data Type": h.inferredType,
      "Populated Data Rows": h.nonBlankCount,
      "Total Data Rows": rawData.length,
      "Fill Percentage": `${h.fillPercentage.toFixed(1)}%`,
      "First Sample Value": h.sampleVal
    }));
    const csvStr = Papa.unparse(csvRows);
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Header_Catalog_${fileName ? fileName.replace(/\.[^/.]+$/, "") : "Dataset"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper to load System Data as default spreadsheet
  const handleLoadSystemData = () => {
    if (!systemData || systemData.length === 0) return;
    setIsParsing(true);
    setParseError(null);

    setTimeout(() => {
      const mapped = systemData.map((d) => ({
        "LOT ID": d.lotId || "",
        "STRUCTURE TAG": d.structureTag || "",
        "CONTRACT PACKAGE": d.contractPackage || "",
        "MUNICIPALITY": d.municipality || "",
        "BARANGAY": d.barangay || "",
        "REGISTERED OWNER": d.registeredOwner || "",
        "LOT AREA (SQM)": d.lotArea || 0,
        "ACCOMPLISHMENT STATUS": d.accomplishmentStatus || "",
        "PAYMENT STATUS": d.paymentStatus || "",
        "PTE STATUS": d.statusPte || "",
        "DOAS STATUS": d.statusDoas || "",
        "DATE ACCOMPLISHED": d.dateAccomplished || "",
        "REMARKS": d.remarks || ""
      }));

      const headers = Object.keys(mapped[0] || {});
      setRawData(mapped);
      setAllHeaders(headers);
      setFileName("SCLA_Live_System_Dataset.xlsx");
      setFileSizeStr(`${mapped.length} System Records`);
      
      // Auto-select smart defaults
      setSelectedGroupCol("CONTRACT PACKAGE");
      setSelectedSubGroupCol("ACCOMPLISHMENT STATUS");
      setSelectedHeaders(["LOT ID", "STRUCTURE TAG", "MUNICIPALITY", "REGISTERED OWNER", "ACCOMPLISHMENT STATUS"]);
      setMetricCol("LOT AREA (SQM)");
      setMetricFunc("SUM");
      setIsParsing(false);
    }, 150);
  };

  // Helper to extract rows and headers from an ExcelJS worksheet
  const extractSheetData = (worksheet: ExcelJS.Worksheet) => {
    const rows: Record<string, any>[] = [];
    let headers: string[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rawValues = (row.values as any[]).slice(1);
      if (rowNumber === 1) {
        headers = rawValues.map((v, i) => (v !== null && v !== undefined) ? String(v).trim() : `Column_${i + 1}`);
      } else {
        const rowObj: Record<string, any> = {};
        headers.forEach((h, idx) => {
          const val = rawValues[idx];
          if (val === null || val === undefined) {
            rowObj[h] = "";
          } else if (typeof val === 'object') {
            if ('result' in val) rowObj[h] = val.result !== null && val.result !== undefined ? String(val.result) : "";
            else if ('text' in val) rowObj[h] = val.text !== null && val.text !== undefined ? String(val.text) : "";
            else if (val instanceof Date) rowObj[h] = val.toISOString().split('T')[0];
            else rowObj[h] = String(val);
          } else {
            rowObj[h] = String(val);
          }
        });
        rows.push(rowObj);
      }
    });

    return { rows, headers };
  };

  // Switch between sheets in an Excel workbook
  const handleSwitchSheet = (sheetName: string) => {
    if (!workbookRef.current) return;
    const worksheet = workbookRef.current.getWorksheet(sheetName);
    if (!worksheet) return;

    setIsParsing(true);
    setParseError(null);
    setTimeout(() => {
      const { rows, headers } = extractSheetData(worksheet);

      if (rows.length === 0 || headers.length === 0) {
        setParseError(`The selected sheet "${sheetName}" is empty or has no readable rows.`);
        setIsParsing(false);
        return;
      }

      setCurrentSheetName(sheetName);
      setRawData(rows);
      setAllHeaders(headers);
      setSelectedGroupCol(headers[0] || "");
      setSelectedSubGroupCol(headers[1] || "");
      setSelectedHeaders(headers.slice(0, Math.min(6, headers.length)));
      setFilterKeyword("");
      setIsParsing(false);
    }, 100);
  };

  // Process file upload (CSV or Excel)
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setIsParsing(true);
    setParseError(null);
    setFileName(file.name);
    setFileSizeStr(`${(file.size / 1024).toFixed(1)} KB`);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    try {
      if (fileExt === "csv" || fileExt === "txt") {
        setAvailableSheets([]);
        setCurrentSheetName(null);
        workbookRef.current = null;

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = (results.data as Record<string, any>[]).filter(
              row => Object.values(row).some(val => val !== null && val !== "" && val !== undefined)
            );
            const headers = results.meta.fields ? results.meta.fields.filter(Boolean) : (data.length > 0 ? Object.keys(data[0]) : []);
            
            if (data.length === 0 || headers.length === 0) {
              setParseError("The uploaded CSV file appears to be empty or missing row headers.");
              setIsParsing(false);
              return;
            }

            setRawData(data);
            setAllHeaders(headers);
            setSelectedGroupCol(headers[0] || "");
            setSelectedHeaders(headers.slice(0, Math.min(6, headers.length)));
            setIsParsing(false);
          },
          error: (err) => {
            setParseError(`Failed to parse CSV file: ${err.message}`);
            setIsParsing(false);
          }
        });
      } else if (fileExt === "xlsx" || fileExt === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);
        workbookRef.current = workbook;

        if (!workbook.worksheets || workbook.worksheets.length === 0) {
          setParseError("No worksheet found inside the uploaded Excel workbook.");
          setIsParsing(false);
          return;
        }

        // Detect all sheets in workbook
        const sheetsInfo = workbook.worksheets.map(ws => ({
          name: ws.name,
          rowCount: Math.max(0, ws.rowCount - 1)
        }));
        setAvailableSheets(sheetsInfo);

        const firstSheet = workbook.worksheets[0];
        const { rows, headers } = extractSheetData(firstSheet);

        if (rows.length === 0 || headers.length === 0) {
          setParseError(`The sheet "${firstSheet.name}" appears to be empty or contains no readable rows.`);
          setIsParsing(false);
          return;
        }

        setCurrentSheetName(firstSheet.name);
        setRawData(rows);
        setAllHeaders(headers);
        setSelectedGroupCol(headers[0] || "");
        setSelectedSubGroupCol(headers[1] || "");
        setSelectedHeaders(headers.slice(0, Math.min(6, headers.length)));
        setIsParsing(false);
      } else {
        setParseError("Unsupported file format. Please upload a valid CSV or Excel (.xlsx, .xls) file.");
        setIsParsing(false);
      }
    } catch (err: any) {
      console.error("File processing error:", err);
      setParseError(`Error reading file: ${err.message || "Unknown file read error"}`);
      setIsParsing(false);
    }
  };

  // Reset file state
  const handleReset = () => {
    setFileName(null);
    setFileSizeStr("");
    setRawData([]);
    setAllHeaders([]);
    setAvailableSheets([]);
    setCurrentSheetName(null);
    workbookRef.current = null;
    setSelectedGroupCol("");
    setSelectedSubGroupCol("");
    setSelectedHeaders([]);
    setMetricCol("");
    setMetricFunc("COUNT");
    setFilterKeyword("");
    setParseError(null);
    setExpandedGroup(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Filtered raw data based on keyword search
  const filteredRawData = useMemo(() => {
    if (!filterKeyword.trim()) return rawData;
    const kw = filterKeyword.toLowerCase().trim();
    return rawData.filter(row => 
      Object.values(row).some(val => String(val ?? "").toLowerCase().includes(kw))
    );
  }, [rawData, filterKeyword]);

  // Header Search List
  const filteredHeadersList = useMemo(() => {
    if (!columnSearch.trim()) return allHeaders;
    const kw = columnSearch.toLowerCase().trim();
    return allHeaders.filter(h => h.toLowerCase().includes(kw));
  }, [allHeaders, columnSearch]);

  // Toggle selection of a single header
  const toggleHeader = (header: string) => {
    if (selectedHeaders.includes(header)) {
      setSelectedHeaders(selectedHeaders.filter(h => h !== header));
    } else {
      setSelectedHeaders([...selectedHeaders, header]);
    }
  };

  // Select all headers
  const handleSelectAllHeaders = () => {
    setSelectedHeaders([...allHeaders]);
  };

  // Deselect all headers
  const handleClearAllHeaders = () => {
    setSelectedHeaders([]);
  };

  // Numeric helper
  const parseNum = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(/,/g, "").trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Calculate Pivot Summary Groupings
  const pivotSummary = useMemo(() => {
    if (!rawData.length || !selectedGroupCol) {
      return { groups: [], totalRecords: 0, overallMetricSum: 0, overallMetricAvg: 0, subGroupKeys: [] };
    }

    const groupMap = new Map<string, Record<string, any>[]>();
    const subGroupSet = new Set<string>();

    filteredRawData.forEach(row => {
      const groupKey = String(row[selectedGroupCol] ?? "(Blank)").trim() || "(Blank)";
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(row);

      if (selectedSubGroupCol) {
        const subKey = String(row[selectedSubGroupCol] ?? "(Blank)").trim() || "(Blank)";
        subGroupSet.add(subKey);
      }
    });

    const subGroupKeys = Array.from(subGroupSet).sort();
    let overallMetricSum = 0;
    let numericValueCount = 0;

    const groups = Array.from(groupMap.entries()).map(([groupKey, rows]) => {
      const count = rows.length;

      // Metric calculations
      let metricVal = 0;
      if (metricCol && metricFunc !== "COUNT") {
        const nums = rows.map(r => parseNum(r[metricCol])).filter(n => !isNaN(n));
        if (nums.length > 0) {
          if (metricFunc === "SUM") {
            metricVal = nums.reduce((a, b) => a + b, 0);
          } else if (metricFunc === "AVG") {
            metricVal = nums.reduce((a, b) => a + b, 0) / nums.length;
          } else if (metricFunc === "MIN") {
            metricVal = Math.min(...nums);
          } else if (metricFunc === "MAX") {
            metricVal = Math.max(...nums);
          }
          overallMetricSum += nums.reduce((a, b) => a + b, 0);
          numericValueCount += nums.length;
        }
      } else {
        metricVal = count;
      }

      // Sub-group breakdown (if cross-tabbing)
      const subBreakdown: Record<string, number> = {};
      if (selectedSubGroupCol) {
        subGroupKeys.forEach(sKey => {
          subBreakdown[sKey] = rows.filter(r => String(r[selectedSubGroupCol] ?? "(Blank)").trim() === sKey).length;
        });
      }

      return {
        groupKey,
        count,
        percent: filteredRawData.length > 0 ? (count / filteredRawData.length) * 100 : 0,
        metricVal,
        rows,
        subBreakdown
      };
    }).sort((a, b) => b.count - a.count);

    const overallMetricAvg = numericValueCount > 0 ? overallMetricSum / numericValueCount : 0;

    return {
      groups,
      totalRecords: filteredRawData.length,
      overallMetricSum,
      overallMetricAvg,
      subGroupKeys
    };
  }, [filteredRawData, selectedGroupCol, selectedSubGroupCol, metricCol, metricFunc, rawData.length]);

  // Chart data formatting
  const chartData = useMemo(() => {
    return pivotSummary.groups.slice(0, 15).map(g => ({
      name: g.groupKey.length > 20 ? g.groupKey.slice(0, 18) + "..." : g.groupKey,
      fullName: g.groupKey,
      Records: g.count,
      Value: Math.round(g.metricVal * 100) / 100
    }));
  }, [pivotSummary.groups]);

  // Chart Colors palette
  const CHART_COLORS = ["#1E3A8A", "#0D9488", "#2563EB", "#D97706", "#7C3AED", "#DB2777", "#059669", "#DC2626", "#4F46E5", "#0284C7"];

  // Export to Excel Workbook
  const handleExportExcel = async () => {
    if (!pivotSummary.groups.length) return;

    const workbook = new ExcelJS.Workbook();
    
    // Sheet 1: Pivot Summary
    const summarySheet = workbook.addWorksheet("Pivot Summary");
    
    summarySheet.columns = [
      { header: selectedGroupCol || "Category Group", key: "group", width: 32 },
      { header: "Record Count", key: "count", width: 16 },
      { header: "Percentage Share", key: "percent", width: 18 },
      ...(metricCol && metricFunc !== "COUNT" ? [{ header: `${metricFunc} of ${metricCol}`, key: "metric", width: 22 }] : []),
      ...pivotSummary.subGroupKeys.map(sk => ({ header: `${selectedSubGroupCol}: ${sk}`, key: `sub_${sk}`, width: 18 }))
    ];

    // Styling Header Row
    const headerRow = summarySheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "1E3A8A" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    pivotSummary.groups.forEach(g => {
      const rowDataObj: Record<string, any> = {
        group: g.groupKey,
        count: g.count,
        percent: `${g.percent.toFixed(1)}%`,
        ...(metricCol && metricFunc !== "COUNT" ? { metric: Math.round(g.metricVal * 100) / 100 } : {})
      };

      pivotSummary.subGroupKeys.forEach(sk => {
        rowDataObj[`sub_${sk}`] = g.subBreakdown[sk] || 0;
      });

      summarySheet.addRow(rowDataObj);
    });

    // Grand Total Row
    const totalRowObj: Record<string, any> = {
      group: "GRAND TOTAL",
      count: pivotSummary.totalRecords,
      percent: "100.0%",
      ...(metricCol && metricFunc !== "COUNT" ? { metric: Math.round(pivotSummary.overallMetricSum * 100) / 100 } : {})
    };
    const totalRow = summarySheet.addRow(totalRowObj);
    totalRow.font = { bold: true };

    // Sheet 2: Selected Columns Data
    const detailSheet = workbook.addWorksheet("Custom Summary Data");
    const exportHeaders = selectedHeaders.length > 0 ? selectedHeaders : allHeaders;

    detailSheet.columns = exportHeaders.map(h => ({ header: h, key: h, width: 22 }));
    const detailHeaderRow = detailSheet.getRow(1);
    detailHeaderRow.font = { bold: true, color: { argb: "FFFFFF" } };
    detailHeaderRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "0F172A" } };

    filteredRawData.forEach(r => {
      const rowObj: Record<string, any> = {};
      exportHeaders.forEach(h => {
        rowObj[h] = r[h] ?? "";
      });
      detailSheet.addRow(rowObj);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Custom_Summary_Report_${selectedGroupCol || "Pivot"}_${new Date().toISOString().split("T")[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const exportHeaders = selectedHeaders.length > 0 ? selectedHeaders : allHeaders;
    const exportRows = filteredRawData.map(r => {
      const rowObj: Record<string, any> = {};
      exportHeaders.forEach(h => {
        rowObj[h] = r[h] ?? "";
      });
      return rowObj;
    });

    const csvStr = Papa.unparse(exportRows);
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Custom_Summary_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy Summary to Clipboard
  const handleCopyClipboard = () => {
    if (!pivotSummary.groups.length) return;
    let tsv = `${selectedGroupCol || "Category"}\tRecord Count\tPercent Share\n`;
    pivotSummary.groups.forEach(g => {
      tsv += `${g.groupKey}\t${g.count}\t${g.percent.toFixed(1)}%\n`;
    });
    tsv += `TOTAL\t${pivotSummary.totalRecords}\t100%\n`;

    navigator.clipboard.writeText(tsv);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  return (
    <div id="custom-report-anchor" className="space-y-6 animate-fade-in font-sans pb-12">
      
      {/* SECTION HEADER BANNER */}
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200/90 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-[#1E3A8A]" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-[#1E3A8A] text-[10px] font-black uppercase tracking-wider border border-blue-200/60 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                PIVOT & CUSTOM REPORT GENERATOR
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Dynamic File Upload & Pivot Style Report Summarizer
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1 max-w-3xl leading-relaxed">
              Upload any custom Excel (.xlsx, .xls) or CSV file to analyze, filter, and aggregate into a real-time pivot breakdown. Customize which exact headers and columns appear in your summary reports.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!fileName && systemData.length > 0 && (
              <button
                type="button"
                onClick={handleLoadSystemData}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Zap className="w-4 h-4" />
                Use Active System Dataset
              </button>
            )}

            {fileName && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-2 border border-slate-200 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Upload New File
              </button>
            )}
          </div>
        </div>

        {/* GUIDANCE HELPER */}
        <div className="mt-5">
          <HelpGuide 
            title="How to Use the Custom Pivot Report Generator"
            accentColor="blue"
            steps={[
              {
                title: "1. Upload Spreadsheet File or System Data",
                desc: "Drag and drop your custom .xlsx, .xls, or .csv file into the upload box below, or click 'Use Active System Dataset' to analyze live project records.",
                taglish: "Upload your Excel or CSV file, or click 'Use Active System Dataset' to analyze live project records."
              },
              {
                title: "2. Select Groupings & Specific Columns",
                desc: "Choose the primary column to group by (e.g. Status, CP, Owner), select optional sub-groupings, and check the exact headers/columns you want inside the summary table.",
                taglish: "Select the main column to group by (e.g. Status, CP) and pick the specific headers to display in the summary table."
              },
              {
                title: "3. Review & Export Pivot Reports",
                desc: "View calculated counts, percentages, visual bar/pie charts, and click group rows to drill down into detailed record cards. Export directly to Excel or CSV.",
                taglish: "Review percentages, bar/pie charts, and export the complete report to Excel or CSV."
              },
              {
                title: "4. Multi-Sheet Excel Switching",
                desc: "If your Excel workbook contains multiple worksheets (e.g. Sheet1, Lot Details, CP Summary), click the sheet tabs above to switch datasets instantly.",
                taglish: "If your Excel workbook contains multiple sheets (e.g. Sheet1, Summary, CP Details), click the sheet tabs above to switch datasets."
              }
            ]}
          />
        </div>
      </div>

      {/* FILE UPLOAD DROPZONE / LOADED BAR */}
      {!fileName ? (
        <div className="bg-white p-8 rounded-[2rem] border-2 border-dashed border-slate-300 hover:border-[#1E3A8A] transition-all text-center relative group">
          <input 
            ref={fileInputRef}
            type="file" 
            accept=".csv, .xlsx, .xls, .txt"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />

          <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-800">
                Click or Drag & Drop Excel / CSV File Here
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Supports <span className="text-[#1E3A8A] font-bold">.XLSX</span>, <span className="text-[#1E3A8A] font-bold">.XLS</span>, and <span className="text-[#1E3A8A] font-bold">.CSV</span> format files
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                📁 Max file size: 50MB
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-bold border border-slate-200">
                📊 Automatic Header Detection
              </span>
            </div>
          </div>

          {isParsing && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center z-20 rounded-[2rem]">
              <div className="w-10 h-10 border-4 border-[#1E3A8A] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-black uppercase tracking-wider text-[#1E3A8A]">
                Reading spreadsheet headers & data rows...
              </p>
            </div>
          )}

          {parseError && (
            <div className="mt-4 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center justify-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              {parseError}
            </div>
          )}
        </div>
      ) : (
        /* FILE ACTIVE SUMMARY HEADER & COMPLETE DIMENSIONS & HEADER CATALOG */
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-[#0F172A] via-[#1E3A8A] to-[#0F172A] text-white p-6 rounded-[2rem] shadow-md border border-slate-700/60 relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center font-black shrink-0 shadow-inner">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
                      FILE LOADED & ANALYZED
                    </span>
                    <span className="text-xs font-bold text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">{fileSizeStr}</span>
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    {fileName}
                  </h3>
                  <p className="text-xs text-slate-300 font-medium mt-1">
                    Exact file structure detected with complete header column breakdown & data row count.
                  </p>
                </div>
              </div>

              {/* EXACT FILE DIMENSIONS STATS GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/10 p-3.5 rounded-2xl border border-white/15 backdrop-blur-xs">
                <div className="px-3 py-1.5 border-r border-white/15 last:border-r-0">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">Data Rows</span>
                  <span className="text-lg font-black text-emerald-300">{rawData.length.toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block">Excl. Header</span>
                </div>

                <div className="px-3 py-1.5 border-r border-white/15 last:border-r-0">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">Total Columns</span>
                  <span className="text-lg font-black text-sky-300">{allHeaders.length}</span>
                  <span className="text-[9px] text-slate-400 block">Headers</span>
                </div>

                <div className="px-3 py-1.5 border-r border-white/15 last:border-r-0">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">Total Sheet Lines</span>
                  <span className="text-lg font-black text-amber-300">{(rawData.length + 1).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block">Header + Data</span>
                </div>

                <div className="px-3 py-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider block">Total Data Cells</span>
                  <span className="text-lg font-black text-purple-300">{(rawData.length * allHeaders.length).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-400 block">Row x Column</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start lg:self-center">
                <button
                  type="button"
                  onClick={() => setShowHeaderCatalog(!showHeaderCatalog)}
                  className="px-4 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 hover:text-white font-black text-xs uppercase tracking-wider border border-sky-400/40 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Table className="w-4 h-4 text-sky-300" />
                  {showHeaderCatalog ? "Hide Header Catalog" : "View All Headers List"}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3.5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white font-bold text-xs uppercase tracking-wider border border-rose-400/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  Change File
                </button>
              </div>
            </div>

            {/* DETECTED EXCEL WORKSHEETS TABS BAR */}
            {availableSheets.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                    Excel Workbook Sheets ({availableSheets.length}):
                  </span>
                  {currentSheetName && (
                    <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                      Active Sheet: {currentSheetName}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {availableSheets.map((sh) => {
                    const isActive = sh.name === currentSheetName;
                    return (
                      <button
                        key={sh.name}
                        type="button"
                        onClick={() => handleSwitchSheet(sh.name)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border",
                          isActive
                            ? "bg-emerald-400 text-slate-950 border-emerald-300 font-black shadow-md scale-[1.02]"
                            : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/15 hover:border-white/30"
                        )}
                      >
                        <FileSpreadsheet className={cn("w-3.5 h-3.5", isActive ? "text-slate-950" : "text-emerald-400")} />
                        <span>{sh.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.2 rounded-md font-extrabold", isActive ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-slate-300")}>
                          {sh.rowCount.toLocaleString()} rows
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* EXPANDABLE DETECTED COLUMN HEADERS CATALOG LIST */}
          {showHeaderCatalog && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200/90 shadow-sm space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <Table className="w-4 h-4 text-[#1E3A8A]" />
                    Complete Detected Header Column Catalog ({allHeaders.length} Columns)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    List of all exact column headers found in <strong className="text-slate-800">{fileName}</strong> with fill statistics & data types.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search headers or sample text..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold w-44 focus:w-60 transition-all outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyHeaderNames}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 border border-slate-200 transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-[#1E3A8A]" />
                    {copiedHeadersSuccess ? "Copied!" : "Copy Header List"}
                  </button>

                  <button
                    type="button"
                    onClick={handleExportHeaderCatalogCSV}
                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    Export Catalog CSV
                  </button>
                </div>
              </div>

              {/* HEADERS TABLE */}
              <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-2xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-black uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-16 text-center border-r">Col #</th>
                      <th className="p-3 border-r min-w-[180px]">Detected Header Column Name</th>
                      <th className="p-3 border-r w-36">Inferred Type</th>
                      <th className="p-3 border-r w-48">Populated Fill Rate</th>
                      <th className="p-3 border-r min-w-[200px]">Row 1 Sample Value</th>
                      <th className="p-3 text-center w-36">Include in Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredCatalogList.map((item) => {
                      const isIncluded = selectedHeaders.includes(item.headerName);
                      return (
                        <tr key={item.headerName} className="hover:bg-blue-50/40 transition-colors">
                          <td className="p-3 text-center text-slate-400 font-bold border-r bg-slate-50/50">
                            #{item.colIndex}
                          </td>
                          <td className="p-3 font-extrabold text-slate-900 border-r">
                            {item.headerName}
                          </td>
                          <td className="p-3 border-r">
                            <span className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider inline-block",
                              item.inferredType.includes("Numeric")
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            )}>
                              {item.inferredType}
                            </span>
                          </td>
                          <td className="p-3 border-r">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span>{item.nonBlankCount.toLocaleString()} / {rawData.length.toLocaleString()}</span>
                                <span className="text-[#1E3A8A] font-extrabold">{item.fillPercentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="bg-emerald-500 h-full rounded-full" 
                                  style={{ width: `${item.fillPercentage}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 border-r text-slate-600 truncate max-w-[220px]" title={item.sampleVal}>
                            {item.sampleVal}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleHeader(item.headerName)}
                              className={cn(
                                "px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border",
                                isIncluded 
                                  ? "bg-emerald-600 text-white border-emerald-600" 
                                  : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                              )}
                            >
                              {isIncluded ? "Included ✓" : "+ Include"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
                <span>Showing {filteredCatalogList.length} of {allHeaders.length} Column Headers</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Green Fill = High Populated Column</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Numeric = Numbers Detected</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PIVOT CONFIGURATION PANEL (HEADER & COLUMN SELECTOR) */}
      {rawData.length > 0 && (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-[#1E3A8A]" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                1. Pivot Settings & Column Header Selection
              </h3>
            </div>
            <span className="text-[11px] font-bold text-slate-500">
              Customize worksheet, row grouping, metric aggregation, and summary columns
            </span>
          </div>

          {/* ACTIVE EXCEL WORKSHEET SELECTOR BAR */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                  Active Excel Worksheet / Dataset
                </span>
                <span className="text-sm font-black text-white">
                  {currentSheetName ? `Sheet: ${currentSheetName}` : (fileName || "Default System Data")}
                </span>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {rawData.length.toLocaleString()} rows • {allHeaders.length} columns detected
                </span>
              </div>
            </div>

            {availableSheets.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider mr-1">
                  Switch Sheet:
                </span>
                {availableSheets.map((sh) => {
                  const isActive = sh.name === currentSheetName;
                  return (
                    <button
                      key={sh.name}
                      type="button"
                      onClick={() => handleSwitchSheet(sh.name)}
                      className={cn(
                        "px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 border",
                        isActive
                          ? "bg-emerald-400 text-slate-950 border-emerald-300 shadow-md scale-105"
                          : "bg-white/10 hover:bg-white/20 text-slate-200 border-white/20"
                      )}
                    >
                      <FileSpreadsheet className={cn("w-3.5 h-3.5", isActive ? "text-slate-950" : "text-emerald-400")} />
                      <span>{sh.name}</span>
                      <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-extrabold", isActive ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-slate-300")}>
                        {sh.rowCount.toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-[11px] text-slate-300 font-medium bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-300" />
                <span>
                  {availableSheets.length === 1 
                    ? `Single Worksheet ("${availableSheets[0]?.name || "Sheet1"}") detected in Excel file.` 
                    : "Single Dataset / CSV file loaded. Upload a multi-sheet Excel file (.xlsx) to see multiple sheet tabs."}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. PRIMARY ROW GROUPING COLUMN */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                <span>Primary Group (Pivot Rows)</span>
                <span className="text-rose-500 font-bold">*Required</span>
              </label>
              <select
                value={selectedGroupCol}
                onChange={(e) => setSelectedGroupCol(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-xs bg-slate-50 focus:bg-white focus:border-[#1E3A8A] outline-none transition-all cursor-pointer"
              >
                <option value="">-- Select Grouping Header --</option>
                {allHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 font-medium">
                Rows will be aggregated & categorized by unique values in this column.
              </p>
            </div>

            {/* 2. SECONDARY CROSS-TAB COLUMN (OPTIONAL) */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Secondary Group (Optional Cross-Tab)
              </label>
              <select
                value={selectedSubGroupCol}
                onChange={(e) => setSelectedSubGroupCol(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-xs bg-slate-50 focus:bg-white focus:border-[#1E3A8A] outline-none transition-all cursor-pointer"
              >
                <option value="">-- None (Single Grouping) --</option>
                {allHeaders.filter(h => h !== selectedGroupCol).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 font-medium">
                Creates secondary pivot columns for side-by-side comparative breakdown.
              </p>
            </div>

            {/* 3. METRIC COLUMN & AGGREGATION */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                Metric Calculation / Value
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={metricFunc}
                  onChange={(e) => setMetricFunc(e.target.value as any)}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-xs bg-slate-50 focus:bg-white focus:border-[#1E3A8A] outline-none cursor-pointer"
                >
                  <option value="COUNT">Count Records</option>
                  <option value="SUM">Sum Total</option>
                  <option value="AVG">Average</option>
                  <option value="MIN">Minimum</option>
                  <option value="MAX">Maximum</option>
                </select>

                <select
                  value={metricCol}
                  onChange={(e) => setMetricCol(e.target.value)}
                  disabled={metricFunc === "COUNT"}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-xs bg-slate-50 focus:bg-white focus:border-[#1E3A8A] outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="">-- Pick Value Column --</option>
                  {allHeaders.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Computes sum/average/counts for numerical values inside selected categories.
              </p>
            </div>
          </div>

          {/* CHECKBOX GRID FOR DISPLAY HEADERS */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                  Select Columns to Include in Summary Breakdown Table
                </label>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Check which specific headers you want visible when expanding row details or generating export tables.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Column search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    placeholder="Search headers..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold w-40 focus:w-52 transition-all outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSelectAllHeaders}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#1E3A8A] font-bold text-[10px] uppercase tracking-wider hover:bg-blue-100 transition-all border border-blue-200 cursor-pointer"
                >
                  Select All ({allHeaders.length})
                </button>

                <button
                  type="button"
                  onClick={handleClearAllHeaders}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* HEADER CHECKBOX CHIPS */}
            <div className="max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {filteredHeadersList.map((header) => {
                const isSelected = selectedHeaders.includes(header);
                return (
                  <button
                    key={header}
                    type="button"
                    onClick={() => toggleHeader(header)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[11px] font-bold transition-all text-left flex items-center justify-between gap-1.5 cursor-pointer border",
                      isSelected
                        ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100/80"
                    )}
                  >
                    <span className="truncate">{header}</span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
              <span>Selected Headers: <strong className="text-[#1E3A8A] font-black">{selectedHeaders.length} of {allHeaders.length}</strong></span>
              {selectedHeaders.length === 0 && (
                <span className="text-rose-600 font-extrabold">⚠️ Please check at least 1 column header to display in the report table.</span>
              )}
            </div>
          </div>

          {/* SEARCH FILTER BAR FOR RAW DATA */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                placeholder="Filter dataset records by keyword (e.g., CP102, SAN FERNANDO, SIGNED)..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:border-[#1E3A8A] outline-none transition-all"
              />
              {filterKeyword && (
                <button
                  type="button"
                  onClick={() => setFilterKeyword("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="text-xs font-extrabold text-slate-600 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-200">
              Matching Records: <strong className="text-[#1E3A8A]">{filteredRawData.length}</strong> / {rawData.length}
            </div>
          </div>
        </div>
      )}

      {/* GENERATED PIVOT SUMMARY REPORT OUTPUT */}
      {rawData.length > 0 && selectedGroupCol && (
        <div className="space-y-6">
          
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Records</span>
                <p className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                  {pivotSummary.totalRecords.toLocaleString()}
                </p>
                <span className="text-[10px] font-bold text-slate-500">In current filtered dataset</span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#1E3A8A] flex items-center justify-center font-black">
                <Table className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Unique Groups</span>
                <p className="text-2xl font-black text-[#1E3A8A] tracking-tight mt-0.5">
                  {pivotSummary.groups.length}
                </p>
                <span className="text-[10px] font-bold text-slate-500">Categorized by {selectedGroupCol}</span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Top Category Group</span>
                <p className="text-base font-black text-slate-900 tracking-tight mt-0.5 truncate max-w-[160px]">
                  {pivotSummary.groups[0]?.groupKey || "N/A"}
                </p>
                <span className="text-[10px] font-extrabold text-emerald-600">
                  {pivotSummary.groups[0]?.count || 0} records ({pivotSummary.groups[0]?.percent.toFixed(1)}%)
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {metricFunc} {metricCol ? metricCol : "Records"}
                </span>
                <p className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                  {metricFunc === "COUNT" || !metricCol
                    ? pivotSummary.totalRecords.toLocaleString()
                    : pivotSummary.overallMetricSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] font-bold text-slate-500">Aggregated metric output</span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center font-black">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* VIEW TOGGLE & EXPORT TOOLBAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveViewMode("pivot")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  activeViewMode === "pivot" ? "bg-[#1E3A8A] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Table className="w-3.5 h-3.5" />
                Pivot Table
              </button>

              <button
                type="button"
                onClick={() => setActiveViewMode("chart")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  activeViewMode === "chart" ? "bg-[#1E3A8A] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Visual Chart
              </button>

              <button
                type="button"
                onClick={() => setActiveViewMode("table")}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  activeViewMode === "table" ? "bg-[#1E3A8A] text-white shadow-2xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Raw Rows Data ({filteredRawData.length})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyClipboard}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSuccess ? "Copied!" : "Copy Pivot"}</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* VIEW 1: PIVOT TABLE BREAKDOWN */}
          {activeViewMode === "pivot" && (
            <div className="bg-white rounded-[2rem] border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <Table className="w-4 h-4 text-emerald-400" />
                    Pivot Summary Matrix ({selectedGroupCol})
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Categorized record counts, percentage shares, and metric aggregates. Click any row to expand records.
                  </p>
                </div>

                <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold border border-slate-700">
                  {pivotSummary.groups.length} Groups
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3.5 px-5 min-w-[220px]">{selectedGroupCol || "Group Header"}</th>
                      <th className="py-3.5 px-4 text-right w-28">Record Count</th>
                      <th className="py-3.5 px-4 text-center w-40">Proportion / Share</th>
                      {metricCol && metricFunc !== "COUNT" && (
                        <th className="py-3.5 px-4 text-right w-36">
                          {metricFunc} ({metricCol})
                        </th>
                      )}
                      {pivotSummary.subGroupKeys.map((sk) => (
                        <th key={sk} className="py-3.5 px-4 text-right w-28 bg-slate-200/50">
                          {selectedSubGroupCol}: {sk}
                        </th>
                      ))}
                      <th className="py-3.5 px-4 text-center w-24">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                    {pivotSummary.groups.map((group) => {
                      const isExpanded = expandedGroup === group.groupKey;
                      return (
                        <React.Fragment key={group.groupKey}>
                          <tr className={cn(
                            "hover:bg-blue-50/50 transition-colors cursor-pointer",
                            isExpanded && "bg-blue-50/80 font-bold"
                          )}>
                            <td 
                              onClick={() => setExpandedGroup(isExpanded ? null : group.groupKey)}
                              className="py-3.5 px-5 font-black text-slate-900 flex items-center gap-2"
                            >
                              <span className="w-2 h-2 rounded-full bg-[#1E3A8A]" />
                              {group.groupKey}
                            </td>

                            <td className="py-3.5 px-4 text-right font-bold">
                              {group.count.toLocaleString()}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-[#1E3A8A] h-full rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(100, group.percent)}%` }} 
                                  />
                                </div>
                                <span className="text-[10px] font-extrabold text-slate-600 w-11 text-right">
                                  {group.percent.toFixed(1)}%
                                </span>
                              </div>
                            </td>

                            {metricCol && metricFunc !== "COUNT" && (
                              <td className="py-3.5 px-4 text-right font-black text-[#1E3A8A]">
                                {group.metricVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                              </td>
                            )}

                            {pivotSummary.subGroupKeys.map((sk) => (
                              <td key={sk} className="py-3.5 px-4 text-right font-semibold text-slate-700 bg-slate-50/50">
                                {group.subBreakdown[sk] ? group.subBreakdown[sk].toLocaleString() : "-"}
                              </td>
                            ))}

                            <td className="py-3.5 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedGroup(isExpanded ? null : group.groupKey)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#1E3A8A] hover:text-white text-slate-700 text-[10px] font-extrabold transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <span>{isExpanded ? "Hide" : "Rows"}</span>
                              </button>
                            </td>
                          </tr>

                          {/* EXPANDED DRILLDOWN ROWS FOR THIS GROUP */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={5 + pivotSummary.subGroupKeys.length} className="p-4 bg-slate-50/90 border-y border-blue-200">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-[#1E3A8A] flex items-center gap-2">
                                      <Eye className="w-3.5 h-3.5" />
                                      Detailed Records for Group: "{group.groupKey}" ({group.rows.length} Items)
                                    </h4>
                                    <span className="text-[10px] font-bold text-slate-500">
                                      Showing selected headers: {selectedHeaders.join(", ") || "All Headers"}
                                    </span>
                                  </div>

                                  <div className="max-h-64 overflow-auto border border-slate-200 rounded-xl bg-white shadow-inner">
                                    <table className="w-full text-left border-collapse text-[11px]">
                                      <thead>
                                        <tr className="bg-slate-200/80 text-slate-800 font-extrabold uppercase tracking-wider sticky top-0 z-10">
                                          <th className="p-2 border-b w-10 text-center">#</th>
                                          {(selectedHeaders.length > 0 ? selectedHeaders : allHeaders).map((h) => (
                                            <th key={h} className="p-2 border-b whitespace-nowrap">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {group.rows.map((rowItem, rIdx) => (
                                          <tr key={rIdx} className="hover:bg-amber-50/50">
                                            <td className="p-2 text-center text-slate-400 font-bold">{rIdx + 1}</td>
                                            {(selectedHeaders.length > 0 ? selectedHeaders : allHeaders).map((h) => (
                                              <td key={h} className="p-2 whitespace-nowrap">
                                                {String(rowItem[h] ?? "-")}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>

                  {/* GRAND TOTAL FOOTER */}
                  <tfoot>
                    <tr className="bg-slate-900 text-white font-black text-xs uppercase border-t-2 border-slate-700">
                      <td className="py-4 px-5">GRAND TOTAL SUMMARY</td>
                      <td className="py-4 px-4 text-right text-emerald-400 text-sm">
                        {pivotSummary.totalRecords.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-center">100.0% Total</td>
                      {metricCol && metricFunc !== "COUNT" && (
                        <td className="py-4 px-4 text-right text-amber-300 text-sm">
                          {pivotSummary.overallMetricSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                      )}
                      {pivotSummary.subGroupKeys.map((sk) => {
                        const skTotal = pivotSummary.groups.reduce((sum, g) => sum + (g.subBreakdown[sk] || 0), 0);
                        return (
                          <td key={sk} className="py-4 px-4 text-right text-slate-300">
                            {skTotal.toLocaleString()}
                          </td>
                        );
                      })}
                      <td className="py-4 px-4 text-center">-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: VISUAL CHART BREAKDOWN */}
          {activeViewMode === "chart" && (
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#1E3A8A]" />
                    Visual Group Distribution ({selectedGroupCol})
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Top categories distribution breakdown.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChartType("bar")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                      chartType === "bar" ? "bg-[#1E3A8A] text-white" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    Bar Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType("pie")}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                      chartType === "pie" ? "bg-[#1E3A8A] text-white" : "bg-slate-100 text-slate-600"
                    )}
                  >
                    Pie Chart
                  </button>
                </div>
              </div>

              <div className="h-80 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        angle={-30} 
                        textAnchor="end" 
                        interval={0} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: "#475569" }} 
                      />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: "#475569" }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: "12px", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Bar dataKey="Records" fill="#1E3A8A" radius={[8, 8, 0, 0]}>
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <RePieChart>
                      <Pie
                        data={chartData}
                        dataKey="Records"
                        nameKey="fullName"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#1E3A8A"
                        label={({ fullName, percent }) => `${fullName.slice(0, 12)}... (${(percent * 100).toFixed(0)}%)`}
                      >
                        {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "11px", fontWeight: "bold" }} />
                    </RePieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* VIEW 3: RAW ROWS DATA TABLE WITH EXACT DIMENSIONS & CUSTOM HEADERS */}
          {activeViewMode === "table" && (
            <div className="bg-white rounded-[2rem] border border-slate-200/90 shadow-sm overflow-hidden space-y-4">
              <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-sky-400" />
                    Exact Dataset Records & Column Header Table View
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Displaying <strong className="text-white">{filteredRawData.length.toLocaleString()}</strong> records matching filter out of <strong className="text-white">{rawData.length.toLocaleString()}</strong> total data rows.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 text-emerald-300 border border-white/15">
                    Data Rows: {rawData.length.toLocaleString()}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 text-sky-300 border border-white/15">
                    Columns: {allHeaders.length}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 text-amber-300 border border-white/15">
                    Total Lines: {(rawData.length + 1).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[520px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-800 font-black uppercase tracking-wider border-b border-slate-200 z-10">
                    <tr>
                      <th className="p-3 w-14 text-center border-r bg-slate-200/80">Row #</th>
                      {(selectedHeaders.length > 0 ? selectedHeaders : allHeaders).map((h) => {
                        const hIdx = allHeaders.indexOf(h);
                        return (
                          <th key={h} className="p-3 border-r whitespace-nowrap bg-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-black text-slate-400 bg-slate-200/80 px-1.5 py-0.5 rounded">
                                Col {hIdx >= 0 ? hIdx + 1 : "?"}
                              </span>
                              <span>{h}</span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredRawData.slice(0, 250).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-blue-50/40 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold border-r bg-slate-50/50">{rIdx + 1}</td>
                        {(selectedHeaders.length > 0 ? selectedHeaders : allHeaders).map((h) => (
                          <td key={h} className="p-3 border-r whitespace-nowrap">
                            {String(row[h] ?? "-")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRawData.length > 250 && (
                <div className="p-3 text-center bg-slate-50 border-t border-slate-200 text-slate-500 font-bold text-xs flex items-center justify-between px-6">
                  <span>Showing preview of first 250 rows</span>
                  <span>Export to Excel/CSV to get all <strong>{filteredRawData.length.toLocaleString()}</strong> rows and <strong>{allHeaders.length}</strong> columns.</span>
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default CustomReportGenerator;
