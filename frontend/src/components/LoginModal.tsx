import React, { useState } from 'react';
import { Lock, User, Sun, KeyRound, AlertCircle, ShieldCheck } from 'lucide-react';
import { DashboardUser } from '../types';
import { getApiUrl } from '../apiConfig';

interface LoginModalProps {
  onLoginSuccess: (user: DashboardUser, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.message || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Failed to connect to dashboard authentication server');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0b0f17]/90 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-700/60 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden text-gray-100 p-8 space-y-6">
        
        {/* Logo & Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 p-0.5 mx-auto shadow-lg shadow-amber-500/20">
            <div className="w-full h-full bg-[#0b0f17] rounded-[14px] flex items-center justify-center">
              <Sun className="w-8 h-8 text-amber-400 animate-pulse" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-100 tracking-tight">
            Felicity Solar Dashboard
          </h1>
          <p className="text-xs text-gray-400">
            Multi-User Dashboard Access & Energy Analytics Engine
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
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
        </form>

        {/* Quick Demo Credentials */}
        <div className="pt-4 border-t border-slate-800 space-y-2 text-[11px] text-gray-400">
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

      </div>
    </div>
  );
};
