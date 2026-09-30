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
  ChevronRight,
  X,
  Thermometer,
  Activity,
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
import { DeviceItem, HistoryPoint, SavingsAnalytics, TelemetryResponse } from '../types';
import { AnalyticsSummary } from './AnalyticsSummary';
import { AnimatedEnergyFlow } from './AnimatedEnergyFlow';
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
  allDevices?: DeviceItem[];
  onBack: () => void;
}

export const DeviceDetailPage: React.FC<DeviceDetailPageProps> = ({ device, allDevices = [], onBack }) => {
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

  const [showPvModal, setShowPvModal] = useState(false);
  const [showBatteryModal, setShowBatteryModal] = useState(false);

  const batteryUnits = (allDevices.length > 0 ? allDevices : [device]).filter(
    (d) => d.type === 'BP' || d.battery_soc > 0 || d.battery_power_w !== 0
  );

  useEffect(() => {
    fetchDeviceHistory();
    fetchDeviceAnalytics();
  }, [device.sn]);

  const isBattery = device.type === 'BP';

  // Filter all PV contributing charge controllers (Inbuilt Inverter MPPT + External MPPTs)
  const plantPvDevices = (allDevices.length > 0 ? allDevices : [device]).filter(
    (d) => d.type !== 'BP' && (d.pv_power_w > 0 || d.type === 'MT' || d.type === 'OG' || d.type === 'INV')
  );

  const totalPvPower = plantPvDevices.length > 0 
    ? plantPvDevices.reduce((sum, d) => sum + Math.round(d.pv_power_w || 0), 0)
    : Math.round(device.pv_power_w || 0);

  const totalPvCurrent = plantPvDevices.length > 0
    ? Math.round(plantPvDevices.reduce((sum, d) => sum + (d.pv_current_a || 0), 0) * 10) / 10
    : (device.pv_current_a || 0);

  const avgPvVoltage = plantPvDevices.length > 0
    ? Math.round(plantPvDevices.reduce((sum, d) => sum + (d.pv_voltage_v || 0), 0) / plantPvDevices.length)
    : (device.pv_voltage_v || 240);

  const loadPower = Math.round(device.load_power_w);
  const loadAmps = device.load_current_a || Math.round((loadPower / 230.0) * 10) / 10;

  const batterySoc = Math.round(device.battery_soc);
  const batteryPower = Math.round(device.battery_power_w);
  const batteryVoltage = device.battery_voltage_v || 53.5;
  const batteryAmps = device.battery_current_a || (batteryVoltage > 0 ? Math.round((Math.abs(batteryPower) / batteryVoltage) * 10) / 10 : 0);
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

  const renderBmsDetails = (dev: DeviceItem) => {
    const cellVolts = dev.cell_voltages || [];
    const cellTemps = dev.cell_temperatures || [];
    const soh = dev.soh_percent != null && dev.soh_percent > 0 ? dev.soh_percent : 100;
    const remKwh = dev.remaining_kwh;
    const maxMV = dev.max_cell_voltage_mv || (cellVolts.length > 0 ? Math.max(...cellVolts) * 1000 : 0);
    const minMV = dev.min_cell_voltage_mv || (cellVolts.length > 0 ? Math.min(...cellVolts) * 1000 : 0);
    const maxNum = dev.max_cell_num || (cellVolts.length > 0 ? cellVolts.indexOf(Math.max(...cellVolts)) + 1 : 0);
    const minNum = dev.min_cell_num || (cellVolts.length > 0 ? cellVolts.indexOf(Math.min(...cellVolts)) + 1 : 0);
    const deltaMV = maxMV > 0 && minMV > 0 ? Math.round(maxMV - minMV) : 0;

    if (cellVolts.length === 0 && cellTemps.length === 0 && !soh && !remKwh) {
      return null;
    }

    return (
      <div className="space-y-4 pt-3 border-t border-slate-800/80">
        {/* BMS Diagnostic Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
            <span className="text-[10px] text-gray-400 block uppercase font-medium">State of Health (SOH)</span>
            <span className="font-mono text-base font-bold text-emerald-400">{soh}%</span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
            <span className="text-[10px] text-gray-400 block uppercase font-medium">Remaining Energy</span>
            <span className="font-mono text-base font-bold text-cyan-400">
              {remKwh != null && remKwh > 0 ? `${remKwh} kWh` : 'N/A'}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
            <span className="text-[10px] text-gray-400 block uppercase font-medium">Cell Delta Voltage</span>
            <span className="font-mono text-base font-bold text-amber-400">
              {deltaMV > 0 ? `${deltaMV} mV` : 'Balanced'}
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
            <span className="text-[10px] text-gray-400 block uppercase font-medium">BMS Heating Status</span>
            <span className="font-mono text-xs font-bold text-emerald-300">
              {dev.heat_status || 'NotHeating'}
            </span>
          </div>
        </div>

        {/* Cell Temperature Sensors */}
        {cellTemps.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
              <span>Cell Temperature Sensors ({cellTemps.length} Sensors)</span>
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {cellTemps.map((temp, idx) => (
                <div key={idx} className="bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg flex items-center justify-between text-xs">
                  <span className="text-gray-400 text-[10px]">Sensor #{idx + 1}</span>
                  <span className="font-mono font-bold text-amber-300">{temp}°C</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 16 Cell Individual Voltage Breakdown */}
        {cellVolts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cell Voltage Matrix ({cellVolts.length} Lithium Cells)</span>
              </span>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-emerald-400 font-semibold">Max: Cell #{maxNum} ({(maxMV/1000).toFixed(3)}V)</span>
                <span className="text-cyan-400 font-semibold">Min: Cell #{minNum} ({(minMV/1000).toFixed(3)}V)</span>
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 font-mono text-xs">
              {cellVolts.map((volt, idx) => {
                const cellNo = idx + 1;
                const isMax = cellNo === maxNum;
                const isMin = cellNo === minNum;

                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-center transition ${
                      isMax
                        ? 'bg-emerald-500/20 border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                        : isMin
                        ? 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[9px] text-gray-400 mb-0.5">
                      <span>#{cellNo < 10 ? `0${cellNo}` : cellNo}</span>
                      {isMax && <span className="text-[8px] bg-emerald-500/40 text-emerald-200 px-1 rounded font-bold">MAX</span>}
                      {isMin && <span className="text-[8px] bg-cyan-500/40 text-cyan-200 px-1 rounded font-bold">MIN</span>}
                    </div>
                    <div className={`text-xs font-bold ${
                      isMax ? 'text-emerald-300' : isMin ? 'text-cyan-300' : 'text-gray-200'
                    }`}>
                      {volt.toFixed(3)}V
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-semibold text-blue-400 hover:text-blue-300 transition mb-2 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
            <span>Back to All Locations</span>
          </button>
          
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <span>{device.plant_name || 'Solo Solar Energy'}</span>
            <span>/</span>
            <span>Locations</span>
            <span>/</span>
            <span className="text-gray-200 font-semibold">{device.alias}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-100 flex items-center gap-2.5 flex-wrap mt-1">
            <span>{device.alias}</span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
              isBattery 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}>
              {isBattery ? 'Lithium Battery Pack' : `Inverter ${device.model}`}
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
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Shine App Style Animated Energy Flow Diagram View */}
      <AnimatedEnergyFlow
        telemetry={{
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          is_live: true,
          configured: true,
          plant_info: {
            name: device.alias,
            total_devices: plantPvDevices.length + batteryUnits.length,
            status: 'Online',
          },
          solar: {
            power_w: totalPvPower,
            voltage_v: avgPvVoltage,
            current_a: totalPvCurrent,
          },
          battery: {
            soc_percent: batterySoc,
            power_w: batteryPower,
            voltage_v: batteryVoltage,
            status: batteryStatus,
          },
          load: {
            power_w: loadPower,
            voltage_v: 230,
            frequency_hz: 50,
          },
          grid: {
            power_w: device.grid_power_w || 0,
            voltage_v: device.grid_voltage_v || 230,
            status: 'Connected',
          },
          system: {
            inverter_temp_c: 36.5,
            health_status: 'Optimal',
          },
          devices: [device],
        }}
        analytics={deviceAnalytics}
      />

      {/* Location-Specific TimescaleDB Analytics Summary */}
      <AnalyticsSummary
        analytics={deviceAnalytics}
        onRefreshAnalytics={fetchDeviceAnalytics}
        deviceSn={device.sn}
        deviceName={device.alias}
      />

      {/* KPI Cards for This Dedicated Location Home */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        
        {/* Solar Output (Clickable for individual MPPT Breakdown) */}
        <div
          onClick={() => setShowPvModal(true)}
          className="glass-card p-6 space-y-3 cursor-pointer hover:border-amber-500/50 transition group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                <Sun className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-gray-200">Solar PV Power</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span>{plantPvDevices.length > 1 ? `${plantPvDevices.length} Parallel MPPTs` : 'Array Generation'}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition" />
                </span>
              </div>
            </div>
          </div>

          <div className="font-mono text-3xl font-bold text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-baseline justify-between">
            <span>{totalPvPower.toLocaleString()} <span className="text-sm font-sans font-normal text-gray-400">W</span></span>
            <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full font-mono">
              Tap for MPPT breakdown
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-white/5">
            <div>
              <span className="text-gray-400 block text-[10px]">Voltage</span>
              <span className="font-mono font-semibold">{avgPvVoltage} V</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[10px]">Current (Amps)</span>
              <span className="font-mono font-bold text-amber-300">{totalPvCurrent} A</span>
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

        {/* Battery Storage Card (Clickable to view Battery Breakdown) */}
        <div
          onClick={() => setShowBatteryModal(true)}
          className="glass-card p-6 space-y-3 cursor-pointer hover:border-emerald-500/50 transition group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                <Battery className="w-6 h-6" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-gray-200">Battery Storage</span>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <span>SOC & Energy Balance</span>
                  <ChevronRight className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition" />
                </span>
              </div>
            </div>
          </div>

          <div>
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

            {/* LED Dots Indicator */}
            {renderLedDots(batterySoc)}
          </div>

          <div className="grid grid-cols-3 gap-1 text-xs pt-2 border-t border-white/5 font-mono">
            <div>
              <span className="text-gray-400 block text-[9px]">Status / Current</span>
              <span className="font-semibold text-emerald-300">{batteryStatus} ({batteryAmps}A)</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Voltage</span>
              <span className="font-semibold">{batteryVoltage} V</span>
            </div>
            <div>
              <span className="text-gray-400 block text-[9px]">Power</span>
              <span className="font-bold text-emerald-300">{batteryPower !== 0 ? `${Math.abs(batteryPower)} W` : '0 W'}</span>
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
              <h3 className="text-base font-bold text-gray-100">Battery SOC & Net Power Trend</h3>
              <p className="text-xs text-gray-400">
                24-Hour Battery Storage — Green: State of Charge (%) | Purple: Charge/Discharge Power (Negative = Charging, Positive = Discharging)
              </p>
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

      {/* PV MPPT Breakdown Modal */}
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
                    <span>Solar PV MPPT Contributors</span>
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                      Total: {totalPvPower} W
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    Location: {device.alias} ({device.plant_name || 'Solo Solar Energy'})
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

            {/* MPPT Contributors List */}
            <div className="space-y-3">
              {plantPvDevices.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">No active PV generation controllers detected.</div>
              ) : (
                plantPvDevices.map((dev) => {
                  const devPv = Math.round(dev.pv_power_w || 0);
                  const pct = totalPvPower > 0 ? Math.round((devPv / totalPvPower) * 100) : 0;
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

      {/* Battery Bank & BMS Breakdown Modal */}
      {showBatteryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0f172a] border border-emerald-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-gray-100 p-6 space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <Battery className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-100 flex items-center gap-2">
                    <span>Battery Storage & BMS Breakdown</span>
                    <span className={`px-2.5 py-0.5 text-[10px] rounded-full border font-mono font-bold ${
                      batteryPower < 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                        : batteryPower > 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-gray-400 border-slate-700'
                    }`}>
                      {batteryPower < 0 ? `Charging (+${Math.abs(batteryPower)} W)` : batteryPower > 0 ? `Discharging (-${batteryPower} W)` : 'Idle'}
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    Location: {device.alias} ({device.plant_name || 'Solo Solar Energy'}) — SOC: {batterySoc}%
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBatteryModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Battery Packs & Units List */}
            <div className="space-y-3">
              {batteryUnits.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">No active battery units detected.</div>
              ) : (
                batteryUnits.map((dev) => {
                  const bSoc = Math.round(dev.battery_soc || 0);
                  const bPower = Math.round(dev.battery_power_w || 0);
                  const bVolt = dev.battery_voltage_v || 53.5;
                  const bAmps = dev.battery_current_a || (bVolt > 0 ? Math.round((Math.abs(bPower) / bVolt) * 10) / 10 : 0);
                  const isPack = dev.type === 'BP';

                  return (
                    <div key={dev.sn} className="glass-card p-4 space-y-2.5 border border-slate-800 hover:border-emerald-500/40 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Battery className="w-4 h-4 text-emerald-400" />
                          <div>
                            <span className="font-bold text-sm text-gray-100">{dev.alias}</span>
                            <span className="block text-[11px] text-gray-400 font-mono">
                              {isPack ? 'Lithium Battery Pack (BMS Connected)' : `Inverter Telemetry (${dev.model})`}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-lg font-bold text-emerald-400">{bSoc}% SOC</span>
                          <span className="block text-[10px] text-emerald-300 font-semibold">
                            {bPower < 0 ? `Charging (${Math.abs(bPower)} W)` : bPower > 0 ? `Discharging (${bPower} W)` : `${bAmps} A`}
                          </span>
                        </div>
                      </div>

                      {/* Voltage & Current */}
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-gray-300 border-t border-slate-800/60">
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase">Voltage</span>
                          <span className="text-emerald-300 font-semibold">{bVolt} V</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase">Current (Amps)</span>
                          <span className="text-emerald-300 font-semibold">{bAmps} A</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-gray-500 uppercase">Serial Number</span>
                          <span className="text-[10px] text-gray-400 truncate block" title={dev.sn}>
                            {dev.sn.substring(0, 10)}...
                          </span>
                        </div>
                      </div>

                      {/* BMS Breakdown: Cell Voltages, Temperatures, SOH & Capacity */}
                      {renderBmsDetails(dev)}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowBatteryModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold"
              >
                Close Breakdown
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
