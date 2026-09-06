import React from 'react';
import { Sun, Battery, Zap, Activity } from 'lucide-react';
import { TelemetryResponse } from '../types';

interface PlantSummaryProps {
  telemetry: TelemetryResponse | null;
}

export const PlantSummary: React.FC<PlantSummaryProps> = ({ telemetry }) => {
  const pvPower = Math.round(telemetry?.solar?.power_w || 0);
  const pvVoltage = telemetry?.solar?.voltage_v || 240;
  const pvCurrent = telemetry?.solar?.current_a || (pvVoltage > 0 ? Math.round((pvPower / pvVoltage) * 10) / 10 : 0);

  const batterySoc = Math.round(telemetry?.battery?.soc_percent || 0);
  const batteryPower = Math.round(telemetry?.battery?.power_w || 0);
  const batteryVoltage = telemetry?.battery?.voltage_v || 53.5;
  const batteryAmps = batteryVoltage > 0 ? Math.round((Math.abs(batteryPower) / batteryVoltage) * 10) / 10 : 0;
  const batteryStatus = batteryPower < 0 ? 'Charging' : (batteryPower > 0 ? 'Discharging' : 'Idle');

  const loadPower = Math.round(telemetry?.load?.power_w || 0);
  const loadVoltage = telemetry?.load?.voltage_v || 230;
  const loadAmps = loadVoltage > 0 ? Math.round((loadPower / loadVoltage) * 10) / 10 : 0;
  const loadFreq = telemetry?.load?.frequency_hz || 50;

  const gridPower = Math.round(telemetry?.grid?.power_w || 0);
  const gridVoltage = telemetry?.grid?.voltage_v || 230;
  const temp = telemetry?.system?.inverter_temp_c || 36.5;

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      
      {/* Solar Card */}
      <div className="glass-card p-6 flex flex-col justify-between gap-4 transition hover:-translate-y-1 hover:border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
            <Sun className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-200">Total Solar Generation</span>
            <span className="text-xs text-gray-400">Combined Array Yield</span>
          </div>
        </div>

        <div className="font-mono text-3xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
          {pvPower.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">W</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5 text-xs">
          <div>
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Voltage</span>
            <span className="font-mono font-semibold">{pvVoltage} V</span>
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Current (Amps)</span>
            <span className="font-mono font-bold text-amber-300">{pvCurrent} A</span>
          </div>
        </div>
      </div>

      {/* Battery Card */}
      <div className="glass-card p-6 flex flex-col justify-between gap-4 transition hover:-translate-y-1 hover:border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
            <Battery className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-200">Battery Storage</span>
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

          {/* LED Dots Bar */}
          {renderLedDots(batterySoc)}
        </div>

        <div className="grid grid-cols-3 gap-1 pt-3 border-t border-white/5 text-xs">
          <div>
            <span className="block text-[9px] text-gray-400 uppercase tracking-wider">Power</span>
            <span className="font-mono font-semibold">{batteryPower} W</span>
          </div>
          <div>
            <span className="block text-[9px] text-gray-400 uppercase tracking-wider">Voltage</span>
            <span className="font-mono font-semibold">{batteryVoltage} V</span>
          </div>
          <div>
            <span className="block text-[9px] text-gray-400 uppercase tracking-wider">Current</span>
            <span className="font-mono font-bold text-emerald-300">{batteryAmps} A</span>
          </div>
        </div>
      </div>

      {/* Load Card */}
      <div className="glass-card p-6 flex flex-col justify-between gap-4 transition hover:-translate-y-1 hover:border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-200">Total Consumption</span>
            <span className="text-xs text-gray-400">Combined AC Load</span>
          </div>
        </div>

        <div className="font-mono text-3xl font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
          {loadPower.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">W</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5 text-xs">
          <div>
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">AC Voltage</span>
            <span className="font-mono font-semibold">{loadVoltage} V</span>
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Current (Amps)</span>
            <span className="font-mono font-bold text-cyan-300">{loadAmps} A</span>
          </div>
        </div>
      </div>

      {/* Grid Status Card */}
      <div className="glass-card p-6 flex flex-col justify-between gap-4 transition hover:-translate-y-1 hover:border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-sm font-semibold text-gray-200">Grid & System</span>
            <span className="text-xs text-purple-400 font-semibold">Connected</span>
          </div>
        </div>

        <div className="font-mono text-3xl font-bold text-purple-400 drop-shadow-[0_0_12px_rgba(139,92,246,0.3)]">
          {gridPower} <span className="text-sm font-sans font-normal text-gray-400">W</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5 text-xs">
          <div>
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Grid Voltage</span>
            <span className="font-mono font-semibold">{gridVoltage} V</span>
          </div>
          <div>
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Max Temp</span>
            <span className="font-mono font-semibold">{temp} °C</span>
          </div>
        </div>
      </div>

    </div>
  );
};
