import React, { useEffect, useState } from 'react';
import { ExternalLink, Star, CheckCircle, Loader2, User, Zap, Award, Camera } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useHorizonAccount } from '../hooks/useHorizonAccount';
import { getExplorerUrl } from '../services/stellar';
import {
  queryGetProfile,
  queryGetUserReputation,
  queryGetUserTier,
  type SorobanUserProfile,
} from '../services/sorobanTaskContract';
import { useTaskStore } from '../services/taskStore';
import { Avatar } from '../components/Avatar';
import { resizeImage } from '../utils/imageOptimization';

export default function Profile() {
  const { address, connect } = useWallet();
  const { balances, isLoading: balancesLoading, accountExists } = useHorizonAccount(address);
  const { currentUser, updateProfile } = useTaskStore();

  const [onChainProfile, setOnChainProfile] = useState<SorobanUserProfile | null>(null);
  const [reputation, setReputation] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!address) return;
    setLoading(true);
    Promise.all([
      queryGetProfile(address).catch(() => null),
      queryGetUserReputation(address).catch(() => null),
      queryGetUserTier(address).catch(() => null),
    ]).then(([profile, rep, userTier]) => {
      setOnChainProfile(profile);
      setReputation(rep);
      setTier(userTier);
      setLoading(false);
    });
  }, [address]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      const resizedBlob = await resizeImage(file, 400, 400);
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        updateProfile(currentUser.username, currentUser.address, currentUser.role, dataUrl, currentUser.email);
        setUploadingAvatar(false);
      };
      reader.onerror = () => {
        setAvatarError('Failed to read image file');
        setUploadingAvatar(false);
      };
      reader.readAsDataURL(resizedBlob);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    updateProfile(currentUser.username, currentUser.address, currentUser.role, '', currentUser.email);
  };

  const tierColor = (t: string) => {
    const map: Record<string, string> = {
      Legend: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
      Master: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      Expert: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      Contributor: 'text-green-400 bg-green-500/10 border-green-500/20',
      Newcomer: 'text-muted bg-white/5 border-white/10',
    };
    return map[t] ?? 'text-muted bg-white/5 border-white/10';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight">On-chain Profile</h1>
        <p className="text-xs text-muted mt-1">
          Calls <code className="text-accent">get_profile()</code>,{' '}
          <code className="text-accent">get_user_reputation()</code>, and{' '}
          <code className="text-accent">get_user_tier()</code> on the Soroban contract.
        </p>
      </div>

      {/* Wallet not connected */}
      {!address && (
        <div className="card glass noise p-10 flex flex-col items-center gap-4 text-center">
          <User className="w-12 h-12 text-muted/30" />
          <div>
            <p className="text-base font-bold text-white">Connect Your Wallet</p>
            <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
              Connect Freighter, xBull, or Lobstr to view your live on-chain reputation, balances,
              and task history.
            </p>
          </div>
          <button
            onClick={connect}
            className="flex items-center gap-2 px-6 py-3 bg-accent text-bg font-extrabold rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-accent/20"
          >
            <Zap className="w-4 h-4" /> Connect Wallet
          </button>
        </div>
      )}

      {/* Connected view */}
      {address && (
        <>
          {/* Address card */}
          <div className="card glass noise p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className="relative shrink-0">
              <Avatar
                email={currentUser.email || `${currentUser.username}@latterfix.app`}
                name={currentUser.username}
                imageUrl={currentUser.avatarUrl}
                size="lg"
                gravatarSize={400}
              />
              {/* Upload overlay */}
              {uploadingAvatar ? (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent border-2 border-[var(--bg)] flex items-center justify-center hover:scale-110 transition-transform"
                  title="Upload avatar"
                >
                  <Camera className="w-3.5 h-3.5 text-black" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
              {currentUser.avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-[var(--bg)] flex items-center justify-center hover:scale-110 transition-transform text-[10px] font-bold text-white"
                  title="Remove avatar"
                >
                  ✕
                </button>
              )}
            </div>
            {avatarError && (
              <p className="text-red-400 text-xs">{avatarError}</p>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xl font-black text-white">
                {onChainProfile?.username ?? currentUser.username}
              </p>
              <a
                href={getExplorerUrl('account', address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-accent hover:underline flex items-center gap-1 mt-1"
              >
                {address} <ExternalLink className="w-3 h-3" />
              </a>
              {onChainProfile?.bio && (
                <p className="text-xs text-muted mt-2">{onChainProfile.bio}</p>
              )}
            </div>
            {tier && (
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full border ${tierColor(tier)}`}
              >
                <Award className="w-3.5 h-3.5 inline mr-1" />
                {tier}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Reputation',
                value: loading
                  ? '...'
                  : reputation !== null
                    ? String(reputation)
                    : String(currentUser.reputation),
                sub: 'On-chain points',
                color: 'text-accent',
                icon: <Star className="w-4 h-4 text-accent" />,
              },
              {
                label: 'Tasks Completed',
                value: loading
                  ? '...'
                  : onChainProfile?.completedTasks !== undefined
                    ? String(onChainProfile.completedTasks)
                    : '0',
                sub: 'Soroban contract',
                color: 'text-green-400',
                icon: <CheckCircle className="w-4 h-4 text-green-400" />,
              },
              {
                label: 'XLM Balance',
                value: balancesLoading ? '...' : `${parseFloat(balances.XLM).toFixed(4)}`,
                sub: accountExists ? 'Horizon (live)' : 'Account unfunded',
                color: 'text-white',
                icon: <Zap className="w-4 h-4 text-yellow-400" />,
              },
              {
                label: 'USDC Balance',
                value: balancesLoading ? '...' : `${parseFloat(balances.USDC).toFixed(4)}`,
                sub: 'SEP-24 token',
                color: 'text-white',
                icon: <Zap className="w-4 h-4 text-blue-400" />,
              },
            ].map((stat) => (
              <div key={stat.label} className="card glass noise p-5 space-y-2">
                <div className="flex items-center justify-between">
                  {stat.icon}
                  {loading && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
                </div>
                <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className="text-[9px] text-white/30">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Token balances */}
          <div className="card glass noise p-6 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">
              Wallet Balances{' '}
              <span className="text-[10px] font-normal text-muted ml-2">from Stellar Horizon</span>
            </h3>
            <div className="space-y-3">
              {[
                { token: 'XLM', balance: balances.XLM, sub: 'Stellar Lumens (native)' },
                { token: 'USDC', balance: balances.USDC, sub: 'Circle USD Coin (SEP-24)' },
                { token: 'EURC', balance: balances.EURC, sub: 'Circle Euro Coin (SEP-24)' },
              ].map(({ token, balance, sub }) => (
                <div
                  key={token}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-white">{token}</p>
                    <p className="text-[10px] text-muted">{sub}</p>
                  </div>
                  <p className="text-lg font-black text-white">
                    {balancesLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                    ) : (
                      parseFloat(balance).toFixed(4)
                    )}
                  </p>
                </div>
              ))}
            </div>
            {!accountExists && !balancesLoading && (
              <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
                ⚠ Account not yet funded on Stellar Testnet.{' '}
                <a
                  href={`https://friendbot.stellar.org?addr=${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-yellow-300"
                >
                  Fund via Friendbot ↗
                </a>
              </p>
            )}
          </div>

          {/* On-chain profile data */}
          {onChainProfile && (
            <div className="card glass noise p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">
                Contract Storage{' '}
                <span className="text-[10px] font-normal text-muted ml-2">
                  get_profile() result
                </span>
              </h3>
              <pre className="bg-black/40 border border-white/5 text-[11px] font-mono p-4 rounded-xl text-accent overflow-x-auto">
                {JSON.stringify(onChainProfile, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
