import React, { useState, useEffect } from 'react';
import {
  Coins,
  Award,
  CheckCircle,
  Save,
  Zap,
  ExternalLink,
  Wifi,
  Loader2,
  Copy,
  Info,
  Compass,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../services/taskStore';
import { useWallet } from '../hooks/useWallet';
import { useHorizonAccount } from '../hooks/useHorizonAccount';
import { getExplorerUrl } from '../services/stellar';
import {
  queryGetProfile,
  queryGetUserTier,
  type SorobanUserProfile,
} from '../services/sorobanTaskContract';

export default function Settings() {
  const { currentUser, updateProfile, restartOnboarding } = useTaskStore();
  const { address, connect, disconnect, isConnecting } = useWallet();
  const navigate = useNavigate();
  const { balances, isLoading: balancesLoading, accountExists } = useHorizonAccount(address);

  const [username, setUsername] = useState(currentUser.username);
  const [role, setRole] = useState(currentUser.role);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const [onChainProfile, setOnChainProfile] = useState<SorobanUserProfile | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Load on-chain profile when wallet connects
  useEffect(() => {
    if (!address) {
      setOnChainProfile(null);
      setTier(null);
      return;
    }
    setProfileLoading(true);
    Promise.all([
      queryGetProfile(address).catch(() => null),
      queryGetUserTier(address).catch(() => null),
    ]).then(([profile, userTier]) => {
      setOnChainProfile(profile);
      setTier(userTier);
      setProfileLoading(false);
    });
  }, [address]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(username, address ?? currentUser.address, role);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tierColor = (t: string) => {
    const map: Record<string, string> = {
      Legend: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
      Master: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      Expert: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      Contributor: 'text-green-400 border-green-500/30 bg-green-500/10',
      Newcomer: 'text-muted border-white/10 bg-white/5',
    };
    return map[t] ?? 'text-muted border-white/10 bg-white/5';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Settings &amp; Profile</h1>
          <p className="text-xs text-muted mt-1">
            Manage your Stellar wallet, on-chain reputation tier, and platform identity.
          </p>
        </div>
        {/* Wallet toggle */}
        {address ? (
          <button
            onClick={disconnect}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold hover:bg-red-500/20 transition"
          >
            Disconnect Wallet
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-bg font-bold rounded-xl text-xs hover:scale-105 transition-transform disabled:opacity-50"
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Stats & Wallet */}
        <div className="lg:col-span-1 space-y-6">
          {/* Reputation card */}
          <div className="card glass noise p-6 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-linear-to-tr from-accent to-accent2 mx-auto flex items-center justify-center font-black text-2xl text-bg">
              {(onChainProfile?.username ?? currentUser.username).substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">
                {onChainProfile?.username ?? currentUser.username}
              </h3>
              {tier && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 inline-block ${tierColor(tier)}`}
                >
                  <Award className="w-3 h-3 inline mr-1" />
                  {tier}
                </span>
              )}
              {profileLoading && (
                <Loader2 className="w-4 h-4 text-accent animate-spin mx-auto mt-2" />
              )}
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-accent" /> Reputation
                </span>
                <span className="font-bold text-white">
                  {onChainProfile?.reputation ?? currentUser.reputation}
                </span>
              </div>
              <div className="w-full h-2 bg-black/35 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-linear-to-r from-accent2 to-accent transition-all duration-500"
                  style={{
                    width: `${Math.min(onChainProfile?.reputation ?? currentUser.reputation, 100)}%`,
                  }}
                />
              </div>
              <p className="text-[9px] text-muted leading-relaxed text-left">
                Earned via <code>reward_contribution()</code> on-chain. Completing tasks increases
                your tier (Newcomer → Legend).
              </p>
            </div>
          </div>

          {/* Wallet balances */}
          <div className="card glass noise p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-green-400" /> Live Balances
              </p>
              <span className="text-[9px] text-muted">Horizon</span>
            </div>
            {address ? (
              <>
                {[
                  { label: 'XLM', value: balances.XLM },
                  { label: 'USDC', value: balances.USDC },
                  { label: 'EURC', value: balances.EURC },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between text-xs">
                    <span className="text-muted">{label}</span>
                    <span className="font-black text-white">
                      {balancesLoading ? '...' : parseFloat(value).toFixed(4)}
                    </span>
                  </div>
                ))}
                {!accountExists && !balancesLoading && (
                  <a
                    href={`https://friendbot.stellar.org?addr=${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-yellow-400 hover:underline mt-1"
                  >
                    ⚠ Account unfunded — Fund via Friendbot ↗
                  </a>
                )}
              </>
            ) : (
              <p className="text-xs text-muted italic">Connect wallet to see live balances.</p>
            )}
          </div>

          {/* Earnings */}
          <div className="card glass noise p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-muted mb-1">
                Total Earnings
              </p>
              <h4 className="text-2xl font-black text-accent">
                {currentUser.earnings.toLocaleString()}{' '}
                <span className="text-xs font-normal text-muted">USDC</span>
              </h4>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Coins className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Right: Edit profile */}
        <div className="lg:col-span-2 space-y-6">
          {/* Connected wallet panel */}
          {address && (
            <div className="card glass noise p-5 space-y-3">
              <p className="text-xs font-bold text-white border-b border-white/5 pb-2">
                Connected Stellar Address
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] font-mono text-accent bg-black/30 border border-white/5 rounded-lg px-3 py-2 truncate">
                  {address}
                </code>
                <button
                  onClick={copyAddress}
                  title="Copy address"
                  className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition text-muted"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <a
                  href={getExplorerUrl('account', address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 transition text-accent"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {copied && <p className="text-[10px] text-green-400">✓ Copied to clipboard</p>}
            </div>
          )}

          <form onSubmit={handleSubmit} className="card glass noise p-8 space-y-6">
            <h3 className="text-lg font-bold text-white border-b border-white/5 pb-3">
              Identity Settings
            </h3>

            {saveSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-2 text-xs text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Profile saved. Call <code>update_profile()</code> on-chain to persist permanently.
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Public Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username..."
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40"
                />
                <p className="text-[10px] text-muted flex items-center gap-1">
                  <Info className="w-3 h-3" /> Stored on-chain in <code>UserProfile.username</code>{' '}
                  via <code>create_profile()</code>.
                </p>
              </div>

              {!address && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                    Stellar Wallet Address (manual)
                  </label>
                  <input
                    type="text"
                    value={currentUser.address}
                    onChange={(e) => updateProfile(username, e.target.value, role)}
                    placeholder="G..."
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white font-mono focus:outline-none focus:border-accent/40"
                  />
                  <p className="text-[10px] text-muted">Or connect a wallet above to auto-fill.</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-muted">
                  Platform Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-accent/40"
                >
                  <option value="Contributor" className="bg-slate-900 text-white">
                    Contributor (Work &amp; Earn)
                  </option>
                  <option value="Creator" className="bg-slate-900 text-white">
                    Creator (Hire &amp; Fund)
                  </option>
                  <option value="Admin" className="bg-slate-900 text-white">
                    Admin (Governance &amp; Arbitration)
                  </option>
                </select>
                <p className="text-[10px] text-muted">
                  Roles switch dashboard workflows instantly. Toggle also available in the navbar.
                </p>
              </div>
            </div>

            <div className="border-t border-white/5 pt-6 flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted">⚡ Stellar Soroban · Testnet</span>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-accent text-bg font-extrabold rounded-xl hover:scale-102 transition-transform shadow-lg shadow-accent/20"
              >
                <Save className="w-4 h-4" /> Save Profile
              </button>
            </div>
          </form>
        </div>
      </div>

      {currentUser.role === 'Admin' && (
        <div className="card glass noise p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20 text-accent shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Onboarding Tour</p>
              <p className="text-xs text-muted">
                Replay the guided tour of organization setup, employees, and payroll funding.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              restartOnboarding();
              navigate('/dashboard');
            }}
            className="px-4 py-2.5 glass border-hi text-white font-bold rounded-xl hover:bg-white/5 transition-all text-xs uppercase tracking-wider shrink-0"
          >
            Restart Tour
          </button>
        </div>
      )}
    </div>
  );
}
