import React, { useState } from 'react';
import { SavingsAnalytics } from '../types';
import { PeriodBreakdownModal } from './PeriodBreakdownModal';
import { getApiUrl } from '../apiConfig';
import {
  Coins,
  RefreshCw,
  CheckCircle2,
  Calendar,
  ChevronRight,
  BarChart3,
} from 'lucide-react';

interface AnalyticsSummaryProps {
  analytics: SavingsAnalytics | null;
  onRefreshAnalytics: () => void;
  deviceSn?: string;
  deviceName?: string;
}

export const AnalyticsSummary: React.FC<AnalyticsSummaryProps> = ({
  analytics,
  onRefreshAnalytics,
  deviceSn = '',
  deviceName = '',
}) => {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const handleTriggerBackfill = async (days: number) => {
    try {
      setIsBackfilling(true);
      setBackfillMsg(`Fetching past ${days} days from Shine API...`);
      const res = await fetch(getApiUrl(`/api/backfill?days=${days}`));
      const data = await res.json();
      setBackfillMsg(`Successfully synced ${data.records_saved} historical records!`);
      onRefreshAnalytics();
    } catch (err) {
      console.error('Backfill failed:', err);
      setBackfillMsg('Backfill failed. Check connection.');
    } finally {
      setIsBackfilling(false);
      setTimeout(() => setBackfillMsg(null), 5000);
    }
  };

  const solarKWh = analytics?.total_solar_kwh.toFixed(2) || '0.00';
  const loadKWh = analytics?.total_load_kwh.toFixed(2) || '0.00';
  const savingsUGX = analytics?.total_savings_ugx.toLocaleString() || '0';
  const savingsUSD = analytics?.total_savings_usd.toFixed(2) || '0.00';
  const selfSuff = analytics?.solar_self_sufficiency_pct || 100;
  const records = analytics?.total_records_synced || 0;

  const formatDateStr = (str: string) => {
    if (!str) return 'N/A';
    return str.split(' ')[0];
  };

  const titlePrefix = deviceName ? `${deviceName} ` : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
              <span>{titlePrefix}QNAP TimescaleDB Savings Analytics</span>
            </h2>
            <p className="text-xs text-gray-400">
              1-Year Timeseries Energy Accumulation & Cost Savings Engine (Click any card to view breakdown)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBreakdownOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Daily / Weekly / Monthly Breakdown</span>
          </button>

          <button
            onClick={() => handleTriggerBackfill(90)}
            disabled={isBackfilling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 text-xs font-semibold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isBackfilling ? 'animate-spin' : ''}`} />
            <span>{isBackfilling ? 'Backfilling...' : 'Sync Past 90 Days'}</span>
          </button>
        </div>
      </div>

      {backfillMsg && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{backfillMsg}</span>
        </div>
      )}

      {/* Grid of 4 Analytics Cards - Clickable to open breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Financial Savings */}
        <div
          onClick={() => setIsBreakdownOpen(true)}
          className="glass-card p-5 space-y-3 border-l-4 border-l-emerald-500 cursor-pointer hover:border-emerald-400 hover:bg-white/5 transition group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 group-hover:text-emerald-300 transition">Financial Savings</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Umeme @ UGX 890/kWh
            </span>
          </div>
          <div>
            <div className="font-mono text-2xl font-black text-emerald-400 flex items-center justify-between">
              <span>UGX {savingsUGX}</span>
              <ChevronRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              ${savingsUSD} USD Saved
            </div>
          </div>
          <div className="flex justify-between text-[11px] pt-2 border-t border-white/5 text-gray-400">
            <span>Solar Energy Produced</span>
            <span className="font-mono font-bold text-gray-200">{solarKWh} kWh</span>
          </div>
        </div>

        {/* Card 2: Self Sufficiency */}
        <div
          onClick={() => setIsBreakdownOpen(true)}
          className="glass-card p-5 space-y-3 border-l-4 border-l-cyan-500 cursor-pointer hover:border-cyan-400 hover:bg-white/5 transition group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 group-hover:text-cyan-300 transition">Solar Self-Sufficiency</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/20">
              Off-Grid Independence
            </span>
          </div>
          <div>
            <div className="font-mono text-2xl font-black text-cyan-400 flex items-center justify-between">
              <span>{selfSuff}%</span>
              <ChevronRight className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, selfSuff)}%` }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[11px] pt-2 border-t border-white/5 text-gray-400">
            <span>Total House Load Offset</span>
            <span className="font-mono font-bold text-gray-200">{loadKWh} kWh</span>
          </div>
        </div>

        {/* Card 3: Storage Engine (TimescaleDB) */}
        <div
          onClick={() => setIsBreakdownOpen(true)}
          className="glass-card p-5 space-y-3 border-l-4 border-l-purple-500 cursor-pointer hover:border-purple-400 hover:bg-white/5 transition group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 group-hover:text-purple-300 transition">TimescaleDB Data House</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">
              QNAP @ 100.116.185.70
            </span>
          </div>
          <div>
            <div className="font-mono text-2xl font-black text-purple-300 flex items-center justify-between">
              <span>{records.toLocaleString()}</span>
              <ChevronRight className="w-4 h-4 text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-xs text-gray-400 font-mono mt-0.5">
              Timeseries Records Logged
            </div>
          </div>
          <div className="flex justify-between text-[11px] pt-2 border-t border-white/5 text-gray-400">
            <span>Database Status</span>
            <span className="font-mono font-semibold text-emerald-400">Active & Syncing</span>
          </div>
        </div>

        {/* Card 4: Date Range Coverage */}
        <div
          onClick={() => setIsBreakdownOpen(true)}
          className="glass-card p-5 space-y-3 border-l-4 border-l-amber-500 cursor-pointer hover:border-amber-400 hover:bg-white/5 transition group"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 group-hover:text-amber-300 transition">Historical Coverage</span>
            <Calendar className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="font-mono text-xs font-bold text-gray-200 truncate flex items-center justify-between">
              <span>{formatDateStr(analytics?.earliest_record || '')}</span>
              <ChevronRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              To {formatDateStr(analytics?.latest_record || '')}
            </div>
          </div>
          <div className="flex justify-between text-[11px] pt-2 border-t border-white/5 text-gray-400">
            <span>Backfill Window</span>
            <span className="font-mono font-semibold text-amber-400">Auto 30–730 Days</span>
          </div>
        </div>

      </div>

      {/* Breakdown Modal */}
      <PeriodBreakdownModal
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        deviceSn={deviceSn}
        deviceName={deviceName || 'Overall Plant'}
      />
    </div>
  );
};
