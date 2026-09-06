import React, { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Users, Shield, User } from 'lucide-react';
import { DashboardUser } from '../types';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'viewer'>('viewer');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/users');
      const data: DashboardUser[] = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;

    try {
      setMsg('Creating user...');
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg(`User "${newUsername}" created successfully!`);
        setNewUsername('');
        setNewPassword('');
        fetchUsers();
      } else {
        setMsg(data.message || 'Failed to create user');
      }
    } catch (err) {
      setMsg('Error creating user account');
    } finally {
      setTimeout(() => setMsg(null), 4000);
    }
  };

  const handleDeleteUser = async (id: number, uname: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${uname}"?`)) return;

    try {
      const res = await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMsg(`User "${uname}" removed.`);
        fetchUsers();
      }
    } catch (err) {
      console.error('Delete user error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0f172a] border border-slate-700/60 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-gray-100 p-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100">Multi-User Account Management</h2>
              <p className="text-xs text-gray-400">Create & Manage Local Dashboard Login Accounts</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {msg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
            {msg}
          </div>
        )}

        {/* Add User Form */}
        <form onSubmit={handleAddUser} className="glass-card p-4 space-y-3">
          <h3 className="text-xs font-bold text-gray-200 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Create New User Account</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as 'admin' | 'viewer')}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="viewer">Viewer (Read Only)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
          >
            Add Account
          </button>
        </form>

        {/* User Accounts List */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-300">Registered Accounts ({users.length})</h3>

          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/50">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/80 text-gray-400 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-bold text-gray-100 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>{u.username}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'admin' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-800 text-gray-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {u.username !== 'admin' && u.username !== 'solo' && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
