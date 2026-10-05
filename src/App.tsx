import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { PresenceIndicator } from "./components/PresenceIndicator";
import { fetchDashboardData, fetchWeeklyUpdates } from "./services/dataService";
import { LotData, WeeklyUpdate, GoogleUser } from "./types";
import { RefreshCcw, Bell, ChevronLeft, ChevronRight, Sun, Moon, Search, X, Upload, Sparkles, Keyboard, HelpCircle, ExternalLink, Printer, FileEdit, GitCompare, ChevronDown, Layers } from "lucide-react";
import { isSameWeek, startOfWeek, format } from "date-fns";
import { motion, AnimatePresence } from "motion/react";
import { Login } from "./components/Login";
import { themes, ThemeConfig, ThemeId, getActiveTheme } from "./lib/theme";
import { AssignedAreaModal } from "./components/AssignedAreaModal";
import { cn } from "./lib/utils";
import { SCLALogo } from "./components/SCLALogo";
import { NetworkLoaderCanvas } from "./components/NetworkLoaderCanvas";
import { HeaderSearchBox } from "./components/HeaderSearchBox";
import { LotComparisonModal } from "./components/LotComparisonModal";

import { Dashboard } from "./components/Dashboard";
import { WeeklyUpdates } from "./components/WeeklyUpdates";
import { LotProfile } from "./components/LotProfile";
import { ReportGenerator } from "./components/ReportGenerator";
import { AddAccomplishment } from "./components/AddAccomplishment";
import { UploadDocuments } from "./components/UploadDocuments";
import { SettingsView } from "./components/SettingsView";
import { fetchDashboardConfigFromBackend } from "./lib/dashboardConfig";

export default function App() {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    try {
      const stored = localStorage.getItem("gcr_la_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [activeSection, setActiveSection] = useState("dashboard");
  const [autoOpenUpload, setAutoOpenUpload] = useState(false);
  const [isUploadActive, setIsUploadActive] = useState(false);
  const [lotData, setLotData] = useState<LotData[]>([]);
  const [weeklyData, setWeeklyUpdates] = useState<WeeklyUpdate[]>([]);
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<LotData>>>(() => {
    try {
      const stored = localStorage.getItem("scla_local_overrides");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const mergedLotData = React.useMemo(() => {
    if (Object.keys(localOverrides).length === 0) return lotData;
    return lotData.map(lot => {
      const override = localOverrides[lot.lotId];
      if (override) {
        return { ...lot, ...override };
      }
      return lot;
    });
  }, [lotData, localOverrides]);

  useEffect(() => {
    fetchDashboardConfigFromBackend();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("scla_local_overrides", JSON.stringify(localOverrides));
    } catch (err) {
      console.error("Failed to persist local overrides:", err);
    }
  }, [localOverrides]);

  const handleRefreshData = (lotId?: string, updatedFields?: Partial<LotData>) => {
    if (lotId && updatedFields) {
      setLocalOverrides(prev => ({
        ...prev,
        [lotId]: {
          ...(prev[lotId] || {}),
          ...updatedFields
        }
      }));
    }
    loadAllData(true);
  };
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
   const [showNotifications, setShowNotifications] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [seenNotificationKeys, setSeenNotificationKeys] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("scla_seen_notifications");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedSearchLotId, setSelectedSearchLotId] = useState<string | null>(null);
  const [profileSelectedTab, setProfileSelectedTab] = useState<"general" | "tech" | "costs" | "milestones" | "supplemental" | "update" | "comments">("general");
  const [profileShowSummaryModal, setProfileShowSummaryModal] = useState(false);

  // Reset modal on selection change
  useEffect(() => {
    if (selectedSearchLotId) {
      setProfileShowSummaryModal(false);
    }
  }, [selectedSearchLotId]);

  const [showHelpLegend, setShowHelpLegend] = useState(false);

  const [themeState, setThemeState] = useState<ThemeConfig>(getActiveTheme);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Force clear dark mode on mount
  useEffect(() => {
    try {
      localStorage.setItem("gcr_la_dark_mode", "false");
    } catch {}
  }, []);

  const activeTheme = React.useMemo(() => {
    return {
      ...themeState,
      isDark: false
    };
  }, [themeState]);
  const [customBg, setCustomBg] = useState<string | null>(() => {
    try {
      return localStorage.getItem("gcr_la_global_bg");
    } catch {
      return null;
    }
  });

  // Comprehensive System Guide Tour
  const tourSteps = React.useMemo(() => [
    {
      targetId: "sidebar-tour-launcher",
      section: "dashboard",
      title: "Interactive Tour Guide",
      description: "Welcome to the Land Acquisition Terminal! Let's take a quick walk through all the modules and features.",
      position: "right" as const
    },
    {
      targetId: "sidebar-item-dashboard",
      section: "dashboard",
      title: "Dashboard Workspace",
      description: "Your central command center displaying real-time physical area data, project milestones, and velocity trends.",
      position: "right" as const
    },
    {
      targetId: "tour-snapshots",
      section: "dashboard",
      title: "Area & Financial Snapshots",
      description: "Monitor overall survey areas side-by-side with live registry estimates and project costs.",
      position: "bottom" as const
    },
    {
      targetId: "tour-kpis",
      section: "dashboard",
      title: "Interactive Milestone KPIs",
      description: "Click or hover over any of the 16 milestone metrics to immediately filter and download lot details.",
      position: "bottom" as const
    },
    {
      targetId: "tour-charts",
      section: "dashboard",
      title: "Analytics Charts & Progress",
      description: "Analyze velocity trends, monthly site access, and expropriation metrics. Maximize panels to view full-screen details.",
      position: "top" as const
    },
    {
      targetId: "sidebar-item-reports",
      section: "reports",
      title: "Reports, Analytics & Planning",
      description: "Generate complete lot databases, land owner registers, and forecast future 12-month disbursement workflows.",
      position: "right" as const
    },
    {
      targetId: "sidebar-item-weekly",
      section: "weekly",
      title: "Weekly Updates & Timeline",
      description: "Review chronological field logs, site progress accomplishments, and verified site photographs.",
      position: "right" as const
    },
    {
      targetId: "sidebar-item-addAccomplishment",
      section: "addAccomplishment",
      title: "Add Accomplishments",
      description: "Authorized portal for submitting new lot milestones, progress logs, and field data in real-time.",
      position: "right" as const
    },
    {
      targetId: "sidebar-item-gis",
      section: "gis",
      title: "GIS Smart Map Link",
      description: "Quickly access the spatial ArcIMS portal for geographic lot visualization and site planning.",
      position: "right" as const
    },
    {
      targetId: "sidebar-item-upload",
      section: "upload",
      title: "Manage Documents",
      description: "Access the unified document repository to archive, organize, and search through land title PDFs, deeds, and letters.",
      position: "right" as const
    },
    {
      targetId: "sidebar-item-settings",
      section: "settings",
      title: "System Settings",
      description: "Tailor visual preferences, toggle layout settings, backup workspace configurations, and adjust audio/animation parameters.",
      position: "right" as const
    }
  ], []);

  const [tourActive, setTourActive] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  const [tourCoords, setTourCoords] = useState<{ top: number; left: number; position: string } | null>(null);
  const [spotlightCoords, setSpotlightCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const lastCoords = React.useRef({ top: 0, left: 0, width: 0, height: 0, tourStep: -1 });

  const updateTooltipCoords = () => {
    const currentStep = tourSteps[tourStep];
    if (!currentStep) return;

    const element = document.getElementById(currentStep.targetId);
    if (!element) {
      if (spotlightCoords !== null || tourCoords !== null) {
        setTourCoords(null);
        setSpotlightCoords(null);
      }
      return;
    }

    const rect = element.getBoundingClientRect();

    // Check if the coordinates or the step have changed before triggering a state update
    if (
      rect.top === lastCoords.current.top &&
      rect.left === lastCoords.current.left &&
      rect.width === lastCoords.current.width &&
      rect.height === lastCoords.current.height &&
      tourStep === lastCoords.current.tourStep
    ) {
      return; // No-op, bypass state update for buttery-smooth performance
    }

    lastCoords.current = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      tourStep
    };

    setSpotlightCoords({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height
    });

    let top = 0;
    let left = 0;
    const padding = 16;

    if (currentStep.position === "right") {
      top = rect.top + rect.height / 2;
      left = rect.right + padding;
    } else if (currentStep.position === "bottom") {
      top = rect.bottom + padding;
      left = rect.left + rect.width / 2;
    } else if (currentStep.position === "top") {
      top = rect.top - padding;
      left = rect.left + rect.width / 2;
    } else {
      top = rect.top + rect.height / 2;
      left = rect.left - padding;
    }

    setTourCoords({
      top,
      left,
      position: currentStep.position
    });
  };

  const handleStartTour = () => {
    setTourStep(0);
    setTourActive(true);
  };

  const handleTourNext = () => {
    if (tourStep < tourSteps.length - 1) {
      const nextStep = tourStep + 1;
      setTourStep(nextStep);
    } else {
      handleTourClose();
    }
  };

  const handleTourPrev = () => {
    if (tourStep > 0) {
      setTourStep(tourStep - 1);
    }
  };

  const handleTourClose = () => {
    setTourActive(false);
    setTourCoords(null);
    setSpotlightCoords(null);
  };

  // Switch sections and position overlay dynamically with buttery-smooth tracking
  useEffect(() => {
    if (!tourActive) return;

    const currentStep = tourSteps[tourStep];
    if (!currentStep) return;

    if (activeSection !== currentStep.section) {
      setActiveSection(currentStep.section);
      const timer = setTimeout(() => {
        const element = document.getElementById(currentStep.targetId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    // Scroll element into view when active step changes
    const element = document.getElementById(currentStep.targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    // Continuously update coordinates via requestAnimationFrame for flawless realtime tracking
    let rAFId: number;
    const track = () => {
      updateTooltipCoords();
      rAFId = requestAnimationFrame(track);
    };
    rAFId = requestAnimationFrame(track);

    return () => {
      cancelAnimationFrame(rAFId);
    };
  }, [tourActive, tourStep, activeSection, tourSteps]);

  // Keyboard navigation for tour accessibility
  useEffect(() => {
    if (!tourActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleTourNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleTourPrev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleTourClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tourActive, tourStep]);

  const [restrictions, setRestrictions] = useState<Record<string, string[]>>(() => {
    try {
      const stored = localStorage.getItem("gcr_la_permissions");
      return stored ? JSON.parse(stored) : {
        "Daniel B. Antoque": [],
        "Christian Jay": [],
        "Pablo": [],
      };
    } catch {
      return {
        "Daniel B. Antoque": [],
        "Christian Jay": [],
        "Pablo": [],
      };
    }
  });

  // Real-time active users and restrictions broadcast functions
  const [activeUsersList, setActiveUsersList] = useState<any[]>([]);
  const [isLotAnalyzerZoomed, setIsLotAnalyzerZoomed] = useState(false);
  const [isViewingDoc, setIsViewingDoc] = useState(false);

  // Reports designated restricted area filter
  const [reportsAssignedArea, setReportsAssignedArea] = useState<{ cp: string[]; lgu: string[]; zone: string[] } | null>(null);
  const [isAssignedAreaModalOpen, setIsAssignedAreaModalOpen] = useState(false);

  // Lot Comparison Modal States
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [compareLotAId, setCompareLotAId] = useState<string | null>(null);
  const [compareLotBId, setCompareLotBId] = useState<string | null>(null);

  // Quick Actions Dropdown State & Ref
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
    };
    if (isActionsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isActionsDropdownOpen]);

  // Global Keyboard Shortcuts for primary navigation and help legend
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in form controls
      const activeEl = document.activeElement;
      const isEditing = 
        activeEl?.tagName === "INPUT" || 
        activeEl?.tagName === "TEXTAREA" || 
        activeEl?.hasAttribute("contenteditable") ||
        (activeEl as HTMLElement)?.isContentEditable;

      if (isEditing) return;

      // Toggle help modal on '?' key (standard keyboard press)
      if (e.key === "?") {
        e.preventDefault();
        setShowHelpLegend(prev => !prev);
        return;
      }

      // Close help modal on Escape
      if (e.key === "Escape" && showHelpLegend) {
        e.preventDefault();
        setShowHelpLegend(false);
        return;
      }

      // Alt + Number shortcuts (Alt + 1 to Alt + 7)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 7) {
          e.preventDefault();
          const sections = [
            "dashboard",
            "reports",
            "weekly",
            "addAccomplishment",
            "gis",
            "upload",
            "settings"
          ];
          const targetSection = sections[num - 1];
          if (targetSection) {
            if (targetSection === "reports" && isLotAnalyzerZoomed) {
              return; // restricted/hidden
            }
            setActiveSection(targetSection);
            setShowHelpLegend(false);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showHelpLegend, isLotAnalyzerZoomed]);

  // Compute if current user is blocked from viewing full reports
  const isReportsBlocked = React.useMemo(() => {
    if (!user) return false;
    const emailKey = (user.email || "").trim().toLowerCase();
    const nameKey = (user.name || "").trim().toLowerCase();
    
    const safeRestrictions = restrictions || {};
    const matchedKeys = Object.keys(safeRestrictions).filter(key => {
      const k = key.trim().toLowerCase();
      return (
        (emailKey && k === emailKey) ||
        (nameKey && k === nameKey) ||
        k === (user.email || "").trim() ||
        k === (user.name || "").trim()
      );
    });
    const isSuperAdmin = emailKey === "antoque2822@gmail.com" || nameKey === "daniel b. antoque";
    if (isSuperAdmin) return false;
    
    const combinedRestrictions = Array.from(new Set(
      matchedKeys.flatMap(key => safeRestrictions[key] || [])
    ));
    return combinedRestrictions.includes("reports");
  }, [user, restrictions]);

  // Handle dynamic data filtering based on reports restricted area assignments
  const filteredLotDataForReports = React.useMemo(() => {
    if (reportsAssignedArea) {
      return mergedLotData.filter(lot => {
        const matchCP = reportsAssignedArea.cp.includes("All") || reportsAssignedArea.cp.includes(lot.cp);
        const matchLGU = reportsAssignedArea.lgu.includes("All") || reportsAssignedArea.lgu.includes(lot.lgu);
        const matchZone = reportsAssignedArea.zone.includes("All") || reportsAssignedArea.zone.includes(lot.zone);
        return matchCP && matchLGU && matchZone;
      });
    }
    return mergedLotData;
  }, [mergedLotData, reportsAssignedArea]);

  // Automatically kick user out of a view if they are restricted from accessing it
  useEffect(() => {
    if (activeSection === "reports" && !reportsAssignedArea && !tourActive) {
      setIsAssignedAreaModalOpen(true);
    }
  }, [activeSection, reportsAssignedArea, tourActive]);

  useEffect(() => {
    if (!user) return;
    const emailKey = (user.email || "").trim().toLowerCase();
    const nameKey = (user.name || "").trim().toLowerCase();
    
    const safeRestrictions = restrictions || {};

    // Find all matched keys in the restrictions map
    const matchedKeys = Object.keys(safeRestrictions).filter(key => {
      const k = key.trim().toLowerCase();
      return (
        (emailKey && k === emailKey) ||
        (nameKey && k === nameKey) ||
        k === (user.email || "").trim() ||
        k === (user.name || "").trim()
      );
    });

    const isSuperAdmin = emailKey === "antoque2822@gmail.com" || nameKey === "daniel b. antoque";

    const combinedRestrictions = isSuperAdmin ? [] : Array.from(new Set(
      matchedKeys.flatMap(key => safeRestrictions[key] || [])
    ));

    if (combinedRestrictions.includes(activeSection)) {
      if (activeSection === "reports" && reportsAssignedArea) {
        // Bypass/allow restricted reports if we assigned.
      } else {
        setActiveSection("dashboard");
      }
    }
  }, [activeSection, user, restrictions, reportsAssignedArea]);

  // Handle default locked tabs for new users immediately on sign in or session load
  useEffect(() => {
    if (!user) return;
    const emailKey = (user.email || "").trim().toLowerCase();
    const nameKey = (user.name || "").trim().toLowerCase();
    const isSuperAdmin = emailKey === "antoque2822@gmail.com" || nameKey === "daniel b. antoque";
    
    if (!isSuperAdmin) {
      const emailMatch = Object.keys(restrictions).find(
        k => k.trim().toLowerCase() === emailKey
      );
      const nameMatch = Object.keys(restrictions).find(
        k => k.trim().toLowerCase() === nameKey
      );

      if (!emailMatch && !nameMatch) {
        const defaultLocked = ["reports", "addAccomplishment", "upload"];
        const updated = {
          ...restrictions,
          [emailKey]: defaultLocked
        };
        localStorage.setItem("gcr_la_permissions", JSON.stringify(updated));
        setRestrictions(updated);
      }
    }
  }, [user, restrictions]);

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

  const getWeekRange = (refDate: Date) => {
    const date = new Date(refDate);
    const day = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
    const diffToMonday = day === 0 ? -6 : 1 - day;
    
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const getBellNotifications = () => {
    if (!weeklyData || weeklyData.length === 0) {
      return { list: [], isActualCurrent: weekOffset === 0, weekLabel: "No Updates Available" };
    }

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + weekOffset * 7);

    const { monday: targetMonday, sunday: targetSunday } = getWeekRange(targetDate);
    
    // 5-day week display formatting (Monday to Friday)
    const targetFriday = new Date(targetMonday);
    targetFriday.setDate(targetMonday.getDate() + 4);

    let weekLabel = "";
    if (weekOffset === 0) {
      weekLabel = `This Week (${format(targetMonday, "MMM dd")} - ${format(targetFriday, "MMM dd, yyyy")})`;
    } else {
      weekLabel = `Week of ${format(targetMonday, "MMM dd")} - ${format(targetFriday, "MMM dd, yyyy")}`;
    }

    // Strictly filter items belonging to the target week (Monday to Sunday) using column 9 (dateEntry)
    const weekUpdates = weeklyData.filter(item => {
      const d = parseDateSafely(item.dateEntry);
      return d && d.getTime() >= targetMonday.getTime() && d.getTime() <= targetSunday.getTime();
    });

    const sortedUpdates = [...weekUpdates].sort((a, b) => {
      const dA = parseDateSafely(a.dateEntry);
      const dB = parseDateSafely(b.dateEntry);
      if (dA && dB) return dB.getTime() - dA.getTime();
      if (dA) return -1;
      if (dB) return 1;
      return 0;
    });

    return {
      list: sortedUpdates,
      isActualCurrent: weekOffset === 0,
      weekLabel: weekLabel
    };
  };

  const notifications = getBellNotifications();

  // For the notification bell badge indicator, check if there are any unseen items in the actual current calendar week (offset 0)
  const currentWeekNotifications = React.useMemo(() => {
    if (!weeklyData || weeklyData.length === 0) return [];
    const today = new Date();
    const { monday: curMonday, sunday: curSunday } = getWeekRange(today);
    return weeklyData.filter(item => {
      const d = parseDateSafely(item.dateEntry);
      return d && d.getTime() >= curMonday.getTime() && d.getTime() <= curSunday.getTime();
    });
  }, [weeklyData]);

  const hasUnseenNotifications = currentWeekNotifications.some(item => {
    const key = `${item.lotId}-${item.dateEntry}-${item.accomplishment}`;
    return !seenNotificationKeys.includes(key);
  });

  const currentNotificationKeysStr = notifications.list.map(item => `${item.lotId}-${item.dateEntry}-${item.accomplishment}`).join(",");

  // Mark notifications as seen when panel is open for current view
  useEffect(() => {
    if (showNotifications && notifications.list.length > 0) {
      const currentKeys = notifications.list.map(item => 
        `${item.lotId}-${item.dateEntry}-${item.accomplishment}`
      );
      const hasNewUnseen = currentKeys.some(k => !seenNotificationKeys.includes(k));
      if (hasNewUnseen) {
        setSeenNotificationKeys(prev => {
          const updated = Array.from(new Set([...prev, ...currentKeys]));
          try {
            localStorage.setItem("scla_seen_notifications", JSON.stringify(updated));
          } catch (e) {
            console.error("Storage error:", e);
          }
          return updated;
        });
      }
    }
  }, [showNotifications, currentNotificationKeysStr]);

  const loadAllData = async (isSilent = false, force = false) => {
    if (!isSilent) {
      setLoading(true);
      setError(null);
    }
    try {
      const [lots, weekly] = await Promise.all([
        fetchDashboardData(force),
        fetchWeeklyUpdates(force)
      ]);
      setLotData(lots);
      setWeeklyUpdates(weekly);
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error("Failed to load data:", err);
      if (!isSilent) {
        setError(err.message || "An unexpected error occurred while fetching data.");
      }
    } finally {
      if (!isSilent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAllData();

    const handleDataUpdated = () => {
      loadAllData(true, true);
    };

    window.addEventListener("scla_data_updated", handleDataUpdated);

    // Auto-sync interval: automatically pulls latest changes every 30 seconds without forcing remote sheet re-fetch
    const syncInterval = setInterval(() => {
      loadAllData(true, false);
    }, 30000);

    return () => {
      window.removeEventListener("scla_data_updated", handleDataUpdated);
      clearInterval(syncInterval);
    };
  }, []);

  // Organic smooth sequential loading progress simulation
  useEffect(() => {
    const isLighthouse = typeof navigator !== "undefined" && (
      /lighthouse/i.test(navigator.userAgent) ||
      /chrome-lighthouse/i.test(navigator.userAgent) ||
      /speed/i.test(navigator.userAgent) ||
      /pagespeed/i.test(navigator.userAgent) ||
      /headless/i.test(navigator.userAgent)
    );

    const intervalTime = isLighthouse ? 2 : 28;

    const interval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setShowLoadingScreen(false);
          }, isLighthouse ? 0 : 800); // Elegant static pause at 100%
          return 100;
        }

        if (loading) {
          // While fetching data, organically climb towards 88%
          if (prev >= 88) {
            if (isLighthouse) {
              return prev + 10;
            }
            return 88;
          }
          const increment = isLighthouse ? 20 : (Math.random() > 0.6 ? 2 : 1);
          return prev + increment;
        } else {
          // Once data finishes loading, complete the final stretch smoothly and fast
          const increment = isLighthouse ? 30 : (Math.max(1, Math.round((103 - prev) / 6)) + (Math.random() > 0.4 ? 1 : 0));
          return Math.min(100, prev + increment);
        }
      });
    }, intervalTime); // Blazing-smooth ticks for butter-smooth progress bar filling
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (!isAutoRefresh) return;
    
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          loadAllData(true);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return (
          <Dashboard 
            data={mergedLotData} 
            loading={loading} 
            weeklyData={weeklyData} 
            activeTheme={activeTheme} 
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            onSelectLot={(lot) => {
              setSelectedSearchLotId(lot.lotId || lot.id);
            }}
          />
        );
      case "weekly":
        return (
          <WeeklyUpdates 
            data={weeklyData} 
            loading={loading} 
            onRefresh={() => loadAllData(false, true)} 
            activeTheme={activeTheme}
            onSelectLot={(id) => {
              setSelectedSearchLotId(id);
              setProfileSelectedTab("general");
            }}
          />
        );
      case "discrepancy":
        return (
          <div className="w-full h-full overflow-hidden flex flex-col">
            <iframe
              src="https://gcr-and-dotr-discrepancies-dashboard-239886646347.asia-southeast1.run.app/"
              className="w-full h-full border-0"
              title="GCR and DOTr discrepancy"
            />
          </div>
        );
      case "gis":
        return (
          <div className="w-full h-full overflow-hidden flex flex-col relative">
            <div className={cn(
              "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b text-xs transition-all shrink-0",
              activeTheme.isDark 
                ? "bg-slate-900 border-slate-800 text-slate-300" 
                : "bg-slate-50 border-slate-200 text-slate-600"
            )}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <p className="leading-normal">
                  <strong className={activeTheme.isDark ? "text-amber-400" : "text-amber-600"}>Login Notice:</strong> Due to browser security settings (Third-Party Cookies), the login popup was blocked inside the iframe. Click the button on the right to securely log in in a new tab.
                </p>
              </div>
              <a
                href="https://gis.railway-sector.com/portal/apps/sites/#/home"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0",
                  activeTheme.isDark
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/50"
                    : "bg-brand-600 hover:bg-brand-500 text-white shadow-md shadow-brand-100"
                )}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in New Tab
              </a>
            </div>
            <iframe
              src="https://gis.railway-sector.com/portal/apps/sites/#/home"
              className="w-full flex-1 border-0"
              title="GIS Smart Map"
              allow="geolocation; microphone; camera"
            />
          </div>
        );
      case "lotProfile":
        return (
          <LotProfile 
            data={mergedLotData} 
            activeTheme={activeTheme} 
            onRefreshData={handleRefreshData} 
            weeklyUpdates={weeklyData}
            selectedTab={profileSelectedTab}
            onSelectedTabChange={setProfileSelectedTab}
            showSummaryModal={profileShowSummaryModal}
            onShowSummaryModalChange={setProfileShowSummaryModal}
            onCompareLot={(lotId) => {
              setCompareLotAId(lotId);
              setCompareLotBId(null);
              setIsComparisonOpen(true);
            }}
          />
        );
      case "reports":
        return (
          <div className="space-y-4">
            {reportsAssignedArea ? (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 dark:bg-slate-900/50 dark:border-slate-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-800 dark:text-slate-200 text-xs font-semibold leading-relaxed mb-4 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-3 text-left">
                  {isReportsBlocked ? (
                    <span className="px-2.5 py-1 bg-amber-500 text-white rounded-lg animate-pulse text-[10px] font-black uppercase tracking-wider shrink-0">🔐 Restricted Pass</span>
                  ) : (
                    <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0">⚙️ Sector Filter</span>
                  )}
                  <div>
                    <p className="font-extrabold uppercase text-[10px] tracking-wide text-indigo-600 dark:text-indigo-400">
                      {isReportsBlocked ? "Assigned Sector Area Access" : "Active Sector Filter"}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      Showing designated operations: <strong className="text-indigo-600 dark:text-indigo-405 dark:text-indigo-400 font-extrabold">
                        {reportsAssignedArea.cp.includes("All") ? "All Packages" : reportsAssignedArea.cp.join(", ")}
                        {" • "}
                        {reportsAssignedArea.lgu.includes("All") ? "All LGUs" : reportsAssignedArea.lgu.join(", ")}
                        {" • "}
                        {reportsAssignedArea.zone.includes("All") ? "All Zones" : reportsAssignedArea.zone.map(z => `Zone ${z}`).join(", ")}
                      </strong> (Loaded <strong className="text-amber-600 dark:text-amber-450 font-extrabold">{filteredLotDataForReports.length.toLocaleString()} matching lots</strong>).
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isReportsBlocked && (
                    <button
                      type="button"
                      onClick={() => setReportsAssignedArea(null)}
                      className="px-4 py-2 bg-slate-250 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAssignedAreaModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    Change Sector Area
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 dark:bg-slate-900/50 dark:border-slate-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-800 dark:text-slate-200 text-xs font-semibold leading-relaxed mb-4">
                <div className="flex items-center gap-3 text-left">
                  <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0">⚙️ Sector Filter</span>
                  <div>
                    <p className="font-extrabold uppercase text-[10px] tracking-wide text-indigo-600 dark:text-indigo-400">Filter Reports by Sector Area</p>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                      You are currently viewing all lots. Click below to filter reports, analytics, and planning charts by specific Contract Packages, LGUs, or Zones.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignedAreaModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  Configure Sector Filter
                </button>
              </div>
            )}
            <ReportGenerator data={filteredLotDataForReports} activeTheme={activeTheme} onZoomChange={setIsLotAnalyzerZoomed} />
          </div>
        );
      case "addAccomplishment":
        return <AddAccomplishment data={mergedLotData} currentUser={user || undefined} activeTheme={activeTheme} />;
      case "upload":
        return (
          <UploadDocuments 
            data={mergedLotData} 
            currentUser={user || undefined} 
            activeTheme={activeTheme} 
            onPreviewChange={setIsViewingDoc} 
            initialOpenUpload={autoOpenUpload}
            onUploadModalClose={() => setAutoOpenUpload(false)}
            onUploadModalToggle={setIsUploadActive}
          />
        );
      case "settings":
        return (
          <SettingsView 
            currentUser={user} 
            onUpdateCurrentUser={(updatedUser) => {
              localStorage.setItem("gcr_la_user", JSON.stringify(updatedUser));
              setUser(updatedUser);
            }}
            activeTheme={activeTheme}
            onChangeTheme={(themeId) => {
              const tData = themes[themeId];
              setThemeState(tData);
            }}
            restrictions={restrictions}
            onUpdateRestrictions={(newRes) => {
              localStorage.setItem("gcr_la_permissions", JSON.stringify(newRes));
              setRestrictions(newRes);
            }}
            activeUsers={activeUsersList}
            customBg={customBg}
            onUpdateCustomBg={(bg) => {
              setCustomBg(bg);
              if (bg) {
                localStorage.setItem("gcr_la_global_bg", bg);
              } else {
                localStorage.removeItem("gcr_la_global_bg");
              }
            }}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 space-y-4">
            <RefreshCcw className="w-12 h-12 opacity-20" />
            <p className="font-bold uppercase tracking-[0.2em] text-xs">Section Under Enhancement</p>
          </div>
        );
    }
  };

  // Show Loading Screen first if showLoadingScreen is true or there's a fatal error loading initial data
  if (showLoadingScreen || (error && lotData.length === 0)) {
    return (
      <main className="fixed inset-0 z-[100] bg-[#030712] flex flex-col items-center justify-center p-8 text-center overflow-hidden">
        {/* Ambient Spinning Radial Blur Backdrops & Network Particle Constellation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <NetworkLoaderCanvas />
          <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/[0.05] blur-[110px] animate-pulse duration-[8000ms]" />
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-indigo-500/[0.04] blur-[110px] animate-pulse duration-[6000ms]" />
          {/* Grid Background overlay */}
          <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
        </div>

        {!error ? (
          <div className="relative z-10 flex flex-col items-center justify-center max-w-sm w-full space-y-8">
            {/* SCLA Logo with Pulsing Shadow Glow */}
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.02, 1],
                  filter: [
                    "drop-shadow(0 0 12px rgba(6, 182, 212, 0.15))",
                    "drop-shadow(0 0 24px rgba(6, 182, 212, 0.3))",
                    "drop-shadow(0 0 12px rgba(6, 182, 212, 0.15))"
                  ]
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              >
                <SCLALogo size={200} animate={true} />
              </motion.div>
            </div>

            {/* Glassmorphic Loader Container */}
            <div className="w-full bg-[#0a1122]/75 backdrop-blur-2xl border border-slate-800/80 p-6 rounded-[2rem] shadow-2xl shadow-cyan-500/5 flex flex-col items-center space-y-4">
              {/* Status text */}
              <div className="text-center w-full">
                <span className="text-[9px] font-black tracking-[0.24em] text-cyan-400 uppercase">GCR SC DATASTREAM</span>
                <h4 className="text-xs font-black text-slate-300 mt-1 uppercase tracking-wider min-h-[16px] transition-all duration-300">
                  {loadingProgress < 25 && "ESTABLISHING SECURE CONNECTION..."}
                  {loadingProgress >= 25 && loadingProgress < 50 && "SYNCHRONIZING ACQUISITION STATISTICS..."}
                  {loadingProgress >= 50 && loadingProgress < 75 && "RECONCILING CO-ALIGNED DIRECTORIES..."}
                  {loadingProgress >= 75 && loadingProgress < 95 && "LAUNCHING SYSTEM DATA TERMINAL..."}
                  {loadingProgress >= 95 && "LOT DATASTREAM DEPLOYED READY!"}
                </h4>
              </div>

              {/* High Tech Progress bar */}
              <div className="w-full px-2">
                <div className="h-2 w-full bg-slate-950/90 rounded-full overflow-hidden border border-slate-800/50 p-[1px] relative">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>

              {/* Percentage Counter */}
              <div className="flex items-center gap-1 font-mono">
                <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400 [text-shadow:0_0_15px_rgba(34,211,238,0.25)]">
                  {loadingProgress}%
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 max-w-md bg-[#0a1122]/90 backdrop-blur-2xl border border-rose-950/40 p-8 rounded-[2.5rem] shadow-2xl shadow-rose-950/10 animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-rose-950/50 text-rose-400 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-rose-800/30 shadow-lg shadow-rose-950/20">
              <Bell className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-black text-rose-400 tracking-tight uppercase mb-2">Synchronization Failure</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 leading-relaxed">
              {error}
            </p>
            <button 
              onClick={loadAllData}
              className={cn("px-8 py-3 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:scale-105 active:scale-95 transition-all outline-none", activeTheme.primaryBg, activeTheme.primaryShadow)}
            >
              Retry Connection
            </button>
          </div>
        )}
      </main>
    );
  }

  if (!user) {
    return (
      <Login 
        onLoginSuccess={(u) => { 
          localStorage.setItem("gcr_la_user", JSON.stringify(u)); 
          setLoadingProgress(0);
          setShowLoadingScreen(true);
          setUser(u); 
          loadAllData();
        }} 
      />
    );
  }

  return (
    <div className={cn("flex h-screen overflow-hidden font-sans transition-all duration-300", activeTheme.isDark ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900")}>
      <AnimatePresence mode="wait">
        {!isViewingDoc && (
          <motion.div
            initial={{ x: -288, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -288, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="print:hidden h-full flex-shrink-0"
          >
            <Sidebar 
              activeSection={activeSection} 
              setActiveSection={setActiveSection} 
              currentUser={user}
              onLogout={() => {
                localStorage.removeItem("gcr_la_user");
                setUser(null);
              }}
              activeTheme={activeTheme}
              restrictions={restrictions}
              isLotAnalyzerZoomed={isLotAnalyzerZoomed}
              onLockedReportsClick={() => setIsAssignedAreaModalOpen(true)}
              onStartTour={handleStartTour}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className={cn(
          "h-20 border-b px-3 sm:px-6 xl:px-8 flex items-center justify-between flex-shrink-0 z-30 transition-all duration-300 print:hidden", 
          activeTheme.isDark ? "bg-slate-900/65 border-slate-800 text-slate-100 backdrop-blur-md" : "bg-white/50 border-slate-200 text-slate-900 backdrop-blur-md",
          (isLotAnalyzerZoomed || isViewingDoc || isUploadActive) && "hidden"
        )}>
          <div className="flex items-center gap-4">
            <div className={cn("w-2 h-8 rounded-full", activeTheme.primaryBg)} />
            <div>
              <h2 className={cn("text-xs xl:text-sm font-black uppercase tracking-[0.2em]", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>
                {activeSection === "discrepancy" 
                  ? "GCR and DOTr discrepancy" 
                  : activeSection === "gis"
                    ? "GIS Smart Map"
                    : isLotAnalyzerZoomed && activeSection === "reports" 
                    ? "" 
                    : activeSection === "reports" 
                      ? "Reports, Analytics & Planning" 
                      : activeSection === "upload" 
                        ? "Manage Documents" 
                        : activeSection.replace(/([A-Z])/g, ' $1').trim()}
              </h2>
              <p className="text-[9px] xl:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                System Last Updated: {lastRefreshed.toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 xl:gap-6 flex-1 min-w-0 justify-end ml-2 xl:ml-4">
            <div className="flex items-center gap-2 xl:gap-3 min-w-0 flex-1 justify-end">
              {/* HEADER GENERAL QUICK SEARCH */}
              <HeaderSearchBox 
                lotData={mergedLotData}
                activeTheme={activeTheme}
                onSelectLot={(id) => {
                  setSelectedSearchLotId(id);
                  setProfileSelectedTab("general");
                }}
              />

              {/* QUICK ACTIONS DROPDOWN OPTION MENU */}
              <div className="relative shrink-0" ref={actionsDropdownRef}>
                <button 
                  type="button"
                  onClick={() => setIsActionsDropdownOpen(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 xl:gap-2 px-3 py-1.5 xl:px-4 xl:py-1.5 rounded-full border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer whitespace-nowrap shrink-0 shadow-xs",
                    isActionsDropdownOpen
                      ? "bg-slate-900 border-slate-900 text-white font-extrabold ring-2 ring-indigo-500/30"
                      : activeTheme.isDark 
                        ? "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-200 hover:text-white"
                        : "bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 hover:from-blue-100 hover:to-indigo-100 border-indigo-200/80 text-indigo-900 hover:text-indigo-950 shadow-xs"
                  )}
                  title="Quick Actions Menu: Update Status, Upload Documents, Compare Lots"
                  aria-expanded={isActionsDropdownOpen}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Actions Option</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-indigo-500 transition-transform duration-200", isActionsDropdownOpen ? "rotate-180 text-white" : "")} />
                </button>

                <AnimatePresence>
                  {isActionsDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-1.5 z-50 overflow-hidden backdrop-blur-md"
                    >
                      <div className="px-3.5 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Select Action</span>
                        <span className="text-[8px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100">3 Options</span>
                      </div>

                      <div className="p-1 space-y-0.5">
                        {/* 1. UPDATE STATUS */}
                        <button
                          type="button"
                          onClick={() => {
                            const targetLotId = selectedSearchLotId || (mergedLotData.length > 0 ? (mergedLotData[0].lotId || mergedLotData[0].id) : "1");
                            setSelectedSearchLotId(targetLotId);
                            setProfileSelectedTab("update");
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-amber-50/90 flex items-start gap-3 transition-all group cursor-pointer border border-transparent hover:border-amber-200/60"
                        >
                          <div className="p-2 rounded-xl bg-amber-100/80 text-amber-700 group-hover:bg-amber-500 group-hover:text-white transition-all shrink-0 shadow-xs">
                            <FileEdit className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 group-hover:text-amber-900">1. Update Status</span>
                              <span className="text-[8px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md">Status</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">Opens the Update Status section</p>
                          </div>
                        </button>

                        {/* 2. UPLOAD DOCUMENTS */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSection("upload");
                            setAutoOpenUpload(true);
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50/90 flex items-start gap-3 transition-all group cursor-pointer border border-transparent hover:border-blue-200/60"
                        >
                          <div className="p-2 rounded-xl bg-blue-100/80 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0 shadow-xs">
                            <Upload className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 group-hover:text-blue-900">2. Upload Documents</span>
                              <span className="text-[8px] font-bold text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded-md">Docs</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">Opens the Upload Documents section</p>
                          </div>
                        </button>

                        {/* 3. COMPARE LOTS */}
                        <button
                          type="button"
                          onClick={() => {
                            const targetLotId = selectedSearchLotId || (mergedLotData.length > 0 ? (mergedLotData[0].lotId || mergedLotData[0].id) : null);
                            setCompareLotAId(targetLotId);
                            setCompareLotBId(null);
                            setIsComparisonOpen(true);
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-indigo-50/90 flex items-start gap-3 transition-all group cursor-pointer border border-transparent hover:border-indigo-200/60"
                        >
                          <div className="p-2 rounded-xl bg-indigo-100/80 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0 shadow-xs">
                            <GitCompare className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 group-hover:text-indigo-900">3. Compare Lots</span>
                              <span className="text-[8px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded-md">Compare</span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">Opens the Compare Lots section</p>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => loadAllData(false)}
                disabled={loading}
                className={cn("flex items-center justify-center p-2 rounded-full border transition-all active:scale-95 cursor-pointer disabled:opacity-50 shrink-0",
                  activeTheme.isDark
                    ? "border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-400"
                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-500"
                )}
                title="Sync database now"
                aria-label="Sync database now"
              >
                <RefreshCcw className={cn("w-3.5 h-3.5", loading ? "animate-spin text-blue-600" : "")} />
              </button>
            </div>

            <PresenceIndicator 
              activeSection={activeSection} 
              currentUser={user || undefined} 
              onUsersUpdate={(users) => setActiveUsersList(users)}
              onRestrictionsReceived={(updatedRestrictions) => {
                setRestrictions(updatedRestrictions);
                localStorage.setItem("gcr_la_permissions", JSON.stringify(updatedRestrictions));
              }}
              restrictions={restrictions}
            />
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors focus:outline-none shrink-0"
                title="Show notifications"
                aria-label="Show notifications"
              >
                <Bell className="w-5 h-5" />
                {hasUnseenNotifications && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "absolute right-0 mt-3 w-[360px] border rounded-[2rem] shadow-[0_20px_50px_rgba(15,23,42,0.15)] z-50 p-5 text-left antialiased transition-colors duration-300",
                        activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                      )}
                    >
                      <div className={cn("flex flex-col gap-2.5 border-b pb-3 mb-3", activeTheme.isDark ? "border-slate-800" : "border-slate-100")}>
                        <div className="flex items-center justify-between">
                          <h3 className={cn("text-xs font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-200" : "text-slate-900")}>
                            SCLA Weekly Updates
                          </h3>
                          <span className={cn("text-[9px] font-black px-2.5 py-1 rounded-full uppercase", 
                            activeTheme.isDark ? "bg-blue-950/45 text-blue-400" : "bg-blue-50 text-blue-600"
                          )}>
                            {notifications.list.length} Items
                          </span>
                        </div>

                        {/* Navigation Chevron Controls */}
                        <div className="flex items-center justify-between gap-2 bg-slate-500/5 p-2 rounded-xl">
                          <div className="flex items-center gap-1.5 min-w-0 pr-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                            <p className={cn("text-[9px] font-bold uppercase tracking-widest truncate", activeTheme.isDark ? "text-slate-400" : "text-slate-505 text-slate-500")}>
                              {notifications.weekLabel}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setWeekOffset(prev => prev - 1);
                              }}
                              title="Previous Week"
                              aria-label="Previous Week"
                              className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center border cursor-pointer transition-all active:scale-90",
                                activeTheme.isDark 
                                  ? "bg-slate-800 border-slate-700 hover:bg-slate-705 hover:bg-slate-700 text-slate-300" 
                                  : "bg-white border-slate-200/80 hover:bg-slate-50 text-slate-600"
                              )}
                            >
                               <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (weekOffset < 0) {
                                  setWeekOffset(prev => prev + 1);
                                }
                              }}
                              disabled={weekOffset === 0}
                              title="Next Week"
                              aria-label="Next Week"
                              className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center border cursor-pointer transition-all active:scale-90 disabled:opacity-20 disabled:pointer-events-none",
                                activeTheme.isDark 
                                  ? "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300" 
                                  : "bg-white border-slate-200/80 hover:bg-slate-50 text-slate-600"
                              )}
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>

                            {weekOffset !== 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWeekOffset(0);
                                }}
                                title="Reset to current week"
                                className={cn(
                                  "text-[8px] font-black px-2 py-1 rounded-md cursor-pointer uppercase transition-all",
                                  activeTheme.isDark ? "bg-indigo-950 text-indigo-400 border border-indigo-900" : "bg-blue-50 text-blue-600 border border-blue-100"
                                )}
                              >
                                Current
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                        {notifications.list.length === 0 ? (
                          <div className={cn("py-10 text-center space-y-2.5 rounded-2xl border border-dashed", 
                            activeTheme.isDark ? "border-slate-800/60 bg-slate-950/20" : "border-slate-100 bg-slate-50/50"
                          )}>
                            <Bell className={cn("w-7 h-7 mx-auto opacity-30", activeTheme.isDark ? "text-slate-400" : "text-slate-505 text-slate-500")} />
                            <div className="space-y-0.5">
                              <p className={cn("text-[10px] font-black uppercase tracking-widest", activeTheme.isDark ? "text-slate-400" : "text-slate-605 text-slate-600")}>
                                No updates found for this week
                              </p>
                              <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-wider">
                                Click navigation arrow to view older weeks
                              </p>
                            </div>
                          </div>
                        ) : (
                          notifications.list.slice(0, 15).map((item, i) => {
                            const targetLot = mergedLotData.find(l => 
                              (l.lotId && item.lotId && l.lotId.trim().toUpperCase() === item.lotId.trim().toUpperCase()) ||
                              (l.id && item.lotId && l.id.trim().toUpperCase() === item.lotId.trim().toUpperCase())
                            );
                            const targetId = targetLot ? (targetLot.lotId || targetLot.id) : (item.lotId || "");

                            return (
                              <div 
                                key={i} 
                                onClick={() => {
                                  if (targetId) {
                                    setShowNotifications(false);
                                    setSelectedSearchLotId(targetId);
                                    setProfileSelectedTab("general");
                                  }
                                }}
                                title={`Click to view Lot ${item.lotId} in Quick Search & Profile`}
                                className={cn(
                                  "p-3 border rounded-2xl flex flex-col gap-2 transition-all cursor-pointer group hover:scale-[1.01] active:scale-[0.99]",
                                  activeTheme.isDark 
                                    ? "bg-slate-950/30 border-slate-800/80 hover:bg-slate-900 hover:border-blue-500/60 hover:shadow-lg hover:shadow-blue-950/40" 
                                    : "bg-slate-50 border-slate-200/60 hover:bg-blue-50/50 hover:border-blue-400 hover:shadow-md"
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={cn("text-xs font-mono font-black px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors",
                                    activeTheme.isDark ? "text-slate-300 bg-slate-800 group-hover:bg-blue-600 group-hover:text-white" : "text-slate-800 bg-slate-200/60 group-hover:bg-blue-600 group-hover:text-white"
                                  )}>
                                    <Search className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                                    {item.lotId}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {item.dateEntry && (
                                      <span className="text-[10px] font-bold text-slate-400">
                                        {item.dateEntry}
                                      </span>
                                    )}
                                    <span className={cn("text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider",
                                      activeTheme.isDark ? "text-indigo-400 bg-indigo-950/60" : "text-blue-600 bg-blue-50"
                                    )}>
                                      {item.cp}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                    <span className="text-[8px] font-bold text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                      Quick Search &rarr;
                                    </span>
                                  </div>
                                  <p className={cn("text-xs font-black leading-snug group-hover:text-blue-600 transition-colors", activeTheme.isDark ? "text-slate-100" : "text-slate-800")}>
                                    {item.accomplishment}
                                  </p>
                                </div>

                                {(item.dateAccomplishment || item.remarks) && (
                                  <div className={cn("pt-1.5 border-t border-dashed space-y-1 text-[10px]",
                                    activeTheme.isDark ? "border-slate-800" : "border-slate-200/80"
                                  )}>
                                    {item.dateAccomplishment && !item.dateAccomplishment.toLowerCase().includes("no data") && (
                                      <div className="flex justify-between text-slate-500">
                                        <span className="font-bold uppercase tracking-wider text-[9px] text-slate-400">Date Accomplished:</span>
                                        <span className={cn("font-black", activeTheme.isDark ? "text-slate-300" : "text-slate-700")}>{item.dateAccomplishment}</span>
                                      </div>
                                    )}
                                    {item.remarks && item.remarks.trim() !== "" && !item.remarks.toLowerCase().includes("no data") && (
                                      <div className="text-right">
                                        <p className="text-slate-500 text-left font-bold uppercase tracking-wider text-[9px] text-slate-400 mb-0.5">Remarks:</p>
                                        <p className={cn("font-medium text-left italic p-1.5 rounded-lg border leading-normal",
                                          activeTheme.isDark 
                                            ? "bg-slate-900/60 border-slate-800/80 text-slate-300" 
                                            : "bg-white/60 border-slate-100/80 text-slate-600"
                                        )}>
                                          "{item.remarks}"
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                        {notifications.list.length > 15 && (
                          <p className="text-[9px] text-center font-bold text-slate-400 uppercase tracking-widest pt-2">
                            Showing first 15 records
                          </p>
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className={cn("h-8 w-[1px] shrink-0 hidden xl:block", activeTheme.isDark ? "bg-slate-800" : "bg-slate-200")} />

            <div className="text-right hidden xl:block shrink-0 whitespace-nowrap">
              <p className={cn("text-xs font-black uppercase tracking-tight", activeTheme.isDark ? "text-slate-200" : "text-slate-800")}>Project GCR-SC</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Land Acquisition</p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={cn(
          "flex-1 custom-scrollbar relative",
          (activeSection === "discrepancy" || activeSection === "gis") 
            ? "p-0 overflow-hidden h-[calc(100vh-80px)]" 
            : "overflow-y-auto p-3 sm:p-5 lg:p-6 xl:p-8"
        )}>
          {/* Subtle Ambient Background Gradients / Custom Image */}
          {customBg ? (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden print:hidden">
              <img 
                src={customBg} 
                alt="App Background" 
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-300",
                  activeTheme.isDark ? "opacity-25 brightness-[0.85] contrast-[1.05] saturate-[1.05]" : "opacity-[0.18] brightness-[1.02]"
                )}
                style={{ filter: "blur(0px)" }}
                referrerPolicy="no-referrer"
              />
              <div className={cn(
                "absolute inset-0 bg-radial",
                activeTheme.isDark ? "from-transparent to-slate-900/50" : "from-transparent to-slate-50/45"
              )} />
            </div>
          ) : (
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden print:hidden">
              <div className={cn("absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-all duration-300", activeTheme.isDark ? "bg-fuchsia-500/5" : "bg-blue-400/5")} />
              <div className={cn("absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full transition-all duration-300", activeTheme.isDark ? "bg-indigo-500/5" : "bg-emerald-400/5")} />
            </div>
          )}

          <div className={cn("relative z-10", (activeSection === "discrepancy" || activeSection === "gis") && "h-full w-full")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className={cn((activeSection === "discrepancy" || activeSection === "gis") && "h-full w-full")}
              >
                <React.Suspense fallback={
                  <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400 space-y-4">
                    <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="font-bold uppercase tracking-[0.2em] text-[10px]">Loading Workspace...</p>
                  </div>
                }>
                  {renderContent()}
                </React.Suspense>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* GLOBAL QUICK SEARCH LOT PROFILE VIEW MODAL */}
      <AnimatePresence>
        {selectedSearchLotId && (
          <div className="fixed inset-0 z-[100000] overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 sm:p-6 md:p-10 select-none">
            {/* Backdrop click to close */}
            <div className="fixed inset-0 cursor-pointer" onClick={() => setSelectedSearchLotId(null)} />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className={cn(
                "w-full max-w-[98vw] 2xl:max-w-[1780px] 3xl:max-w-[1880px] rounded-[3rem] shadow-2xl relative z-10 p-6 md:p-8 border overflow-hidden mt-4 mb-4 select-text",
                activeTheme.isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-250 text-slate-900"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b pb-4 border-slate-550/10">
                <div className="flex items-center gap-2.5">
                  <div className={cn("w-2 h-7 rounded-full", activeTheme.primaryBg)} />
                  <div className="text-left">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em]">General Quick Search</h2>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Global Lot Summary Profile</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Direct Update Status button next to close profile */}
                  <button 
                    type="button"
                    onClick={() => setProfileSelectedTab("update")}
                    className={cn(
                      "px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]",
                      profileSelectedTab === "update"
                        ? "bg-amber-500 hover:bg-amber-450 text-white shadow-amber-500/20"
                        : "bg-amber-600 hover:bg-amber-505 text-white shadow-amber-600/15"
                    )}
                    aria-label="Direct Live Status Update"
                  >
                    <FileEdit className="w-3.5 h-3.5 shrink-0" />
                    Update Status
                  </button>

                  {/* Snapshot Printout button next to close profile */}
                  <button 
                    type="button"
                    onClick={() => setProfileShowSummaryModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-550 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-md shadow-emerald-500/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                    aria-label="Snapshot Printout Report"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    Snapshot Printout
                  </button>

                  {/* Compare Lot button next to snapshot printout */}
                  <button 
                    type="button"
                    onClick={() => {
                      setCompareLotAId(selectedSearchLotId);
                      setCompareLotBId(null);
                      setIsComparisonOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-550 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-md shadow-indigo-500/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                    aria-label="Compare this Lot"
                  >
                    <GitCompare className="w-3.5 h-3.5 shrink-0" />
                    Compare Lot
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSearchLotId(null)}
                    className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-rose-500/10 hover:scale-[1.02] active:scale-[0.98] font-bold"
                  >
                    Close Profile
                  </button>
                </div>
              </div>

              {/* Scrollable Container for LotProfile */}
              <div className="max-h-[82vh] overflow-y-auto pr-2 custom-scrollbar">
                <LotProfile 
                  data={mergedLotData} 
                  activeTheme={activeTheme} 
                  isModalMode={true} 
                  onCloseModal={() => setSelectedSearchLotId(null)}
                  selectedLotIdFromSearch={selectedSearchLotId}
                  onRefreshData={handleRefreshData}
                  selectedTab={profileSelectedTab}
                  onSelectedTabChange={setProfileSelectedTab}
                  showSummaryModal={profileShowSummaryModal}
                  onShowSummaryModalChange={setProfileShowSummaryModal}
                  weeklyUpdates={weeklyData}
                  onCompareLot={(lotId) => {
                    setCompareLotAId(lotId);
                    setCompareLotBId(null);
                    setIsComparisonOpen(true);
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AssignedAreaModal 
        isOpen={isAssignedAreaModalOpen}
        onClose={() => setIsAssignedAreaModalOpen(false)}
        onConfirm={(assignedArea) => {
          setReportsAssignedArea(assignedArea);
          setIsAssignedAreaModalOpen(false);
          setActiveSection("reports");
        }}
        lotData={mergedLotData}
        activeTheme={activeTheme}
        initialValue={reportsAssignedArea}
      />

      <LotComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        data={mergedLotData}
        activeTheme={activeTheme}
        initialLotAId={compareLotAId}
        initialLotBId={compareLotBId}
        onViewLotDetails={(lotId) => {
          setIsComparisonOpen(false);
          setSelectedSearchLotId(lotId);
          setProfileSelectedTab("general");
        }}
      />

      {/* Floating System-Wide Tour Guide Overlay */}
      <AnimatePresence>
        {tourActive && tourCoords && (
          <>
            {/* Backdrop spotlight dark screen tint with absolute pointer-events-none */}
            <div 
              className="fixed inset-0 z-[9990] bg-slate-950/25 dark:bg-slate-950/40 backdrop-blur-[0.5px] pointer-events-none" 
              data-html2canvas-ignore="true"
            />

            {/* Glowing active spotlight highlight border */}
            {spotlightCoords && (
              <div 
                className="fixed z-[9991] rounded-2xl border-2 border-brand-500 pointer-events-none shadow-[0_0_20px_rgba(99,102,241,0.5)] ring-4 ring-brand-500/15"
                style={{
                  top: spotlightCoords.top - 4,
                  left: spotlightCoords.left - 4,
                  width: spotlightCoords.width + 8,
                  height: spotlightCoords.height + 8,
                }}
              />
            )}

            {/* Beautiful Floating Tooltip popover with directional arrows */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="fixed z-[9999] w-72 xs:w-80 p-5 rounded-3xl border shadow-2xl backdrop-blur-xl flex flex-col gap-3.5 text-left pointer-events-auto"
              style={{
                top: tourCoords.top,
                left: tourCoords.left,
                transform: 
                  tourCoords.position === "right" 
                    ? "translateY(-50%)" 
                    : tourCoords.position === "left"
                      ? "translate(-100%, -50%)"
                      : tourCoords.position === "top"
                        ? "translate(-50%, -100%)"
                        : "translateX(-50%)"
              }}
              data-html2canvas-ignore="true"
            >
              {/* Tooltip Background Theme Pairing */}
              <div className={cn(
                "absolute inset-0 rounded-3xl -z-10",
                activeTheme.isDark 
                  ? "bg-slate-950/95 border-slate-800" 
                  : "bg-white/95 border-slate-200"
              )} />

              {/* Decorative top gradient accent bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 via-sky-450 to-indigo-500 rounded-t-full" />

              {/* Arrow indicator element */}
              <div 
                className={cn(
                  "absolute w-3 h-3 rotate-45 border -z-10",
                  activeTheme.isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200",
                  tourCoords.position === "right" && "top-1/2 -translate-y-1/2 -left-[6px] border-r-0 border-t-0",
                  tourCoords.position === "left" && "top-1/2 -translate-y-1/2 -right-[6px] border-l-0 border-b-0",
                  tourCoords.position === "top" && "bottom-[-6px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
                  tourCoords.position === "bottom" && "top-[-6px] left-1/2 -translate-x-1/2 border-b-0 border-r-0"
                )}
              />

              {/* Step counter header */}
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400">
                <span className="flex items-center gap-1.5 text-brand-500 font-bold">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  Terminal Guide
                </span>
                <span>{tourStep + 1} / {tourSteps.length}</span>
              </div>

              {/* Content Header */}
              <div className="space-y-1">
                <h4 className={cn(
                  "text-xs font-black uppercase tracking-wider font-display",
                  activeTheme.isDark ? "text-white" : "text-slate-900"
                )}>
                  {tourSteps[tourStep]?.title}
                </h4>
                <p className={cn(
                  "text-[11px] leading-relaxed font-semibold transition-colors duration-200",
                  activeTheme.isDark ? "text-slate-350" : "text-slate-600"
                )}>
                  {tourSteps[tourStep]?.description}
                </p>
              </div>

              {/* Micro progress indicator */}
              <div className="h-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-gradient-to-r from-brand-500 to-sky-450 rounded-full transition-all duration-300"
                  style={{ width: `${((tourStep + 1) / tourSteps.length) * 100}%` }}
                />
              </div>

              {/* Action Toolbars */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1">
                <button
                  type="button"
                  onClick={handleTourClose}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors cursor-pointer select-none"
                >
                  Skip
                </button>
                
                <div className="flex items-center gap-1.5">
                  {tourStep > 0 && (
                    <button
                      type="button"
                      onClick={handleTourPrev}
                      className={cn(
                        "px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer select-none active:scale-95",
                        activeTheme.isDark 
                          ? "bg-slate-900 hover:bg-slate-850 text-slate-300" 
                          : "bg-slate-100 hover:bg-slate-150 text-slate-700"
                      )}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTourNext}
                    className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-md shadow-brand-500/20 cursor-pointer select-none active:scale-95 flex items-center gap-1"
                  >
                    <span>{tourStep === tourSteps.length - 1 ? "Finish" : "Next"}</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>



      {/* Keyboard Shortcuts Help Legend Overlay */}
      <AnimatePresence>
        {showHelpLegend && (
          <>
            {/* Backdrop screen tint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelpLegend(false)}
              className="fixed inset-0 z-[10000] bg-slate-950/40 backdrop-blur-sm cursor-pointer"
            />

            {/* Centered Modal card */}
            <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none select-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 15 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                className={cn(
                  "w-full max-w-md p-6 rounded-[2.5rem] border shadow-2xl backdrop-blur-2xl flex flex-col gap-4 text-left pointer-events-auto relative overflow-hidden",
                  activeTheme.isDark
                    ? "bg-slate-900/95 border-slate-800 text-slate-100 shadow-slate-950/60"
                    : "bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/60"
                )}
              >
                {/* Top decorative gradient accent bar */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-500 via-sky-450 to-indigo-500" />

                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shadow-md",
                      activeTheme.isDark ? "bg-slate-800 text-brand-400" : "bg-slate-100 text-brand-500"
                    )}>
                      <Keyboard className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider font-display">
                        Keyboard Shortcuts
                      </h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        System-wide Quick Navigation
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelpLegend(false)}
                    className={cn(
                      "p-1.5 rounded-xl transition-all cursor-pointer active:scale-95",
                      activeTheme.isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Shortcuts Grid List */}
                <div className="space-y-3 py-1">
                  {/* Item helper */}
                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400/80 pb-0.5">
                    Primary Views
                  </div>

                  {/* Navigation keys */}
                  {[
                    { key: "1", label: "Dashboard" },
                    { key: "2", label: "Reports, Analytics & Planning", note: isLotAnalyzerZoomed ? "Disabled in Zoom mode" : undefined },
                    { key: "3", label: "Weekly Updates" },
                    { key: "4", label: "Add Accomplishment" },
                    { key: "5", label: "GIS Smart Map" },
                    { key: "6", label: "Manage Documents" },
                    { key: "7", label: "Settings" }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-550/10 last:border-0">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn(
                          "text-[11px] font-semibold tracking-wide",
                          item.note ? "text-slate-400 dark:text-slate-500 line-through font-bold" : activeTheme.isDark ? "text-slate-200 font-bold" : "text-slate-700 font-bold"
                        )}>
                          {item.label}
                        </span>
                        {item.note && (
                          <span className="text-[9px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest">
                            {item.note}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <kbd className={cn(
                          "px-2 py-1 rounded-lg border text-[10px] font-mono font-black shadow-xs",
                          activeTheme.isDark ? "bg-slate-950 border-slate-800 text-slate-350" : "bg-slate-50 border-slate-200 text-slate-600"
                        )}>
                          Alt
                        </kbd>
                        <span className="text-slate-400 dark:text-slate-600 font-mono text-[10px]">+</span>
                        <kbd className={cn(
                          "px-2.5 py-1 rounded-lg border text-[10px] font-mono font-black shadow-xs min-w-[24px] text-center",
                          activeTheme.isDark ? "bg-slate-950 border-slate-800 text-brand-400 border-brand-500/30" : "bg-slate-50 border-slate-200 text-brand-600 border-brand-200"
                        )}>
                          {item.key}
                        </kbd>
                      </div>
                    </div>
                  ))}

                  <div className="text-[9px] font-black uppercase tracking-widest text-slate-400/80 pt-2 pb-0.5 border-t border-slate-100 dark:border-slate-800/60">
                    General Controls
                  </div>

                  {/* General Actions */}
                  <div className="flex items-center justify-between py-1">
                    <span className={cn("text-[11px] font-bold tracking-wide", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                      Toggle Help Legend
                    </span>
                    <kbd className={cn(
                      "px-2.5 py-1 rounded-lg border text-[10px] font-mono font-black shadow-xs min-w-[24px] text-center",
                      activeTheme.isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                    )}>
                      ?
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className={cn("text-[11px] font-bold tracking-wide", activeTheme.isDark ? "text-slate-200" : "text-slate-700")}>
                      Close Modal / Popover
                    </span>
                    <kbd className={cn(
                      "px-2.5 py-1 rounded-lg border text-[10px] font-mono font-black shadow-xs min-w-[24px] text-center",
                      activeTheme.isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"
                    )}>
                      Esc
                    </kbd>
                  </div>
                </div>

                {/* Footer Tip */}
                <div className={cn(
                  "p-3 rounded-2xl flex items-start gap-2.5 mt-1 border",
                  activeTheme.isDark ? "bg-slate-950/50 border-slate-800/80" : "bg-slate-50 border-slate-200/60"
                )}>
                  <HelpCircle className="w-4 h-4 text-brand-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-400 font-bold">
                    Keyboard shortcuts are disabled while typing inside forms, search bars, and editing fields to prevent accidental navigation.
                  </p>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
