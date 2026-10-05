import React, { useState, useEffect, useRef } from "react";
import { Users, Check, Edit2, X, Shield, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleUser } from "../types";
import { 
  STORAGE_KEY_DASHBOARD_PANELS, 
  STORAGE_KEY_KPI_WIDGETS, 
  EVENT_DASHBOARD_PANELS_CHANGED, 
  EVENT_KPI_WIDGETS_CHANGED 
} from "../lib/dashboardConfig";

interface ActiveUser {
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
}

interface PresenceIndicatorProps {
  activeSection: string;
  currentUser?: GoogleUser;
  onUsersUpdate?: (users: ActiveUser[]) => void;
  onRestrictionsReceived?: (restrictions: Record<string, string[]>) => void;
  restrictions?: Record<string, string[]>;
}

// Helper for safe localStorage write (ignores quota issues for big images/avatars)
const safeLocalSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`localStorage setItem failed for key "${key}" (possibly exceeded quota):`, err);
  }
};

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ 
  activeSection, 
  currentUser,
  onUsersUpdate,
  onRestrictionsReceived,
  restrictions
}) => {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [zoomedPresenceUser, setZoomedPresenceUser] = useState<ActiveUser | null>(null);
  const [localIsIdle, setLocalIsIdle] = useState(false);
  const localIsIdleRef = useRef(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const toggleZoomPresenceUser = (usr: ActiveUser) => {
    if (zoomedPresenceUser && zoomedPresenceUser.id === usr.id && zoomedPresenceUser.activeSection === usr.activeSection) {
      setZoomedPresenceUser(null);
    } else {
      setZoomedPresenceUser(usr);
    }
  };
  
  // Local profile
  const [profile, setProfile] = useState(() => {
    const defaultId = currentUser?.email || Math.random().toString(36).substring(2, 9);
    const defaultName = currentUser?.name || `GCR Guest-${defaultId.substring(0, 4)}`;
    try {
      const savedId = currentUser?.email || localStorage.getItem("scla_usr_id") || defaultId;
      const savedName = currentUser?.name || localStorage.getItem("scla_usr_name") || defaultName;
      const savedColor = localStorage.getItem("scla_usr_color") || getRandomColor();
      
      localStorage.setItem("scla_usr_id", savedId);
      localStorage.setItem("scla_usr_name", savedName);
      localStorage.setItem("scla_usr_color", savedColor);
      
      return { 
        id: savedId, 
        name: savedName, 
        color: savedColor,
        picture: currentUser?.picture || "",
        positionCode: currentUser?.positionCode || "",
        jobPosition: currentUser?.jobPosition || "",
        email: currentUser?.email || ""
      };
    } catch {
      return { 
        id: defaultId, 
        name: defaultName, 
        color: getRandomColor(),
        picture: currentUser?.picture || "",
        positionCode: currentUser?.positionCode || "",
        jobPosition: currentUser?.jobPosition || "",
        email: currentUser?.email || ""
      };
    }
  });

  const [inputName, setInputName] = useState(profile.name);
  const socketRef = useRef<WebSocket | null>(null);
  const prevRestrictionsRef = useRef<string>(restrictions ? JSON.stringify(restrictions) : "");

  // Helper colors
  function getRandomColor() {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6"];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Synchronize with currentUser changes and update the network session
  useEffect(() => {
    if (currentUser) {
      const updatedProfile = {
        id: currentUser.email,
        name: currentUser.name,
        color: profile.color || getRandomColor(),
        picture: currentUser.picture || "",
        positionCode: currentUser.positionCode || "",
        jobPosition: currentUser.jobPosition || "",
        email: currentUser.email || ""
      };
      setProfile(updatedProfile);
      setInputName(currentUser.name);
      
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update_profile",
          name: currentUser.name,
          picture: currentUser.picture || "",
          positionCode: currentUser.positionCode || "",
          jobPosition: currentUser.jobPosition || "",
          email: currentUser.email || ""
        }));
      }
    }
  }, [currentUser]);

  // Connect to websocket with robust auto-reconnection support
  useEffect(() => {
    let socket: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isTerminated = false;
    let reconnectAttempts = 0;

    const connect = () => {
      if (isTerminated) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}`;

      try {
        socket = new WebSocket(wsUrl);
        socketRef.current = socket;
      } catch (wsErr) {
        console.error("Presence WebSocket synchronous creation failed:", wsErr);
        scheduleReconnect();
        return;
      }

      socket.onopen = () => {
        reconnectAttempts = 0; // Reset attempts on successful connection
        console.log("Presence WebSocket connected successfully");
        
        // Send initial join
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({
            type: "join",
            id: profile.id,
            name: profile.name,
            color: profile.color,
            picture: profile.picture || "",
            activeSection,
            positionCode: profile.positionCode || "",
            jobPosition: profile.jobPosition || "",
            email: profile.email || "",
            isIdle: localIsIdleRef.current
          }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "data_updated") {
            window.dispatchEvent(new CustomEvent("scla_data_updated"));
          } else if (message.type === "presence_update") {
            setUsers(message.users);
            if (onUsersUpdate) {
              onUsersUpdate(message.users);
            }
          } else if (message.type === "restrictions_update") {
            if (onRestrictionsReceived) {
              prevRestrictionsRef.current = JSON.stringify(message.restrictions);
              onRestrictionsReceived(message.restrictions);
            }
          } else if (message.type === "initial_config") {
            const bg = message.globalTeamPhoto || "";
            safeLocalSet("gcr_global_team_photo", bg);
            if (bg) {
              safeLocalSet("scla_team_photo", bg);
            } else {
              try {
                localStorage.removeItem("scla_team_photo");
              } catch {}
            }
            window.dispatchEvent(new CustomEvent("scla_global_background_updated", {
              detail: { globalBackground: bg }
            }));
            if (message.dev1) {
              safeLocalSet("gcr_dev1_name", message.dev1.name);
              safeLocalSet("gcr_dev1_role", message.dev1.role);
              safeLocalSet("gcr_dev1_badge", message.dev1.badge);
              safeLocalSet("gcr_dev1_pic", message.dev1.picture);
              safeLocalSet("gcr_dev1_bio", message.dev1.bio);
            }
            if (message.dev2) {
              safeLocalSet("gcr_dev2_name", message.dev2.name);
              safeLocalSet("gcr_dev2_role", message.dev2.role);
              safeLocalSet("gcr_dev2_badge", message.dev2.badge);
              safeLocalSet("gcr_dev2_pic", message.dev2.picture);
              safeLocalSet("gcr_dev2_bio", message.dev2.bio);
            }
            window.dispatchEvent(new CustomEvent("scla_devs_updated", {
              detail: { dev1: message.dev1, dev2: message.dev2 }
            }));
            if (Array.isArray(message.panels) && message.panels.length > 0) {
              safeLocalSet(STORAGE_KEY_DASHBOARD_PANELS, JSON.stringify(message.panels));
              window.dispatchEvent(new CustomEvent(EVENT_DASHBOARD_PANELS_CHANGED, { detail: message.panels }));
            }
            if (Array.isArray(message.kpis) && message.kpis.length > 0) {
              safeLocalSet(STORAGE_KEY_KPI_WIDGETS, JSON.stringify(message.kpis));
              window.dispatchEvent(new CustomEvent(EVENT_KPI_WIDGETS_CHANGED, { detail: message.kpis }));
            }
          } else if (message.type === "dashboard_config_update") {
            if (Array.isArray(message.panels) && message.panels.length > 0) {
              safeLocalSet(STORAGE_KEY_DASHBOARD_PANELS, JSON.stringify(message.panels));
              window.dispatchEvent(new CustomEvent(EVENT_DASHBOARD_PANELS_CHANGED, { detail: message.panels }));
            }
            if (Array.isArray(message.kpis) && message.kpis.length > 0) {
              safeLocalSet(STORAGE_KEY_KPI_WIDGETS, JSON.stringify(message.kpis));
              window.dispatchEvent(new CustomEvent(EVENT_KPI_WIDGETS_CHANGED, { detail: message.kpis }));
            }
          } else if (message.type === "devs_update") {
            if (message.dev1) {
              safeLocalSet("gcr_dev1_name", message.dev1.name);
              safeLocalSet("gcr_dev1_role", message.dev1.role);
              safeLocalSet("gcr_dev1_badge", message.dev1.badge);
              safeLocalSet("gcr_dev1_pic", message.dev1.picture);
              safeLocalSet("gcr_dev1_bio", message.dev1.bio);
            }
            if (message.dev2) {
              safeLocalSet("gcr_dev2_name", message.dev2.name);
              safeLocalSet("gcr_dev2_role", message.dev2.role);
              safeLocalSet("gcr_dev2_badge", message.dev2.badge);
              safeLocalSet("gcr_dev2_pic", message.dev2.picture);
              safeLocalSet("gcr_dev2_bio", message.dev2.bio);
            }
            window.dispatchEvent(new CustomEvent("scla_devs_updated", {
              detail: { dev1: message.dev1, dev2: message.dev2 }
            }));
          } else if (message.type === "global_background_update") {
            const bg = message.globalBackground || "";
            safeLocalSet("gcr_global_team_photo", bg);
            if (bg) {
              safeLocalSet("scla_team_photo", bg);
            } else {
              try {
                localStorage.removeItem("scla_team_photo");
              } catch {}
            }
            window.dispatchEvent(new CustomEvent("scla_global_background_updated", {
              detail: { globalBackground: bg }
            }));
          } else if (message.type === "schedules_update") {
            const scheds = message.schedules || [];
            try {
              localStorage.setItem("heatmap_lot_schedules", JSON.stringify(scheds));
            } catch {}
            window.dispatchEvent(new CustomEvent("scla_schedules_updated", {
              detail: { schedules: scheds }
            }));
          }
        } catch (err) {
          console.error("Failed to parse presence update:", err);
        }
      };

      socket.onclose = () => {
        console.warn("Presence WebSocket connection closed. Attempting reconnect...");
        cleanup();
        scheduleReconnect();
      };

      socket.onerror = (err) => {
        console.error("Presence WebSocket connection error:", err);
        if (socket) {
          socket.close();
        }
      };
    };

    const cleanup = () => {
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
      }
    };

    const scheduleReconnect = () => {
      if (isTerminated) return;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      
      // Exponential backoff capped at 10 seconds
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
      reconnectAttempts++;
      
      reconnectTimeout = setTimeout(() => {
        console.log(`Reconnecting to Presence WebSocket (attempt ${reconnectAttempts})...`);
        connect();
      }, delay);
    };

    // Keepalive ping interval checking every 15 seconds to keep the socket alive and detect stale states early
    pingInterval = setInterval(() => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      } else if (socket && (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING)) {
        console.warn("Detected dead Presence WebSocket during ping check. Reconnecting immediately...");
        cleanup();
        scheduleReconnect();
      }
    }, 15000);

    // Initiate first connection
    connect();

    return () => {
      isTerminated = true;
      cleanup();
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) socket.close();
    };
  }, [profile.id]);

  // Synchronize localIsIdle ref with state to allow handleActivity to access latest value
  useEffect(() => {
    localIsIdleRef.current = localIsIdle;
  }, [localIsIdle]);

  // Track system activity and tab focus status to determine idle/deactivated status
  useEffect(() => {
    const IDLE_TIME = 2 * 60 * 1000; // 2 minutes for seamless, responsive testing

    let lastX = -1;
    let lastY = -1;

    const handleActivity = (e?: Event) => {
      // Ignore synthetic mousemove triggers that fire in background without motion
      if (e && e.type === "mousemove") {
        const me = e as MouseEvent;
        if (me.clientX === lastX && me.clientY === lastY) {
          return;
        }
        lastX = me.clientX;
        lastY = me.clientY;
      }

      // If we were previously marked as idle, restore status to active online
      if (localIsIdleRef.current) {
        setLocalIsIdle(false);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: "update_profile",
            isIdle: false
          }));
        }
      }

      // Reset the inactivity timer
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        setLocalIsIdle(true);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: "update_profile",
            isIdle: true
          }));
        }
      }, IDLE_TIME);
    };

    // Fast-acting listener for browser tab deactivation and window defocus
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Switch to Idle / Deactivated instantly when tab is put in background
        setLocalIsIdle(true);
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: "update_profile",
            isIdle: true
          }));
        }
      } else {
        // Return to Active Online instantly upon returning to the window tab
        handleActivity();
      }
    };

    // Set initial timer
    idleTimerRef.current = setTimeout(() => {
      setLocalIsIdle(true);
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update_profile",
          isIdle: true
        }));
      }
    }, IDLE_TIME);

    // Track standard physical inputs within the webpage window
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click", "focus"];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Track tab focus changes via HTML Page Visibility API
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);
    window.addEventListener("focus", handleActivity);

    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
      window.removeEventListener("focus", handleActivity);
    };
  }, []);

  // Track restrictions to broadcast changes to WebSocket in real-time
  useEffect(() => {
    if (restrictions) {
      const serialized = JSON.stringify(restrictions);
      if (prevRestrictionsRef.current && prevRestrictionsRef.current !== serialized) {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: "update_restrictions",
            restrictions
          }));
        }
      }
      prevRestrictionsRef.current = serialized;
    }
  }, [restrictions]);

  // Tell server when active section changes
  useEffect(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "update_profile",
        activeSection
      }));
    }
  }, [activeSection]);

  // Listen for local browser broadcasts from Settings/Data Admin to push over WebSocket
  useEffect(() => {
    const handleBroadcastDevs = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update_devs",
          dev1: customEvent.detail.dev1,
          dev2: customEvent.detail.dev2
        }));
      }
    };

    const handleBroadcastGlobalBg = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update_global_background",
          globalBackground: customEvent.detail.globalBackground
        }));
      }
    };

    const handleBroadcastSchedules = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update_schedules",
          schedules: customEvent.detail.schedules
        }));
      }
    };

    const handleBroadcastDashboardConfig = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "update_dashboard_config",
          panels: customEvent.detail.panels,
          kpis: customEvent.detail.kpis
        }));
      }
    };

    window.addEventListener("scla_broadcast_devs", handleBroadcastDevs);
    window.addEventListener("scla_broadcast_global_background", handleBroadcastGlobalBg);
    window.addEventListener("scla_broadcast_schedules", handleBroadcastSchedules);
    window.addEventListener("scla_broadcast_dashboard_config", handleBroadcastDashboardConfig);

    return () => {
      window.removeEventListener("scla_broadcast_devs", handleBroadcastDevs);
      window.removeEventListener("scla_broadcast_global_background", handleBroadcastGlobalBg);
      window.removeEventListener("scla_broadcast_schedules", handleBroadcastSchedules);
      window.removeEventListener("scla_broadcast_dashboard_config", handleBroadcastDashboardConfig);
    };
  }, []);

  const handleSaveName = () => {
    if (!inputName.trim()) return;
    const updated = { ...profile, name: inputName.trim() };
    setProfile(updated);
    setIsEditing(false);
    
    try {
      localStorage.setItem("scla_usr_name", updated.name);
    } catch {}

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "update_profile",
        name: updated.name
      }));
    }
  };

  const getInitials = (nameStr: string) => {
    return nameStr
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const formatSectionName = (sec: string) => {
    if (!sec) return "Dashboard";
    if (sec === "discrepancy") return "GCR & DOTr Discrepancy";
    if (sec === "gis") return "GIS Smart Map";
    return sec
      .replace(/([A-Z])/g, " $1")
      .trim()
      .replace(/^\w/, (c) => c.toUpperCase());
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 xl:px-4 xl:py-2 bg-slate-100 hover:bg-slate-200/80 active:scale-95 text-slate-700 rounded-full border border-slate-200/60 transition-all font-sans select-none cursor-pointer whitespace-nowrap shrink-0"
        title="View online users"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-black uppercase tracking-wider">
          <span className="hidden xl:inline">{users.length} Active {users.length === 1 ? "User" : "Users"}</span>
          <span className="xl:hidden">{users.length} Active</span>
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-[0_20px_50px_rgba(15,23,42,0.15)] z-50 p-5 text-left antialiased animate-in fade-in slide-in-from-top-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Active Members</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Team Presence Live</p>
                </div>
                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  {users.length} Online
                </span>
              </div>

              {/* Set My Profile Name */}
              <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Your Identity</span>
                  {!isEditing && (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="text-[9px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-2.5 h-2.5" /> Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="flex gap-1.5 mt-1">
                    <input
                      type="text"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                      maxLength={20}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveName}
                      className="bg-emerald-600 text-white p-1.5 rounded-xl hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                      title="Save name"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div 
                    onClick={() => toggleZoomPresenceUser({
                      id: profile.id,
                      name: profile.name,
                      picture: profile.picture,
                      color: profile.color,
                      activeSection,
                      lastSeen: Date.now(),
                      positionCode: profile.positionCode,
                      jobPosition: profile.jobPosition,
                      email: profile.email,
                      isIdle: localIsIdle
                    })}
                    className="flex items-center gap-2.5 cursor-zoom-in hover:opacity-85 active:scale-98 transition-all p-1 rounded-xl"
                    title="Zoom Profile"
                  >
                    <div 
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[10px] font-black border border-slate-100 shadow-xs overflow-hidden bg-slate-200 shrink-0"
                      style={{ backgroundColor: profile.color }}
                    >
                      {profile.picture ? (
                        <img 
                          src={profile.picture} 
                          alt="Avatar" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        getInitials(profile.name)
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-800 leading-none">{profile.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Viewing: {formatSectionName(activeSection)}
                      </p>
                      {localIsIdle ? (
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1 select-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Idle / Deactivated
                        </p>
                      ) : (
                        <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1 select-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Online
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Users List */}
              <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                {users.filter(u => u.id !== profile.id).length === 0 ? (
                  <div className="py-4 text-center text-slate-400 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest">No other users online</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                      Share the link with your colleagues to view dashboards and lot data concurrently!
                    </p>
                  </div>
                ) : (
                  users
                    .filter(u => u.id !== profile.id)
                    .map((item, idx) => (
                      <div 
                        key={`${item.id}-${idx}`} 
                        onClick={() => toggleZoomPresenceUser(item)}
                        className="p-2.5 bg-slate-50 hover:bg-indigo-50/20 dark:hover:bg-slate-800/10 border border-slate-200/30 rounded-2xl flex items-center justify-between transition-all cursor-zoom-in active:scale-98"
                        title="Zoom Profile"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black border border-slate-100 select-none shadow-xs overflow-hidden bg-slate-200 shrink-0"
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
                              getInitials(item.name)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-800 leading-none truncate whitespace-nowrap">
                              {item.name}
                            </p>
                            {item.isIdle ? (
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-1 select-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Idle / Deactivated
                              </p>
                            ) : (
                              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1 select-none">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Online
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <span className="inline-block text-[9px] font-black text-slate-500 bg-slate-200/50 p-1 rounded-lg uppercase tracking-wide">
                            {formatSectionName(item.activeSection)}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>

              {/* Inline Collapsible Member Details Panel right below the active list */}
              <AnimatePresence>
                {zoomedPresenceUser && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 14 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-slate-100 pt-3"
                  >
                    <div className="relative bg-slate-50/65 border border-slate-200/45 rounded-2xl p-4 flex flex-col items-center text-center gap-2.5">
                      {/* Close Button */}
                      <button
                        onClick={() => setZoomedPresenceUser(null)}
                        className="absolute top-2.5 right-2.5 p-1 rounded-full bg-slate-200/60 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all active:scale-95 cursor-pointer"
                        title="Close active member breakdown"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Accent Header */}
                      <div className="flex flex-col items-center gap-0.5 mt-0.5">
                        <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-indigo-600">
                          <Shield className="w-2.5 h-2.5 text-indigo-650" /> Workspace Profile
                        </span>
                      </div>

                      {/* Avatar Image / Initials */}
                      <div className="relative">
                        <div 
                          className="absolute -inset-0.5 rounded-full blur-xs opacity-60 animate-pulse" 
                          style={{ backgroundColor: zoomedPresenceUser.color || '#6366f1' }}
                        />
                        <div 
                          className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-white shadow-xs bg-slate-100 flex items-center justify-center shrink-0"
                          style={!zoomedPresenceUser.picture ? { backgroundColor: zoomedPresenceUser.color || '#6366f1' } : undefined}
                        >
                          {zoomedPresenceUser.picture ? (
                            <img
                              src={zoomedPresenceUser.picture}
                              alt={zoomedPresenceUser.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span className="text-white text-md font-black select-none">
                              {getInitials(zoomedPresenceUser.name)}
                            </span>
                          )}
                        </div>
                        {/* Status dot indicator */}
                        <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full shadow-xs ${zoomedPresenceUser.isIdle ? "bg-slate-400" : "bg-emerald-500"}`} />
                      </div>

                      {/* Contact Description / Meta */}
                      <div className="space-y-1 text-center font-sans">
                        <h4 className="text-sm font-black text-slate-800 tracking-tight leading-none pb-0.5">
                          {zoomedPresenceUser.name}
                        </h4>

                        {/* Custom registration fields below active member profile click */}
                        {(zoomedPresenceUser.jobPosition || zoomedPresenceUser.positionCode) && (
                          <div className="flex flex-wrap gap-1 justify-center items-center mt-1">
                            {zoomedPresenceUser.jobPosition && (
                              <span className="text-[8px] font-extrabold text-blue-600 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {zoomedPresenceUser.jobPosition}
                              </span>
                            )}
                            {zoomedPresenceUser.positionCode && (
                              <span className="text-[8px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                                Code: {zoomedPresenceUser.positionCode}
                              </span>
                            )}
                          </div>
                        )}

                        {zoomedPresenceUser.email && (
                          <p className="text-[9px] font-semibold text-slate-500 font-mono select-all select-text pb-0.5">
                            {zoomedPresenceUser.email}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 justify-center mt-1">
                          <span className="inline-block px-2 py-0.5 text-[8px] font-black text-slate-500 bg-slate-200/50 rounded-md uppercase tracking-wider">
                            Viewing: {formatSectionName(zoomedPresenceUser.activeSection)}
                          </span>
                          {zoomedPresenceUser.isIdle ? (
                            <span className="inline-block px-2 py-0.5 text-[8px] font-black text-slate-400 bg-slate-200/20 rounded-md uppercase tracking-wider flex items-center gap-1 select-none">
                              <span className="w-1 h-1 rounded-full bg-slate-400" /> Idle / Deactivated
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[8px] font-black text-emerald-600 bg-emerald-50 rounded-md uppercase tracking-wider flex items-center gap-1 select-none">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> Active Online
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Biography Context Box */}
                      <div className="w-full bg-white border border-slate-200/40 p-2.5 rounded-xl">
                        <p className="text-[9px] text-slate-550 font-semibold leading-relaxed text-slate-500">
                          {((zoomedPresenceUser.name || "").toLowerCase().trim() === "daniel b. antoque" || (zoomedPresenceUser.email || "").toLowerCase().trim() === "antoque2822@gmail.com")
                            ? "GCR Land Acquisition Lead Developer & Chief Dashboard System Architect."
                            : ((zoomedPresenceUser.name || "").toLowerCase().trim() === "christian jay pablo" || (zoomedPresenceUser.name || "").toLowerCase().trim() === "christian jay" || (zoomedPresenceUser.email || "").toLowerCase().trim() === "christian@railway.com")
                              ? "GCR Land Acquisition Support Developer & Senior Quality Control Partner."
                              : `Authorized system operator specialized in Land Acquisition document tracking and record validation operating as a ${zoomedPresenceUser.jobPosition || "Case handler"}.`}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
