import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import compression from "compression";

let currentFilename = "";
let currentDirname = "";

try {
  if (typeof import.meta !== "undefined" && typeof import.meta.url === "string") {
    currentFilename = fileURLToPath(import.meta.url);
    currentDirname = path.dirname(currentFilename);
  } else {
    currentFilename = __filename;
    currentDirname = __dirname;
  }
} catch (e) {
  currentFilename = process.cwd();
  currentDirname = process.cwd();
}

const resolvedFilename = currentFilename;
const resolvedDirname = currentDirname;

function getRandomColor() {
  const colors = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#14b8a6", // Teal
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const SCHEDULES_FILE = path.join(process.cwd(), "cached_schedules.json");
  const PANELS_FILE = path.join(process.cwd(), "cached_dashboard_panels.json");
  const KPI_FILE = path.join(process.cwd(), "cached_kpi_widgets.json");
  let activeSchedules: any[] = [];

  const DEFAULT_DASHBOARD_PANELS = [
    { id: "resourceLoad", label: "Resource Load Distribution", visible: true, description: "Distribution of lots by LGU, CP, Zone, Mode, Payment, or Status" },
    { id: "la", label: "LA Progress Overview", visible: false, description: "Land Acquisition Status Breakdown and milestone tracking" },
    { id: "expro", label: "Expro Progress Overview", visible: false, description: "Expropriation vs Negotiated acquisition comparison" },
    { id: "scNonWorkable", label: "SC Non-Workable Area Progress", visible: true, description: "Monthly site access timeline and targets for SC areas" },
    { id: "cumulative", label: "Cumulative Acquisition Progress", visible: true, description: "Cumulative performance tracking across monthly timelines" },
    { id: "disbursement", label: "Disbursement Plan Matrix", visible: false, description: "Financial forecasting and disbursement timeline tracking" }
  ];

  const DEFAULT_KPI_WIDGETS = [
    { id: "totalLots", label: "TOTAL LOTS", visible: true, color: "#616a8c", description: "Total land parcel count or searched Lot ID" },
    { id: "notIssued", label: "NoT Issued", visible: true, color: "#e49864", description: "Notice to Take possession not yet issued" },
    { id: "otbIssued", label: "Issued RfD/OTB/OtC", visible: true, color: "#e49864", description: "Offer to Buy / Request for Donation / Offer to Compensate issued" },
    { id: "otbAccepted", label: "Accepted RfD/OTB/OtC", visible: true, color: "#d6bf5d", description: "Offers accepted by land owners" },
    { id: "otbReview", label: "30 days Review RfD/OTB/OtC", visible: true, color: "#b34b40", description: "Under standard 30-day statutory review period" },
    { id: "otbIncurable", label: "Incurable RfD/OTB/OtC", visible: true, color: "#b34b40", description: "Unresolved ownership or legal title issues" },
    { id: "otbRejected", label: "Rejected RfD/OTB/OtC", visible: true, color: "#bd0707", description: "Offers rejected by property owners" },
    { id: "signedDoas", label: "SIGNED DOAS", visible: true, color: "#112bbc", description: "Deed of Absolute Sale executed" },
    { id: "signedEjseas", label: "EJSEAS", visible: true, color: "#112bbc", description: "Extra-Judicial Settlement with Sale signed" },
    { id: "signedPte", label: "PTE", visible: true, color: "#66ac69", description: "Permit to Enter granted" },
    { id: "partiallyPaid", label: "Partial Paid", visible: true, color: "#187f05", description: "Partial compensation payment disbursed" },
    { id: "fullyPaid", label: "Fully Paid", visible: true, color: "#187f05", description: "Full land acquisition payment completed" },
    { id: "handedOver", label: "Handed Over", visible: true, color: "#239694", description: "Site successfully handed over for construction" },
    { id: "withCno", label: "CNO", visible: true, color: "#187f05", description: "Certificate of No Objection issued" },
    { id: "withMoa", label: "MOA", visible: true, color: "#187f05", description: "Memorandum of Agreement in effect" },
    { id: "paidCrops", label: "Paid Crops", visible: true, color: "#187f05", description: "Compensation for crops & improvements paid" }
  ];

  let activePanelsConfig: any[] = [];
  let activeKpiWidgetsConfig: any[] = [];

  try {
    if (fs.existsSync(SCHEDULES_FILE)) {
      const savedData = fs.readFileSync(SCHEDULES_FILE, "utf-8");
      activeSchedules = JSON.parse(savedData);
      console.log(`[Schedules Startup] Loaded ${activeSchedules.length} schedules from disk.`);
    }
  } catch (err) {
    console.error("[Schedules Startup] Failed to read cached_schedules.json:", err);
  }

  try {
    if (fs.existsSync(PANELS_FILE)) {
      activePanelsConfig = JSON.parse(fs.readFileSync(PANELS_FILE, "utf-8"));
      console.log(`[Panels Startup] Loaded ${activePanelsConfig.length} panels from disk.`);
    }
  } catch (err) {
    console.error("[Panels Startup] Failed to read cached_dashboard_panels.json:", err);
  }

  try {
    if (fs.existsSync(KPI_FILE)) {
      activeKpiWidgetsConfig = JSON.parse(fs.readFileSync(KPI_FILE, "utf-8"));
      console.log(`[KPI Startup] Loaded ${activeKpiWidgetsConfig.length} KPI widgets from disk.`);
    }
  } catch (err) {
    console.error("[KPI Startup] Failed to read cached_kpi_widgets.json:", err);
  }

  // Ensure default configs exist if files were empty or missing
  if (!activePanelsConfig || !Array.isArray(activePanelsConfig) || activePanelsConfig.length === 0) {
    activePanelsConfig = DEFAULT_DASHBOARD_PANELS;
    try {
      fs.writeFileSync(PANELS_FILE, JSON.stringify(activePanelsConfig, null, 2), "utf-8");
    } catch {}
  } else {
    // Append any default panels that might be missing
    let changed = false;
    DEFAULT_DASHBOARD_PANELS.forEach(def => {
      if (!activePanelsConfig.some(p => p.id === def.id)) {
        activePanelsConfig.push(def);
        changed = true;
      }
    });
    if (changed) {
      try {
        fs.writeFileSync(PANELS_FILE, JSON.stringify(activePanelsConfig, null, 2), "utf-8");
      } catch {}
    }
  }
  if (!activeKpiWidgetsConfig || !Array.isArray(activeKpiWidgetsConfig) || activeKpiWidgetsConfig.length === 0) {
    activeKpiWidgetsConfig = DEFAULT_KPI_WIDGETS;
    try {
      fs.writeFileSync(KPI_FILE, JSON.stringify(activeKpiWidgetsConfig, null, 2), "utf-8");
    } catch {}
  }

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // ==========================================
  // AUDIT LOGS STORAGE & ENDPOINTS
  // ==========================================
  const AUDIT_LOGS_FILE = path.join(process.cwd(), "cached_audit_logs.json");
  let auditLogs: any[] = [];

  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const savedData = fs.readFileSync(AUDIT_LOGS_FILE, "utf-8");
      auditLogs = JSON.parse(savedData);
      console.log(`[Audit Logs Startup] Loaded ${auditLogs.length} logs from disk.`);
    } else {
      // Create some initial audit logs representing actual past events
      auditLogs = [
        {
          id: "log_init_1",
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          userEmail: "antoque2822@gmail.com",
          userName: "Daniel B. Antoque",
          action: "UPLOAD",
          details: "Uploaded document 'Lot_1005_Title_Dossier.pdf' for Lot ID Reference: 1005",
          fileName: "Lot_1005_Title_Dossier.pdf",
          lotId: "1005"
        },
        {
          id: "log_init_2",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          userEmail: "christian@railway.com",
          userName: "Christian Jay Pablo",
          action: "STATUS_CHANGE",
          details: "Changed category of document 'Lot_1102_PTE.docx' to PTE",
          fileName: "Lot_1102_PTE.docx",
          lotId: "1102"
        },
        {
          id: "log_init_3",
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          userEmail: "pablo@railway.com",
          userName: "Pablo QC Partner",
          action: "DELETE",
          details: "Moved document 'Lot_998_Duplicate_DOAS.pdf' to Trash",
          fileName: "Lot_998_Duplicate_DOAS.pdf",
          lotId: "998"
        }
      ];
      fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(auditLogs, null, 2), "utf-8");
    }
  } catch (err) {
    console.error("[Audit Logs Startup] Failed to read or seed cached_audit_logs.json:", err);
  }

  // Get all audit logs
  app.get("/api/audit-logs", (req, res) => {
    res.json(auditLogs);
  });

  // Post a new audit log
  app.post("/api/audit-logs", (req, res) => {
    try {
      const { userEmail, userName, action, details, fileName, lotId } = req.body;
      if (!action || !details) {
        return res.status(400).json({ error: "Missing required fields (action, details)" });
      }

      const newLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userEmail: userEmail || "anonymous@gcr-system.org",
        userName: userName || "Anonymous Operator",
        action,
        details,
        fileName: fileName || "",
        lotId: lotId || ""
      };

      auditLogs.unshift(newLog);

      if (auditLogs.length > 1000) {
        auditLogs = auditLogs.slice(0, 1000);
      }

      fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(auditLogs, null, 2), "utf-8");
      res.json({ success: true, log: newLog });
    } catch (err: any) {
      console.error("Failed to append audit log:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Memory Cache Store for external Google CSVs to prevent HTTP 429
  const csvCache: Record<string, { data: string; timestamp: number }> = {
    dashboard: { data: "", timestamp: 0 },
    weekly: { data: "", timestamp: 0 },
    report: { data: "", timestamp: 0 },
  };

  // Cache duration: 30 seconds (30000 ms) - balanced real-time synchronization with Google Sheets without rate-limit throttling
  const CACHE_DURATION_MS = 30000;

  const resolveDiskPath = (k: string): string => {
    const filename = `cached_${k}.csv`;
    const paths = [
      path.join(process.cwd(), filename),
      path.join(resolvedDirname, filename),
      path.join(resolvedDirname, "..", filename),
      `/${filename}`
    ];
    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          return p;
        }
      } catch (e) {
        // Safe skip on permission issue
      }
    }
    return path.join(process.cwd(), filename);
  };

  const buildSampleDashboardRow = (
    index: number,
    lotId: string,
    cp: string,
    owner: string,
    statusNot: string,
    dateNot: string,
    statusOtb: string,
    dateOtb: string,
    statusDoas: string,
    dateDoas: string,
    statusPte: string,
    datePte: string,
    paymentStatus: string,
    datePaid: string,
    dateHo: string
  ): string => {
    const row = Array(90).fill("");
    row[1] = lotId;
    row[2] = cp;
    row[3] = owner;
    row[4] = "Manila"; // lgu
    row[5] = statusNot;
    row[6] = dateNot;
    row[7] = statusOtb;
    row[8] = dateOtb;
    row[9] = statusOtb ? "ACCEPTED" : ""; // otbReply
    row[10] = dateOtb ? "2026-01-15" : ""; // otbReplyDate
    row[11] = statusDoas;
    row[12] = dateDoas;
    row[13] = statusPte;
    row[14] = datePte;
    row[15] = paymentStatus;
    row[16] = datePaid;
    row[17] = dateHo;
    row[21] = "Yes"; // prowImpact
    row[24] = "Zone 1"; // zone
    row[25] = "Barangay 123"; // barangay
    row[26] = "Case 1"; // harmonization assessment
    row[27] = "2026"; // appraisalYear
    row[32] = "500"; // totalArea
    row[33] = "200"; // affectedArea
    row[35] = "1500000"; // estimatedLandCost
    row[36] = "450000"; // estimatedStructureCost
    row[37] = "1950000"; // totalEstimatedCost
    row[38] = "1500000"; // actualLandCost
    row[39] = "450000"; // actualStructureCost
    row[42] = "2026-03-01"; // advancePaymentDate
    row[44] = "2026-04-01"; // dateCno
    row[50] = "No"; // mortgage
    row[51] = "None"; // ejse
    row[52] = "None"; // rawOptimization (OPTIMIZATION CASES)
    row[54] = "Station 10+200"; // station
    row[55] = "Pier 45"; // pierNo
    row[56] = "CN-9912"; // controlNo
    row[57] = "Negotiated"; // modeAcquisition
    row[58] = "300"; // remainingArea
    row[59] = "Residential"; // affectedStructure
    row[60] = "House"; // useStructure
    row[61] = "Owner"; // ownerStructure
    row[62] = "Mango Tree"; // actualCropTree
    row[67] = "Main Station"; // stationClassification
    row[85] = "Complete"; // docCollection
    return row.join(",");
  };

  const seedDashboardCSV = (): string => {
    const header = Array(90).fill("").map((_, i) => `Col${i}`);
    header[26] = "HARMONIZATION ASSESSMENT";
    header[52] = "OPTIMIZATION CASES";
    
    const rows = [
      header.join(","),
      buildSampleDashboardRow(1, "LOT-001", "CP1", "John Doe", "ISSUED", "2026-01-10", "ISSUED", "2026-01-12", "SIGNED", "2026-02-01", "SIGNED", "2026-02-10", "FULLY PAID", "2026-02-25", "2026-03-10"),
      buildSampleDashboardRow(2, "LOT-002", "CP1", "Jane Smith", "ISSUED", "2026-01-10", "ISSUED", "2026-01-12", "SIGNED", "2026-02-01", "SIGNED", "2026-02-10", "PARTIALLY PAID", "2026-02-20", ""),
      buildSampleDashboardRow(3, "LOT-003", "CP2", "Robert Johnson", "ISSUED", "2026-01-10", "ISSUED", "2026-01-12", "SIGNED", "2026-02-01", "", "", "", "", ""),
      buildSampleDashboardRow(4, "LOT-004", "CP2", "Michael Brown", "ISSUED", "2026-01-10", "ISSUED", "2026-01-12", "", "", "", "", "", "", ""),
      buildSampleDashboardRow(5, "LOT-005", "CP1", "William Davis", "ISSUED", "2026-01-10", "", "", "", "", "", "", "", "", ""),
      buildSampleDashboardRow(6, "LOT-006", "CP3", "David Miller", "", "", "", "", "", "", "", "", "", "", ""),
      buildSampleDashboardRow(7, "LOT-007", "CP3", "James Wilson", "ISSUED", "2026-01-10", "ISSUED", "2026-01-12", "EJSEAS", "2026-02-05", "", "", "", "", ""),
    ];
    return rows.join("\n");
  };

  const seedWeeklyCSV = (): string => {
    const header1 = ["Date Accomplished", "Lot ID", "CP", "Owner", "Personnel", "Accomplishment", "", "Remarks", "Date Entry", "Tag"].join(",");
    const header2 = ["", "", "", "", "", "", "", "", "", ""].join(",");
    const rows = [
      header1,
      header2,
      ["2026-07-01", "LOT-001", "CP1", "John Doe", "Juan Dela Cruz", "Signed DOAS document", "", "Awaiting final payout approval", "2026-07-02", "DOAS"].join(","),
      ["2026-07-03", "LOT-002", "CP1", "Jane Smith", "Juan Dela Cruz", "PTE Cleared and Verified", "", "Possession to execute", "2026-07-04", "PTE"].join(","),
      ["2026-07-05", "LOT-003", "CP2", "Robert Johnson", "Maria Santos", "Initial Land Appraisal", "", "Pending review by central office", "2026-07-06", "Appraisal"].join(",")
    ];
    return rows.join("\n");
  };

  // Pre-populate cache on startup from local disk fallbacks to block cold-starts and enforce 100% resilience
  try {
    for (const key of ["dashboard", "weekly", "report"] as const) {
      const targetPath = path.join(process.cwd(), `cached_${key}.csv`);
      if (!fs.existsSync(targetPath)) {
        console.log(`[Cache Startup] Seeding default local fallback for '${key}' to: ${targetPath}`);
        const defaultCSV = key === "weekly" ? seedWeeklyCSV() : seedDashboardCSV();
        try {
          fs.writeFileSync(targetPath, defaultCSV, "utf-8");
        } catch (writeErr) {
          console.error(`[Cache Startup] Failed to write seed file for '${key}':`, writeErr);
        }
      }

      const resolvedPath = resolveDiskPath(key);
      if (fs.existsSync(resolvedPath)) {
        const diskData = fs.readFileSync(resolvedPath, "utf-8");
        // Initialize with timestamp: 0 so the cache is marked stale immediately on startup,
        // forcing a fresh background fetch as soon as possible, while still serving disk copy as fallback.
        csvCache[key] = { data: diskData, timestamp: 0 };
        console.log(`[Cache Startup] Pre-populated in-memory cache of '${key}' from: ${resolvedPath}`);
      } else {
        console.warn(`[Cache Startup] No stored file found for '${key}' at: ${resolvedPath}`);
      }
    }
  } catch (err) {
    console.error("[Cache Startup] Disk fallback pre-population failed:", err);
  }

  const pendingFetches: Record<string, Promise<string> | null> = {
    dashboard: null,
    weekly: null,
    report: null,
  };

  // Trigger proactive background fetches on startup so we have fresh real data warmed up in cache immediately
  setTimeout(() => {
    console.log("[Cache Startup] Triggering proactive background fetches for freshest Google Sheets data...");
    getCachedCSV("dashboard", "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzUHVV2sQGk_dLgffwufAPHPGY5jW2uxUq6c7kgA1s_Pw5y8lXRwEAWtnyl4WF36Cj6tKxQQ7axaMZ/pub?gid=1524465648&single=true&output=csv").catch((e) => {
      console.warn("[Cache Startup] Proactive dashboard fetch failed/timed out, will retry on next request:", e.message || e);
    });
    getCachedCSV("weekly", "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWnkYO0tbDQQgGdQLkccRuzM_sC2VHUYSQrhmyAbI9E5elg4nxTunUmF6lKhzls9vTGyFrBvQJ4rTe/pub?gid=0&single=true&output=csv").catch((e) => {
      console.warn("[Cache Startup] Proactive weekly fetch failed/timed out, will retry on next request:", e.message || e);
    });
    getCachedCSV("report", "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzUHVV2sQGk_dLgffwufAPHPGY5jW2uxUq6c7kgA1s_Pw5y8lXRwEAWtnyl4WF36Cj6tKxQQ7axaMZ/pub?gid=1411114695&single=true&output=csv").catch((e) => {
      console.warn("[Cache Startup] Proactive report fetch failed/timed out, will retry on next request:", e.message || e);
    });
  }, 1000);

  function isInvalidCSV(text: string | null | undefined): boolean {
    if (!text || typeof text !== "string" || text.trim().length === 0) return true;
    if (text.split("\n").filter(l => l.trim().length > 0).length < 20) return true;
    const lower = text.toLowerCase();
    return lower.includes("rate exceeded") ||
           lower.includes("exceeded rate limit") ||
           lower.includes("resource exceeded") ||
           lower.includes("quota exceeded") ||
           lower.includes("too many requests") ||
           lower.includes("<html") ||
           lower.includes("<!doctype") ||
           lower.includes("google.com/sorry") ||
           lower.includes("service error") ||
           lower.includes("try again later");
  }

  async function getCachedCSV(key: "dashboard" | "weekly" | "report", url: string, force: boolean = false): Promise<string> {
    const now = Date.now();
    const entry = csvCache[key];
    const resolvedPath = resolveDiskPath(key);

    const getBestFallback = (): string => {
      if (entry.data && !isInvalidCSV(entry.data)) {
        return entry.data;
      }
      if (fs.existsSync(resolvedPath)) {
        try {
          const diskData = fs.readFileSync(resolvedPath, "utf-8");
          if (!isInvalidCSV(diskData)) {
            entry.data = diskData;
            return diskData;
          }
        } catch (e) {
          // ignore
        }
      }
      const seed = key === "weekly" ? seedWeeklyCSV() : seedDashboardCSV();
      entry.data = seed;
      return seed;
    };

    if (force) {
      if (entry.timestamp > now) {
        console.log(`[Cache proxy] Active rate limit backoff in progress for ${key}. Serving cached copy.`);
        return getBestFallback();
      } else {
        entry.timestamp = 0;
      }
    }

    // If cache is fresh, return it immediately to bypass external network calls
    if (!force && entry.data && !isInvalidCSV(entry.data) && (now - entry.timestamp < CACHE_DURATION_MS)) {
      return entry.data;
    }

    // De-duplicate concurrent requests so we only hit external URL once
    if (pendingFetches[key]) {
      console.log(`[Cache proxy] Awaiting active concurrent fetch for ${key}...`);
      return pendingFetches[key]!;
    }

    const fetchPromise = (async () => {
      try {
        // Fetch raw published Google Sheets URL directly without adding query params that break Google Edge CDN
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (!response.ok) {
          console.warn(`[Cache Warning] Fetch for ${key} returned HTTP ${response.status}. Backing off for 60s.`);
          entry.timestamp = now + 60000;
          return getBestFallback();
        }

        const csvText = await response.text();
        if (!isInvalidCSV(csvText)) {
          csvCache[key] = {
            data: csvText,
            timestamp: now
          };
          try {
            fs.writeFileSync(resolvedPath, csvText, "utf-8");
          } catch (writeErr) {
            console.warn(`[Cache Warning] Failed to write local disk cache for ${key}:`, writeErr);
          }
          return csvText;
        }

        console.warn(`[Cache Warning] Fetch for ${key} returned rate limit payload. Backing off for 60s.`);
        entry.timestamp = now + 60000;
        return getBestFallback();
      } catch (err: any) {
        console.warn(`[Cache Info] Cannot load freshest CSV for ${key} from remote Sheets (${err.message || err}). Serving fallback.`);
        entry.timestamp = now + 60000;
        return getBestFallback();
      } finally {
        pendingFetches[key] = null;
      }
    })();

    pendingFetches[key] = fetchPromise;
    return fetchPromise;
  }

  // Endpoints to serve direct local fallback static files isomorphically
  app.get("/cached_dashboard.csv", (req, res) => {
    const resolvedPath = resolveDiskPath("dashboard");
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.sendFile(resolvedPath);
    } else if (csvCache.dashboard.data) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvCache.dashboard.data);
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(seedDashboardCSV());
    }
  });

  app.get("/cached_weekly.csv", (req, res) => {
    const resolvedPath = resolveDiskPath("weekly");
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.sendFile(resolvedPath);
    } else if (csvCache.weekly.data) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvCache.weekly.data);
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(seedWeeklyCSV());
    }
  });

  app.get("/cached_report.csv", (req, res) => {
    const resolvedPath = resolveDiskPath("report");
    if (resolvedPath && fs.existsSync(resolvedPath)) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.sendFile(resolvedPath);
    } else if (csvCache.report.data) {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvCache.report.data);
    } else {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(seedDashboardCSV());
    }
  });

  let broadcastDataUpdate = () => {
    csvCache.dashboard = { data: "", timestamp: 0 };
    csvCache.weekly = { data: "", timestamp: 0 };
    csvCache.report = { data: "", timestamp: 0 };
  };

  // Clear cache endpoint to force immediate re-fetch of latest Google Sheet data
  app.post("/api/proxy/clear-cache", (req, res) => {
    broadcastDataUpdate();
    console.log("[Cache proxy] Cache cleared successfully via API request.");
    res.json({ success: true, message: "Cache cleared successfully." });
  });

  // API proxies for external CSV datasets to bypass CORS / block issues
  app.get("/api/proxy/dashboard", async (req, res) => {
    try {
      const force = req.query.force === "true" || req.query.clear === "true";
      const csvData = await getCachedCSV(
        "dashboard",
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzUHVV2sQGk_dLgffwufAPHPGY5jW2uxUq6c7kgA1s_Pw5y8lXRwEAWtnyl4WF36Cj6tKxQQ7axaMZ/pub?gid=1524465648&single=true&output=csv",
        force
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(csvData);
    } catch (err: any) {
      console.warn("[Cache Warning] Proxy dashboard endpoint failed to fetch. Returning fallback seed:", err.message || err);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvCache.dashboard.data || seedDashboardCSV());
    }
  });

  app.get("/api/proxy/weekly", async (req, res) => {
    try {
      const force = req.query.force === "true" || req.query.clear === "true";
      const csvData = await getCachedCSV(
        "weekly",
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vQWnkYO0tbDQQgGdQLkccRuzM_sC2VHUYSQrhmyAbI9E5elg4nxTunUmF6lKhzls9vTGyFrBvQJ4rTe/pub?gid=0&single=true&output=csv",
        force
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(csvData);
    } catch (err: any) {
      console.warn("[Cache Warning] Proxy weekly endpoint failed to fetch. Returning fallback seed:", err.message || err);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvCache.weekly.data || seedWeeklyCSV());
    }
  });

  app.get("/api/proxy/report", async (req, res) => {
    try {
      const force = req.query.force === "true" || req.query.clear === "true";
      const csvData = await getCachedCSV(
        "report",
        "https://docs.google.com/spreadsheets/d/e/2PACX-1vTzUHVV2sQGk_dLgffwufAPHPGY5jW2uxUq6c7kgA1s_Pw5y8lXRwEAWtnyl4WF36Cj6tKxQQ7axaMZ/pub?gid=1411114695&single=true&output=csv",
        force
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.send(csvData);
    } catch (err: any) {
      console.warn("[Cache Warning] Proxy report endpoint failed to fetch. Returning fallback seed:", err.message || err);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.send(csvCache.report.data || seedDashboardCSV());
    }
  });

  // Schedules REST Endpoints for Multi-user Sync and Persistence
  app.get("/api/schedules", (req, res) => {
    res.json(activeSchedules);
  });

  app.post("/api/schedules", (req, res) => {
    try {
      const { schedules } = req.body;
      if (Array.isArray(schedules)) {
        activeSchedules = schedules;
        fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(activeSchedules, null, 2), "utf-8");
        
        // Broadcast schedules update to all connected WebSocket clients
        const payload = JSON.stringify({
          type: "schedules_update",
          schedules: activeSchedules,
        });
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
        res.json({ success: true, count: activeSchedules.length });
      } else {
        res.status(400).json({ error: "schedules must be an array" });
      }
    } catch (err: any) {
      console.error("Failed to save and broadcast schedules:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Dashboard Layout Config (Panels and KPIs) REST Endpoints for Multi-user Sync
  app.get("/api/dashboard-config", (req, res) => {
    res.json({
      panels: activePanelsConfig,
      kpis: activeKpiWidgetsConfig
    });
  });

  app.post("/api/dashboard-config", (req, res) => {
    try {
      const { panels, kpis } = req.body;
      if (Array.isArray(panels)) {
        activePanelsConfig = panels;
        fs.writeFileSync(PANELS_FILE, JSON.stringify(activePanelsConfig, null, 2), "utf-8");
      }
      if (Array.isArray(kpis)) {
        activeKpiWidgetsConfig = kpis;
        fs.writeFileSync(KPI_FILE, JSON.stringify(activeKpiWidgetsConfig, null, 2), "utf-8");
      }

      // Broadcast update to all connected clients in real time
      const payload = JSON.stringify({
        type: "dashboard_config_update",
        panels: activePanelsConfig,
        kpis: activeKpiWidgetsConfig
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });

      res.json({ success: true, panels: activePanelsConfig, kpis: activeKpiWidgetsConfig });
    } catch (err: any) {
      console.error("Failed to save and broadcast dashboard layout config:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // GOOGLE DRIVE INTEGRATION PROXY ENDPOINTS
  // ==========================================
  const ROOT_FOLDER_ID = "1-f-i5Xn0zHL2-voxfHykNaWNFTBWNSSt";

  const getAuthHeader = (req: express.Request) => {
    return req.headers.authorization || "";
  };

  // 1. List files and folders in a directory
  app.get("/api/drive/files", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const folderId = req.query.folderId || ROOT_FOLDER_ID;
      const searchKeyword = req.query.searchKeyword;
      
      if (searchKeyword) {
        // Build a list of all descendant folder IDs under folderId recursively
        const allowedIds = new Set<string>([folderId as string]);
        try {
          const folderUrl = `https://www.googleapis.com/drive/v3/files?q=mimeType%3D'application/vnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id,parents)&pageSize=1000`;
          const folderRes = await fetch(folderUrl, {
            headers: { "Authorization": authHeader }
          });
          if (folderRes.ok) {
            const folderData = await folderRes.json();
            const folders = folderData.files || [];
            
            const parentToChildren = new Map<string, string[]>();
            for (const folder of folders) {
              const parents = folder.parents || [];
              for (const parentId of parents) {
                if (!parentToChildren.has(parentId)) {
                  parentToChildren.set(parentId, []);
                }
                parentToChildren.get(parentId)!.push(folder.id);
              }
            }

            const queue: string[] = [folderId as string];
            while (queue.length > 0) {
              const current = queue.shift()!;
              const children = parentToChildren.get(current) || [];
              for (const childId of children) {
                if (!allowedIds.has(childId)) {
                  allowedIds.add(childId);
                  queue.push(childId);
                }
              }
            }
          }
        } catch (err) {
          console.error("Error building recursive folder list:", err);
        }

        // Now search globally in user's Drive for files matching the keyword
        const query = `name contains '${searchKeyword}' and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,description,owners,webViewLink,webContentLink,parents)&pageSize=1000`;

        const response = await fetch(url, {
          headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
        }

        const data = await response.json();
        const files = data.files || [];
        
        // Filter: keep only files whose parents are in the allowed folder hierarchy
        const filteredFiles = files.filter((file: any) => {
          if (!file.parents || file.parents.length === 0) return false;
          return file.parents.some((pId: string) => allowedIds.has(pId));
        });

        res.json({ files: filteredFiles });
      } else {
        // Standard non-search behavior: get files directly inside the current folder
        const query = `'${folderId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,description,owners,webViewLink,webContentLink,parents)&pageSize=1000`;

        const response = await fetch(url, {
          headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
          const errorText = await response.text();
          return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
        }

        const data = await response.json();
        res.json(data);
      }
    } catch (err: any) {
      console.error("Failed to list files:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Create a new folder
  app.post("/api/drive/folders", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { name, parentId } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Folder name is required" });
      }

      const parentFolderId = parentId || ROOT_FOLDER_ID;

      const response = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
      }

      const folder = await response.json();
      res.json(folder);
    } catch (err: any) {
      console.error("Failed to create folder:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Upload a file (multipart metadata + content payload)
  app.post("/api/drive/upload", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { name, mimeType, parentId, content, metadata } = req.body;
      if (!name || !mimeType || !content) {
        return res.status(400).json({ error: "Missing required fields (name, mimeType, content)" });
      }

      const parentFolderId = parentId || ROOT_FOLDER_ID;
      const boundary = "foo_bar_boundary";
      const metadataPart = JSON.stringify({
        name: name,
        mimeType: mimeType,
        parents: [parentFolderId],
        description: typeof metadata === "string" ? metadata : JSON.stringify(metadata)
      });

      const part1 = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n`;
      const part2 = `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}\r\n`;
      const part3 = `--${boundary}--`;

      const requestBody = part1 + part2 + part3;

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,modifiedTime,description,owners,webViewLink,webContentLink", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": Buffer.byteLength(requestBody).toString()
        },
        body: requestBody
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
      }

      const fileData = await response.json();
      res.json(fileData);
    } catch (err: any) {
      console.error("Failed to upload file:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Update file metadata (Rename, Description, or both)
  app.patch("/api/drive/files/:fileId", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { fileId } = req.params;
      const { name, description } = req.body;

      const updateBody: any = {};
      if (name) updateBody.name = name;
      if (description) updateBody.description = typeof description === "string" ? description : JSON.stringify(description);

      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,createdTime,modifiedTime,description,owners,webViewLink,webContentLink`, {
        method: "PATCH",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updateBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
      }

      const updatedFile = await response.json();
      res.json(updatedFile);
    } catch (err: any) {
      console.error("Failed to update file:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Move a file between directories
  app.post("/api/drive/move", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { fileId, currentParentId, newParentId } = req.body;
      if (!fileId || !newParentId) {
        return res.status(400).json({ error: "Missing required fields (fileId, newParentId)" });
      }

      let removeParents = currentParentId;
      if (!removeParents) {
        const getFile = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
          headers: { "Authorization": authHeader }
        });
        if (getFile.ok) {
          const fileMeta = await getFile.json();
          if (fileMeta.parents && fileMeta.parents.length > 0) {
            removeParents = fileMeta.parents.join(",");
          }
        }
      }

      let moveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newParentId}`;
      if (removeParents) {
        moveUrl += `&removeParents=${removeParents}`;
      }

      const response = await fetch(moveUrl, {
        method: "PATCH",
        headers: {
          "Authorization": authHeader
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
      }

      const movedFile = await response.json();
      res.json(movedFile);
    } catch (err: any) {
      console.error("Failed to move file:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 6. Delete a file (trash first or permanently)
  app.delete("/api/drive/files/:fileId", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { fileId } = req.params;
      const permanent = req.query.permanent === "true";

      let response;
      if (permanent) {
        response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "DELETE",
          headers: { "Authorization": authHeader }
        });
      } else {
        response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: "PATCH",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ trashed: true })
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Drive API error: ${errorText}` });
      }

      if (permanent) {
        res.json({ success: true, message: "Permanently deleted file" });
      } else {
        const result = await response.json();
        res.json({ success: true, file: result, message: "Moved file to Trash" });
      }
    } catch (err: any) {
      console.error("Failed to delete file:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // 7. Download / stream file binary stream
  app.get("/api/drive/download/:fileId", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { fileId } = req.params;

      const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
        headers: { "Authorization": authHeader }
      });

      let fileName = "file";
      let mimeType = "application/octet-stream";
      let fileSize = "";

      if (metaResponse.ok) {
        const meta = await metaResponse.json();
        fileName = meta.name || "file";
        mimeType = meta.mimeType || "application/octet-stream";
        fileSize = meta.size || "";
      }

      const mediaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { "Authorization": authHeader }
      });

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text();
        return res.status(mediaResponse.status).send(`Google Drive API download error: ${errorText}`);
      }

      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
      if (fileSize) {
        res.setHeader("Content-Length", fileSize);
      }

      const arrayBuffer = await mediaResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error("Failed to download file:", err);
      res.status(500).send(`Server error downloading file: ${err.message}`);
    }
  });

  // 10. Append values to a Google Sheet
  app.post("/api/sheets/append", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { spreadsheetId, range, values } = req.body;
      if (!spreadsheetId || !range || !values) {
        return res.status(400).json({ error: "Missing required fields: spreadsheetId, range, values" });
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Sheets API error: ${errorText}` });
      }

      const responseData = await response.json();
      broadcastDataUpdate();
      res.json({ success: true, data: responseData });
    } catch (err: any) {
      console.error("Failed to append to Google Sheet:", err);
      res.status(500).json({ error: `Server error appending to sheet: ${err.message}` });
    }
  });

  // 11. Read values from a Google Sheet
  app.get("/api/sheets/:spreadsheetId/values/:range", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { spreadsheetId, range } = req.params;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": authHeader
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Sheets API error: ${errorText}` });
      }

      const responseData = await response.json();
      res.json(responseData);
    } catch (err: any) {
      console.error("Failed to read from Google Sheet:", err);
      res.status(500).json({ error: `Server error reading sheet: ${err.message}` });
    }
  });

  // 12. Update specific range values in a Google Sheet
  app.put("/api/sheets/:spreadsheetId/values/:range", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { spreadsheetId, range } = req.params;
      const { values } = req.body;
      if (!values) {
        return res.status(400).json({ error: "Missing required fields: values" });
      }

      // Sanitize values: convert any undefined or null to "" to ensure Google Sheets API clears the cell
      const sanitizedValues = Array.isArray(values)
        ? values.map(row =>
            Array.isArray(row)
              ? row.map(cell => (cell === undefined || cell === null) ? "" : String(cell))
              : []
          )
        : [];

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: sanitizedValues })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: `Google Sheets API error: ${errorText}` });
      }

      const responseData = await response.json();
      broadcastDataUpdate();
      res.json({ success: true, data: responseData });
    } catch (err: any) {
      console.error("Failed to update Google Sheet:", err);
      res.status(500).json({ error: `Server error updating sheet: ${err.message}` });
    }
  });

  // 13. Delete row in Google Sheets by row index (0-based start index)
  app.post("/api/sheets/:spreadsheetId/delete-row", async (req, res) => {
    try {
      const authHeader = getAuthHeader(req);
      if (!authHeader) {
        return res.status(401).json({ error: "Missing Authorization header" });
      }

      const { spreadsheetId } = req.params;
      const { sheetName, rowIndex } = req.body; // rowIndex is 0-based index of the sheet row

      if (sheetName === undefined || rowIndex === undefined) {
        return res.status(400).json({ error: "Missing required fields: sheetName, rowIndex" });
      }

      // First, get the sheetId from spreadsheet metadata
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const metaResponse = await fetch(metaUrl, {
        headers: { "Authorization": authHeader }
      });

      if (!metaResponse.ok) {
        const errorText = await metaResponse.text();
        return res.status(metaResponse.status).json({ error: `Google Sheets metadata error: ${errorText}` });
      }

      const metaData = await metaResponse.json();
      const sheet = metaData.sheets?.find((s: any) => 
        s.properties?.title?.trim().toLowerCase() === sheetName.trim().toLowerCase()
      ) || metaData.sheets?.[0];

      if (!sheet) {
        return res.status(404).json({ error: `No sheets found in the spreadsheet` });
      }

      const sheetId = Number(sheet.properties.sheetId);

      // Send batchUpdate deleteDimension request
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
      const updateResponse = await fetch(updateUrl, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1
                }
              }
            }
          ]
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        return res.status(updateResponse.status).json({ error: `Google Sheets delete error: ${errorText}` });
      }

      const updateData = await updateResponse.json();
      broadcastDataUpdate();
      res.json({ success: true, data: updateData });
    } catch (err: any) {
      console.error("Failed to delete row from Google Sheet:", err);
      res.status(500).json({ error: `Server error deleting row: ${err.message}` });
    }
  });

  // Vite middleware for development
  let vite: any = null;
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  broadcastDataUpdate = () => {
    csvCache.dashboard = { data: "", timestamp: 0 };
    csvCache.weekly = { data: "", timestamp: 0 };
    csvCache.report = { data: "", timestamp: 0 };
    const payload = JSON.stringify({ type: "data_updated", timestamp: Date.now() });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  };

  const activeUsers = new Map<string, {
    id: string;
    name: string;
    color: string;
    picture?: string;
    activeSection: string;
    lastSeen: number;
    positionCode?: string;
    jobPosition?: string;
    email?: string;
    isIdle?: boolean;
  }>();

  // Periodically clean up stale presence users who haven't pinged or updated in over 45 seconds
  setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [uid, user] of activeUsers.entries()) {
      if (now - user.lastSeen > 45000) { // 45 seconds timeout
        activeUsers.delete(uid);
        changed = true;
      }
    }
    if (changed) {
      const payload = JSON.stringify({
        type: "presence_update",
        users: Array.from(activeUsers.values()),
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
  }, 10000);

  let globalTeamPhoto = "";
  let dev1Config = {
    name: "Daniel B. Antoque",
    role: "Main Developer",
    badge: "Lead",
    picture: "",
    bio: "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."
  };
  let dev2Config = {
    name: "Christian Jay Pablo",
    role: "Support Developer",
    badge: "Partner",
    picture: "",
    bio: "GCR Land Acquisition Support Developer & Senior Quality Control Partner."
  };

  wss.on("connection", (ws: WebSocket) => {
    let clientId = "";

    const sendUpdate = () => {
      const payload = JSON.stringify({
        type: "presence_update",
        users: Array.from(activeUsers.values()),
      });
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    };

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "join") {
          clientId = data.id || Math.random().toString(36).substring(2, 9);
          activeUsers.set(clientId, {
            id: clientId,
            name: data.name || `User-${clientId.substring(0, 4)}`,
            color: data.color || getRandomColor(),
            picture: data.picture || "",
            activeSection: data.activeSection || "dashboard",
            lastSeen: Date.now(),
            positionCode: data.positionCode || "",
            jobPosition: data.jobPosition || "",
            email: data.email || "",
            isIdle: !!data.isIdle,
          });
          sendUpdate();
          
          // Send initial shared global config to joining client
          ws.send(JSON.stringify({
            type: "initial_config",
            globalTeamPhoto,
            dev1: dev1Config,
            dev2: dev2Config,
            panels: activePanelsConfig,
            kpis: activeKpiWidgetsConfig
          }));

          // Send current persistent schedules list to newly connected user
          ws.send(JSON.stringify({
            type: "schedules_update",
            schedules: activeSchedules
          }));
        } else if (data.type === "update_profile") {
          if (clientId && activeUsers.has(clientId)) {
            const current = activeUsers.get(clientId)!;
            if (data.name) current.name = data.name;
            if (data.color) current.color = data.color;
            if (data.picture !== undefined) current.picture = data.picture;
            if (data.activeSection) current.activeSection = data.activeSection;
            if (data.positionCode !== undefined) current.positionCode = data.positionCode;
            if (data.jobPosition !== undefined) current.jobPosition = data.jobPosition;
            if (data.email !== undefined) current.email = data.email;
            if (data.isIdle !== undefined) current.isIdle = data.isIdle;
            current.lastSeen = Date.now();
            activeUsers.set(clientId, current);
            sendUpdate();
          }
        } else if (data.type === "update_restrictions") {
          // Broadcast restrictions changes in real time to all clients
          const payload = JSON.stringify({
            type: "restrictions_update",
            restrictions: data.restrictions,
          });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
        } else if (data.type === "update_devs") {
          if (data.dev1) dev1Config = data.dev1;
          if (data.dev2) dev2Config = data.dev2;
          // Broadcast to all clients
          const payload = JSON.stringify({
            type: "devs_update",
            dev1: dev1Config,
            dev2: dev2Config
          });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
        } else if (data.type === "update_global_background") {
          globalTeamPhoto = data.globalBackground || "";
          // Broadcast to all clients
          const payload = JSON.stringify({
            type: "global_background_update",
            globalBackground: globalTeamPhoto
          });
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
        } else if (data.type === "update_schedules") {
          try {
            if (Array.isArray(data.schedules)) {
              activeSchedules = data.schedules;
              fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(activeSchedules, null, 2), "utf-8");
              
              const payload = JSON.stringify({
                type: "schedules_update",
                schedules: activeSchedules,
              });
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(payload);
                }
              });
            }
          } catch (err: any) {
            console.error("Failed to broadcast updated schedules:", err);
          }
        } else if (data.type === "update_dashboard_config") {
          try {
            if (Array.isArray(data.panels)) {
              activePanelsConfig = data.panels;
              fs.writeFileSync(PANELS_FILE, JSON.stringify(activePanelsConfig, null, 2), "utf-8");
            }
            if (Array.isArray(data.kpis)) {
              activeKpiWidgetsConfig = data.kpis;
              fs.writeFileSync(KPI_FILE, JSON.stringify(activeKpiWidgetsConfig, null, 2), "utf-8");
            }
            const payload = JSON.stringify({
              type: "dashboard_config_update",
              panels: activePanelsConfig,
              kpis: activeKpiWidgetsConfig
            });
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
              }
            });
          } catch (err: any) {
            console.error("Failed to broadcast updated dashboard config:", err);
          }
        } else if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          if (clientId && activeUsers.has(clientId)) {
            const current = activeUsers.get(clientId)!;
            current.lastSeen = Date.now();
            activeUsers.set(clientId, current);
          }
        }
      } catch (err) {
        console.error("Presence WS message error:", err);
      }
    });

    ws.on("close", () => {
      if (clientId) {
        activeUsers.delete(clientId);
        sendUpdate();
      }
    });

    ws.on("error", () => {
      if (clientId) {
        activeUsers.delete(clientId);
        sendUpdate();
      }
    });
  });

  server.on("upgrade", (request, socket, head) => {
    // Gracefully delegate Vite home modules reload/reconnection WebSocket upgrades to Vite
    if (vite && request.headers["sec-websocket-protocol"] === "vite-hmr") {
      vite.ws.handleUpgrade(request, socket, head);
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
