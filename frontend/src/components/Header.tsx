import React from 'react';
import { Sun, RefreshCw, KeyRound, User, Users, LogOut } from 'lucide-react';
import { TelemetryResponse, DashboardUser } from '../types';

interface HeaderProps {
  telemetry: TelemetryResponse | null;
  currentUser: DashboardUser | null;
  onRefresh: () => void;
  onOpenConfig: () => void;
  onOpenUsersModal: () => void;
  onLogout: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  currentUser,
  onRefresh,
  onOpenConfig,
  onOpenUsersModal,
  onLogout,
  isRefreshing,
}) => {
  const plantName = telemetry?.plant_info?.name || 'Solo Solar Energy';
  const totalDevices = telemetry?.plant_info?.total_devices || 3;
  const isLive = telemetry?.is_live || false;

  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/10">
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Sun className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-base sm:text-xl font-bold flex items-center gap-2 flex-wrap">
              <span>{plantName}</span>
              <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
                {totalDevices} Devices
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-400">Multi-User Energy Analytics Dashboard</p>
          </div>
        </div>

        {/* Live indicator on small screens right aligned */}
        <div className={`sm:hidden flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
          isLive 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`} />
          {isLive ? 'Live' : 'Demo'}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-white/5 sm:border-transparent">
        {/* Active Logged In Dashboard User */}
        {currentUser && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-[11px] sm:text-xs text-gray-200 font-mono">
            <User className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-bold truncate max-w-[80px] sm:max-w-none">{currentUser.username}</span>
            <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-1 py-0.5 rounded">
              {currentUser.role}
            </span>
          </div>
        )}

        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          isLive 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`} />
          {isLive ? 'Cloud Connected' : 'Demo Mode'}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 sm:p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-gray-200"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* User Management Button (for Admins) */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={onOpenUsersModal}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-semibold text-xs transition"
              title="Manage Dashboard Users"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Users</span>
            </button>
          )}

          <button
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs transition"
            title="Shine API Configuration"
          >
            <KeyRound className="w-4 h-4" />
            <span className="hidden sm:inline">Cloud Config</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition"
            title="Logout of Dashboard"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
