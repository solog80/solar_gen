import React, { useState, useEffect } from 'react';
import { PeriodBreakdownResponse, PeriodItem } from '../types';
import { getApiUrl } from '../apiConfig';
import {
  X,
  Calendar as CalendarIcon,
  BarChart3,
  TrendingUp,
  Coins,
  Zap,
  Filter,
  RotateCcw,
} from 'lucide-react';

interface PeriodBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceSn?: string;
  deviceName?: string;
}

export const PeriodBreakdownModal: React.FC<PeriodBreakdownModalProps> = ({
  isOpen,
  onClose,
  deviceSn = '',
  deviceName = 'Overall Plant',
}) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [data, setData] = useState<PeriodBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBreakdown = async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      const querySn = deviceSn ? `&sn=${deviceSn}` : '';
      const queryStart = startDate ? `&start_date=${startDate}` : '';
      const queryEnd = endDate ? `&end_date=${endDate}` : '';
      const res = await fetch(getApiUrl(`/api/breakdown?period=${period}${querySn}${queryStart}${queryEnd}`));
      const result: PeriodBreakdownResponse = await res.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch period breakdown:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBreakdown();
  }, [isOpen, period, deviceSn]);

  if (!isOpen) return null;

  const handleApplyCustomRange = () => {
    fetchBreakdown();
  };

  const handleResetRange = () => {
    setStartDate('');
    setEndDate('');
    fetchBreakdown();
  };

  const setPresetRange = (preset: '30days' | 'thisMonth' | 'lastMonth' | 'ytd' | '1year' | 'allTime') => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === '30days') {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'thisMonth') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'lastMonth') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      setStartDate(formatDate(start));
      setEndDate(formatDate(end));
    } else if (preset === 'ytd') {
      const start = new Date(today.getFullYear(), 0, 1);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === '1year') {
      const start = new Date();
      start.setDate(today.getDate() - 365);
      setStartDate(formatDate(start));
      setEndDate(formatDate(today));
    } else if (preset === 'allTime') {
      setStartDate('');
      setEndDate('');
    }
    setTimeout(() => fetchBreakdown(), 50);
  };

  const items: PeriodItem[] = data?.items || [];
  const totalSolar = items.reduce((acc, curr) => acc + curr.solar_kwh, 0).toFixed(2);
  const totalLoad = items.reduce((acc, curr) => acc + curr.load_kwh, 0).toFixed(2);
  const totalUGX = items.reduce((acc, curr) => acc + curr.savings_ugx, 0).toLocaleString();
  const totalUSD = items.reduce((acc, curr) => acc + curr.savings_usd, 0).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-700/60 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-100">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                Historical Power & Savings Analytics
                {deviceName && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {deviceName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                Custom Date-Range Time-Series Energy & Cost Savings Engine (Umeme Tariff: UGX 890 / kWh)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Range Selector & Quick Presets Toolbar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/40 space-y-3">
          
          {/* Row 1: Period Tabs + Presets */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={() => setPeriod('daily')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === 'daily'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Daily</span>
              </button>

              <button
                onClick={() => setPeriod('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === 'weekly'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Weekly</span>
              </button>

              <button
                onClick={() => setPeriod('monthly')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === 'monthly'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Monthly</span>
              </button>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1.5 flex-wrap text-xs">
              <span className="text-gray-400 text-[11px] font-semibold mr-1">Date Presets:</span>
              <button
                onClick={() => setPresetRange('30days')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 text-[11px] transition"
              >
                Past 30 Days
              </button>
              <button
                onClick={() => setPresetRange('thisMonth')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 text-[11px] transition"
              >
                This Month
              </button>
              <button
                onClick={() => setPresetRange('lastMonth')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-gray-300 text-[11px] transition"
              >
                Last Month
              </button>
              <button
                onClick={() => setPresetRange('1year')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold transition"
              >
                Full 1 Year (365d)
              </button>
              <button
                onClick={() => setPresetRange('allTime')}
                className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-semibold transition"
              >
                All-Time (2024–2026)
              </button>
            </div>
          </div>

          {/* Row 2: Custom Date Range Inputs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <button
                onClick={handleApplyCustomRange}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter Range</span>
              </button>

              {(startDate || endDate) && (
                <button
                  onClick={handleResetRange}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white text-xs transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="text-right">
                <div className="text-gray-400">Total Savings</div>
                <div className="text-emerald-400 font-bold text-sm">UGX {totalUGX} (${totalUSD})</div>
              </div>
              <div className="text-right">
                <div className="text-gray-400 font-mono">Solar Produced</div>
                <div className="text-cyan-400 font-bold text-sm">{totalSolar} kWh</div>
              </div>
            </div>
          </div>

        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-400">Querying TimescaleDB time-series date bucket analytics...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-gray-400">
              <p className="text-sm font-semibold">No telemetry records found for the selected date range</p>
              <p className="text-xs">Try selecting a broader date range or click "All-Time" above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* Summary KPI Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-card p-3 border-l-2 border-l-emerald-500">
                  <div className="text-[11px] text-gray-400 font-semibold">Range Savings (UGX)</div>
                  <div className="text-lg font-mono font-black text-emerald-400 mt-1">UGX {totalUGX}</div>
                </div>
                <div className="glass-card p-3 border-l-2 border-l-cyan-500">
                  <div className="text-[11px] text-gray-400 font-semibold">Range Savings (USD)</div>
                  <div className="text-lg font-mono font-black text-cyan-400 mt-1">${totalUSD} USD</div>
                </div>
                <div className="glass-card p-3 border-l-2 border-l-purple-500">
                  <div className="text-[11px] text-gray-400 font-semibold">Solar Generation</div>
                  <div className="text-lg font-mono font-black text-purple-300 mt-1">{totalSolar} kWh</div>
                </div>
                <div className="glass-card p-3 border-l-2 border-l-amber-500">
                  <div className="text-[11px] text-gray-400 font-semibold">House Load Offset</div>
                  <div className="text-lg font-mono font-black text-amber-300 mt-1">{totalLoad} kWh</div>
                </div>
              </div>

              {/* Interactive Breakdown Table */}
              <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-gray-300 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="px-4 py-3">Time Period Bucket</th>
                      <th className="px-4 py-3 text-right">Solar Energy (kWh)</th>
                      <th className="px-4 py-3 text-right">House Load (kWh)</th>
                      <th className="px-4 py-3 text-right">Grid Input (kWh)</th>
                      <th className="px-4 py-3 text-right text-emerald-400">Savings (UGX)</th>
                      <th className="px-4 py-3 text-right text-cyan-400">Savings (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-gray-200">
                    {items.map((item, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-bold text-gray-100 flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{item.period_label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-purple-300 font-semibold">
                          {item.solar_kwh.toFixed(2)} kWh
                        </td>
                        <td className="px-4 py-3 text-right text-amber-300">
                          {item.load_kwh.toFixed(2)} kWh
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400">
                          {item.grid_kwh.toFixed(2)} kWh
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-400">
                          UGX {item.savings_ugx.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-cyan-400">
                          ${item.savings_usd.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-gray-400">
          <div>
            Data Source: <strong className="text-gray-200">QNAP NAS TimescaleDB Hypertable</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold transition"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
};
