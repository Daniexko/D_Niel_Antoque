import React, { useState } from "react";
import { createPortal } from "react-dom";
import { 
  LayoutDashboard, 
  FileText, 
  UserCircle, 
  Calendar, 
  PlusCircle, 
  Map, 
  Upload, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock,
  X,
  Shield,
  Sparkles,
  GitCompare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { GoogleUser } from "../types";
import { ThemeConfig } from "../lib/theme";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  currentUser: GoogleUser;
  onLogout: () => void;
  activeTheme: ThemeConfig;
  restrictions?: Record<string, string[]>;
  isLotAnalyzerZoomed?: boolean;
  onLockedReportsClick?: () => void;
  onStartTour?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeSection, 
  setActiveSection,
  currentUser,
  onLogout,
  activeTheme,
  restrictions = {},
  isLotAnalyzerZoomed = false,
  onLockedReportsClick,
  onStartTour
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const rawMenuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "reports", label: "Reports, Analytics & Planning", icon: FileText },
    { id: "weekly", label: "Weekly Updates", icon: Calendar },
    { id: "discrepancy", label: "GCR and DOTr discrepancy", icon: GitCompare },
    { id: "addAccomplishment", label: "Add Accomplishment", icon: PlusCircle },
    { id: "gis", label: "GIS Smart Map", icon: Map },
    { id: "upload", label: "Manage Documents", icon: Upload },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const menuItems = isLotAnalyzerZoomed 
    ? rawMenuItems.filter(item => item.id !== "reports")
    : rawMenuItems;

  // Get restrictions for current user
  const emailKey = (currentUser?.email || "").trim().toLowerCase();
  const nameKey = (currentUser?.name || "").trim().toLowerCase();
  
  const safeRestrictions = restrictions || {};

  // Find all matched keys in the restrictions map
  const matchedKeys = Object.keys(safeRestrictions).filter(key => {
    const k = key.trim().toLowerCase();
    return (
      (emailKey && k === emailKey) ||
      (nameKey && k === nameKey) ||
      k === (currentUser?.email || "").trim() ||
      k === (currentUser?.name || "").trim()
    );
  });

  const isSuperAdmin = emailKey === "antoque2822@gmail.com" || nameKey === "daniel b. antoque";

  const userRestrictions = isSuperAdmin ? [] : Array.from(new Set(
    matchedKeys.flatMap(key => safeRestrictions[key] || [])
  ));

  return (
    <motion.aside 
      layout="position"
      animate={{ width: isCollapsed ? 80 : 288 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={cn(
        "relative select-none flex flex-col h-full overflow-hidden",
        activeTheme.isDark 
          ? "bg-slate-900/85 backdrop-blur-xl border-r border-slate-800 text-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.15)]" 
          : "bg-white/80 backdrop-blur-xl border-r border-slate-200 text-slate-900 shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
      )}
    >
      {/* Floating Toggle Trigger Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "absolute top-10 -right-3 w-6 h-6 border shadow-md rounded-full flex items-center justify-center transition-all active:scale-95 z-50 cursor-pointer",
          activeTheme.isDark
            ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
        )}
        title={isCollapsed ? "Unhide Sidebar" : "Hide Sidebar"}
        aria-label={isCollapsed ? "Unhide Sidebar" : "Hide Sidebar"}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      <div className={cn("flex items-center gap-3 transition-all duration-300", isCollapsed ? "p-5 justify-center" : "p-8")}>
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 transition-all", activeTheme.primaryBg, activeTheme.primaryShadow)}>
          <FileText className="text-white w-6 h-6" />
        </div>
        <div className={cn("transition-all duration-300 origin-left", isCollapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none scale-90" : "w-auto opacity-100 scale-100")}>
          <h1 className={cn("font-bold text-lg leading-tight uppercase tracking-wider whitespace-nowrap", activeTheme.isDark ? "text-slate-150" : "text-slate-800")}>Land Acquisition</h1>
          <p className={cn("text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-colors", activeTheme.primaryText70)}>Management System</p>
        </div>
      </div>

      <nav className={cn("flex-1 space-y-1.5 transition-all duration-300", isCollapsed ? "px-2" : "px-4")}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const isRestricted = userRestrictions.includes(item.id);

          return (
            <button
              key={item.id}
              id={`sidebar-item-${item.id}`}
              disabled={isRestricted && item.id !== "settings" && item.id !== "reports"}
              onClick={() => {
                if (isRestricted) {
                  if (item.id === "reports") {
                    onLockedReportsClick?.();
                  }
                  return;
                }
                setActiveSection(item.id);
              }}
              aria-label={item.label}
              className={cn(
                "w-full flex items-center rounded-xl transition-all duration-300 group relative cursor-pointer",
                isCollapsed ? "px-3 py-3 justify-center" : "gap-3 px-4 py-3",
                isRestricted
                  ? item.id === "reports"
                    ? "opacity-90 hover:bg-slate-500/10 cursor-pointer border border-amber-500/20"
                    : "opacity-40 bg-slate-50/50 cursor-not-allowed"
                  : isActive 
                    ? cn("text-white", isCollapsed ? "" : "translate-x-1")
                    : activeTheme.isDark
                      ? "text-slate-400 hover:bg-slate-900/60 hover:text-slate-100"
                      : "text-slate-550 hover:bg-slate-50 hover:text-slate-800"
              )}
              title={
                isRestricted 
                  ? item.id === "reports"
                    ? `${item.label} (Access Limited to Assigned Area)`
                    : `${item.label} (Access Locked by Admin)` 
                  : isCollapsed ? item.label : undefined
              }
            >
              {/* Sliding Active Indicator Background */}
              {isActive && !isRestricted && (
                <motion.div
                  layoutId="active-sidebar-indicator"
                  className={cn(
                    "absolute inset-0 rounded-xl z-0",
                    activeTheme.primaryBg,
                    activeTheme.primaryShadow
                  )}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              {isRestricted ? (
                <div className="relative z-10 flex-shrink-0">
                  <Lock className={cn("w-5 h-5", item.id === "reports" ? "text-amber-550 text-amber-500 animate-pulse" : "text-amber-550/60 text-slate-450")} />
                </div>
              ) : (
                <div className="relative z-10 flex-shrink-0">
                  <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-white" : activeTheme.isDark ? "text-slate-500 group-hover:text-slate-350" : "text-slate-400 group-hover:text-slate-600")} />
                </div>
              )}
              
              <span className={cn("relative z-10 font-semibold text-sm transition-all duration-300 origin-left whitespace-nowrap", isCollapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none scale-90" : "w-auto opacity-100 scale-100")}>
                {item.label}
              </span>

              {isActive && !isCollapsed && !isRestricted && (
                <div className="relative z-10 ml-auto w-1.5 h-1.5 bg-white rounded-full ring-4 ring-white/30" />
              )}
            </button>
          );
        })}
      </nav>

      <div className={cn("border-t transition-all duration-300", activeTheme.isDark ? "border-slate-900/60" : "border-slate-100", isCollapsed ? "p-2" : "p-4")}>
        {onStartTour && (
          <button
            onClick={onStartTour}
            id="sidebar-tour-launcher"
            className={cn(
              "w-full flex items-center rounded-xl transition-all font-bold text-xs py-2.5 cursor-pointer mb-3 select-none active:scale-95 group",
              isCollapsed ? "px-0 justify-center" : "px-4 gap-3",
              activeTheme.isDark
                ? "bg-brand-950/20 hover:bg-brand-900/30 text-brand-400 hover:text-brand-300 border border-brand-900/30 shadow-xs"
                : "bg-brand-50 hover:bg-brand-100/60 text-brand-700 hover:text-brand-800 border border-brand-100/60 shadow-xs"
            )}
            title="Launch Interactive Guide Tour"
            aria-label="Launch Interactive Guide Tour"
          >
            <Sparkles className="w-4 h-4 flex-shrink-0 text-brand-500 animate-pulse" />
            <span className={cn("transition-all duration-300 origin-left whitespace-nowrap", isCollapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none scale-90" : "w-auto opacity-100 scale-100")}>
              Interactive Tour
            </span>
          </button>
        )}

        <div 
          onClick={() => setIsZoomed(true)}
          className={cn(
            "rounded-2xl transition-all duration-300 border cursor-zoom-in select-none group relative overflow-hidden",
            activeTheme.isDark 
              ? "bg-slate-900/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/70 shadow-xs hover:shadow-md" 
              : "bg-slate-50 border-slate-100 hover:bg-slate-100/50 hover:border-slate-200/80 shadow-xs hover:shadow-md",
            isCollapsed ? "p-2 mb-2" : "p-4 mb-4"
          )}
          title="Zoom Profile Card"
        >
          {/* Subtle light leak hover effect inside card */}
          <div className="absolute inset-0 bg-radial from-indigo-505/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

          <div className="flex items-center gap-3 justify-center relative z-10">
            <div className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-850 shadow-xs overflow-hidden flex-shrink-0 bg-slate-205 transition-transform group-hover:scale-105 duration-300">
              <img 
                src={currentUser.picture || "https://img.icons8.com/color/96/subway.png"} 
                alt="Avatar" 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
              />
            </div>
            <div className={cn("flex-1 min-w-0 transition-all duration-300 origin-left", isCollapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none scale-90" : "w-auto opacity-100 scale-100")}>
              <p className={cn("text-sm font-bold truncate group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors duration-200", activeTheme.isDark ? "text-slate-200" : "text-slate-800")} title={currentUser.name}>
                {currentUser.name}
              </p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] text-slate-400 font-bold truncate tracking-tight" title={currentUser.email}>
                  {currentUser.email}
                </p>
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className={cn(
            "w-full flex items-center rounded-xl transition-all font-semibold text-sm py-3 cursor-pointer", 
            activeTheme.isDark ? "text-rose-400 hover:bg-rose-950/20" : "text-red-600 hover:bg-red-50",
            isCollapsed ? "px-0 justify-center" : "px-4 gap-3"
          )}
          title={isCollapsed ? "Logout" : undefined}
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className={cn("transition-all duration-300 origin-left whitespace-nowrap", isCollapsed ? "w-0 opacity-0 overflow-hidden pointer-events-none scale-90" : "w-auto opacity-100 scale-100")}>
            Logout
          </span>
        </button>
      </div>

      {/* Active User Zoom Dynamic Modal */}
      {createPortal(
        <AnimatePresence>
          {isZoomed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md cursor-zoom-out"
              onClick={() => setIsZoomed(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 15 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="relative max-w-sm w-full bg-slate-900 border border-slate-800/80 rounded-[2.5rem] overflow-hidden shadow-2xl p-6 flex flex-col items-center text-center gap-5 cursor-default select-none animate-in fade-in zoom-in duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setIsZoomed(false)}
                  className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/40 hover:bg-slate-700/85 text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header Title Accent */}
                <div className="flex flex-col items-center gap-1 pt-2">
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                    <Shield className="w-3 h-3 text-indigo-400" /> Authorized Profile Session
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Land Acquisition Management System
                  </p>
                </div>

                {/* Glowing Avatar frame with high contrast details */}
                <div className="relative group/avatar mt-2">
                  <div className="absolute -inset-1 rounded-full bg-linear-to-tr from-indigo-500 via-pink-500 to-emerald-500 blur-lg opacity-70 group-hover/avatar:opacity-100 transition-opacity duration-300 animate-pulse" />
                  <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-slate-900 shadow-2xl">
                    <img
                      src={currentUser.picture || "https://img.icons8.com/color/96/subway.png"}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {/* Active Indicator Pulse */}
                  <div className="absolute bottom-2 right-4 w-5.5 h-5.5 bg-emerald-550 bg-emerald-500 border-4 border-slate-900 rounded-full animate-bounce shadow-lg flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                  </div>
                </div>

                {/* User Dynamic Meta and Info description fields */}
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-white tracking-tight px-1 font-sans">
                    {currentUser.name}
                  </h3>
                  <code className="text-[11px] block text-slate-400 font-bold bg-slate-950/60 border border-slate-800/50 px-3 py-1 rounded-xl">
                    {currentUser.email}
                  </code>
                </div>

                {/* Dynamic Role Badge and Bio Description */}
                <div className="w-full bg-slate-950/30 border border-slate-850/60 p-4 rounded-3xl space-y-2.5">
                  <div className="flex justify-center items-center gap-2 flex-wrap font-sans">
                    <span className={cn(
                      "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider border",
                      ((currentUser?.email || "").toLowerCase().trim() === "antoque2822@gmail.com" || (currentUser?.name || "").toLowerCase().trim() === "daniel b. antoque")
                        ? "text-indigo-400 bg-indigo-950/50 border-indigo-800/40"
                        : ((currentUser?.email || "").toLowerCase().trim() === "christian@railway.com" || (currentUser?.name || "").toLowerCase().trim() === "christian jay")
                          ? "text-emerald-400 bg-emerald-950/50 border-emerald-800/40"
                          : "text-amber-400 bg-amber-950/50 border-amber-800/40"
                    )}>
                      {currentUser?.jobPosition || (
                        ((currentUser?.email || "").toLowerCase().trim() === "antoque2822@gmail.com" || (currentUser?.name || "").toLowerCase().trim() === "daniel b. antoque")
                          ? "Super Admin"
                          : ((currentUser?.email || "").toLowerCase().trim() === "christian@railway.com" || (currentUser?.name || "").toLowerCase().trim() === "christian jay")
                            ? "QC Partner"
                            : "Authorized Operator"
                      )}
                    </span>
                    {currentUser?.positionCode && (
                      <span className="text-[9px] font-black text-slate-300 text-sky-400 bg-sky-950/50 border border-sky-800/40 px-3 py-1 rounded-full uppercase tracking-wider font-mono">
                        Code: {currentUser?.positionCode}
                      </span>
                    )}
                    <span className="text-[9px] font-black text-slate-350 bg-slate-800/55 border border-slate-800 px-3 py-1 rounded-full uppercase tracking-wider">
                      {((currentUser?.email || "").toLowerCase().trim() === "antoque2822@gmail.com" || (currentUser?.name || "").toLowerCase().trim() === "daniel b. antoque")
                        ? "Lead Developer"
                        : "Verified User"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-medium leading-relaxed font-sans px-2">
                    {((currentUser?.email || "").toLowerCase().trim() === "antoque2822@gmail.com" || (currentUser?.name || "").toLowerCase().trim() === "daniel b. antoque")
                      ? "System Owner, Primary Developer & Chief Land Acquisition Database Architect."
                      : ((currentUser?.email || "").toLowerCase().trim() === "christian@railway.com" || (currentUser?.name || "").toLowerCase().trim() === "christian jay")
                        ? "Quality Control Advisor, Senior Quality Analyst and Supporting Dashboard Partner."
                        : `System Operator specialized in Land Acquisition document tracking, records validation, and status dashboard reporting as ${currentUser?.jobPosition || "Case handler"} with registration code ${currentUser?.positionCode || "N/A"}.`}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-1.5 justify-center py-0.5 px-3 bg-slate-950/60 border border-slate-850/60 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Live Online Session
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.aside>
  );
};
