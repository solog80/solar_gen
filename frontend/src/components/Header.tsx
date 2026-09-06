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
    <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <Sun className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {plantName}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400">
              {totalDevices} Devices
            </span>
          </h1>
          <p className="text-xs text-gray-400">Multi-User Energy Analytics Dashboard</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Active Logged In Dashboard User */}
        {currentUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-gray-200 font-mono">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-bold">{currentUser.username}</span>
            <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
              {currentUser.role}
            </span>
          </div>
        )}

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          isLive 
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-amber-400'}`} />
          {isLive ? 'Cloud Connected' : 'Demo Mode'}
        </div>

        <button
          onClick={onRefresh}
          className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition text-gray-200"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* User Management Button (for Admins) */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={onOpenUsersModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-semibold text-xs transition"
          >
            <Users className="w-4 h-4" />
            <span>Manage Users</span>
          </button>
        )}

        <button
          onClick={onOpenConfig}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs transition"
        >
          <KeyRound className="w-4 h-4" />
          <span>Cloud API Config</span>
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
    </header>
  );
};
