import React, { useState } from 'react';
import { Sun, Battery, Zap, Activity, X, Layers, ChevronRight } from 'lucide-react';
import { TelemetryResponse } from '../types';

interface PlantSummaryProps {
  telemetry: TelemetryResponse | null;
}

export const PlantSummary: React.FC<PlantSummaryProps> = ({ telemetry }) => {
  const [showPvModal, setShowPvModal] = useState(false);

  const pvPower = Math.round(telemetry?.solar?.power_w || 0);
  const pvVoltage = telemetry?.solar?.voltage_v || 240;
  const pvCurrent = telemetry?.solar?.current_a || (pvVoltage > 0 ? Math.round((pvPower / pvVoltage) * 10) / 10 : 0);

  // Extract all PV contributing devices (Inverters & MPPTs with PV generation or capabilities)
  const pvContributors = (telemetry?.devices || []).filter(
    (d) => d.type !== 'BP' && (d.pv_power_w > 0 || d.type === 'MT' || d.type === 'OG' || d.type === 'INV')
  );

  const batterySoc = Math.round(telemetry?.battery?.soc_percent || 0);
  const batteryPower = Math.round(telemetry?.battery?.power_w || 0);
  const batteryVoltage = telemetry?.battery?.voltage_v || 53.5;
  const batteryAmps = batteryVoltage > 0 ? Math.round((Math.abs(batteryPower) / batteryVoltage) * 10) / 10 : 0;
  const batteryStatus = batteryPower < 0 ? 'Charging' : (batteryPower > 0 ? 'Discharging' : 'Idle');

  const loadPower = Math.round(telemetry?.load?.power_w || 0);
  const loadVoltage = telemetry?.load?.voltage_v || 230;
  const loadAmps = loadVoltage > 0 ? Math.round((loadPower / loadVoltage) * 10) / 10 : 0;

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
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        
        {/* Solar Card (Clickable to open breakdown modal) */}
        <div
          onClick={() => setShowPvModal(true)}
          className="glass-card p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 transition hover:-translate-y-1 hover:border-amber-500/50 cursor-pointer group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                <Sun className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <span className="block text-xs sm:text-sm font-semibold text-gray-200">Total Solar Generation</span>
                <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
                  <span>{pvContributors.length > 1 ? `${pvContributors.length} Parallel Contributors` : 'Combined Array Yield'}</span>
                  <ChevronRight className="w-3 h-3 text-amber-400 group-hover:translate-x-0.5 transition" />
                </span>
              </div>
            </div>
          </div>

          <div className="font-mono text-2xl sm:text-3xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-baseline justify-between">
            <span>{pvPower.toLocaleString()} <span className="text-xs sm:text-sm font-sans font-normal text-gray-400">W</span></span>
            <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-mono">
              Tap for PV breakdown
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 sm:pt-3 border-t border-white/5 text-xs">
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
        <div className="glass-card p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 transition hover:-translate-y-1 hover:border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
              <Battery className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-semibold text-gray-200">Battery Storage</span>
              <span className="text-[10px] sm:text-xs text-gray-400">SOC & Energy Balance</span>
            </div>
          </div>

          <div>
            <div className="font-mono text-2xl sm:text-3xl font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)] flex items-baseline justify-between">
              <span>{batterySoc}%</span>
              <span className="text-xs font-sans font-medium text-gray-300">
                {batteryPower !== 0 ? `${Math.abs(batteryPower)} W` : '0 W'}
              </span>
            </div>
            {renderLedDots(batterySoc)}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 sm:pt-3 border-t border-white/5 text-xs">
            <div>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Status / Current</span>
              <span className="font-mono font-semibold text-emerald-300">{batteryStatus} ({batteryAmps}A)</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Voltage</span>
              <span className="font-mono font-semibold text-gray-300">{batteryVoltage} V</span>
            </div>
          </div>
        </div>

        {/* House Load Card */}
        <div className="glass-card p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 transition hover:-translate-y-1 hover:border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-semibold text-gray-200">House Consumption</span>
              <span className="text-[10px] sm:text-xs text-gray-400">Total AC Load Output</span>
            </div>
          </div>

          <div className="font-mono text-2xl sm:text-3xl font-bold text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.3)]">
            {loadPower.toLocaleString()} <span className="text-xs sm:text-sm font-sans font-normal text-gray-400">W</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 sm:pt-3 border-t border-white/5 text-xs">
            <div>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Voltage</span>
              <span className="font-mono font-semibold">{loadVoltage} V</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Current (Amps)</span>
              <span className="font-mono font-bold text-blue-300">{loadAmps} A</span>
            </div>
          </div>
        </div>

        {/* AC Grid Status Card */}
        <div className="glass-card p-4 sm:p-6 flex flex-col justify-between gap-3 sm:gap-4 transition hover:-translate-y-1 hover:border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <span className="block text-xs sm:text-sm font-semibold text-gray-200">AC Utility Grid</span>
              <span className="text-[10px] sm:text-xs text-gray-400">Grid Feed & Inverter Temp</span>
            </div>
          </div>

          <div className="font-mono text-2xl sm:text-3xl font-bold text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            {gridPower.toLocaleString()} <span className="text-xs sm:text-sm font-sans font-normal text-gray-400">W</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 sm:pt-3 border-t border-white/5 text-xs">
            <div>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Grid Voltage</span>
              <span className="font-mono font-semibold">{gridVoltage} V</span>
            </div>
            <div>
              <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Inverter Temp</span>
              <span className="font-mono font-semibold text-purple-300">{temp} °C</span>
            </div>
          </div>
        </div>

      </div>

      {/* PV Breakdown Modal */}
      {showPvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-amber-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-gray-100 p-6 space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                    <span>Solar Generation PV Contributors</span>
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      Total: {pvPower} W
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    Individual Charge Controllers & Parallel MPPT Strings breakdown
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPvModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PV Contributors List */}
            <div className="space-y-3">
              {pvContributors.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">No active PV generation controllers detected.</div>
              ) : (
                pvContributors.map((dev) => {
                  const devPv = Math.round(dev.pv_power_w || 0);
                  const pct = pvPower > 0 ? Math.round((devPv / pvPower) * 100) : 0;
                  const isMppt = dev.type === 'MT' || dev.alias.toLowerCase().includes('mppt');

                  return (
                    <div key={dev.sn} className="glass-card p-4 space-y-2.5 border border-slate-800 hover:border-amber-500/40 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Layers className={`w-4 h-4 ${isMppt ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <div>
                            <span className="font-bold text-sm text-gray-100">{dev.alias}</span>
                            <span className="block text-[11px] text-gray-400 font-mono">
                              Model: {dev.model || 'PV Controller'} ({isMppt ? 'External MPPT' : 'Inbuilt Charge Controller'})
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-lg font-bold text-amber-400">{devPv} W</span>
                          <span className="block text-[10px] text-amber-300/80 font-bold">{pct}% of Total</span>
                        </div>
                      </div>

                      {/* Percentage Bar */}
                      <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>

                      {/* PV Parameters */}
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-gray-300">
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase">PV Voltage</span>
                          <span>{dev.pv_voltage_v || 0} V</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase">PV Current</span>
                          <span>{dev.pv_current_a || 0} A</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase">Serial Number</span>
                          <span className="text-[10px] text-gray-400 truncate block" title={dev.sn}>
                            {dev.sn.substring(0, 10)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Informational Footer note on Parallel Savings calculation */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-1">
              <span className="font-bold block text-amber-200">How Savings Are Calculated with Parallel Charge Controllers:</span>
              <p className="text-[11px] text-amber-300/90">
                The total plant solar generation (kWh) is the sum of energy produced by all parallel charge controllers (Inbuilt Inverter MPPT + External MPPTs). Every kWh generated avoids utility grid usage and is converted to financial savings (UGX) according to Uganda Time-of-Use (TOU) tariffs.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowPvModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold"
              >
                Close Breakdown
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default PlantSummary;

