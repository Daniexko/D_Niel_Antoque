import { useState, useEffect } from "react";

export type ThemeId = "blue" | "emerald" | "rose" | "violet" | "charcoal";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  isDark?: boolean;
  primaryBg: string;      // bg-blue-600
  sidebarActiveBg: string; // bg-blue-600
  primaryText: string;    // text-blue-600
  primaryText70: string;  // text-blue-600/70
  primaryHoverBg: string; // hover:bg-blue-50
  primaryHoverText: string; // hover:text-blue-600
  primaryBorder: string;  // border-blue-200
  primaryShadow: string;  // shadow-blue-500/20
  primaryAccentBg: string; // bg-blue-50
  primaryAccentText: string; // text-blue-700
  primaryGradient: string; // from-blue-600 to-indigo-600
  pulseBg: string;         // bg-blue-500
  spinnerColor: string;    // border-t-blue-600
}

export const themes: Record<ThemeId, ThemeConfig> = {
  blue: {
    id: "blue",
    name: "GCR Blue (Default)",
    isDark: false,
    primaryBg: "bg-blue-600",
    sidebarActiveBg: "bg-blue-600",
    primaryText: "text-blue-600",
    primaryText70: "text-blue-600/70",
    primaryHoverBg: "hover:bg-blue-50",
    primaryHoverText: "hover:text-blue-600",
    primaryBorder: "border-blue-200",
    primaryShadow: "shadow-blue-500/20",
    primaryAccentBg: "bg-blue-50",
    primaryAccentText: "text-blue-700",
    primaryGradient: "from-blue-600 to-indigo-600",
    pulseBg: "bg-blue-500",
    spinnerColor: "border-t-blue-600",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Forest",
    isDark: false,
    primaryBg: "bg-emerald-600",
    sidebarActiveBg: "bg-emerald-600",
    primaryText: "text-emerald-600",
    primaryText70: "text-emerald-600/70",
    primaryHoverBg: "hover:bg-emerald-50",
    primaryHoverText: "hover:text-emerald-600",
    primaryBorder: "border-emerald-200",
    primaryShadow: "shadow-emerald-500/20",
    primaryAccentBg: "bg-emerald-50",
    primaryAccentText: "text-emerald-700",
    primaryGradient: "from-emerald-600 to-teal-600",
    pulseBg: "bg-emerald-500",
    spinnerColor: "border-t-emerald-600",
  },
  rose: {
    id: "rose",
    name: "Sunset Crimson",
    isDark: false,
    primaryBg: "bg-rose-600",
    sidebarActiveBg: "bg-rose-600",
    primaryText: "text-rose-600",
    primaryText70: "text-rose-600/70",
    primaryHoverBg: "hover:bg-rose-50",
    primaryHoverText: "hover:text-rose-600",
    primaryBorder: "border-rose-200",
    primaryShadow: "shadow-rose-500/20",
    primaryAccentBg: "bg-rose-50",
    primaryAccentText: "text-rose-700",
    primaryGradient: "from-rose-600 to-amber-600",
    pulseBg: "bg-rose-500",
    spinnerColor: "border-t-rose-600",
  },
  violet: {
    id: "violet",
    name: "Royal Violet",
    isDark: false,
    primaryBg: "bg-violet-600",
    sidebarActiveBg: "bg-violet-600",
    primaryText: "text-violet-600",
    primaryText70: "text-violet-600/70",
    primaryHoverBg: "hover:bg-violet-50",
    primaryHoverText: "hover:text-violet-600",
    primaryBorder: "border-violet-200",
    primaryShadow: "shadow-violet-500/20",
    primaryAccentBg: "bg-violet-50",
    primaryAccentText: "text-violet-700",
    primaryGradient: "from-violet-600 to-fuchsia-600",
    pulseBg: "bg-violet-500",
    spinnerColor: "border-t-violet-600",
  },
  charcoal: {
    id: "charcoal",
    name: "Obsidian Steel",
    isDark: false,
    primaryBg: "bg-slate-800",
    sidebarActiveBg: "bg-slate-800",
    primaryText: "text-slate-800",
    primaryText70: "text-slate-800/70",
    primaryHoverBg: "hover:bg-slate-100",
    primaryHoverText: "hover:text-slate-800",
    primaryBorder: "border-slate-300",
    primaryShadow: "shadow-slate-500/20",
    primaryAccentBg: "bg-slate-100",
    primaryAccentText: "text-slate-800",
    primaryGradient: "from-slate-800 to-slate-950",
    pulseBg: "bg-slate-600",
    spinnerColor: "border-t-slate-800",
  },
};

export function getActiveTheme(): ThemeConfig {
  try {
    const saved = localStorage.getItem("gcr_la_theme") as ThemeId;
    if (saved && themes[saved]) return themes[saved];
  } catch {}
  return themes.blue;
}
