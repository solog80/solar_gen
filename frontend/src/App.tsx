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

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<DashboardUser | null>(() => {
    const saved = localStorage.getItem('dash_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dash_token'));

  const [telemetry, setTelemetry] = useState<TelemetryResponse | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [analytics, setAnalytics] = useState<SavingsAnalytics | null>(null);
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
      const data: TelemetryResponse = await res.json();
      setTelemetry(data);
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(getApiUrl('/api/history'));
      const data: HistoryPoint[] = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(getApiUrl('/api/analytics'));
      const data: SavingsAnalytics = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
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
    return <LoginModal onLoginSuccess={handleLoginSuccess} />;
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
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
      <section className="glass-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-100">Plant Devices & IoT Modules</h2>
          <p className="text-xs text-gray-400">Click any device card below to open its dedicated home page with time-series curves</p>
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
