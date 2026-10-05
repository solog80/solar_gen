import React, { useState } from 'react';
import {
  Sun,
  Battery,
  Zap,
  Activity,
  MapPin,
  CloudSun,
  ChevronDown,
  Clock,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { TelemetryResponse, SavingsAnalytics, DeviceItem } from '../types';

interface AnimatedEnergyFlowProps {
  telemetry: TelemetryResponse | null;
  analytics: SavingsAnalytics | null;
  onSelectDevice?: (device: DeviceItem) => void;
  selectedPlant?: string;
  onSelectPlant?: (plant: string) => void;
}

export const AnimatedEnergyFlow: React.FC<AnimatedEnergyFlowProps> = ({
  telemetry,
  analytics,
  onSelectDevice,
  selectedPlant = 'Salt Media',
  onSelectPlant,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'alarm' | 'device'>('overview');
  const [selectedDeviceFilter, setSelectedDeviceFilter] = useState<string>('all');

  const pvPower = Math.round(telemetry?.solar?.power_w || 0);
  const loadPower = Math.round(telemetry?.load?.power_w || 0);
  const batteryPower = Math.round(telemetry?.battery?.power_w || 0);
  const gridPower = Math.round(telemetry?.grid?.power_w || 0);
  const gridVoltage = telemetry?.grid?.voltage_v ?? 0;
  const gridStatus = telemetry?.grid?.status || (gridVoltage > 90 ? 'Connected' : 'Disconnected');
  const isGridConnected = gridStatus === 'Connected' || gridVoltage > 90;
  const batterySoc = Math.round(telemetry?.battery?.soc_percent || 0);

  const isCharging = batteryPower < 0;
  const isDischarging = batteryPower > 0;
  const absBatPower = Math.abs(batteryPower);

  const solarKWh = analytics?.total_solar_kwh.toFixed(2) || '54.77';
  const loadKWh = analytics?.total_load_kwh.toFixed(2) || '17.69';
  const gridKWh = analytics?.total_grid_kwh.toFixed(2) || '0.00';
  const savingsUGX = analytics?.total_savings_ugx.toLocaleString() || '48,748';

  const updateTime = telemetry?.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19);
  const plantName = telemetry?.plant_info?.name || 'Salt Media';

  return (
    <div className="max-w-4xl mx-auto space-y-4 font-sans text-gray-800 animate-fade-in">
      
      {/* Mobile App Style Top Bar */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/10 space-y-4">
        
        {/* Top Header Row */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          
          {/* Location Picker */}
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-lg sm:text-xl tracking-tight text-white group-hover:text-emerald-300 transition">
              {plantName}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-white transition" />
          </div>

          {/* Weather & Sun Time Badge */}
          <div className="flex items-center gap-3 text-xs bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <div className="flex items-center gap-1 text-amber-300 font-semibold">
              <CloudSun className="w-4 h-4" />
              <span>20°C</span>
            </div>
            <span className="text-gray-400">|</span>
            <div className="flex items-center gap-1 text-gray-300 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>06:41 - 18:47</span>
            </div>
          </div>
        </div>

        {/* Location Sub-title */}
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Mubende, Uganda, Kampala</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Shine Cloud Active</span>
          </div>
        </div>

        {/* Sub-Navigation Tabs (Overview | Data | Alarm | Device) */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-2xl border border-white/5 text-xs">
            {(['overview', 'data', 'alarm', 'device'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-xl capitalize font-semibold transition ${
                  activeTab === tab
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Device Filter Dropdown */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <span className="text-gray-400">Filter:</span>
            <span className="font-bold text-white">All Devices</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </div>
        </div>

        {/* Timestamp */}
        <div className="text-[11px] font-mono text-gray-400 text-center sm:text-left pt-1">
          Update Time: <span className="text-gray-200">{updateTime} (UTC+03:00)</span>
        </div>

        {/* Custom CSS Keyframes for Moving Energy Particles */}
        <style>{`
          @keyframes energyParticleFlow {
            0% {
              stroke-dashoffset: 40;
            }
            100% {
              stroke-dashoffset: 0;
            }
          }
          @keyframes energyParticleFlowReverse {
            0% {
              stroke-dashoffset: 0;
            }
            100% {
              stroke-dashoffset: 40;
            }
          }
          .animate-particle-pv {
            stroke-dasharray: 8 12;
            animation: energyParticleFlow 1.2s linear infinite;
          }
          .animate-particle-bat-charge {
            stroke-dasharray: 8 12;
            animation: energyParticleFlow 1.2s linear infinite;
          }
          .animate-particle-bat-discharge {
            stroke-dasharray: 8 12;
            animation: energyParticleFlowReverse 1.2s linear infinite;
          }
          .animate-particle-load {
            stroke-dasharray: 8 12;
            animation: energyParticleFlow 1.2s linear infinite;
          }
          .animate-particle-grid {
            stroke-dasharray: 8 12;
            animation: energyParticleFlow 1.5s linear infinite;
          }
        `}</style>

        {/* MAIN ANIMATED ENERGY FLOW GRAPHIC CARD */}
        <div className="relative bg-gradient-to-b from-[#131b2e] to-[#0f172a] rounded-3xl p-4 sm:p-8 border border-slate-700/80 shadow-2xl overflow-hidden min-h-[440px] flex flex-col justify-between">
          
          {/* Background Vector Graphic (Modern House, Solar Panels, Inverter, Battery & Grid) */}
          <div className="absolute inset-0 flex items-center justify-center opacity-90 pointer-events-none">
            <svg
              viewBox="0 0 800 500"
              className="w-full h-full object-contain"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Modern House Base */}
              <path
                d="M 250 200 L 450 140 L 620 200 L 620 380 L 250 380 Z"
                fill="url(#houseGrad)"
                stroke="#334155"
                strokeWidth="2"
              />
              
              {/* Roof Solar Array */}
              <path
                d="M 230 200 L 450 135 L 500 170 L 280 235 Z"
                fill="url(#solarRoofGrad)"
                stroke="#f59e0b"
                strokeWidth="3"
              />
              {/* Solar Panel Grid Lines */}
              <line x1="300" y1="180" x2="350" y2="215" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" />
              <line x1="360" y1="160" x2="410" y2="195" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" />
              <line x1="420" y1="145" x2="470" y2="180" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="1.5" />

              {/* Hybrid Inverter Wall Mount Box */}
              <rect x="420" y="270" width="45" height="55" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
              <circle cx="442" cy="285" r="5" fill="#10b981" className="animate-pulse" />
              <rect x="430" y="300" width="25" height="12" rx="3" fill="#090d16" />

              {/* Lithium Battery Pack Unit (Left of House) */}
              <rect x="180" y="310" width="55" height="70" rx="10" fill="#0f172a" stroke="#10b981" strokeWidth="2.5" />
              <line x1="190" y1="325" x2="225" y2="325" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
              <line x1="190" y1="335" x2="225" y2="335" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
              <line x1="190" y1="345" x2="225" y2="345" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
              <circle cx="207" cy="362" r="4" fill="#10b981" className="animate-pulse" />

              {/* Utility Grid Tower (Right Side) */}
              <g>
                <path
                  d="M 710 160 L 730 360 M 690 200 L 750 200 M 695 250 L 745 250 M 700 300 L 740 300 M 690 200 L 730 360 M 750 200 L 710 360"
                  stroke="#64748b"
                  strokeWidth="2"
                />
                {!isGridConnected && (
                  <g transform="translate(720, 200)">
                    <circle cx="0" cy="0" r="14" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                    <path d="M -5 -5 L 5 5 M 5 -5 L -5 5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                  </g>
                )}
              </g>

              {/* Dynamic Connecting Lines & Flow Animation */}
              
              {/* Line 1: Solar Roof Panels -> Hybrid Inverter */}
              <path id="pathPV" d="M 330 205 L 442 205 L 442 270" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="4" />
              {pvPower > 0 && (
                <path
                  d="M 330 205 L 442 205 L 442 270"
                  stroke="#f59e0b"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-particle-pv"
                />
              )}

              {/* Line 2: Inverter -> Battery Storage */}
              <path id="pathBat" d="M 420 295 L 235 295 L 235 310" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="4" />
              {isCharging && (
                <path
                  d="M 420 295 L 235 295 L 235 310"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-particle-bat-charge"
                />
              )}
              {isDischarging && (
                <path
                  d="M 420 295 L 235 295 L 235 310"
                  stroke="#8b5cf6"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-particle-bat-discharge"
                />
              )}

              {/* Line 3: Inverter -> House Interior Load */}
              <path id="pathLoad" d="M 465 295 L 550 295 L 550 330" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="4" />
              {loadPower > 0 && (
                <path
                  d="M 465 295 L 550 295 L 550 330"
                  stroke="#06b6d4"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-particle-load"
                />
              )}

              {/* Line 4: Grid Tower -> Inverter */}
              <path id="pathGrid" d="M 710 230 L 442 230 L 442 270" stroke="rgba(168, 85, 247, 0.2)" strokeWidth="3" strokeDasharray="4 4" />
              {gridPower > 0 && (
                <path
                  d="M 710 230 L 442 230 L 442 270"
                  stroke="#a855f7"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-particle-grid"
                />
              )}

              {/* Gradients */}
              <defs>
                <linearGradient id="houseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
                </linearGradient>
                <linearGradient id="solarRoofGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="100%" stopColor="#0369a1" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* 4 Interactive Telemetry Node Cards Positioned Around the Diagram */}
          
          {/* Top Left: Solar PV Node */}
          <div className="relative z-10 self-start glass-card px-4 py-3 border border-amber-500/40 bg-slate-900/90 shadow-xl rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <Sun className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Solar PV</span>
              <div className="font-mono text-xl font-bold text-amber-400 flex items-baseline gap-1">
                <span>{pvPower.toLocaleString()}</span>
                <span className="text-xs font-sans font-normal text-amber-300">W</span>
              </div>
            </div>
          </div>

          {/* Top Right: Utility Grid Node */}
          <div className={`relative z-10 self-end glass-card px-4 py-3 border ${isGridConnected ? 'border-purple-500/40' : 'border-red-500/40'} bg-slate-900/90 shadow-xl rounded-2xl flex items-center gap-3`}>
            <div className="relative">
              <div className={`w-10 h-10 rounded-xl ${isGridConnected ? 'bg-purple-500/20 text-purple-400' : 'bg-red-500/20 text-red-400'} flex items-center justify-center font-bold`}>
                <Activity className="w-6 h-6" />
              </div>
              {!isGridConnected && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md border border-slate-900">
                  ✕
                </div>
              )}
            </div>
            <div>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${isGridConnected ? 'text-gray-400' : 'text-red-400'}`}>
                {isGridConnected ? 'Grid AC' : 'Grid Outage'}
              </span>
              <div className={`font-mono text-xl font-bold ${isGridConnected ? 'text-purple-400' : 'text-red-400'} flex items-baseline gap-1`}>
                <span>{gridPower.toLocaleString()}</span>
                <span className="text-xs font-sans font-normal text-purple-300">W</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Battery Charging & House Load Nodes */}
          <div className="relative z-10 flex items-center justify-between w-full pt-20 sm:pt-28">
            
            {/* Bottom Left: Battery Charging / Discharging Node */}
            <div className="glass-card px-4 py-3 border border-emerald-500/40 bg-slate-900/90 shadow-xl rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Battery className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                  {isCharging ? 'Battery Charging' : isDischarging ? 'Battery Discharging' : 'Battery Storage'}
                </span>
                <div className="font-mono text-xl font-bold text-emerald-400 flex items-baseline gap-1">
                  <span>{absBatPower.toLocaleString()}</span>
                  <span className="text-xs font-sans font-normal text-emerald-300">W</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-300/90 font-bold">
                  {batterySoc}% SOC
                </div>
              </div>
            </div>

            {/* Bottom Right: House AC Load Node */}
            <div className="glass-card px-4 py-3 border border-cyan-500/40 bg-slate-900/90 shadow-xl rounded-2xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">House Load</span>
                <div className="font-mono text-xl font-bold text-cyan-400 flex items-baseline gap-1">
                  <span>{loadPower.toLocaleString()}</span>
                  <span className="text-xs font-sans font-normal text-cyan-300">W</span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* TODAY'S DATA SUMMARY CARDS GRID BELOW */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-gray-100 px-1 flex items-center gap-2">
          <span>Today's Energy Cumulative Data</span>
          <span className="text-xs text-emerald-400 font-mono font-semibold">
            (Financial Savings: UGX {savingsUGX})
          </span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          {/* Today PV */}
          <div className="glass-card p-4 space-y-2 border-l-4 border-l-amber-500">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Solar PV Yield</span>
            </div>
            <div className="font-mono text-xl font-bold text-amber-400">
              {solarKWh} <span className="text-xs font-sans font-normal text-gray-400">kWh</span>
            </div>
          </div>

          {/* Today Load */}
          <div className="glass-card p-4 space-y-2 border-l-4 border-l-cyan-500">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>House Load</span>
            </div>
            <div className="font-mono text-xl font-bold text-cyan-400">
              {loadKWh} <span className="text-xs font-sans font-normal text-gray-400">kWh</span>
            </div>
          </div>

          {/* Battery Status */}
          <div className="glass-card p-4 space-y-2 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Battery className="w-4 h-4 text-emerald-400" />
              <span>Battery Bank</span>
            </div>
            <div className="font-mono text-xl font-bold text-emerald-400">
              {batterySoc}% <span className="text-xs font-sans font-normal text-emerald-300">SOC</span>
            </div>
          </div>

          {/* Grid Import */}
          <div className="glass-card p-4 space-y-2 border-l-4 border-l-purple-500">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>Grid Energy</span>
            </div>
            <div className="font-mono text-xl font-bold text-purple-400">
              {gridKWh} <span className="text-xs font-sans font-normal text-gray-400">kWh</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};

export default AnimatedEnergyFlow;
