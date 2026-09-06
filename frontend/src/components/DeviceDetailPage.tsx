import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sun,
  Battery,
  Zap,
  ShieldCheck,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { DeviceItem, HistoryPoint, SavingsAnalytics } from '../types';
import { AnalyticsSummary } from './AnalyticsSummary';
import { getApiUrl } from '../apiConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface DeviceDetailPageProps {
  device: DeviceItem;
  onBack: () => void;
}

export const DeviceDetailPage: React.FC<DeviceDetailPageProps> = ({ device, onBack }) => {
  const [deviceHistory, setDeviceHistory] = useState<HistoryPoint[]>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<SavingsAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeviceAnalytics = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/analytics?sn=${encodeURIComponent(device.sn)}`));
      const data: SavingsAnalytics = await res.json();
      setDeviceAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch device analytics:', err);
    }
  };

  const fetchDeviceHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(getApiUrl(`/api/device/history?sn=${encodeURIComponent(device.sn)}`));
      const data: HistoryPoint[] = await res.json();
      setDeviceHistory(data);
    } catch (err) {
      console.error('Failed to fetch device history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceHistory();
    fetchDeviceAnalytics();
  }, [device.sn]);

  const isBattery = device.type === 'BP';
  const pvPower = Math.round(device.pv_power_w);
  const pvVoltage = device.pv_voltage_v || 240;
  const pvCurrent = device.pv_current_a || (pvVoltage > 0 ? Math.round((pvPower / pvVoltage) * 10) / 10 : 0);

  const loadPower = Math.round(device.load_power_w);
  const loadAmps = device.load_current_a || Math.round((loadPower / 230.0) * 10) / 10;

  const batterySoc = Math.round(device.battery_soc);
  const batteryPower = Math.round(device.battery_power_w);
  const batteryVoltage = 53.5;
  const batteryAmps = device.battery_current_a || Math.round((Math.abs(batteryPower) / batteryVoltage) * 10) / 10;
  const batteryStatus = batteryPower < 0 ? 'Charging' : (batteryPower > 0 ? 'Discharging' : 'Idle');

  const renderLedDots = (soc: number) => {
    let activeCount = 0;
    if (soc >= 90) activeCount = 5;
    else if (soc >= 70) activeCount = 4;
    else if (soc >= 55) activeCount = 3;
    else if (soc >= 35) activeCount = 2;
    else if (soc >= 15) activeCount = 1;

    return (
      <div className="flex items-center gap-1.5 mt-2" title={`${activeCount} LED Dots Active (${soc}%)`}>
        <span className="text-[10px] text-gray-400 font-semibold mr-0.5">LEDs:</span>
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className={`w-2.5 h-2.5 rounded-full border transition-all ${
              dot <= activeCount
                ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_6px_#34d399]'
                : 'bg-slate-800 border-slate-700'
            }`}
          />
        ))}
        <span className="text-[10px] text-emerald-400 font-bold ml-1 font-mono">{activeCount}/5 Dots</span>
      </div>
    );
  };

  // Solar & Load Chart Data
  const labels = deviceHistory.map((h) => h.time);
  const powerChartData = {
    labels,
    datasets: [
      {
        label: `${device.alias} Solar PV (W)`,
        data: deviceHistory.map((h) => h.pv_power),
        borderColor: '#f59e0b',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(245, 158, 11, 0.4)');
          gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3,
      },
      {
        label: `${device.alias} Load (W)`,
        data: deviceHistory.map((h) => h.load_power),
        borderColor: '#06b6d4',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)');
          gradient.addColorStop(1, 'rgba(6, 182, 212, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
      },
      {
        label: `${device.alias} Grid Power (W)`,
        data: deviceHistory.map((h) => h.grid_power_w || 0),
        borderColor: '#a855f7',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
          gradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
      },
    ],
  };

  // Battery Chart Data
  const batteryChartData = {
    labels,
    datasets: [
      {
        label: 'Battery SOC (%)',
        data: deviceHistory.map((h) => h.battery_soc),
        borderColor: '#10b981',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3,
        yAxisID: 'ySOC',
      },
      {
        label: 'Charge / Discharge (W)',
        data: deviceHistory.map((h) => h.battery_power_w),
        borderColor: '#8b5cf6',
        borderDash: [4, 4],
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 2,
        yAxisID: 'yPower',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: '#1f2937',
        titleColor: '#f3f4f6',
        bodyColor: '#9ca3af',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9ca3af', font: { family: 'Space Grotesk' } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9ca3af', font: { family: 'Space Grotesk' } },
      },
    },
  };

  const batteryChartOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#9ca3af', font: { family: 'Space Grotesk' } },
      },
      ySOC: {
        type: 'linear' as const,
        position: 'left' as const,
        min: 0,
        max: 100,
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#34d399', font: { family: 'Space Grotesk' } },
      },
      yPower: {
        type: 'linear' as const,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: { color: '#a78bfa', font: { family: 'Space Grotesk' } },
      },
    },
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-300">
      
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-200 text-xs font-semibold transition mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plant Overview
          </button>
          
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{device.plant_name || 'Solo Solar Energy'}</span>
            <span>/</span>
            <span>Locations</span>
            <span>/</span>
            <span className="text-gray-200 font-semibold">{device.alias}</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3 mt-1">
            {device.alias}
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              isBattery 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}>
              {isBattery ? 'Lithium Battery Pack' : `Inverter ${device.model}`}
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>{device.country || 'Uganda'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>{device.timezone || 'UTC+03:00'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Location-Specific TimescaleDB Analytics Summary */}
      <AnalyticsSummary
        analytics={deviceAnalytics}
        onRefreshAnalytics={fetchDeviceAnalytics}
        deviceSn={device.sn}
        deviceName={device.alias}
      />

      {/* KPI Cards for This Dedicated Location Home */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Solar Output */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">Solar PV Power</span>
              <span className="text-xs text-gray-400">Array Generation</span>
            </div>
          </div>
          <div className="font-mono text-3xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            {pvPower.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">W</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
            <div>
              <span className="text-gray-400 block text-[10px]">Voltage</span>
              <span className="font-mono font-semibold">{pvVoltage} V</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">Current (Amps)</span>
              <span className="font-mono font-bold text-amber-300">{pvCurrent} A</span>
            </div>
          </div>
        </div>

        {/* AC Load */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">House Consumption</span>
              <span className="text-xs text-gray-400">Active AC Load</span>
            </div>
          </div>
          <div className="font-mono text-3xl font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            {loadPower.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">W</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
            <div>
              <span className="text-gray-400 block text-[10px]">Output AC Volt</span>
              <span className="font-mono font-semibold">230 V</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">Current (Amps)</span>
              <span className="font-mono font-bold text-cyan-300">{loadAmps} A</span>
            </div>
          </div>
        </div>

        {/* Battery Storage */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Battery className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">Battery SOC</span>
              <span className="text-xs text-emerald-400 font-semibold">{batteryStatus}</span>
            </div>
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <div className="font-mono text-3xl font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                {batterySoc} <span className="text-sm font-sans font-normal text-gray-400">%</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-300">
                {batteryPower !== 0 ? `${Math.abs(batteryPower)} W` : 'Active'}
              </span>
            </div>

            {/* LED Dots Indicator */}
            {renderLedDots(batterySoc)}
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs pt-2 border-t border-white/5">
            <div>
              <span className="text-gray-400 block text-[9px]">Power</span>
              <span className="font-mono font-semibold">{batteryPower} W</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Voltage</span>
              <span className="font-mono font-semibold">53.5 V</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Current</span>
              <span className="font-mono font-bold text-emerald-300">{batteryAmps} A</span>
            </div>
          </div>
        </div>

        {/* Utility Grid AC Input */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">AC Grid Input</span>
              <span className="text-xs text-emerald-400 font-semibold">Grid Connected</span>
            </div>
          </div>
          <div className="font-mono text-2xl font-black text-gray-100">
            {device.grid_power_w || 0} <span className="text-sm font-normal text-gray-400">W</span>
          </div>
          <div className="flex justify-between text-xs pt-2 border-t border-white/5">
            <span className="text-gray-400">Grid Voltage / Freq</span>
            <span className="font-mono font-semibold text-purple-400">{device.grid_voltage_v || 230}V @ 50Hz</span>
          </div>
        </div>

      </div>

      {/* Time-Series Charts Spanning Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Solar Generation vs House Load Curve */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-100">Solar PV, AC Load & Grid Power Curve</h3>
              <p className="text-xs text-gray-400">24-Hour Historical Solar, Grid & Consumption for {device.alias}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-amber-500" /> PV (W)
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-cyan-500" /> Load (W)
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-purple-500" /> Grid (W)
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <Line data={powerChartData} options={chartOptions} />
          </div>
        </div>

        {/* Chart 2: Battery SOC & Charge/Discharge Power Curve */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-100">Battery SOC & Power Curve</h3>
              <p className="text-xs text-gray-400">24-Hour Storage Charge/Discharge Cycle</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" /> SOC (%)
              </span>
              <span className="flex items-center gap-1.5 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-purple-500" /> Power (W)
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <Line data={batteryChartData} options={batteryChartOptions} />
          </div>
        </div>

      </div>

      {/* Full Hardware Specs & Inspector */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <Layers className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-bold text-gray-100">Hardware & Communication Registry</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Device Name / Location</span>
              <span className="font-mono font-bold text-gray-200">{device.alias}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Hardware Model</span>
              <span className="font-mono font-bold text-gray-200">{device.model} ({device.type_name})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Device Inverter SN</span>
              <span className="font-mono text-gray-200">{device.sn}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Wi-Fi Collector Logger SN</span>
              <span className="font-mono text-blue-400 font-semibold">{device.collector_sn || 'N/A'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Rated System Power</span>
              <span className="font-mono font-bold text-gray-200">{device.rated_power_kw || '10'} kW</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Plant Name & ID</span>
              <span className="font-mono text-gray-200">{device.plant_name} ({device.plant_id})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Internal Device ID</span>
              <span className="font-mono text-gray-400">{device.id}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Operating Status</span>
              <span className="font-mono font-bold text-emerald-400">Online / Healthy</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
