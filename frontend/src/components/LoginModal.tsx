import React, { useState } from 'react';
import { Lock, User, Sun, KeyRound, AlertCircle, ShieldCheck, Settings, Server, Check } from 'lucide-react';
import { DashboardUser } from '../types';
import { getApiUrl, getApiBaseUrl, setApiBaseUrl } from '../apiConfig';

interface LoginModalProps {
  onLoginSuccess: (user: DashboardUser, token: string) => void;
  onSkipLogin?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onSkipLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // API Server URL settings state
  const [serverUrlInput, setServerUrlInput] = useState(() => getApiBaseUrl());
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [serverSavedMsg, setServerSavedMsg] = useState<string | null>(null);

  const handleSaveServerUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setApiBaseUrl(serverUrlInput);
    setServerSavedMsg('Backend API Server URL saved!');
    setTimeout(() => setServerSavedMsg(null), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const targetUrl = getApiUrl('/api/auth/login');
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setError(`Server returned non-JSON response (${res.status}). Ensure backend API URL is configured under Settings below.`);
        setShowServerSettings(true);
        return;
      }

      const data = await res.json();

      if (res.ok && data.success) {
        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(`Failed to connect to backend server. ${err?.message || ''}`);
      setShowServerSettings(true);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0b0f17]/90 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-700/60 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-gray-100 p-6 sm:p-8 space-y-5 my-auto">
        
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 p-0.5 mx-auto shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#0b0f17] rounded-[14px] flex items-center justify-center">
              <Sun className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 animate-pulse" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-gray-100 tracking-tight">
            Felicity Solar Dashboard
          </h1>
          <p className="text-xs text-gray-400">
            Multi-User Dashboard Access & Energy Analytics Engine
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Authentication Connection Failed</span>
            </div>
            <p className="pl-6 text-[11px] text-red-300/90 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-300">Username</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. solo or admin"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-300">Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Sign In to Dashboard</span>
              </>
            )}
          </button>

          {onSkipLogin && (
            <button
              type="button"
              onClick={onSkipLogin}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-gray-300 font-semibold text-xs transition flex items-center justify-center gap-2"
            >
              <span>Skip Login & Enter Dashboard</span>
            </button>
          )}
        </form>

        {/* Quick Demo Credentials */}
        <div className="pt-3 border-t border-slate-800 space-y-2 text-[11px] text-gray-400">
          <div className="font-semibold text-gray-300 flex items-center justify-between">
            <span>Quick Login Accounts:</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
            <button
              onClick={() => handleQuickFill('solo', 'solo2026')}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-emerald-300 text-center transition"
            >
              <div className="font-bold">solo</div>
              <div className="text-gray-400 text-[9px]">Admin</div>
            </button>

            <button
              onClick={() => handleQuickFill('admin', 'admin123')}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-cyan-300 text-center transition"
            >
              <div className="font-bold">admin</div>
              <div className="text-gray-400 text-[9px]">Admin</div>
            </button>

            <button
              onClick={() => handleQuickFill('viewer', 'viewer123')}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 text-purple-300 text-center transition"
            >
              <div className="font-bold">viewer</div>
              <div className="text-gray-400 text-[9px]">Viewer</div>
            </button>
          </div>
        </div>

        {/* Collapsible Backend API Server URL Settings */}
        <div className="pt-3 border-t border-slate-800">
          <button
            onClick={() => setShowServerSettings(!showServerSettings)}
            className="flex items-center justify-between w-full text-xs font-semibold text-gray-400 hover:text-gray-200 transition"
          >
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span>Backend API Server Settings</span>
            </span>
            <Settings className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {showServerSettings && (
            <form onSubmit={handleSaveServerUrl} className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 animate-fade-in">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                  Go Backend API Server URL
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="https://solar-analytics.solofx.net"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2 px-3 text-xs text-blue-300 font-mono placeholder-gray-600 focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Enter your Cloudflare Tunnel URL or public Go server URL if connecting remotely outside local network.
                </p>
              </div>

              {serverSavedMsg && (
                <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>{serverSavedMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-1.5 px-3 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-semibold text-xs transition"
              >
                Save Backend API URL
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
};
