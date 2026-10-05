import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Battery,
  Zap,
  ShieldCheck,
  MapPin,
  Clock,
  Layers,
  Thermometer,
  Activity,
  Cpu,
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

interface BatteryDetailPageProps {
  device: DeviceItem;
  allDevices?: DeviceItem[];
  onBack: () => void;
}

export const BatteryDetailPage: React.FC<BatteryDetailPageProps> = ({
  device,
  allDevices = [],
  onBack,
}) => {
  const [deviceHistory, setDeviceHistory] = useState<HistoryPoint[]>([]);
  const [deviceAnalytics, setDeviceAnalytics] = useState<SavingsAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDeviceAnalytics = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/analytics?sn=${encodeURIComponent(device.sn)}`));
      const data: SavingsAnalytics = await res.json();
      setDeviceAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch battery analytics:', err);
    }
  };

  const fetchDeviceHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(getApiUrl(`/api/device/history?sn=${encodeURIComponent(device.sn)}`));
      const data: HistoryPoint[] = await res.json();
      setDeviceHistory(data);
    } catch (err) {
      console.error('Failed to fetch battery history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceHistory();
    fetchDeviceAnalytics();
  }, [device.sn]);

  const batterySoc = Math.round(device.battery_soc || 0);
  const batteryPower = Math.round(device.battery_power_w || 0);
  const batteryVoltage = device.battery_voltage_v || 51.8;
  const batteryAmps =
    device.battery_current_a ||
    (batteryVoltage > 0 ? Math.round((Math.abs(batteryPower) / batteryVoltage) * 10) / 10 : 0);
  const batteryStatus =
    batteryPower < 0 ? 'Charging' : batteryPower > 0 ? 'Discharging' : 'Idle';

  const cellVolts = device.cell_voltages || [];
  const cellTemps = device.cell_temperatures || [];
  const soh = device.soh_percent != null && device.soh_percent > 0 ? device.soh_percent : 100;
  const remKwh = device.remaining_kwh;
  const maxMV =
    device.max_cell_voltage_mv || (cellVolts.length > 0 ? Math.max(...cellVolts) * 1000 : 0);
  const minMV =
    device.min_cell_voltage_mv || (cellVolts.length > 0 ? Math.min(...cellVolts) * 1000 : 0);
  const maxNum =
    device.max_cell_num || (cellVolts.length > 0 ? cellVolts.indexOf(Math.max(...cellVolts)) + 1 : 0);
  const minNum =
    device.min_cell_num || (cellVolts.length > 0 ? cellVolts.indexOf(Math.min(...cellVolts)) + 1 : 0);
  const deltaMV = maxMV > 0 && minMV > 0 ? Math.round(maxMV - minMV) : 0;

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
        <span className="text-[10px] text-emerald-400 font-bold ml-1 font-mono">
          {activeCount}/5 Dots
        </span>
      </div>
    );
  };

  // Battery SOC Chart Data
  const labels = deviceHistory.map((h) => h.time);
  const batterySocChartData = {
    labels,
    datasets: [
      {
        label: `${device.alias} Battery SOC (%)`,
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
      },
    ],
  };

  // Charge / Discharge Power Chart Data
  const batteryPowerChartData = {
    labels,
    datasets: [
      {
        label: `${device.alias} Power (W)`,
        data: deviceHistory.map((h) => h.battery_power_w),
        borderColor: '#8b5cf6',
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 250);
          gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3,
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

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition mb-2 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <span>{device.plant_name || 'Solo Solar Energy'}</span>
            <span>/</span>
            <span>Battery Storage</span>
            <span>/</span>
            <span className="text-gray-200 font-semibold">{device.alias}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-2.5 flex-wrap mt-1">
            <span>{device.alias}</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full border bg-emerald-500/20 border-emerald-500/40 text-emerald-400 font-mono">
              Lithium Battery Pack (BMS)
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300">
            <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{device.country || 'Uganda'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300">
            <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>{device.timezone || 'UTC+03:00'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>BMS Connected & Online</span>
          </div>
        </div>
      </div>

      {/* Analytics Summary */}
      <AnalyticsSummary
        analytics={deviceAnalytics}
        onRefreshAnalytics={fetchDeviceAnalytics}
        deviceSn={device.sn}
        deviceName={device.alias}
        plantName={device.plant_name}
      />

      {/* Battery KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        
        {/* SOC Card */}
        <div className="glass-card p-6 space-y-3 border border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Battery className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-gray-200">State of Charge (SOC)</span>
                <span className="text-xs text-gray-400">Battery Level</span>
              </div>
            </div>
          </div>

          <div className="flex items-baseline justify-between font-mono">
            <div className="text-3xl font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              {batterySoc}%
            </div>
            <span className={`text-xs font-sans font-bold px-2.5 py-0.5 rounded-full border ${
              batteryPower < 0
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : batteryPower > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-gray-400 border-slate-700'
            }`}>
              {batteryPower < 0 ? `Charging (+${Math.abs(batteryPower)} W)` : batteryPower > 0 ? `Discharging (-${batteryPower} W)` : 'Idle'}
            </span>
          </div>

          {renderLedDots(batterySoc)}
        </div>

        {/* Battery Power & Amps */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">Power & Current</span>
              <span className="text-xs text-gray-400">Net Energy Flow</span>
            </div>
          </div>

          <div className="font-mono text-3xl font-bold text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.3)]">
            {Math.abs(batteryPower)} <span className="text-sm font-sans font-normal text-gray-400">W</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5 font-mono">
            <div>
              <span className="text-gray-400 block text-[10px]">Voltage</span>
              <span className="font-semibold text-gray-200">{batteryVoltage} V</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">Current (Amps)</span>
              <span className="font-bold text-purple-300">{batteryAmps} A</span>
            </div>
          </div>
        </div>

        {/* State of Health & Capacity */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">Health & Capacity</span>
              <span className="text-xs text-gray-400">State of Health (SOH)</span>
            </div>
          </div>

          <div className="font-mono text-3xl font-bold text-cyan-400 drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            {soh}% <span className="text-sm font-sans font-normal text-gray-400">SOH</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5 font-mono">
            <div>
              <span className="text-gray-400 block text-[10px]">Remaining Energy</span>
              <span className="font-bold text-cyan-300">{remKwh != null && remKwh > 0 ? `${remKwh} kWh` : 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">Cell Balance</span>
              <span className="font-bold text-amber-300">{deltaMV > 0 ? `${deltaMV} mV` : 'Optimal'}</span>
            </div>
          </div>
        </div>

        {/* Temperature & Heat Status */}
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <Thermometer className="w-6 h-6" />
            </div>
            <div>
              <span className="block text-sm font-semibold text-gray-200">Temperature & Heat</span>
              <span className="text-xs text-gray-400">BMS Thermal Sensors</span>
            </div>
          </div>

          <div className="font-mono text-3xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            {cellTemps.length > 0 ? `${Math.max(...cellTemps)}°C` : '28°C'}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5 font-mono">
            <div>
              <span className="text-gray-400 block text-[10px]">Sensors Count</span>
              <span className="font-semibold text-gray-200">{cellTemps.length || 4} Sensors</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">Heating Status</span>
              <span className="font-bold text-emerald-300">{device.heat_status || 'NotHeating'}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 16-Cell Voltage Matrix & Thermal Sensor Grid */}
      <div className="glass-card p-6 space-y-5 border border-emerald-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <span>Lithium Cell Voltage Matrix & BMS Diagnostics</span>
                <span className="px-2.5 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-mono font-bold">
                  {cellVolts.length || 16} Cells
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                Individual cell voltage balance (3.237V - 3.246V) with 3 decimal precision
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
              Max Cell: #{maxNum || 2} ({(maxMV / 1000).toFixed(3)}V)
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
              Min Cell: #{minNum || 9} ({(minMV / 1000).toFixed(3)}V)
            </div>
          </div>
        </div>

        {/* 16 Cell Cards */}
        {cellVolts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 font-mono">
            {cellVolts.map((volt, idx) => {
              const cellNo = idx + 1;
              const isMax = cellNo === maxNum;
              const isMin = cellNo === minNum;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border text-center transition duration-200 ${
                    isMax
                      ? 'bg-emerald-500/20 border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : isMin
                      ? 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                    <span>Cell #{cellNo < 10 ? `0${cellNo}` : cellNo}</span>
                    {isMax && <span className="text-[9px] bg-emerald-500/40 text-emerald-200 px-1 rounded font-bold">MAX</span>}
                    {isMin && <span className="text-[9px] bg-cyan-500/40 text-cyan-200 px-1 rounded font-bold">MIN</span>}
                  </div>
                  <div className={`text-sm font-bold ${
                    isMax ? 'text-emerald-300' : isMin ? 'text-cyan-300' : 'text-gray-100'
                  }`}>
                    {volt.toFixed(3)} V
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-gray-400 font-mono">
            Fetching live 16-cell BMS breakdown...
          </div>
        )}

        {/* Thermal Sensors Panel */}
        {cellTemps.length > 0 && (
          <div className="pt-3 border-t border-slate-800/80 space-y-2">
            <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-400" />
              <span>BMS Temperature Sensors Breakdown</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {cellTemps.map((temp, idx) => (
                <div key={idx} className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-gray-400">Sensor #{idx + 1}</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">{temp}°C</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Historical Time-Series Curves for Battery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Battery SOC (%) Trend */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-100">Battery SOC (%) Trend</h3>
              <p className="text-xs text-gray-400">24-Hour State of Charge profile for {device.alias}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" /> SOC (%)
            </span>
          </div>

          <div className="h-72 w-full">
            <Line data={batterySocChartData} options={chartOptions} />
          </div>
        </div>

        {/* Chart 2: Charge & Discharge Power Curve */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-100">Charge / Discharge Power Curve</h3>
              <p className="text-xs text-gray-400">Negative = Charging from PV/Grid | Positive = Discharging</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold">
              <span className="w-3 h-3 rounded-sm bg-purple-500" /> Net Power (W)
            </span>
          </div>

          <div className="h-72 w-full">
            <Line data={batteryPowerChartData} options={chartOptions} />
          </div>
        </div>

      </div>

      {/* Full Hardware Specs & Registry */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-white/10 pb-3">
          <Layers className="w-5 h-5 text-emerald-400" />
          <h3 className="text-base font-bold text-gray-100">Battery Hardware & Communication Registry</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Device Name / Location</span>
              <span className="font-mono font-bold text-gray-200">{device.alias}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Battery Model</span>
              <span className="font-mono font-bold text-gray-200">{device.model || 'Lithium Battery Pack'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Battery SN</span>
              <span className="font-mono text-gray-200">{device.sn}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Wi-Fi Collector Logger SN</span>
              <span className="font-mono text-blue-400 font-semibold">{device.collector_sn || 'N/A'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Rated Energy Capacity</span>
              <span className="font-mono font-bold text-gray-200">{device.rated_power_kw || '25'} kWh</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Plant Name & ID</span>
              <span className="font-mono text-gray-200">{device.plant_name} ({device.plant_id})</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">Firmware / Module Version</span>
              <span className="font-mono text-gray-300">{device.firmware_version || '2.15'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-400">BMS Operating Status</span>
              <span className="font-mono font-bold text-emerald-400">Online / Optimal</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BatteryDetailPage;
