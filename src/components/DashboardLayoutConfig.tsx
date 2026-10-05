import React, { useState, useEffect } from "react";
import { 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  Check, 
  Layout, 
  BarChart3, 
  SlidersHorizontal,
  Sparkles,
  Info,
  Search,
  ListFilter,
  Lock,
  Unlock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeConfig } from "../lib/theme";
import { cn } from "../lib/utils";
import {
  KpiWidgetConfig,
  DashboardPanelConfig,
  DEFAULT_KPI_WIDGETS,
  DEFAULT_DASHBOARD_PANELS,
  getStoredKpiWidgetsConfig,
  saveKpiWidgetsConfig,
  getStoredPanelsConfig,
  savePanelsConfig,
  STORAGE_KEY_KPI_WIDGETS,
  STORAGE_KEY_DASHBOARD_PANELS,
  EVENT_KPI_WIDGETS_CHANGED,
  EVENT_DASHBOARD_PANELS_CHANGED
} from "../lib/dashboardConfig";

interface DashboardLayoutConfigProps {
  activeTheme: ThemeConfig;
  isAdminUnlocked?: boolean;
  onUnlockAdmin?: () => void;
}

export const DashboardLayoutConfig: React.FC<DashboardLayoutConfigProps> = ({ 
  activeTheme,
  isAdminUnlocked = false,
  onUnlockAdmin
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"kpi" | "panels">("kpi");
  const [kpiWidgets, setKpiWidgets] = useState<KpiWidgetConfig[]>([]);
  const [panels, setPanels] = useState<DashboardPanelConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Admin authentication state
  const [isLocalAdminUnlocked, setIsLocalAdminUnlocked] = useState<boolean>(() => {
    if (isAdminUnlocked) return true;
    try {
      return sessionStorage.getItem("scla_admin_unlocked") === "true";
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (isAdminUnlocked) {
      setIsLocalAdminUnlocked(true);
      try {
        sessionStorage.setItem("scla_admin_unlocked", "true");
      } catch {}
    }
  }, [isAdminUnlocked]);

  // Load configs on mount & listen for real-time changes
  useEffect(() => {
    const handleKpiChange = (e?: Event) => {
      const detailKpis = (e as CustomEvent)?.detail;
      setKpiWidgets(Array.isArray(detailKpis) && detailKpis.length > 0 ? detailKpis : getStoredKpiWidgetsConfig());
    };

    const handlePanelsChange = (e?: Event) => {
      const detailPanels = (e as CustomEvent)?.detail;
      setPanels(Array.isArray(detailPanels) && detailPanels.length > 0 ? detailPanels : getStoredPanelsConfig());
    };

    setKpiWidgets(getStoredKpiWidgetsConfig());
    setPanels(getStoredPanelsConfig());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_KPI_WIDGETS) handleKpiChange();
      if (e.key === STORAGE_KEY_DASHBOARD_PANELS) handlePanelsChange();
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("gcr_dashboard_sync");
        channel.onmessage = (msg) => {
          if (msg.data?.type === EVENT_KPI_WIDGETS_CHANGED) {
            handleKpiChange(new CustomEvent(EVENT_KPI_WIDGETS_CHANGED, { detail: msg.data.config }));
          }
          if (msg.data?.type === EVENT_DASHBOARD_PANELS_CHANGED) {
            handlePanelsChange(new CustomEvent(EVENT_DASHBOARD_PANELS_CHANGED, { detail: msg.data.config }));
          }
        };
      }
    } catch {
      // BroadcastChannel unavailable
    }

    window.addEventListener(EVENT_KPI_WIDGETS_CHANGED, handleKpiChange);
    window.addEventListener(EVENT_DASHBOARD_PANELS_CHANGED, handlePanelsChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(EVENT_KPI_WIDGETS_CHANGED, handleKpiChange);
      window.removeEventListener(EVENT_DASHBOARD_PANELS_CHANGED, handlePanelsChange);
      window.removeEventListener("storage", handleStorageChange);
      if (channel) channel.close();
    };
  }, []);

  const triggerSaveSuccess = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 3000);
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "Dataadmin") {
      setIsLocalAdminUnlocked(true);
      try {
        sessionStorage.setItem("scla_admin_unlocked", "true");
      } catch {}
      setPasswordError("");
      setPasswordInput("");
      if (onUnlockAdmin) onUnlockAdmin();
      triggerSaveSuccess("Admin authorization verified! Real-time controls unlocked.");
    } else {
      setPasswordError("Invalid Admin Password. Please enter the correct authorization code.");
    }
  };

  const checkAdminAuth = (): boolean => {
    if (!isLocalAdminUnlocked) {
      setPasswordError("Admin authorization required to modify data visibility.");
      return false;
    }
    return true;
  };

  // --- KPI WIDGET HANDLERS ---
  const handleToggleKpiVisibility = (id: string) => {
    if (!checkAdminAuth()) return;
    const updated = kpiWidgets.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    setKpiWidgets(updated);
    saveKpiWidgetsConfig(updated);
    triggerSaveSuccess("KPI widget visibility updated");
  };

  const handleMoveKpi = (index: number, direction: "up" | "down") => {
    if (!checkAdminAuth()) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= kpiWidgets.length) return;

    const updated = [...kpiWidgets];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setKpiWidgets(updated);
    saveKpiWidgetsConfig(updated);
    triggerSaveSuccess("KPI widget order reallocated");
  };

  const handleKpiShowAll = () => {
    if (!checkAdminAuth()) return;
    const updated = kpiWidgets.map(item => ({ ...item, visible: true }));
    setKpiWidgets(updated);
    saveKpiWidgetsConfig(updated);
    triggerSaveSuccess("All KPI widgets are now visible");
  };

  const handleKpiHideAll = () => {
    if (!checkAdminAuth()) return;
    // Keep totalLots visible as safety fallback
    const updated = kpiWidgets.map(item => ({ ...item, visible: item.id === "totalLots" }));
    setKpiWidgets(updated);
    saveKpiWidgetsConfig(updated);
    triggerSaveSuccess("Hidden non-essential KPI widgets");
  };

  const handleKpiReset = () => {
    if (!checkAdminAuth()) return;
    setKpiWidgets(DEFAULT_KPI_WIDGETS);
    saveKpiWidgetsConfig(DEFAULT_KPI_WIDGETS);
    triggerSaveSuccess("KPI widgets reset to factory order");
  };

  // --- PANEL HANDLERS ---
  const handleTogglePanelVisibility = (id: string) => {
    if (!checkAdminAuth()) return;
    const updated = panels.map(item => 
      item.id === id ? { ...item, visible: !item.visible } : item
    );
    setPanels(updated);
    savePanelsConfig(updated);
    triggerSaveSuccess("Dashboard panel visibility updated");
  };

  const handleMovePanel = (index: number, direction: "up" | "down") => {
    if (!checkAdminAuth()) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= panels.length) return;

    const updated = [...panels];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setPanels(updated);
    savePanelsConfig(updated);
    triggerSaveSuccess("Dashboard panel sequence updated");
  };

  const handlePanelsShowAll = () => {
    if (!checkAdminAuth()) return;
    const updated = panels.map(item => ({ ...item, visible: true }));
    setPanels(updated);
    savePanelsConfig(updated);
    triggerSaveSuccess("All dashboard chart panels enabled");
  };

  const handlePanelsHideAll = () => {
    if (!checkAdminAuth()) return;
    const updated = panels.map(item => ({ ...item, visible: false }));
    setPanels(updated);
    savePanelsConfig(updated);
    triggerSaveSuccess("All dashboard chart panels hidden");
  };

  const handlePanelsReset = () => {
    if (!checkAdminAuth()) return;
    setPanels(DEFAULT_DASHBOARD_PANELS);
    savePanelsConfig(DEFAULT_DASHBOARD_PANELS);
    triggerSaveSuccess("Dashboard panels reset to factory order");
  };

  const visibleKpisCount = kpiWidgets.filter(w => w.visible).length;
  const visiblePanelsCount = panels.filter(p => p.visible).length;

  const filteredKpiWidgets = kpiWidgets.filter(w => 
    w.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredPanels = panels.filter(p => 
    p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Save Success Toast Banner */}
      <AnimatePresence>
        {saveSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{saveSuccessMsg}</span>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Live Synced
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container Card */}
      <div className={cn(
        "rounded-3xl border shadow-sm p-6 sm:p-8 space-y-6 transition-all duration-300",
        activeTheme.isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
      )}>
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className={`w-5 h-5 ${activeTheme.primaryText}`} />
              <h2 className={cn("text-lg font-black tracking-tight", activeTheme.isDark ? "text-white" : "text-slate-800")}>
                Dashboard Display & Layout Controls
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Customize visible KPI status cards and chart panel layout order. Changes apply instantly.
            </p>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 self-start md:self-auto">
            <button
              onClick={() => setActiveSubTab("kpi")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeSubTab === "kpi"
                  ? activeTheme.isDark ? "bg-slate-700 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>KPI Widgets</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {visibleKpisCount}/{kpiWidgets.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab("panels")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                activeSubTab === "panels"
                  ? activeTheme.isDark ? "bg-slate-700 text-white shadow-xs" : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Chart Panels</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                {visiblePanelsCount}/{panels.length}
              </span>
            </button>
          </div>
        </div>

        {/* Admin Protection Lockbox Notice */}
        {!isLocalAdminUnlocked ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 dark:text-amber-200">
                  Admin Authorization Required
                </h3>
                <p className="text-[11px] font-semibold opacity-90 mt-0.5">
                  Only authorized Administrators can hide or unhide dashboard panels and KPI data. Enter the Admin password to unlock controls.
                </p>
              </div>
            </div>
            <form onSubmit={handleAdminVerify} className="flex items-center gap-2 max-w-sm pt-1">
              <input 
                type="password"
                placeholder="Enter Admin Password..."
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-500/40 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                Unlock
              </button>
            </form>
            {passwordError && (
              <p className="text-xs font-extrabold text-rose-500">{passwordError}</p>
            )}
          </div>
        ) : (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-500 animate-bounce" />
              <span>Admin Mode Unlocked — Full Data Hiding & Visibility Controls Available</span>
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-300">
              Admin Active
            </span>
          </div>
        )}

        {/* Search & Global Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeSubTab === "kpi" ? "KPI widgets" : "chart panels"}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-2xl text-xs font-medium border transition-all focus:outline-hidden",
                activeTheme.isDark 
                  ? "bg-slate-800/80 border-slate-700 text-white focus:border-indigo-500" 
                  : "bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500"
              )}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {activeSubTab === "kpi" ? (
              <>
                <button
                  onClick={handleKpiShowAll}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  Show All ({kpiWidgets.length})
                </button>
                <button
                  onClick={handleKpiHideAll}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                  Hide Non-Essential
                </button>
                <button
                  onClick={handleKpiReset}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Order
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handlePanelsShowAll}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  Show All ({panels.length})
                </button>
                <button
                  onClick={handlePanelsHideAll}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                  Hide All
                </button>
                <button
                  onClick={handlePanelsReset}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Order
                </button>
              </>
            )}
          </div>
        </div>

        {/* --- KPI WIDGETS REORDER & VISIBILITY LIST --- */}
        {activeSubTab === "kpi" && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-3">
              <span>Status Card Name & Scope</span>
              <span>Actions & Position Order</span>
            </div>

            {filteredKpiWidgets.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                No KPI widgets matched your search.
              </div>
            ) : (
              filteredKpiWidgets.map((item) => {
                const originalIndex = kpiWidgets.findIndex(w => w.id === item.id);
                const isFirst = originalIndex === 0;
                const isLast = originalIndex === kpiWidgets.length - 1;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all duration-200",
                      item.visible
                        ? activeTheme.isDark 
                          ? "bg-slate-800/60 border-slate-700/80 shadow-2xs" 
                          : "bg-white border-slate-200/90 shadow-2xs"
                        : activeTheme.isDark
                          ? "bg-slate-900/30 border-slate-800/40 opacity-50"
                          : "bg-slate-50/70 border-slate-200/40 opacity-50"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Color Dot / Badge Indicator */}
                      <div 
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white/20" 
                        style={{ backgroundColor: item.color || "#616a8c" }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-black tracking-tight truncate",
                            activeTheme.isDark ? "text-slate-100" : "text-slate-800"
                          )}>
                            {item.label}
                          </span>
                          {!item.visible && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 uppercase">
                              Hidden
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] font-medium text-slate-400 truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Controls: Visibility & Reorder Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle Visibility Switch */}
                      <button
                        onClick={() => handleToggleKpiVisibility(item.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border",
                          item.visible
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-200/60 dark:bg-slate-800 border-slate-300/60 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300/60"
                        )}
                        title={item.visible ? "Hide this KPI from Dashboard" : "Show this KPI on Dashboard"}
                      >
                        {item.visible ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Visible</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>

                      {/* Reorder Buttons */}
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <button
                          disabled={isFirst || searchQuery !== ""}
                          onClick={() => handleMoveKpi(originalIndex, "up")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            isFirst || searchQuery !== ""
                              ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                          )}
                          title="Move card left/up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isLast || searchQuery !== ""}
                          onClick={() => handleMoveKpi(originalIndex, "down")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            isLast || searchQuery !== ""
                              ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                          )}
                          title="Move card right/down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* --- DASHBOARD CHART PANELS REORDER & VISIBILITY LIST --- */}
        {activeSubTab === "panels" && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider px-3">
              <span>Chart Panel Section Name & Description</span>
              <span>Actions & Sequence</span>
            </div>

            {filteredPanels.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-semibold rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                No chart panels matched your search query.
              </div>
            ) : (
              filteredPanels.map((item) => {
                const originalIndex = panels.findIndex(p => p.id === item.id);
                const isFirst = originalIndex === 0;
                const isLast = originalIndex === panels.length - 1;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-200",
                      item.visible
                        ? activeTheme.isDark 
                          ? "bg-slate-800/60 border-slate-700/80 shadow-2xs" 
                          : "bg-white border-slate-200/90 shadow-2xs"
                        : activeTheme.isDark
                          ? "bg-slate-900/30 border-slate-800/40 opacity-50"
                          : "bg-slate-50/70 border-slate-200/40 opacity-50"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn(
                        "p-2.5 rounded-xl shrink-0 mt-0.5",
                        item.visible 
                          ? "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400" 
                          : "bg-slate-200/60 dark:bg-slate-800 text-slate-400"
                      )}>
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-black tracking-tight",
                            activeTheme.isDark ? "text-slate-100" : "text-slate-800"
                          )}>
                            {item.label}
                          </span>
                          {!item.visible ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase">
                              Hidden
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                              Position #{originalIndex + 1}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right Controls: Visibility Switch & Sequence Buttons */}
                    <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleTogglePanelVisibility(item.id)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border",
                          item.visible
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                            : "bg-slate-200/60 dark:bg-slate-800 border-slate-300/60 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-300/60"
                        )}
                        title={item.visible ? "Hide this panel from Dashboard" : "Display this panel on Dashboard"}
                      >
                        {item.visible ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                            <span>Hidden</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        <button
                          disabled={isFirst || searchQuery !== ""}
                          onClick={() => handleMovePanel(originalIndex, "up")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            isFirst || searchQuery !== ""
                              ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                          )}
                          title="Move panel up in sequence"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isLast || searchQuery !== ""}
                          onClick={() => handleMovePanel(originalIndex, "down")}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            isLast || searchQuery !== ""
                              ? "text-slate-300 dark:text-slate-700 cursor-not-allowed"
                              : "text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
                          )}
                          title="Move panel down in sequence"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {/* Footer Info Box */}
        <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-indigo-500 shrink-0" />
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Layout positions and visibility preferences are persistently saved to the server and synchronized in real time across all active users.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Global Realtime Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
