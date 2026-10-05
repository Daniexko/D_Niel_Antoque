import React, { useState } from "react";
import { GoogleUser } from "../types";
import { LogIn, User, Hash, Briefcase, Mail } from "lucide-react";
import { motion } from "motion/react";

interface LoginProps {
  onLoginSuccess: (user: GoogleUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [customName, setCustomName] = useState("");
  const [positionCode, setPositionCode] = useState("");
  const [jobPosition, setJobPosition] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !positionCode.trim() || !customEmail.trim()) return;

    // Use high-quality initials avatar matching the provided name
    const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
      customName
    )}&backgroundColor=0f295a,3b82f6,10b981&textColor=ffffff`;

    onLoginSuccess({
      name: customName.trim(),
      email: customEmail.trim(),
      picture: avatarUrl,
      positionCode: positionCode.trim(),
      jobPosition: jobPosition.trim() || "Case handler",
    });
  };

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden antialiased font-sans select-none px-4 py-8">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Decorative Brand Dots and Line (matching user logo) */}
      <div className="flex items-center gap-1.5 mb-6 opacity-90 scale-100 sm:scale-110">
        <div className="relative flex items-center justify-center">
          <svg className="w-16 h-8" viewBox="0 0 100 40">
            <line x1="10" y1="20" x2="25" y2="20" stroke="#dc2626" strokeWidth="3" strokeDasharray="3 3" />
            <line x1="25" y1="20" x2="85" y2="20" stroke="#dc2626" strokeWidth="3" />
            <circle cx="10" cy="20" r="4.5" fill="#dc2626" />
            <circle cx="25" cy="20" r="4.5" fill="#dc2626" />
            <circle cx="45" cy="20" r="4.5" fill="#dc2626" />
            <circle cx="65" cy="20" r="4.5" fill="#dc2626" />
            <circle cx="85" cy="20" r="4.5" fill="#dc2626" />
          </svg>
        </div>
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-white tracking-widest leading-none">LA TEAM</h2>
          <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] mt-0.5">Land Acquisition</span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] shadow-2xl p-6 sm:p-10 relative z-10"
      >
        <div className="text-center mb-6">
          <span className="text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-3 py-1 rounded-full font-black uppercase tracking-widest inline-block mb-3">
            Secure Entry Portal
          </span>
          <h1 className="text-2xl font-black text-white tracking-tight leading-tight">GCR LA Data Manager</h1>
          <p className="text-xs text-slate-300 mt-1.5 font-medium">Sign in with registered operator credentials to authorize session</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-2xl mb-1 text-center">
            <p className="text-[10px] font-semibold leading-relaxed text-slate-300">
              Only authorized personnel can initiate operations. Fields marked with <span className="text-red-400 font-black">*</span> are strictly required.
            </p>
          </div>

          {/* Full Name / Username */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-350 uppercase tracking-widest px-1 flex items-center gap-1">
              <User className="w-3 h-3 text-blue-400" /> Full Name / Username <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              required
              className="w-full bg-slate-950/90 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-white font-bold placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:bg-slate-950 transition-colors"
              placeholder="e.g. Daniel B. Antoque"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Position Code */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-350 uppercase tracking-widest px-1 flex items-center gap-1">
                <Hash className="w-3 h-3 text-blue-400" /> Position Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={positionCode}
                onChange={(e) => setPositionCode(e.target.value)}
                required
                className="w-full bg-slate-950/90 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-white font-bold placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:bg-slate-950 transition-colors"
                placeholder="ex.. C123, B123"
              />
            </div>

            {/* Job Position */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-350 uppercase tracking-widest px-1 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-blue-400" /> Job Position
              </label>
              <input
                type="text"
                value={jobPosition}
                onChange={(e) => setJobPosition(e.target.value)}
                className="w-full bg-slate-950/90 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-white font-bold placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:bg-slate-950 transition-colors"
                placeholder="ex.. Case handler"
              />
            </div>
          </div>

          {/* Registered Gmail */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-350 uppercase tracking-widest px-1 flex items-center gap-1">
              <Mail className="w-3 h-3 text-blue-400" /> Registered Gmail <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              required
              className="w-full bg-slate-950/90 border border-slate-800/80 rounded-xl px-4 py-3 text-xs text-white font-bold placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:bg-slate-950 transition-colors"
              placeholder="e.g. coworker@gmail.com"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-linear-to-r from-blue-600/90 to-indigo-600/90 hover:from-blue-600 hover:to-indigo-600 text-white font-black text-xs py-3 px-4 rounded-xl shadow-lg shadow-blue-500/10 hover:shadow-blue-500/25 active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer mt-2 uppercase tracking-widest"
          >
            <LogIn className="w-4 h-4" />
            <span>Access GCR LA Operations</span>
          </button>
        </form>
      </motion.div>

      {/* Under footer */}
      <div className="text-[10px] text-slate-400 mt-6 font-semibold text-center space-y-1">
        <p>© 2026 GCR Land Acquisition Operations - Active Data Segment</p>
        <p>Enterprise Administration Cloud Network Layer</p>
      </div>
    </main>
  );
};
