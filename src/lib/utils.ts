import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
  if (isNaN(num)) return "₱0.00";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  return `₱${formatted}`;
}

export function formatArea(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
  if (isNaN(num)) return "0.00";
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatFullAmountWithScale(value: number | string) {
  const num = typeof value === "string" ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : Number(value);
  if (num === undefined || num === null || isNaN(num)) {
    return {
      fullStr: "₱0.00",
      scaleStr: "₱0.00",
      displayShort: "₱0.00",
      displayFull: "₱0.00",
      scaledValue: 0,
      scaleWord: ""
    };
  }

  const absVal = Math.abs(num);
  const formattedFull = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  let scaleWord = "";
  let divider = 1;

  if (absVal >= 1e12) {
    divider = 1e12;
    scaleWord = "Trillion";
  } else if (absVal >= 1e9) {
    divider = 1e9;
    scaleWord = "Billion";
  } else if (absVal >= 1e6) {
    divider = 1e6;
    scaleWord = "Million";
  } else if (absVal >= 1e3) {
    divider = 1e3;
    scaleWord = "Thousand";
  } else if (absVal >= 100) {
    divider = 100;
    scaleWord = "Hundreds";
  }

  const scaledValue = num / divider;
  const formattedScaled = scaledValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const displayShort = scaleWord ? `₱${formattedScaled} ${scaleWord}` : formattedFull;
  const displayFull = scaleWord ? `${formattedFull} (${formattedScaled} ${scaleWord})` : formattedFull;

  return {
    fullStr: formattedFull,
    scaleStr: displayShort,
    displayShort,
    displayFull,
    scaledValue,
    scaleWord
  };
}

const UNIQUE_CHART_COLORS = [
  { startDark: "#818cf8", endDark: "#312e81", startLight: "#4f46e5", endLight: "#3730a3" }, // 0: Indigo
  { startDark: "#a78bfa", endDark: "#4c1d95", startLight: "#7c3aed", endLight: "#5b21b6" }, // 1: Violet
  { startDark: "#38bdf8", endDark: "#075985", startLight: "#0284c7", endLight: "#0c4a6e" }, // 2: Sky
  { startDark: "#34d399", endDark: "#064e3b", startLight: "#059669", endLight: "#065f46" }, // 3: Emerald
  { startDark: "#f472b6", endDark: "#881337", startLight: "#e11d48", endLight: "#9f1239" }, // 4: Rose
  { startDark: "#fbbf24", endDark: "#78350f", startLight: "#d97706", endLight: "#92400e" }, // 5: Amber
  { startDark: "#c084fc", endDark: "#581c87", startLight: "#9333ea", endLight: "#6b21a8" }, // 6: Purple
  { startDark: "#60a5fa", endDark: "#1e3a8a", startLight: "#2563eb", endLight: "#1e40af" }, // 7: Blue
  { startDark: "#2dd4bf", endDark: "#134e4a", startLight: "#0d9488", endLight: "#115e59" }, // 8: Teal
  { startDark: "#a3e635", endDark: "#365314", startLight: "#65a30d", endLight: "#3f6212" }, // 9: Lime
  { startDark: "#f43f5e", endDark: "#9f1239", startLight: "#be123c", endLight: "#881337" }, // 10: Crimson
  { startDark: "#fb923c", endDark: "#7c2d12", startLight: "#ea580c", endLight: "#9a3412" }, // 11: Orange
  { startDark: "#e879f9", endDark: "#701a75", startLight: "#c026d3", endLight: "#86198f" }, // 12: Fuchsia
  { startDark: "#22d3ee", endDark: "#164e63", startLight: "#0891b2", endLight: "#155e75" }, // 13: Cyan
  { startDark: "#facc15", endDark: "#713f12", startLight: "#ca8a04", endLight: "#854d0e" }, // 14: Yellow
  { startDark: "#4ade80", endDark: "#14532d", startLight: "#16a34a", endLight: "#14532d" }, // 15: Green
  { startDark: "#ff7675", endDark: "#d63031", startLight: "#d63031", endLight: "#7f1d1d" }, // 16: Coral
  { startDark: "#a29bfe", endDark: "#6c5ce7", startLight: "#6c5ce7", endLight: "#3730a3" }, // 17: Lavender
  { startDark: "#fdcb6e", endDark: "#e17055", startLight: "#d97706", endLight: "#7c2d12" }, // 18: Sunset
  { startDark: "#55efc4", endDark: "#00b894", startLight: "#059669", endLight: "#064e3b" }, // 19: Mint
  { startDark: "#81ecec", endDark: "#00cec9", startLight: "#0891b2", endLight: "#164e63" }, // 20: Aqua
  { startDark: "#fd79a8", endDark: "#e84393", startLight: "#db2777", endLight: "#831843" }, // 21: Deep Pink
  { startDark: "#74b9ff", endDark: "#0984e3", startLight: "#0284c7", endLight: "#075985" }, // 22: Powder Blue
  { startDark: "#fab1a0", endDark: "#e17055", startLight: "#ea580c", endLight: "#9a3412" }  // 23: Peach
];

export function getUniqueItemColor(index: number, isDark: boolean) {
  if (index < UNIQUE_CHART_COLORS.length) {
    const palette = UNIQUE_CHART_COLORS[index];
    return {
      start: isDark ? palette.startDark : palette.startLight,
      end: isDark ? palette.endDark : palette.endLight
    };
  }
  // Fallback HSL algorithm using golden ratio multiplier for unlimited unique distinct colors
  const hue = Math.round((index * 137.508) % 360);
  if (isDark) {
    return {
      start: `hsl(${hue}, 80%, 65%)`,
      end: `hsl(${hue}, 80%, 28%)`
    };
  } else {
    return {
      start: `hsl(${hue}, 75%, 45%)`,
      end: `hsl(${hue}, 75%, 25%)`
    };
  }
}

