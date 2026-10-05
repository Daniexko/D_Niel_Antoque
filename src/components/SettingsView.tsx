import React, { useState, useEffect } from "react";
import { 
  User, 
  Paintbrush, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Sliders,
  Settings,
  HelpCircle,
  Sparkles,
  Info,
  Image,
  Trash2,
  Camera,
  X,
  Activity,
  Search,
  Download,
  RefreshCw,
  FileSpreadsheet,
  SlidersHorizontal
} from "lucide-react";
import { GoogleUser } from "../types";
import { themes, ThemeConfig, ThemeId } from "../lib/theme";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { DashboardLayoutConfig } from "./DashboardLayoutConfig";

interface SettingsViewProps {
  currentUser: GoogleUser;
  onUpdateCurrentUser: (user: GoogleUser) => void;
  activeTheme: ThemeConfig;
  onChangeTheme: (themeId: ThemeId) => void;
  restrictions: Record<string, string[]>; // name -> restricted tab IDs
  onUpdateRestrictions: (restrictions: Record<string, string[]>) => void;
  activeUsers?: any[];
  customBg: string | null;
  onUpdateCustomBg: (bg: string | null) => void;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  userName: string;
  action: string;
  details: string;
  fileName?: string;
  lotId?: string;
}

const PRESET_AVATARS = [
  "https://img.icons8.com/color/96/subway.png",
  "https://api.dicebear.com/7.x/initials/svg?seed=Daniel&backgroundColor=0f295a&textColor=ffffff",
  "https://api.dicebear.com/7.x/initials/svg?seed=Christian&backgroundColor=10b981&textColor=ffffff",
  "https://api.dicebear.com/7.x/initials/svg?seed=Pablo&backgroundColor=8b5cf6&textColor=ffffff",
  "https://api.dicebear.com/7.x/initials/svg?seed=User&backgroundColor=f43f5e&textColor=ffffff",
];

const SIDEBAR_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "reports", label: "Reports, Analytics & Planning" },
  { id: "weekly", label: "Weekly Updates" },
  { id: "addAccomplishment", label: "Add Accomplishment" },
  { id: "gis", label: "GIS Smart Map" },
  { id: "upload", label: "Manage Documents" },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateCurrentUser,
  activeTheme,
  onChangeTheme,
  restrictions,
  onUpdateRestrictions,
  activeUsers = [],
  customBg,
  onUpdateCustomBg
}) => {
  // Settings Tab Controller
  const [settingsActiveTab, setSettingsActiveTab] = useState<"system" | "layout" | "audit">("system");

  // Audit Logs State Managers
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsSearch, setLogsSearch] = useState("");
  const [logsActionFilter, setLogsActionFilter] = useState("ALL");

  const fetchAuditLogs = async () => {
    setIsLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch("/api/audit-logs");
      if (!res.ok) throw new Error("Failed to load official database audit trails.");
      const data = await res.json();
      const sorted = (data || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(sorted);
    } catch (err: any) {
      console.error(err);
      setLogsError(err.message || "An unexpected network error occurred while synchronizing security logs.");
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (settingsActiveTab === "audit") {
      fetchAuditLogs();
    }
  }, [settingsActiveTab]);

  const handleExportLogsCSV = () => {
    if (auditLogs.length === 0) return;
    
    // Header
    const headers = ["ID", "Timestamp", "User Email", "User Name", "Action", "File Name", "Lot ID", "Details"];
    
    // Filtered logs
    const filtered = auditLogs.filter(log => {
      const matchSearch = 
        log.userName.toLowerCase().includes(logsSearch.toLowerCase()) ||
        log.userEmail.toLowerCase().includes(logsSearch.toLowerCase()) ||
        log.action.toLowerCase().includes(logsSearch.toLowerCase()) ||
        log.details.toLowerCase().includes(logsSearch.toLowerCase()) ||
        (log.fileName && log.fileName.toLowerCase().includes(logsSearch.toLowerCase())) ||
        (log.lotId && log.lotId.toLowerCase().includes(logsSearch.toLowerCase()));
      
      const matchAction = logsActionFilter === "ALL" || log.action === logsActionFilter;
      
      return matchSearch && matchAction;
    });

    const rows = filtered.map(log => [
      log.id,
      log.timestamp,
      `"${log.userEmail.replace(/"/g, '""')}"`,
      `"${log.userName.replace(/"/g, '""')}"`,
      `"${log.action.replace(/"/g, '""')}"`,
      `"${(log.fileName || "").replace(/"/g, '""')}"`,
      `"${(log.lotId || "").replace(/"/g, '""')}"`,
      `"${log.details.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Profile Form States
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [picture, setPicture] = useState(currentUser.picture || PRESET_AVATARS[0]);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(false);

  // Footer Developer Profiles (Main & Support Developers inside Data Admin block)
  const [dev1Name, setDev1Name] = useState(() => {
    try { return localStorage.getItem("gcr_dev1_name") || "Daniel B. Antoque"; } catch { return "Daniel B. Antoque"; }
  });
  const [dev1Role, setDev1Role] = useState(() => {
    try { return localStorage.getItem("gcr_dev1_role") || "Main Developer"; } catch { return "Main Developer"; }
  });
  const [dev1Badge, setDev1Badge] = useState(() => {
    try { return localStorage.getItem("gcr_dev1_badge") || "Lead"; } catch { return "Lead"; }
  });
  const [dev1Pic, setDev1Pic] = useState(() => {
    try { return localStorage.getItem("gcr_dev1_pic") || ""; } catch { return ""; }
  });
  const [dev1Bio, setDev1Bio] = useState(() => {
    try { return localStorage.getItem("gcr_dev1_bio") || "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."; } catch { return "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."; }
  });

  const [dev2Name, setDev2Name] = useState(() => {
    try { return localStorage.getItem("gcr_dev2_name") || "Christian Jay Pablo"; } catch { return "Christian Jay Pablo"; }
  });
  const [dev2Role, setDev2Role] = useState(() => {
    try { return localStorage.getItem("gcr_dev2_role") || "Support Developer"; } catch { return "Support Developer"; }
  });
  const [dev2Badge, setDev2Badge] = useState(() => {
    try { return localStorage.getItem("gcr_dev2_badge") || "Partner"; } catch { return "Partner"; }
  });
  const [dev2Pic, setDev2Pic] = useState(() => {
    try { return localStorage.getItem("gcr_dev2_pic") || ""; } catch { return ""; }
  });
  const [dev2Bio, setDev2Bio] = useState(() => {
    try { return localStorage.getItem("gcr_dev2_bio") || "GCR Land Acquisition Support Developer & Senior Quality Control Partner."; } catch { return "GCR Land Acquisition Support Developer & Senior Quality Control Partner."; }
  });
  const [devSuccessMsg, setDevSuccessMsg] = useState(false);

  // Global Dashboard Canvas Background state within Data Admin
  const [globalBg, setGlobalBg] = useState(() => {
    try { return localStorage.getItem("gcr_global_team_photo") || ""; } catch { return ""; }
  });
  const [bgSuccessMsg, setBgSuccessMsg] = useState(false);

  // Global Performance & Optimization States
  const [performanceMode, setPerformanceMode] = useState(() => {
    try { return localStorage.getItem("gcr_performance_mode") === "true"; } catch { return false; }
  });
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [clearCacheSuccess, setClearCacheSuccess] = useState(false);

  const handleTogglePerformanceMode = (val: boolean) => {
    setPerformanceMode(val);
    try {
      localStorage.setItem("gcr_performance_mode", String(val));
      window.dispatchEvent(new CustomEvent("gcr_performance_mode_changed", { detail: val }));
    } catch (e) {
      console.error("Failed to save performance mode", e);
    }
  };

  const handleClearServerCache = async () => {
    setIsClearingCache(true);
    setClearCacheSuccess(false);
    try {
      const res = await fetch("/api/proxy/clear-cache", { method: "POST" });
      if (res.ok) {
        setClearCacheSuccess(true);
        setTimeout(() => setClearCacheSuccess(false), 3000);
      }
    } catch (e) {
      console.error("Failed to clear server cache", e);
    } finally {
      setIsClearingCache(false);
    }
  };

  // Admin Lock States
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Active Target Email address in Admin settings
  const [adminTargetEmail, setAdminTargetEmail] = useState<string>("antoque2822@gmail.com");
  const [draftRestrictions, setDraftRestrictions] = useState<string[]>([]);
  const [adminSaveSuccess, setAdminSaveSuccess] = useState(false);
  const [customUserToAdd, setCustomUserToAdd] = useState("");

  // Editing footer developer profile selection
  const [editingDevProfile, setEditingDevProfile] = useState<1 | 2>(1);

  // Toggle visibility of the Configure Restricted Tabs section (Hide / Unhide)
  const [isConfigureRestrictedVisible, setIsConfigureRestrictedVisible] = useState(true);

  // States for Quick-Select presets
  const [quickSelectPresets, setQuickSelectPresets] = useState<{ name: string; email: string }[]>(() => {
    try {
      const saved = localStorage.getItem("gcr_quick_select_presets");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse presets:", e);
    }
    return [
      { name: "Daniel B. Antoque", email: "antoque2822@gmail.com" },
      { name: "Christian Jay", email: "christian@railway.com" },
      { name: "Pablo", email: "pablo@railway.com" }
    ];
  });

  const deletePreset = (emailToClear: string) => {
    const updated = quickSelectPresets.filter(p => p.email.toLowerCase().trim() !== emailToClear.toLowerCase().trim());
    setQuickSelectPresets(updated);
    try {
      localStorage.setItem("gcr_quick_select_presets", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save presets:", e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setPicture(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    onUpdateCurrentUser({
      name: name.trim(),
      email: email.trim(),
      picture: picture
    });

    setProfileSuccessMsg(true);
    setTimeout(() => {
      setProfileSuccessMsg(false);
    }, 3000);
  };

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput === "Dataadmin") {
      setIsAdminUnlocked(true);
      setAdminError("");
      setAdminPasswordInput("");
    } else {
      setAdminError("Invalid authorization code. Please check and try again.");
    }
  };

  const isTargetSuperAdmin = (adminTargetEmail || "").toLowerCase().trim() === "antoque2822@gmail.com";

  // Target Member Details Helper to find dynamic live user registration metadata
  const targetMemberDetails = (() => {
    const targetEmailLower = (adminTargetEmail || "").toLowerCase().trim();
    const currentEmailLower = (currentUser?.email || "").toLowerCase().trim();
    if (currentEmailLower === targetEmailLower) {
      return {
        name: currentUser?.name || "Authorized Operator",
        email: currentUser?.email || "",
        jobPosition: currentUser?.jobPosition || "Super Admin",
        positionCode: currentUser?.positionCode || "Master"
      };
    }
    const onlineMatch = activeUsers.find(au => 
      (au.id || "").toLowerCase().trim() === targetEmailLower || 
      (au.email || "").toLowerCase().trim() === targetEmailLower
    );
    if (onlineMatch) {
      return {
        name: onlineMatch.name,
        email: onlineMatch.email || onlineMatch.id || "",
        jobPosition: onlineMatch.jobPosition || "Authorized Operator",
        positionCode: onlineMatch.positionCode || "N/A"
      };
    }
    const presetMatch = quickSelectPresets.find(p => (p.email || "").toLowerCase().trim() === targetEmailLower);
    if (presetMatch) {
      const emailLower = (presetMatch.email || "").toLowerCase().trim();
      const isDaniel = emailLower === "antoque2822@gmail.com";
      const isChristian = emailLower === "christian@railway.com";
      return {
        name: presetMatch.name,
        email: presetMatch.email,
        jobPosition: isDaniel ? "Super Admin" : isChristian ? "QC Partner" : "Authorized Operator",
        positionCode: isDaniel ? "Developer" : "N/A"
      };
    }
    return null;
  })();

  // Sync draft selection with stored permissions for the designated email address
  useEffect(() => {
    const emailKey = adminTargetEmail.trim().toLowerCase();
    
    if (emailKey === "antoque2822@gmail.com") {
      setDraftRestrictions([]);
      return;
    }

    // Is there any explicit restriction mapping for this user?
    const matchedKey = Object.keys(restrictions).find(
      key => key.trim().toLowerCase() === emailKey
    );

    let currentList: string[] | undefined = undefined;

    if (matchedKey) {
      currentList = restrictions[matchedKey];
    } else {
      // Sync using preset keys if no explicit lowercase email settings found yet
      if (emailKey === "christian@railway.com") {
        currentList = restrictions["Christian Jay"] || undefined;
      } else if (emailKey === "pablo@railway.com") {
        currentList = restrictions["Pablo"] || undefined;
      }
    }

    // If still have not found details, then it is a new user!
    if (currentList === undefined && emailKey !== "") {
      // Set default restricted tabs locked by default for new users
      currentList = ["reports", "addAccomplishment", "upload"];
    }

    setDraftRestrictions(currentList || []);
  }, [adminTargetEmail, restrictions]);

  const toggleDraftRestriction = (tabId: string) => {
    if (isTargetSuperAdmin) return; // Immune to restriction locks!
    if (draftRestrictions.includes(tabId)) {
      setDraftRestrictions(draftRestrictions.filter(id => id !== tabId));
    } else {
      setDraftRestrictions([...draftRestrictions, tabId]);
    }
  };

  const handleSaveAdminRules = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminTargetEmail.trim()) return;

    const emailKey = adminTargetEmail.trim().toLowerCase();
    const isTargetSuperAdmin = emailKey === "antoque2822@gmail.com";
    const savedDraft = isTargetSuperAdmin ? [] : draftRestrictions;
    
    const nextRestrictions = {
      ...restrictions,
      [emailKey]: savedDraft
    };

    // If matches logged-in user name or email, keep updated live
    if (currentUser?.email && currentUser.email.toLowerCase() === emailKey) {
      if (currentUser.name) {
        nextRestrictions[currentUser.name] = savedDraft;
      }
    }

    // Safeguard legacy named setups too
    if (emailKey === "antoque2822@gmail.com") {
      nextRestrictions["Daniel B. Antoque"] = [];
    } else if (emailKey === "christian@railway.com") {
      nextRestrictions["Christian Jay"] = savedDraft;
    } else if (emailKey === "pablo@railway.com") {
      nextRestrictions["Pablo"] = savedDraft;
    }

    onUpdateRestrictions(nextRestrictions);
    
    setAdminSaveSuccess(true);
    setTimeout(() => {
      setAdminSaveSuccess(false);
    }, 3000);
  };

  const handleSaveDeveloperProfiles = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      localStorage.setItem("gcr_dev1_name", dev1Name.trim());
      localStorage.setItem("gcr_dev1_role", dev1Role.trim());
      localStorage.setItem("gcr_dev1_badge", dev1Badge.trim());
      localStorage.setItem("gcr_dev1_pic", dev1Pic.trim());
      localStorage.setItem("gcr_dev1_bio", dev1Bio.trim());

      localStorage.setItem("gcr_dev2_name", dev2Name.trim());
      localStorage.setItem("gcr_dev2_role", dev2Role.trim());
      localStorage.setItem("gcr_dev2_badge", dev2Badge.trim());
      localStorage.setItem("gcr_dev2_pic", dev2Pic.trim());
      localStorage.setItem("gcr_dev2_bio", dev2Bio.trim());
    } catch (err) {
      console.warn("localStorage setItem failed:", err);
    }

    // Broadcast update globally to everyone!
    window.dispatchEvent(new CustomEvent("scla_broadcast_devs", {
      detail: {
        dev1: {
          name: dev1Name.trim(),
          role: dev1Role.trim(),
          badge: dev1Badge.trim(),
          picture: dev1Pic.trim(),
          bio: dev1Bio.trim()
        },
        dev2: {
          name: dev2Name.trim(),
          role: dev2Role.trim(),
          badge: dev2Badge.trim(),
          picture: dev2Pic.trim(),
          bio: dev2Bio.trim()
        }
      }
    }));

    setDevSuccessMsg(true);
    setTimeout(() => {
      setDevSuccessMsg(false);
    }, 3000);
  };

  const handleDev1PicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setDev1Pic(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDev2PicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image must be smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setDev2Pic(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16 font-sans">
      
      {/* Visual Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Settings className={`w-6 h-6 ${activeTheme.primaryText}`} />
            Preferences & Security Controls
          </h1>
          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">
            Manage your interface experience, visual themes, and administrator permissions
          </p>
        </div>
        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${activeTheme.primaryAccentBg} ${activeTheme.primaryAccentText}`}>
          Config Active: {activeTheme.name}
        </span>
      </div>

      {/* Settings Panel Tab Bar */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 max-w-md">
        <button
          onClick={() => setSettingsActiveTab("system")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            settingsActiveTab === "system"
              ? activeTheme.isDark 
                ? "bg-slate-800 text-white shadow-md"
                : "bg-white text-slate-800 shadow-md"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <Sliders className="w-3.5 h-3.5" />
          System
        </button>
        <button
          onClick={() => setSettingsActiveTab("layout")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            settingsActiveTab === "layout"
              ? activeTheme.isDark 
                ? "bg-slate-800 text-white shadow-md"
                : "bg-white text-slate-800 shadow-md"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
          Dashboard Layout
        </button>
        <button
          onClick={() => setSettingsActiveTab("audit")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
            settingsActiveTab === "audit"
              ? activeTheme.isDark 
                ? "bg-slate-800 text-white shadow-md"
                : "bg-white text-slate-800 shadow-md"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          )}
        >
          <Activity className="w-3.5 h-3.5 text-rose-500" />
          Audit Logs
        </button>
      </div>

      {settingsActiveTab === "system" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Column: Personal Profile & Color Theme Customization */}
        <div className="space-y-8">
          
          {/* Card 1: My Profile Settings */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className={`p-6 bg-linear-to-r ${activeTheme.primaryGradient} text-white flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight">Active User Identity</h3>
                  <p className="text-[10px] text-white/70">Updates references, sidebar name & avatar</p>
                </div>
              </div>
              <Sparkles className="w-4 h-4 opacity-40 animate-pulse" />
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-5">
              
              {/* Display Picture Chooser */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Choose Profile Picture
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl border-2 border-slate-200 p-0.5 bg-slate-50 flex-shrink-0 overflow-hidden shadow-xs">
                    <img 
                      src={picture} 
                      alt="Current avatar preview" 
                      className="w-full h-full object-cover rounded-xl"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  {/* Select Preset Avatars */}
                  <div className="flex flex-wrap gap-2">
                    {PRESET_AVATARS.map((av, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setPicture(av)}
                        className={`w-10 h-10 rounded-xl border overflow-hidden transition-all duration-150 relative active:scale-90 cursor-pointer ${
                          picture === av 
                            ? `ring-2 ring-offset-2 ring-indigo-500 border-indigo-200` 
                            : "border-slate-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={av} alt="Avatar option" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        {picture === av && (
                          <div className={`absolute inset-0 bg-black/20 flex items-center justify-center`}>
                            <Check className="w-4 h-4 text-white font-bold" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1">
                      Upload from Local File
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                        id="avatar-file-upload-input"
                      />
                      <label
                        htmlFor="avatar-file-upload-input"
                        className="w-full h-10 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl px-3 text-[11px] text-slate-600 font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        Choose Photo...
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block mb-1">
                      Or Image Web URL
                    </label>
                    <input
                      type="url"
                      value={picture.startsWith("data:") ? "" : picture}
                      onChange={(e) => setPicture(e.target.value)}
                      className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 font-medium shadow-2xs"
                      placeholder="https://example.com/avatar.png"
                    />
                  </div>
                </div>
              </div>

              {/* Display fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 font-bold focus:outline-hidden focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Gmail Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 font-bold focus:outline-hidden focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <AnimatePresence>
                  {profileSuccessMsg && (
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-emerald-600 font-bold text-xs flex items-center gap-1"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      Updated successfully!
                    </motion.p>
                  )}
                </AnimatePresence>
                
                <button
                  type="submit"
                  className={`ml-auto px-6 py-2.5 text-xs font-black uppercase tracking-widest text-white rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer hover:shadow-md ${activeTheme.primaryBg}`}
                >
                  Save Profile
                </button>
              </div>

            </form>
          </section>

          {/* Card 2: Visual Themes Portion */}
          <section className={cn(
            "rounded-3xl border shadow-xs p-6 sm:p-8 space-y-6 transition-all duration-300",
            activeTheme.isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${activeTheme.isDark ? "bg-indigo-950/45 text-indigo-400" : activeTheme.primaryAccentBg + " " + activeTheme.primaryAccentText}`}>
                <Paintbrush className="w-5 h-5" />
              </div>
              <div>
                <h3 className={cn("font-extrabold text-sm tracking-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>Global Design Canvas</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Instantly changes major color accents, buttons, & sidebars</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3.5 pt-2">
              {Object.values(themes).map((themeOption) => {
                const isActive = activeTheme.id === themeOption.id;
                return (
                  <button
                    key={themeOption.id}
                    onClick={() => {
                      try {
                        localStorage.setItem("gcr_la_theme", themeOption.id);
                      } catch {}
                      onChangeTheme(themeOption.id);
                    }}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left cursor-pointer active:scale-98",
                      isActive 
                        ? `border-indigo-500 ${activeTheme.isDark ? "bg-indigo-950/30 text-indigo-400 font-bold" : themeOption.primaryAccentBg + " " + themeOption.primaryAccentText} ring-2 ring-indigo-500/20 shadow-xs`
                        : (activeTheme.isDark ? "border-slate-800/80 bg-slate-950/20 hover:bg-slate-800/45 text-slate-300 hover:text-white" : "border-slate-200/80 bg-white hover:bg-slate-50/50 hover:border-slate-300")
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Gradient Circle Visual */}
                      <div className={`w-8 h-8 rounded-full bg-linear-to-br ${themeOption.primaryGradient} border border-white shrink-0 shadow-xs flex items-center justify-center`}>
                        {isActive && <Check className="w-4 h-4 text-white font-heavy" />}
                      </div>
                      <div>
                        <p className={cn("text-xs font-black leading-none", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>{themeOption.name}</p>
                        <p className="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 uppercase">Accent Theme Mode</p>
                      </div>
                    </div>

                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                      {isActive ? "Active" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Card 3: Global Background Uploader */}
          <section className={cn("rounded-3xl border shadow-xs p-6 sm:p-8 space-y-6 transition-all duration-300", activeTheme.isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200")}>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl", activeTheme.isDark ? "bg-indigo-950/40 text-indigo-400" : "bg-indigo-50 text-indigo-700")}>
                <Image className="w-5 h-5" />
              </div>
              <div>
                <h3 className={cn("font-extrabold text-sm tracking-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>Global App Background</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Upload an image to style the entire canvas background</p>
              </div>
            </div>

            <div className="space-y-4">
              {customBg ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border-2 border-slate-300/40 aspect-[16/7] shadow-inner group">
                    <img 
                      src={customBg} 
                      alt="Custom Canvas Background Preview" 
                      className="w-full h-full object-cover select-none" 
                    />
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-3xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                      <button
                        type="button"
                        onClick={() => onUpdateCustomBg(null)}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove Background
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider flex items-center gap-1 animate-pulse">
                      <Check className="w-3.5 h-3.5" /> Background Canvas Active
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateCustomBg(null)}
                      className={cn("text-[10.5px] font-black uppercase tracking-wider hover:underline transition-all flex items-center gap-1 cursor-pointer", activeTheme.isDark ? "text-rose-450 hover:text-rose-400" : "text-rose-600 hover:text-rose-700")}
                    >
                      Clear Background
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      var file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          alert("Image file size should be within 2MB for optimal load-times (offline base64 store).");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result === "string") {
                            onUpdateCustomBg(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="canvas-global-bg-upload"
                  />
                  <label
                    htmlFor="canvas-global-bg-upload"
                    className={cn(
                      "w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-3 p-4 text-center cursor-pointer transition-all duration-150 active:scale-98",
                      activeTheme.isDark 
                        ? "border-slate-800 bg-slate-900/10 hover:bg-slate-900/30 hover:border-indigo-500/50 text-slate-350" 
                        : "border-slate-350 bg-slate-50 hover:bg-slate-100/50 hover:border-indigo-400 text-slate-600"
                    )}
                  >
                    <div className={cn("p-2 rounded-xl", activeTheme.isDark ? "bg-slate-900 text-indigo-400" : "bg-white text-slate-400 shadow-2xs")}>
                      <Image className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider">Choose Custom Background</p>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">Kahit anong format ng picture ay pwede (PNG, JPG, WEBP, GIF, SVG, etc.)</p>
                      <p className="text-[8px] text-slate-500 font-medium mt-0.5">Recommended within 2MB size limit</p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </section>

          {/* Card 4: Performance & Rendering Optimization */}
          <section className={cn(
            "rounded-3xl border shadow-xs p-6 sm:p-8 space-y-6 transition-all duration-300",
            activeTheme.isDark ? "bg-slate-900/40 border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-xl", activeTheme.isDark ? "bg-indigo-950/40 text-indigo-400" : "bg-emerald-50 text-emerald-700")}>
                <SlidersHorizontal className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className={cn("font-extrabold text-sm tracking-tight", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>Performance & CPU Tuning</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Toggle system optimizations for smoother rendering and speed</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Performance Mode Switch */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all flex items-start gap-3",
                performanceMode 
                  ? "border-emerald-500/30 bg-emerald-500/[0.03]"
                  : activeTheme.isDark ? "border-slate-800 bg-slate-950/20" : "border-slate-150 bg-slate-50"
              )}>
                <input 
                  type="checkbox" 
                  id="system-performance-mode-toggle"
                  checked={performanceMode}
                  onChange={(e) => handleTogglePerformanceMode(e.target.checked)}
                  className="mt-1 h-4.5 w-4.5 rounded-sm border-slate-350 text-indigo-650 focus:ring-indigo-505"
                />
                <div>
                  <label htmlFor="system-performance-mode-toggle" className={cn("text-xs font-black block cursor-pointer select-none", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                    Enable Performance Boost Mode
                  </label>
                  <p className="text-[10px] text-slate-400 font-medium leading-normal mt-1">
                    Ideal for slower devices. This limits particles in the constellation network background, bypasses CPU-heavy canvas connector calculations, and lowers Report Matrix pagination size to 40 per page to save computing threads.
                  </p>
                </div>
              </div>

              {/* Server Cache Clear Button */}
              <div className={cn(
                "p-4 rounded-2xl border transition-all",
                activeTheme.isDark ? "border-slate-800 bg-slate-950/20" : "border-slate-150 bg-slate-50"
              )}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className={cn("text-xs font-black", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                      Flush Server Datasets Cache
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium leading-normal">
                      Flushes Google Sheet cache proxies on the cloud server to pull the absolute newest values.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isClearingCache}
                    onClick={handleClearServerCache}
                    className={cn(
                      "px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer select-none",
                      isClearingCache 
                        ? "bg-slate-350 text-slate-500 cursor-not-allowed"
                        : "bg-slate-800 hover:bg-slate-900 text-white"
                    )}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", isClearingCache ? "animate-spin" : "")} />
                    <span>{isClearingCache ? "Clearing..." : "Flush Cache"}</span>
                  </button>
                </div>

                {clearCacheSuccess && (
                  <div className="text-emerald-600 font-bold text-[10px] uppercase tracking-wider mt-2.5 flex items-center gap-1 animate-pulse">
                    <Check className="w-4 h-4 shrink-0" />
                    Server proxy cache successfully flushed! Fresh datasets synced.
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>

        {/* Right Column: Protected Admin Permissions Panel */}
        <div className="space-y-8">
          
          <section className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className={`p-6 ${isAdminUnlocked ? 'bg-indigo-900' : 'bg-slate-900'} text-white flex items-center justify-between transition-colors`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  {isAdminUnlocked ? (
                    <Unlock className="w-5 h-5 text-indigo-400 animate-bounce" />
                  ) : (
                    <Lock className="w-5 h-5 text-amber-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5">
                    GCR Admin Management Portal
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Data Admin Lockbox Access</p>
                </div>
              </div>
              
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                isAdminUnlocked ? "bg-emerald-500 text-white" : "bg-amber-500 text-slate-950"
              }`}>
                {isAdminUnlocked ? "Unlocked" : "Locked"}
              </span>
            </div>

            <div className="p-6 sm:p-8">
              {!isAdminUnlocked ? (
                /* PASSWORD SIGN-IN PORTION */
                <form onSubmit={handleAdminVerify} className="space-y-5 py-4">
                  <div className="text-center space-y-2 mb-2">
                    <ShieldCheck className="w-12 h-12 text-slate-400 mx-auto opacity-30 stroke-[1.5]" />
                    <h4 className="font-black text-slate-700 text-sm uppercase tracking-wider">Access Codes Required</h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-normal">
                      Entering options to restrict, lock, or grant sidebar page access requires the administrator password.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1.5 block">
                    
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        placeholder="Enter system password"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {adminError && (
                      <p className="text-[10px] text-rose-500 font-bold mt-2 flex items-center gap-1.5 px-0.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {adminError}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs tracking-widest uppercase py-3 px-4 rounded-xl shadow-xs hover:shadow-md transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Verify System Access
                  </button>
                </form>
              ) : (
                /* ADMIN MANAGEMENT CONTROL BOARD */
                <>
                  <form onSubmit={handleSaveAdminRules} className="space-y-6">
                  
                  {/* Select Member / Add Custom Guest to restrict */}
                  <div className="space-y-4 p-4 sm:p-5 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center justify-between border-b border-slate-200/50 pb-2.5">
                      <label className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">
                        Direct Member Directory
                      </label>
                      <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wider">Dynamic Auto-Fill</span>
                    </div>

                    {/* 🟢 Real-time Online Active Users */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                          🟢 Live Active Users ({activeUsers.length})
                        </label>
                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider animate-pulse flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-emerald-500" /> Real-time Sync
                        </span>
                      </div>

                      {activeUsers.length === 0 ? (
                        <div className="p-3 text-center border border-dashed border-slate-200 rounded-xl bg-white/70">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">No other active users connected</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                          {activeUsers.map((item, idx) => {
                            const itemId = (item.id || item.email || "").toLowerCase().trim();
                            const isMatch = (adminTargetEmail || "").toLowerCase().trim() === itemId;
                            const isMe = itemId === (currentUser?.email || "").toLowerCase().trim();
                            const lockedCount = itemId ? (restrictions[itemId] || []).length : 0;
                            const initials = (item.name || "User").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

                            return (
                              <button
                                key={`${item.id}-${idx}`}
                                type="button"
                                onClick={() => setAdminTargetEmail(item.id)}
                                className={`p-2.5 rounded-xl border transition-all text-left flex items-center justify-between cursor-pointer hover:shadow-xs group ${
                                  isMatch 
                                    ? "bg-slate-900 border-slate-900 text-white shadow-xs" 
                                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {/* Color coded avatar */}
                                  <div 
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-black shrink-0 overflow-hidden shadow-2xs border ${
                                      isMatch ? "border-white/10" : "border-slate-100"
                                    }`}
                                    style={{ backgroundColor: item.color }}
                                  >
                                    {item.picture ? (
                                      <img 
                                        src={item.picture} 
                                        alt="Avatar" 
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover" 
                                      />
                                    ) : (
                                      initials
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-xs truncate leading-none">{item.name}</span>
                                      {isMe && (
                                        <span className={`text-[8px] font-black uppercase px-1 py-0.2 heading-none rounded ${
                                          isMatch ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600"
                                        }`}>
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <span className={`text-[9px] block mt-0.5 font-medium truncate ${
                                      isMatch ? "text-slate-300" : "text-slate-400"
                                    }`}>
                                      {item.email || item.id}
                                    </span>

                                    {/* Render dynamic registration position fields inside active user list layout */}
                                    {(item.jobPosition || item.positionCode) && (
                                      <div className="flex gap-1 items-center mt-1 flex-wrap">
                                        {item.jobPosition && (
                                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                            isMatch ? "bg-white/15 text-white" : "bg-blue-50 text-blue-600 border border-blue-100"
                                          }`}>
                                            {item.jobPosition}
                                          </span>
                                        )}
                                        {item.positionCode && (
                                          <span className={`text-[8px] font-extrabold font-mono px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                            isMatch ? "bg-white/15 text-indigo-400" : "bg-indigo-50 text-indigo-650 border border-indigo-100"
                                          }`}>
                                            Code: {item.positionCode}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0 flex flex-col items-end gap-1.5 pl-2">
                                  <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider leading-none ${
                                    isMatch ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
                                  }`}>
                                    Viewing: {item.activeSection.replace(/([A-Z])/g, " $1").trim()}
                                  </span>
                                  {lockedCount > 0 && (
                                    <span className="text-[8px] font-black uppercase bg-red-500 text-white px-1.5 py-0.5 rounded leading-none shrink-0">
                                      {lockedCount} Locked
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Offline Quick list directory */}
                    <div className="space-y-1.5 border-t border-slate-200/50 pt-3">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">
                        📁 Quick-Select Preset Directory (Offline Mode)
                      </label>
                      {quickSelectPresets.length === 0 ? (
                        <p className="text-[10px] text-slate-400 font-semibold italic">All presets deleted.</p>
                      ) : (
                        <div className="flex gap-2 flex-wrap pb-1">
                          {quickSelectPresets.map((member, idx) => {
                            const memberEmail = (member.email || "").toLowerCase().trim();
                            const isMatch = (adminTargetEmail || "").toLowerCase().trim() === memberEmail;
                            const isOnline = activeUsers.some(au => {
                              const auId = (au.id || "").toLowerCase().trim();
                               const auEmail = (au.email || "").toLowerCase().trim();
                               return auId === memberEmail || auEmail === memberEmail;
                             });
                            const lockedCount = memberEmail ? ((restrictions[memberEmail] || restrictions[member.name] || []).length) : 0;
                            return (
                              <div key={`${memberEmail}-${idx}`} className="relative group/preset">
                                <button
                                  type="button"
                                  onClick={() => setAdminTargetEmail(member.email)}
                                  className={`px-3 py-2 pr-7 text-xs font-bold rounded-xl border transition-all text-left flex flex-col justify-center items-start cursor-pointer hover:shadow-2xs ${
                                    isMatch 
                                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" 
                                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 max-w-[120px]">
                                    <span className="font-extrabold leading-none truncate">{member.name}</span>
                                    {isOnline && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Online" />
                                    )}
                                  </div>
                                  <span className={`text-[9px] mt-0.5 font-medium min-w-0 max-w-[120px] truncate ${isMatch ? "text-white/80" : "text-slate-400"}`}>{member.email}</span>
                                  {lockedCount > 0 && (
                                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 mt-1 rounded ${isMatch ? "bg-white/30 text-white" : "bg-amber-100 text-amber-700"}`}>
                                      {lockedCount} Locked
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    deletePreset(member.email);
                                  }}
                                  className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                    isMatch ? "bg-indigo-700/50 hover:bg-indigo-800 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-500"
                                  }`}
                                  title={`Remove ${member.name} from presets`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Email Input Box as Requested */}
                    <div className="pt-3 border-t border-slate-200/60 space-y-1.5">
                      <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest block">
                        Target Member Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={adminTargetEmail}
                        onChange={(e) => setAdminTargetEmail(e.target.value)}
                        placeholder="Enter email to lock/unlock, e.g. member@gmail.com"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-hidden focus:shadow-xs placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Settings Grid Block - On/Off Toggles for selected User */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-150 pb-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
                        <h5 className="text-xs font-black text-slate-800 tracking-tight">
                          Configure Restricted Sidebar Tabs for:
                        </h5>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsConfigureRestrictedVisible(!isConfigureRestrictedVisible)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer"
                        title={isConfigureRestrictedVisible ? "Hide configuration controls" : "Unhide configuration controls"}
                      >
                        {isConfigureRestrictedVisible ? (
                          <>
                            <EyeOff className="w-3 h-3 text-indigo-550 shrink-0" />
                            <span>Hide</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 text-indigo-550 shrink-0" />
                            <span>Unhide</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {isConfigureRestrictedVisible && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Dynamic breakdown card of target member credentials */}
                        {targetMemberDetails && (
                          <div className="bg-slate-50 border border-slate-200/85 p-4 rounded-2xl space-y-2.5 font-sans select-none animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Selected Profile Access Detail</span>
                              <span className="text-[8px] font-black uppercase text-indigo-600 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 rounded">Data Admin Lockbox Link</span>
                            </div>
                            <div className="flex justify-between items-start gap-3 flex-wrap sm:flex-nowrap">
                              <div className="space-y-1">
                                <h6 className="text-xs font-black text-slate-800 leading-tight">{targetMemberDetails.name}</h6>
                                <code className="text-[9.5px] block text-slate-550 font-mono text-slate-500 bg-slate-200/30 px-2 py-0.5 rounded">{targetMemberDetails.email}</code>
                              </div>
                              
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[9px] font-black text-indigo-650 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-2xs">
                                  {targetMemberDetails.jobPosition}
                                </span>
                                {targetMemberDetails.positionCode && targetMemberDetails.positionCode !== "N/A" && (
                                  <span className="text-[9px] font-black font-mono text-slate-650 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Code: {targetMemberDetails.positionCode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {isTargetSuperAdmin ? (
                          <div className="text-xs font-bold px-3.5 py-3.5 text-indigo-800 leading-relaxed bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-2.5 shadow-sm">
                            <span className="text-lg leading-none shrink-0">🛡️</span>
                            <div>
                              <p className="font-black text-indigo-900 uppercase tracking-wide">Super Admin / Owner Protection </p>
                              <p className="text-slate-600 font-medium text-[11px] mt-1 leading-normal">
                                Ang email na <strong className="text-indigo-700 font-extrabold">antoque2822@gmail.com</strong> ay ang pinaka-Admin (Director). Hindi maaaring i-lock o i-restrict ang access ng account na ito. All sidebar functions stay permanently unlocked & visible!
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs font-semibold px-2 text-slate-500 leading-relaxed bg-indigo-50/50 rounded-lg p-2.5 border border-indigo-100/50">
                            Specify which views should be <strong className="text-red-500 font-extrabold">Disabled (Locked)</strong> for email <span className="font-extrabold text-indigo-700">{adminTargetEmail || "(no email typed)"}</span> below:
                          </div>
                        )}

                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 shadow-2xs">
                          {SIDEBAR_TABS.map((tab) => {
                            const isRestricted = isTargetSuperAdmin ? false : draftRestrictions.includes(tab.id);
                            return (
                              <div key={tab.id} className="p-3.5 pr-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{tab.label}</p>
                                  <p className="text-[10px] font-semibold text-slate-400">
                                    Sidebar status: {isTargetSuperAdmin ? (
                                      <span className="text-indigo-600 font-extrabold uppercase">🛡️ PERMANENTLY UNLOCKED</span>
                                    ) : isRestricted ? (
                                      <span className="text-red-500 font-extrabold uppercase">🚫 Restricted & Hidden</span>
                                    ) : (
                                      <span className="text-emerald-600 font-extrabold uppercase">✅ Allowed & Visible</span>
                                    )}
                                  </p>
                                </div>

                                {/* Custom Sliding Switch toggle component */}
                                <button
                                  type="button"
                                  disabled={isTargetSuperAdmin}
                                  onClick={() => toggleDraftRestriction(tab.id)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                    isTargetSuperAdmin ? "bg-indigo-200 cursor-not-allowed opacity-60" : isRestricted ? "bg-red-500" : "bg-slate-200"
                                  }`}
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                      isRestricted ? "translate-x-5" : "translate-x-0"
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* System warning and save buttons */}
                        <div className="space-y-4 pt-1">
                          <div className="p-3.5 bg-orange-50 border border-orange-100 rounded-2xl flex gap-3 text-amber-800 text-[11px] leading-relaxed">
                            <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-bold">Save Required to Apply Rules</p>
                              <p className="text-slate-500 text-[10px] font-medium mt-0.5">
                                Toggles will only be saved when you click the Save button. When saved, the selected tabs will immediately disappear from that user's sidebar upon access.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <AnimatePresence>
                              {adminSaveSuccess && (
                                <motion.p 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -10 }}
                                  className="text-emerald-600 font-bold text-xs flex items-center gap-1"
                                >
                                  <Check className="w-4.5 h-4.5 shrink-0" />
                                  Rules Saved Successfully!
                                </motion.p>
                              )}
                            </AnimatePresence>

                            <button
                              type="submit"
                              className="ml-auto bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs tracking-wider uppercase py-2.5 px-6 rounded-xl hover:shadow-md transition-all active:scale-95 cursor-pointer"
                            >
                              Save Member Rules
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lock admin console button */}
                  <div className="pt-2">
                    <button
                      type="button; submit"
                      onClick={(e) => { e.preventDefault(); setIsAdminUnlocked(false); }}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1.5 mx-auto transition-colors cursor-pointer"
                    >
                      <Lock className="w-3 h-3" />
                      Lock Admin Dashboard
                    </button>
                  </div>

                </form>

                {/* Sub-divider */}
                <div className="my-6 border-t border-slate-100" />

                {/* Developer Footer Team Profiles Editing Section */}
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="p-5 sm:p-6 bg-slate-50 border border-slate-200 rounded-3xl shadow-xs space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                      <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-850 tracking-tight">
                          Manage Footer Developer Profiles
                        </h4>
                        <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest mt-0.5">
                          Change names, badges, roles & portraits in team credits
                        </p>
                      </div>
                    </div>

                    {/* PROFILE SELECTOR OPTION TABS */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-550 uppercase tracking-widest block">
                        📁 Choose Developer Profile to Edit (Option Name)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-2 border border-slate-200 rounded-2xl shadow-3xs">
                        <button
                          type="button"
                          onClick={() => setEditingDevProfile(1)}
                          className={`px-4 py-3 rounded-xl border transition-all cursor-pointer text-left flex items-center justify-between ${
                            editingDevProfile === 1
                              ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                              : "bg-slate-50 border-slate-100 hover:bg-slate-100/70 text-slate-700 hover:border-slate-200"
                          }`}
                        >
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wider opacity-85 leading-none">Option 1: Lead Dev Profile</p>
                            <p className="text-[12px] font-extrabold mt-1">
                              {dev1Name || "Daniel B. Antoque"}
                            </p>
                          </div>
                          {editingDevProfile === 1 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white shrink-0 shadow-sm" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingDevProfile(2)}
                          className={`px-4 py-3 rounded-xl border transition-all cursor-pointer text-left flex items-center justify-between ${
                            editingDevProfile === 2
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                              : "bg-slate-50 border-slate-100 hover:bg-slate-100/70 text-slate-700 hover:border-slate-200"
                          }`}
                        >
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-wider opacity-85 leading-none">Option 2: Support Dev Profile</p>
                            <p className="text-[12px] font-extrabold mt-1">
                              {dev2Name || "Christian Jay Pablo"}
                            </p>
                          </div>
                          {editingDevProfile === 2 && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 border border-white shrink-0 shadow-sm" />
                          )}
                        </button>
                      </div>
                     {/* DYNAMIC SPACIOUS FULL-WIDTH EDITING PANEL */}
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs animate-in fade-in duration-300">
                      {editingDevProfile === 1 ? (
                        /* DEV 1 DEVELOPER DETAILS PANEL */
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                                Profile 1: Main Developer (Exposed Editing mode)
                              </span>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Customize portrait image, full name, specialty role designation and biography details
                              </p>
                            </div>
                            {dev1Badge && (
                              <span className="text-[9px] font-black uppercase text-white bg-slate-900 px-2.5 py-1 rounded shadow-xs max-w-fit">
                                {dev1Badge}
                              </span>
                            )}
                          </div>

                          <div className="space-y-6">
                            {/* Live Portrait Preview Card - CENTERED ON TOP */}
                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-150 rounded-2xl">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 text-center">
                                👁️ Live Portrait Preview Card
                              </label>
                              
                              <div className="bg-white p-3 border border-slate-200/60 rounded-3xl shadow-xs max-w-xs w-full">
                                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center gap-4 shadow-lg text-white relative overflow-hidden">
                                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-550/20 rounded border border-indigo-500/30 text-[8px] uppercase tracking-wider font-extrabold text-indigo-300">
                                    Live Preview
                                  </div>
                                  
                                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-550/35 shadow-md bg-slate-800 flex items-center justify-center relative mt-2">
                                    {dev1Pic ? (
                                      <img src={dev1Pic} alt="Dev 1 Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User className="w-8 h-8 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="space-y-1.5 min-w-0 w-full">
                                    <h5 className="text-sm font-black tracking-wide text-white truncate px-2">
                                      {dev1Name || "No Name Entered"}
                                    </h5>
                                    <p className="text-[10px] text-indigo-400 font-extrabold tracking-widest uppercase truncate">
                                      {dev1Role || "No Role Entered"}
                                    </p>
                                    <div className="border-t border-slate-800 my-2 pt-2" />
                                    <p className="text-[10.5px] text-slate-300 font-medium leading-relaxed px-3 text-justify line-clamp-4">
                                      {dev1Bio || "No biographical information entered yet."}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Inputs form column - ON BOTTOM */}
                            <div className="space-y-4 pt-2">
                              <div className="border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                                  📝 Edit Profile Details
                                </label>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Full Name
                                  </label>
                                  <input
                                    type="text"
                                    value={dev1Name}
                                    onChange={(e) => setDev1Name(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="e.g. Daniel B. Antoque"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Role Title
                                  </label>
                                  <input
                                    type="text"
                                    value={dev1Role}
                                    onChange={(e) => setDev1Role(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="e.g. Main Developer"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Badge Text
                                  </label>
                                  <input
                                    type="text"
                                    value={dev1Badge}
                                    onChange={(e) => setDev1Badge(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="e.g. Lead"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Portrait Photo URL
                                  </label>
                                  <input
                                    type="text"
                                    value={dev1Pic.startsWith("data:") ? "" : dev1Pic}
                                    onChange={(e) => setDev1Pic(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-600 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="Paste Image URL Link"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                                  Local File Upload
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id="dev1-portrait-upload-input"
                                  className="hidden"
                                  onChange={handleDev1PicUpload}
                                />
                                <label
                                  htmlFor="dev1-portrait-upload-input"
                                  className="w-full h-10 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 cursor-pointer rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-indigo-600 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xs"
                                >
                                  <Camera className="w-4 h-4 text-slate-500" />
                                  Choose Photo Portrait File...
                                </label>
                              </div>

                              <div>
                                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                  Biography/Details Bio
                                </label>
                                <textarea
                                  rows={3}
                                  value={dev1Bio}
                                  onChange={(e) => setDev1Bio(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-700 leading-normal focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs resize-none"
                                  placeholder="Describe developer bio and contribution context..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* DEV 2 DEVELOPER DETAILS PANEL */
                        <div className="space-y-6">
                          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-2">
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-750 bg-emerald-50 px-2.5 py-1 rounded-md">
                                Profile 2: Support Developer (Exposed Editing mode)
                              </span>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">
                                Customize portrait image, full name, specialty role designation and biography details
                              </p>
                            </div>
                            {dev2Badge && (
                              <span className="text-[9px] font-black uppercase text-white bg-emerald-600 px-2.5 py-1 rounded shadow-xs max-w-fit">
                                {dev2Badge}
                              </span>
                            )}
                          </div>

                          <div className="space-y-6">
                            {/* Live Portrait Preview Card - CENTERED ON TOP */}
                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-150 rounded-2xl">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 text-center">
                                👁️ Live Portrait Preview Card
                              </label>
                              
                              <div className="bg-white p-3 border border-slate-200/60 rounded-3xl shadow-xs max-w-xs w-full">
                                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col items-center text-center gap-4 shadow-lg text-white relative overflow-hidden">
                                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-550/20 rounded border border-emerald-500/30 text-[8px] uppercase tracking-wider font-extrabold text-emerald-300">
                                    Live Preview
                                  </div>
                                  
                                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-emerald-500/30 shadow-md bg-slate-800 flex items-center justify-center relative mt-2">
                                    {dev2Pic ? (
                                      <img src={dev2Pic} alt="Dev 2 Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                    ) : (
                                      <User className="w-8 h-8 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="space-y-1.5 min-w-0 w-full">
                                    <h5 className="text-sm font-black tracking-wide text-white truncate px-2">
                                      {dev2Name || "No Name Entered"}
                                    </h5>
                                    <p className="text-[10px] text-emerald-400 font-extrabold tracking-widest uppercase truncate">
                                      {dev2Role || "No Role Entered"}
                                    </p>
                                    <div className="border-t border-slate-800 my-2 pt-2" />
                                    <p className="text-[10.5px] text-slate-300 font-medium leading-relaxed px-3 text-justify line-clamp-4">
                                      {dev2Bio || "No biographical information entered yet."}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Inputs form column - ON BOTTOM */}
                            <div className="space-y-4 pt-2">
                              <div className="border-b border-slate-100 pb-2">
                                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                                  📝 Edit Profile Details
                                </label>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Full Name
                                  </label>
                                  <input
                                    type="text"
                                    value={dev2Name}
                                    onChange={(e) => setDev2Name(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="e.g. Christian Jay Pablo"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Role Title
                                  </label>
                                  <input
                                    type="text"
                                    value={dev2Role}
                                    onChange={(e) => setDev2Role(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="e.g. Support Developer"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Badge Text
                                  </label>
                                  <input
                                    type="text"
                                    value={dev2Badge}
                                    onChange={(e) => setDev2Badge(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-205 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="e.g. Partner"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                    Portrait Photo URL
                                  </label>
                                  <input
                                    type="text"
                                    value={dev2Pic.startsWith("data:") ? "" : dev2Pic}
                                    onChange={(e) => setDev2Pic(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-600 focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs"
                                    placeholder="Paste Image URL Link"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                                  Local File Upload
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id="dev2-portrait-upload-input"
                                  className="hidden"
                                  onChange={handleDev2PicUpload}
                                />
                                <label
                                  htmlFor="dev2-portrait-upload-input"
                                  className="w-full h-10 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 cursor-pointer rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-indigo-600 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-2xs"
                                >
                                  <Camera className="w-4 h-4 text-slate-500" />
                                  Choose Photo Portrait File...
                                </label>
                              </div>

                              <div>
                                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                                  Biography/Details Bio
                                </label>
                                <textarea
                                  rows={3}
                                  value={dev2Bio}
                                  onChange={(e) => setDev2Bio(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-700 leading-normal focus:border-indigo-500 focus:outline-hidden focus:bg-white transition-all shadow-2xs resize-none"
                                  placeholder="Describe developer bio and contribution context..."
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </div>

                    {/* Submit Developer Update Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-5 border-t border-slate-200">
                      <div>
                        <AnimatePresence>
                          {devSuccessMsg && (
                            <motion.span
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              className="text-emerald-600 text-xs font-black flex items-center gap-1.5"
                            >
                              <Check className="w-4 h-4 shrink-0" />
                              Profiles updated and saved successfully!
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveDeveloperProfiles()}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-[10px] uppercase tracking-widest px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
                      >
                        Save Developer Credits
                      </button>
                    </div>
                  </div>
                </div>

                {/* Global Dashboard Canvas Background Setting block */}
                  <div className="p-4 sm:p-5 bg-emerald-50/40 border border-emerald-100 rounded-3xl space-y-5 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 border-b border-emerald-100/60 pb-3">
                      <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                        <Image className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-emerald-900 tracking-tight">
                          Global SC LA Dashboard Background
                        </h4>
                        <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider">
                          Change the hero background image for all connected users simultaneously
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Base64 image file selection or image link */}
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          Global Background Photo URL
                        </label>
                        <input
                          type="text"
                          value={globalBg.startsWith("data:") ? "" : globalBg}
                          onChange={(e) => {
                            setGlobalBg(e.target.value);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700"
                          placeholder="Paste Direct Photo URL (e.g. https://...)"
                        />
                      </div>

                      {/* File Upload Button */}
                      <div>
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                          Or Upload Global Background Portrait
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          id="global-bg-upload-input"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                alert("Image must be smaller than 5MB.");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === "string") {
                                  setGlobalBg(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label
                          htmlFor="global-bg-upload-input"
                          className="w-full h-8 bg-white hover:bg-slate-50 border border-slate-200 cursor-pointer rounded-xl text-[10px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-2xs"
                        >
                          <Camera className="w-3.5 h-3.5 text-slate-500" />
                          Choose Custom Global Canvas Image...
                        </label>
                      </div>

                      {/* Live Preview block if any */}
                      {globalBg && (
                        <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-28 bg-slate-900 group">
                          <img 
                            src={globalBg} 
                            alt="Global Preview" 
                            className="w-full h-full object-cover opacity-60"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent flex items-end p-2.5">
                            <span className="text-[9px] text-white font-black tracking-widest uppercase">Global Background Active Preview</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setGlobalBg("")}
                            className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <AnimatePresence>
                          {bgSuccessMsg && (
                            <motion.span
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -8 }}
                              className="text-emerald-600 text-xs font-black flex items-center gap-1"
                            >
                              <Check className="w-4 h-4 shrink-0" />
                              Global background broadcasted successfully!
                            </motion.span>
                          )}
                        </AnimatePresence>

                        <button
                          type="button"
                          onClick={() => {
                            try {
                              localStorage.setItem("gcr_global_team_photo", globalBg);
                            } catch (err) {
                              console.warn("localStorage setItem failed:", err);
                            }
                            // Fire custom event to PresenceIndicator websocket to broadcast to all clients!
                            window.dispatchEvent(new CustomEvent("scla_broadcast_global_background", {
                              detail: { globalBackground: globalBg }
                            }));
                            setBgSuccessMsg(true);
                            setTimeout(() => setBgSuccessMsg(false), 3000);
                          }}
                          className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-widest px-5 py-2.5 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                        >
                          Apply & Broadcast Global Background
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lock admin console button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdminUnlocked(false)}
                      className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest flex items-center gap-1.5 mx-auto transition-colors cursor-pointer"
                    >
                      <Lock className="w-3 h-3" />
                      Lock Admin Dashboard
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>

        </div>

      </div>
      ) : settingsActiveTab === "layout" ? (
        <DashboardLayoutConfig 
          activeTheme={activeTheme} 
          isAdminUnlocked={isAdminUnlocked}
          onUnlockAdmin={() => setIsAdminUnlocked(true)}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Controls Card */}
          <div className={cn(
            "p-6 rounded-[2.5rem] border shadow-xs space-y-4",
            activeTheme.isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          )}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className={cn("text-base font-black tracking-tight uppercase flex items-center gap-2", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                  <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
                  System Activity & Document Audits
                </h3>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mt-0.5">
                  Real-time security logs, verification checks, and administrative overrides
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={fetchAuditLogs}
                  disabled={isLogsLoading}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border",
                    activeTheme.isDark ? "bg-slate-800 border-slate-700 text-slate-200 hover:text-white" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  )}
                  title="Synchronize audit log from backend memory storage"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 text-blue-500", isLogsLoading && "animate-spin")} />
                  {isLogsLoading ? "Syncing..." : "Sync Logs"}
                </button>

                <button
                  onClick={handleExportLogsCSV}
                  disabled={auditLogs.length === 0}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md",
                    activeTheme.primaryBg, activeTheme.primaryShadow
                  )}
                  title="Export filtered records to local CSV format"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search logs by user, action, details, filename, or lot ID..."
                  value={logsSearch}
                  onChange={(e) => setLogsSearch(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none font-bold text-xs transition-all",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200 text-slate-850"
                  )}
                />
              </div>

              <div className="relative">
                <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={logsActionFilter}
                  onChange={(e) => setLogsActionFilter(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none font-bold text-xs cursor-pointer appearance-none",
                    activeTheme.isDark ? "bg-slate-950 text-slate-100 border-slate-800" : "bg-slate-50 border-slate-200 text-slate-850"
                  )}
                >
                  <option value="ALL">All Actions</option>
                  <option value="UPLOAD">Document Uploads</option>
                  <option value="DELETE">Document Deletions</option>
                  <option value="RENAME">Document Renames</option>
                  <option value="METADATA_UPDATE">Metadata Updates</option>
                  <option value="STATUS_CHANGE">Status Overrides</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Card */}
          {logsError ? (
            <div className="p-8 text-center bg-rose-500/10 border border-rose-500/20 rounded-[2.5rem] space-y-2">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-xs font-black uppercase text-rose-500 tracking-wider">Error Syncing Logs</p>
              <p className="text-xs text-slate-400 font-semibold">{logsError}</p>
            </div>
          ) : isLogsLoading && auditLogs.length === 0 ? (
            <div className="py-24 text-center space-y-3 bg-slate-500/5 rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/80">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Accessing mainframe security system...</p>
            </div>
          ) : (() => {
            const filtered = auditLogs.filter(log => {
              const matchSearch = 
                log.userName.toLowerCase().includes(logsSearch.toLowerCase()) ||
                log.userEmail.toLowerCase().includes(logsSearch.toLowerCase()) ||
                log.action.toLowerCase().includes(logsSearch.toLowerCase()) ||
                log.details.toLowerCase().includes(logsSearch.toLowerCase()) ||
                (log.fileName && log.fileName.toLowerCase().includes(logsSearch.toLowerCase())) ||
                (log.lotId && log.lotId.toLowerCase().includes(logsSearch.toLowerCase()));
              
              const matchAction = logsActionFilter === "ALL" || log.action === logsActionFilter;
              
              return matchSearch && matchAction;
            });

            if (filtered.length === 0) {
              return (
                <div className="p-16 text-center border border-slate-200/50 dark:border-slate-800/80 rounded-[2.5rem] space-y-2 bg-slate-500/5">
                  <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-black uppercase text-slate-400 tracking-wider">No audit matches found</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Try loosening your search keywords or choosing another action filter.</p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto rounded-[2.5rem] border border-slate-200/50 dark:border-slate-800/80 shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={cn(
                      "border-b text-[9px] font-black uppercase tracking-widest",
                      activeTheme.isDark ? "bg-slate-950/40 border-slate-850 text-slate-400" : "bg-slate-50 border-slate-150 text-slate-550"
                    )}>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">Lot ID</th>
                      <th className="px-6 py-4">File Affected</th>
                      <th className="px-6 py-4">Description / Metadata Changes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-850/60 text-xs">
                    {filtered.map((log) => (
                      <tr 
                        key={log.id} 
                        className={cn(
                          "transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-950/20",
                          activeTheme.isDark ? "bg-slate-900/10" : "bg-white"
                        )}
                      >
                        <td className="px-6 py-4 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="font-extrabold text-slate-700 dark:text-slate-200">{log.userName}</p>
                          <p className="text-[9px] text-slate-400 font-medium">{log.userEmail}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                            log.action === "UPLOAD" && "bg-emerald-500/10 text-emerald-500 border-emerald-500/10",
                            log.action === "DELETE" && "bg-rose-500/10 text-rose-500 border-rose-500/10",
                            log.action === "RENAME" && "bg-blue-500/10 text-blue-500 border-blue-500/10",
                            log.action === "METADATA_UPDATE" && "bg-purple-500/10 text-purple-500 border-purple-500/10",
                            log.action === "STATUS_CHANGE" && "bg-amber-500/10 text-amber-500 border-amber-500/10"
                          )}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-500">
                          {log.lotId || "—"}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-350 max-w-[150px] truncate" title={log.fileName}>
                          {log.fileName || "—"}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-500 dark:text-slate-400 leading-relaxed max-w-[300px] break-words">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </motion.div>
      )}

    </div>
  );
};
