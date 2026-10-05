export interface KpiWidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  color?: string;
  description?: string;
}

export interface DashboardPanelConfig {
  id: string;
  label: string;
  visible: boolean;
  description?: string;
}

export const DEFAULT_KPI_WIDGETS: KpiWidgetConfig[] = [
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

export const DEFAULT_DASHBOARD_PANELS: DashboardPanelConfig[] = [
  { id: "resourceLoad", label: "Resource Load Distribution", visible: true, description: "Distribution of lots by LGU, CP, Zone, Mode, Payment, or Status" },
  { id: "la", label: "LA Progress Overview", visible: false, description: "Land Acquisition Status Breakdown and milestone tracking" },
  { id: "expro", label: "Expro Progress Overview", visible: false, description: "Expropriation vs Negotiated acquisition comparison" },
  { id: "scNonWorkable", label: "SC Non-Workable Area Progress", visible: true, description: "Monthly site access timeline and targets for SC areas" },
  { id: "cumulative", label: "Cumulative Acquisition Progress", visible: true, description: "Cumulative performance tracking across monthly timelines" },
  { id: "disbursement", label: "Disbursement Plan Matrix", visible: false, description: "Financial forecasting and disbursement timeline tracking" }
];

export const STORAGE_KEY_KPI_WIDGETS = "gcr_kpi_widgets_config";
export const STORAGE_KEY_DASHBOARD_PANELS = "gcr_dashboard_panels_config";
export const EVENT_KPI_WIDGETS_CHANGED = "gcr_kpi_widgets_changed";
export const EVENT_DASHBOARD_PANELS_CHANGED = "gcr_dashboard_panels_changed";

export function getStoredKpiWidgetsConfig(): KpiWidgetConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KPI_WIDGETS);
    if (!raw) return DEFAULT_KPI_WIDGETS;
    const parsed = JSON.parse(raw) as KpiWidgetConfig[];
    if (!Array.isArray(parsed)) return DEFAULT_KPI_WIDGETS;

    // Ensure all default items exist and missing properties are filled
    const parsedMap = new Map(parsed.map(item => [item.id, item]));
    const result: KpiWidgetConfig[] = [];

    // First add items in saved order
    parsed.forEach(item => {
      const def = DEFAULT_KPI_WIDGETS.find(d => d.id === item.id);
      if (def) {
        result.push({
          id: def.id,
          label: item.label || def.label,
          visible: typeof item.visible === "boolean" ? item.visible : true,
          color: def.color,
          description: def.description
        });
      }
    });

    // Append any newly added default items that weren't in localStorage
    DEFAULT_KPI_WIDGETS.forEach(def => {
      if (!result.some(r => r.id === def.id)) {
        result.push(def);
      }
    });

    return result;
  } catch (e) {
    console.error("Failed to parse stored KPI widgets config", e);
    return DEFAULT_KPI_WIDGETS;
  }
}

// Global broadcast channel for cross-tab realtime sync
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
    syncChannel = new BroadcastChannel("gcr_dashboard_sync");
  }
} catch {
  // BroadcastChannel unavailable
}

export function saveKpiWidgetsConfig(config: KpiWidgetConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_KPI_WIDGETS, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(EVENT_KPI_WIDGETS_CHANGED, { detail: config }));
    
    if (syncChannel) {
      syncChannel.postMessage({ type: EVENT_KPI_WIDGETS_CHANGED, config });
    }

    const currentPanels = getStoredPanelsConfig();
    window.dispatchEvent(new CustomEvent("scla_broadcast_dashboard_config", { 
      detail: { 
        kpis: config,
        panels: currentPanels
      } 
    }));

    // Backup to server REST endpoint asynchronously
    fetch("/api/dashboard-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kpis: config, panels: currentPanels })
    }).catch(err => console.warn("Failed REST backup for KPI config:", err));
  } catch (e) {
    console.error("Failed to save KPI widgets config", e);
  }
}

const STORAGE_KEY_DISBURSEMENT_DEFAULT_HIDDEN_MIGRATION = "gcr_disbursement_def_hidden_2027_v1";

export function getStoredPanelsConfig(): DashboardPanelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DASHBOARD_PANELS);
    if (!raw) return DEFAULT_DASHBOARD_PANELS;
    const parsed = JSON.parse(raw) as DashboardPanelConfig[];
    if (!Array.isArray(parsed)) return DEFAULT_DASHBOARD_PANELS;

    const result: DashboardPanelConfig[] = [];

    // First add items in saved order
    parsed.forEach(item => {
      const def = DEFAULT_DASHBOARD_PANELS.find(d => d.id === item.id);
      if (def) {
        result.push({
          id: def.id,
          label: item.label || def.label,
          visible: typeof item.visible === "boolean" ? item.visible : def.visible,
          description: def.description
        });
      }
    });

    // Append any missing default items
    DEFAULT_DASHBOARD_PANELS.forEach(def => {
      if (!result.some(r => r.id === def.id)) {
        result.push(def);
      }
    });

    // One-time migration to ensure Disbursement Plan Matrix is hidden by default for existing users
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY_DISBURSEMENT_DEFAULT_HIDDEN_MIGRATION)) {
      localStorage.setItem(STORAGE_KEY_DISBURSEMENT_DEFAULT_HIDDEN_MIGRATION, "true");
      const disb = result.find(p => p.id === "disbursement");
      if (disb) {
        disb.visible = false;
        localStorage.setItem(STORAGE_KEY_DASHBOARD_PANELS, JSON.stringify(result));
      }
    }

    return result;
  } catch (e) {
    console.error("Failed to parse stored panels config", e);
    return DEFAULT_DASHBOARD_PANELS;
  }
}

export function savePanelsConfig(config: DashboardPanelConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DASHBOARD_PANELS, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent(EVENT_DASHBOARD_PANELS_CHANGED, { detail: config }));
    
    if (syncChannel) {
      syncChannel.postMessage({ type: EVENT_DASHBOARD_PANELS_CHANGED, config });
    }

    const currentKpis = getStoredKpiWidgetsConfig();
    window.dispatchEvent(new CustomEvent("scla_broadcast_dashboard_config", { 
      detail: { 
        panels: config,
        kpis: currentKpis
      } 
    }));

    // Backup to server REST endpoint asynchronously
    fetch("/api/dashboard-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ panels: config, kpis: currentKpis })
    }).catch(err => console.warn("Failed REST backup for panels config:", err));
  } catch (e) {
    console.error("Failed to save panels config", e);
  }
}

export async function fetchDashboardConfigFromBackend(): Promise<void> {
  try {
    const res = await fetch("/api/dashboard-config");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.panels) && data.panels.length > 0) {
        localStorage.setItem(STORAGE_KEY_DASHBOARD_PANELS, JSON.stringify(data.panels));
        window.dispatchEvent(new CustomEvent(EVENT_DASHBOARD_PANELS_CHANGED, { detail: data.panels }));
      }
      if (Array.isArray(data.kpis) && data.kpis.length > 0) {
        localStorage.setItem(STORAGE_KEY_KPI_WIDGETS, JSON.stringify(data.kpis));
        window.dispatchEvent(new CustomEvent(EVENT_KPI_WIDGETS_CHANGED, { detail: data.kpis }));
      }
    }
  } catch (err) {
    console.warn("Failed to fetch dashboard config from server:", err);
  }
}
