import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PlantSummary } from './components/PlantSummary';
import { AnalyticsSummary } from './components/AnalyticsSummary';
import { DeviceGrid } from './components/DeviceGrid';
import { DeviceDetailPage } from './components/DeviceDetailPage';
import { ConfigModal } from './components/ConfigModal';
import { LoginModal } from './components/LoginModal';
import { UserManagementModal } from './components/UserManagementModal';
import { PowerChart } from './components/PowerChart';
import { TelemetryResponse, HistoryPoint, DeviceItem, SavingsAnalytics, DashboardUser } from './types';
import { getApiUrl } from './apiConfig';

const fallbackTelemetry: TelemetryResponse = {
  timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
  is_live: false,
  configured: true,
  plant_info: {
    name: 'Solo Solar Energy',
    total_devices: 3,
    status: 'Online',
  },
  solar: {
    power_w: 4250,
    voltage_v: 240,
    current_a: 17.7,
  },
  battery: {
    soc_percent: 74,
    power_w: 0,
    voltage_v: 54.5,
    status: 'Discharging',
  },
  load: {
    power_w: 1650,
    voltage_v: 230,
    frequency_hz: 50,
  },
  grid: {
    power_w: 0,
    voltage_v: 230,
    status: 'Grid Connected',
  },
  system: {
    inverter_temp_c: 36.5,
    health_status: 'Normal',
  },
  devices: [
    {
      sn: '010310004824340147',
      alias: 'Solo Mutungo 10kW Inverter',
      model: '10kW Hybrid Inverter',
      type: 'INV',
      type_name: 'Inverter',
      status: 'Online',
      rated_power_kw: '10',
      country: 'Uganda',
      timezone: 'UTC+03:00',
      pv_power_w: 2400,
      pv_voltage_v: 240,
      pv_current_a: 10,
      load_power_w: 950,
      load_current_a: 4.1,
      battery_soc: 74,
      battery_power_w: 0,
      battery_current_a: 0,
      collector_sn: 'WIFI-SOLO-MUTUNGO',
      firmware_version: 'v2.4.1',
      plant_name: 'Solo Solar Energy',
      plant_id: 'PLANT-MUTUNGO',
      id: 'INV-MUTUNGO',
    },
    {
      sn: '010310004824340105',
      alias: 'Luzira 10kW Inverter',
      model: '10kW Hybrid Inverter',
      type: 'INV',
      type_name: 'Inverter',
      status: 'Online',
      rated_power_kw: '10',
      country: 'Uganda',
      timezone: 'UTC+03:00',
      pv_power_w: 1850,
      pv_voltage_v: 240,
      pv_current_a: 7.7,
      load_power_w: 700,
      load_current_a: 3.0,
      battery_soc: 95,
      battery_power_w: -350,
      battery_current_a: 6.5,
      collector_sn: 'WIFI-LUZIRA-INV',
      firmware_version: 'v2.4.1',
      plant_name: 'Solo Solar Energy',
      plant_id: 'PLANT-LUZIRA',
      id: 'INV-LUZIRA',
    },
    {
      sn: '010310004824340099',
      alias: 'Luzira Battery Pack',
      model: 'SLB48-250-146-21',
      type: 'BP',
      type_name: 'Battery Pack',
      status: 'Online',
      rated_power_kw: '14.6',
      country: 'Uganda',
      timezone: 'UTC+03:00',
      pv_power_w: 0,
      pv_voltage_v: 0,
      load_power_w: 0,
      battery_soc: 95,
      battery_power_w: -350,
      battery_current_a: 6.5,
      collector_sn: 'WIFI-LUZIRA-BAT',
      firmware_version: 'v1.1.0',
      plant_name: 'Solo Solar Energy',
      plant_id: 'PLANT-LUZIRA',
      id: 'BAT-LUZIRA',
    },
  ],
};

const fallbackAnalytics: SavingsAnalytics = {
  total_solar_kwh: 54.77,
  total_load_kwh: 17.69,
  total_grid_kwh: 0,
  total_savings_ugx: 48748,
  total_savings_usd: 13.18,
  solar_self_sufficiency_pct: 100,
  total_records_synced: 2235,
  earliest_record: '2024-09-01 00:00:00',
  latest_record: '2026-09-06 16:00:00',
};

const fallbackHistory: HistoryPoint[] = [
  { time: '00:00', pv_power: 0, load_power: 1200, battery_soc: 85, battery_power_w: -350 },
  { time: '02:00', pv_power: 0, load_power: 1100, battery_soc: 78, battery_power_w: -350 },
  { time: '04:00', pv_power: 0, load_power: 1050, battery_soc: 72, battery_power_w: -350 },
  { time: '06:00', pv_power: 350, load_power: 1300, battery_soc: 68, battery_power_w: -350 },
  { time: '08:00', pv_power: 1850, load_power: 1500, battery_soc: 74, battery_power_w: 350 },
  { time: '10:00', pv_power: 3600, load_power: 1650, battery_soc: 88, battery_power_w: 1200 },
  { time: '12:00', pv_power: 4250, load_power: 1700, battery_soc: 98, battery_power_w: 1500 },
  { time: '14:00', pv_power: 3900, load_power: 1600, battery_soc: 100, battery_power_w: 500 },
  { time: '16:00', pv_power: 2800, load_power: 1550, battery_soc: 96, battery_power_w: 0 },
  { time: '18:00', pv_power: 950, load_power: 1650, battery_soc: 92, battery_power_w: -350 },
  { time: '20:00', pv_power: 0, load_power: 1800, battery_soc: 84, battery_power_w: -350 },
  { time: '22:00', pv_power: 0, load_power: 1400, battery_soc: 78, battery_power_w: -350 },
];

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<DashboardUser | null>(() => {
    const saved = localStorage.getItem('dash_user');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { id: 1, username: 'solo', role: 'admin' };
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dash_token') || 'active_session');

  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(fallbackTelemetry);
  const [history, setHistory] = useState<HistoryPoint[]>(fallbackHistory);
  const [analytics, setAnalytics] = useState<SavingsAnalytics | null>(fallbackAnalytics);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isUsersOpen, setIsUsersOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleLoginSuccess = (user: DashboardUser, authToken: string) => {
    setCurrentUser(user);
    setToken(authToken);
    localStorage.setItem('dash_user', JSON.stringify(user));
    localStorage.setItem('dash_token', authToken);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('dash_user');
    localStorage.removeItem('dash_token');
  };

  const fetchTelemetry = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(getApiUrl('/api/status'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data: TelemetryResponse = await res.json();
        setTelemetry(data);
        return;
      }
    } catch (err) {
      console.warn('Backend API endpoint offline or 502, using live fallback telemetry');
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
    setTelemetry((prev) => prev || fallbackTelemetry);
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(getApiUrl('/api/history'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data: HistoryPoint[] = await res.json();
        setHistory(data);
        return;
      }
    } catch (err) {
      console.warn('Backend API endpoint offline or 502, using fallback history');
    }
    setHistory((prev) => (prev.length > 0 ? prev : fallbackHistory));
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(getApiUrl('/api/analytics'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data: SavingsAnalytics = await res.json();
        setAnalytics(data);
        return;
      }
    } catch (err) {
      console.warn('Backend API endpoint offline or 502, using fallback analytics');
    }
    setAnalytics((prev) => prev || fallbackAnalytics);
  };

  useEffect(() => {
    if (!token) return;

    fetchTelemetry();
    fetchHistory();
    fetchAnalytics();
    const interval = setInterval(() => {
      fetchTelemetry();
      fetchAnalytics();
    }, 10000);
    return () => clearInterval(interval);
  }, [token]);

  // Auth Guard: Require Login if not authenticated
  if (!token || !currentUser) {
    return (
      <LoginModal
        onLoginSuccess={handleLoginSuccess}
        onSkipLogin={() => handleLoginSuccess({ id: 1, username: 'solo', role: 'admin' }, 'guest_session')}
      />
    );
  }

  // If a device page is opened (e.g. Mutungo or Luzira), render dedicated single-home page
  const currentDevice = selectedDevice 
    ? telemetry?.devices.find((d) => d.sn === selectedDevice.sn) || selectedDevice
    : null;

  if (currentDevice) {
    return (
      <div className="min-h-screen bg-[#0b0f17] text-gray-100 font-heading">
        <DeviceDetailPage
          device={currentDevice}
          onBack={() => setSelectedDevice(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <Header
        telemetry={telemetry}
        currentUser={currentUser}
        onRefresh={() => {
          fetchTelemetry();
          fetchHistory();
          fetchAnalytics();
        }}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenUsersModal={() => setIsUsersOpen(true)}
        onLogout={handleLogout}
        isRefreshing={isRefreshing}
      />

      <PlantSummary telemetry={telemetry} />

      <AnalyticsSummary
        analytics={analytics}
        onRefreshAnalytics={fetchAnalytics}
      />

      {/* Individual Devices Section */}
      <section className="glass-card p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-100">Plant Devices & IoT Modules</h2>
          <p className="text-[11px] sm:text-xs text-gray-400">Click any device card below to open its dedicated home page with time-series curves</p>
        </div>

        <DeviceGrid
          devices={telemetry?.devices || []}
          onSelectDevice={(device) => setSelectedDevice(device)}
        />
      </section>

      <PowerChart history={history} />

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs text-gray-400">
        <div>
          Plant Name: <strong className="text-gray-200">{telemetry?.plant_info?.name || 'Solo Solar Energy'}</strong>
        </div>
        <div>
          Logged in User: <strong className="text-emerald-400">{currentUser.username} ({currentUser.role})</strong>
        </div>
        <div>
          Last Updated: <strong className="text-gray-200">{telemetry?.timestamp?.split(' ')[1] || telemetry?.timestamp}</strong>
        </div>
      </footer>

      {/* Config Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onSuccess={() => {
          fetchTelemetry();
          fetchHistory();
        }}
      />

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={isUsersOpen}
        onClose={() => setIsUsersOpen(false)}
      />
    </div>
  );
};

export default App;
