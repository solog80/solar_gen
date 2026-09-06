import React from 'react';
import { ArrowRight } from 'lucide-react';
import { DeviceItem } from '../types';

interface DeviceGridProps {
  devices: DeviceItem[];
  onSelectDevice: (device: DeviceItem) => void;
}

export const DeviceGrid: React.FC<DeviceGridProps> = ({ devices, onSelectDevice }) => {
  if (!devices || devices.length === 0) {
    return <p className="text-gray-400 text-sm">No plant devices discovered.</p>;
  }

  const renderLedDots = (soc: number) => {
    let activeCount = 0;
    if (soc >= 90) activeCount = 5;
    else if (soc >= 70) activeCount = 4;
    else if (soc >= 55) activeCount = 3;
    else if (soc >= 35) activeCount = 2;
    else if (soc >= 15) activeCount = 1;

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            className={`w-2 h-2 rounded-full border transition-all ${
              dot <= activeCount
                ? 'bg-emerald-400 border-emerald-300 shadow-[0_0_5px_#34d399]'
                : 'bg-slate-800 border-slate-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
      {devices.map((device) => {
        const isBattery = device.type === 'BP';
        const tagClass = isBattery 
          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
          : 'bg-amber-500/20 border-amber-500/40 text-amber-400';

        const pvWatts = Math.round(device.pv_power_w);
        const pvAmps = device.pv_current_a || (device.pv_voltage_v > 0 ? Math.round((pvWatts / device.pv_voltage_v) * 10) / 10 : 0);
        const loadWatts = Math.round(device.load_power_w);
        const loadAmps = device.load_current_a || Math.round((loadWatts / 230.0) * 10) / 10;
        const batSoc = Math.round(device.battery_soc);
        const batWatts = Math.round(device.battery_power_w);
        const batAmps = device.battery_current_a || Math.round((Math.abs(batWatts) / 53.5) * 10) / 10;

        return (
          <div
            key={device.sn}
            onClick={() => onSelectDevice(device)}
            className="group glass-card p-5 cursor-pointer flex flex-col justify-between gap-3 hover:bg-white/[0.08] hover:border-blue-500/50 hover:-translate-y-1 transition duration-200 shadow-lg"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-base text-gray-100 group-hover:text-blue-400 transition">
                  {device.alias}
                </h3>
                <span className="font-mono text-xs text-gray-400 block mt-0.5">
                  SN: {device.sn}
                </span>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${tagClass}`}>
                {isBattery ? 'Battery Pack' : `Inverter ${device.model}`}
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/5 text-xs">
              {/* Solar PV Generation & Amps */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Solar PV Generation</span>
                <span className="font-mono font-bold text-amber-400">
                  {pvWatts} W <span className="text-amber-300 text-[11px]">({pvAmps} A)</span>
                </span>
              </div>

              {/* AC Load & Amps */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">House Load</span>
                <span className="font-mono font-bold text-cyan-400">
                  {loadWatts} W <span className="text-cyan-300 text-[11px]">({loadAmps} A)</span>
                </span>
              </div>

              {/* Battery SOC, LED Dots & Amps */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Battery SOC</span>
                  {renderLedDots(batSoc)}
                </div>
                <span className="font-mono font-bold text-emerald-400">
                  {batSoc}% <span className="text-emerald-300 text-[11px]">({batWatts !== 0 ? `${Math.abs(batWatts)}W / ` : ''}{batAmps} A)</span>
                </span>
              </div>

              {/* Utility Grid AC */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Utility Grid AC</span>
                <span className="font-mono text-purple-400 font-bold text-xs">
                  {device.grid_power_w && device.grid_power_w > 0 ? `${device.grid_power_w} W` : 'Connected (230V @ 50Hz)'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 group-hover:text-blue-300 pt-2 transition">
              <span>View Full Device Inspector</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
            </div>
          </div>
        );
      })}
    </div>
  );
};
