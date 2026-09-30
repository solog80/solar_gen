import React from 'react';
import { X, Cpu, Sun, Battery, Zap, ShieldCheck } from 'lucide-react';
import { DeviceItem } from '../types';

interface DeviceModalProps {
  device: DeviceItem | null;
  onClose: () => void;
}

export const DeviceModal: React.FC<DeviceModalProps> = ({ device, onClose }) => {
  if (!device) return null;

  const isBattery = device.type === 'BP';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#131924] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-100">{device.alias}</h3>
              <span className="font-mono text-xs text-gray-400">Serial Number: {device.sn}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Live Stat Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">PV Output</span>
            <span className="font-mono text-xl font-bold text-amber-400">{Math.round(device.pv_power_w)} W</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Battery SOC</span>
            <span className="font-mono text-xl font-bold text-emerald-400">{Math.round(device.battery_soc)} %</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">AC Load</span>
            <span className="font-mono text-xl font-bold text-cyan-400">{Math.round(device.load_power_w || 0)} W</span>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-3">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Rated Power</span>
            <span className="font-mono text-xl font-bold text-gray-200">{device.rated_power_kw || '10'} kW</span>
          </div>
        </div>

        {/* Detailed Specs Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Device Metadata & System Specs</h4>
          
          <table className="w-full text-xs">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2.5 text-gray-400">Device Name / Alias</td>
                <td className="py-2.5 font-mono font-bold text-gray-100">{device.alias}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Hardware Model</td>
                <td className="py-2.5 font-mono font-bold text-gray-100">{device.model} ({device.type_name || device.type})</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Device Classification</td>
                <td className="py-2.5 font-mono font-bold text-gray-100">{isBattery ? 'Lithium Battery Pack (BP)' : 'Off-Grid Inverter (OG)'}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Collector Datalogger SN</td>
                <td className="py-2.5 font-mono font-semibold text-blue-400">{device.collector_sn || 'N/A'}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Inverter SN</td>
                <td className="py-2.5 font-mono text-gray-200">{device.sn}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Plant Name</td>
                <td className="py-2.5 font-mono text-gray-200">{device.plant_name || 'Solo Solar Energy'}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Plant ID</td>
                <td className="py-2.5 font-mono text-gray-400">{device.plant_id || '10151855957824961'}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Country & Timezone</td>
                <td className="py-2.5 font-mono text-gray-200">{device.country || 'Uganda'} ({device.timezone || 'UTC+03:00'})</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Firmware Version</td>
                <td className="py-2.5 font-mono text-gray-200">{device.firmware_version || '1.03'}</td>
              </tr>
              <tr>
                <td className="py-2.5 text-gray-400">Status</td>
                <td className="py-2.5 font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Online (Normal Operation)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BMS Telemetry Breakdown for Battery Packs */}
        {(device.cell_voltages || device.cell_temperatures || isBattery) && (
          <div className="pt-2 border-t border-white/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-emerald-400" />
              <span>BMS Telemetry & Cell Voltages</span>
            </h4>

            {device.cell_voltages && device.cell_voltages.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-[11px]">
                {device.cell_voltages.map((v, i) => (
                  <div key={i} className="p-1.5 rounded bg-white/5 border border-white/10 text-center">
                    <span className="text-[9px] text-gray-400 block">#{i + 1}</span>
                    <span className="font-bold text-emerald-300">{v.toFixed(3)}V</span>
                  </div>
                ))}
              </div>
            )}

            {device.cell_temperatures && device.cell_temperatures.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs font-mono">
                {device.cell_temperatures.map((t, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                    Temp #{i + 1}: {t}°C
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs transition"
          >
            Close Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
