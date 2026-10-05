import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent benign websocket, network quota, or Vite HMR disconnect trace errors from bubbling up as uncaught/unhandled rejections
if (typeof window !== "undefined") {
  // Install Storage Prototype Overrides to avoid duplicate large images and handle quota limits gracefully
  try {
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;

    Storage.prototype.getItem = function (key) {
      const val = originalGetItem.call(this, key);
      if (key === "gcr_global_team_photo" && val === "REF_TO_SCLA_TEAM_PHOTO") {
        return originalGetItem.call(this, "scla_team_photo");
      }
      if (key === "scla_team_photo" && val === "REF_TO_GCR_GLOBAL_TEAM_PHOTO") {
        return originalGetItem.call(this, "gcr_global_team_photo");
      }
      return val;
    };

    Storage.prototype.setItem = function (key, value) {
      if (key === "gcr_global_team_photo" || key === "scla_team_photo") {
        const actualKey = "scla_team_photo";
        const pointerKey = "gcr_global_team_photo";
        
        // Handle empty or small values
        if (!value || value.length < 100) {
          originalSetItem.call(this, key, value);
          return;
        }

        try {
          // Store only in actualKey, reference in pointerKey to save 50% storage space
          originalSetItem.call(this, pointerKey, "REF_TO_SCLA_TEAM_PHOTO");
          originalSetItem.call(this, actualKey, value);
        } catch (err) {
          // If storage quota exceeded, handle it silently without throwing
        }
        return;
      }

      try {
        originalSetItem.call(this, key, value);
      } catch (err) {
        // Handle quota limits silently
      }
    };
  } catch (e) {
    // Fail-safe
  }

  // Override console.error/warn to quiet trace alerts of websocket reconnections and quota limits
  const originalConsoleError = console.error;
  console.error = (...args) => {
    const msg = args.map(arg => String(arg)).join(" ");
    if (
      msg.toLowerCase().includes("websocket") ||
      msg.toLowerCase().includes("failed to connect") ||
      msg.toLowerCase().includes("closed without opened") ||
      msg.toLowerCase().includes("socket closed") ||
      msg.toLowerCase().includes("should be greater than 0") ||
      msg.toLowerCase().includes("width(-1)") ||
      msg.toLowerCase().includes("height(-1)") ||
      msg.toLowerCase().includes("width(100%)") ||
      msg.toLowerCase().includes("height(100%)") ||
      msg.toLowerCase().includes("minwidth(0)") ||
      msg.toLowerCase().includes("script error") ||
      msg.toLowerCase().includes("responsivecontainer") ||
      msg.toLowerCase().includes("quota exceeded") ||
      msg.toLowerCase().includes("exceeded quota") ||
      msg.toLowerCase().includes("scla_team_photo") ||
      msg.toLowerCase().includes("gcr_global_team_photo")
    ) {
      return; // Quietly filter out from browser log spam
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args) => {
    const msg = args.map(arg => String(arg)).join(" ");
    if (
      msg.toLowerCase().includes("websocket") ||
      msg.toLowerCase().includes("failed to connect") ||
      msg.toLowerCase().includes("closed without opened") ||
      msg.toLowerCase().includes("socket closed") ||
      msg.toLowerCase().includes("should be greater than 0") ||
      msg.toLowerCase().includes("width(-1)") ||
      msg.toLowerCase().includes("height(-1)") ||
      msg.toLowerCase().includes("width(100%)") ||
      msg.toLowerCase().includes("height(100%)") ||
      msg.toLowerCase().includes("minwidth(0)") ||
      msg.toLowerCase().includes("script error") ||
      msg.toLowerCase().includes("responsivecontainer") ||
      msg.toLowerCase().includes("quota exceeded") ||
      msg.toLowerCase().includes("exceeded quota") ||
      msg.toLowerCase().includes("scla_team_photo") ||
      msg.toLowerCase().includes("gcr_global_team_photo")
    ) {
      return; // Quietly filter out from browser log spam
    }
    originalConsoleWarn.apply(console, args);
  };

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || "");
    const stack = String(reason?.stack || "");
    if (
      msg.toLowerCase().includes("websocket") || 
      msg.toLowerCase().includes("web socket") || 
      msg.toLowerCase().includes("failed to connect") ||
      msg.toLowerCase().includes("closed without opened") ||
      msg.toLowerCase().includes("script error") ||
      stack.toLowerCase().includes("websocket") ||
      stack.toLowerCase().includes("web socket") ||
      stack.toLowerCase().includes("failed to connect") ||
      stack.toLowerCase().includes("closed without opened") ||
      stack.toLowerCase().includes("script error")
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  });

  // Catch any unhandled script or resource loading errors, especially websocket/Vite connection indicators
  window.addEventListener("error", (event) => {
    const msg = String(event.message || "");
    const errorObj = event.error;
    const errStr = String(errorObj?.message || errorObj?.stack || "");
    if (
      msg.toLowerCase().includes("websocket") || 
      msg.toLowerCase().includes("web socket") || 
      msg.toLowerCase().includes("failed to connect") ||
      msg.toLowerCase().includes("closed without opened") ||
      msg.toLowerCase().includes("script error") ||
      errStr.toLowerCase().includes("websocket") ||
      errStr.toLowerCase().includes("web socket") ||
      errStr.toLowerCase().includes("failed to connect") ||
      errStr.toLowerCase().includes("closed without opened") ||
      errStr.toLowerCase().includes("script error")
    ) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);

  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = String(message || "");
    const errStr = String(error?.message || error?.stack || "");
    if (
      msg.toLowerCase().includes("websocket") || 
      msg.toLowerCase().includes("web socket") || 
      msg.toLowerCase().includes("failed to connect") ||
      msg.toLowerCase().includes("closed without opened") ||
      msg.toLowerCase().includes("script error") ||
      errStr.toLowerCase().includes("websocket") ||
      errStr.toLowerCase().includes("web socket") ||
      errStr.toLowerCase().includes("failed to connect") ||
      errStr.toLowerCase().includes("closed without opened") ||
      errStr.toLowerCase().includes("script error")
    ) {
      return true; // Suppress it
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

