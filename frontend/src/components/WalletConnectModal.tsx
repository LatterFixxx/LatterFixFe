import React from 'react';
import { useWallet } from '../hooks/useWallet';

interface WalletConnectModalProps {
  open: boolean;
  onClose: () => void;
}

function hasFreighter(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { freighterApi?: unknown }).freighterApi);
}

function hasLobstr(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as unknown as { lobstr?: unknown }).lobstr);
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ open, onClose }) => {
  const { connect, isConnecting } = useWallet();

  if (!open) return null;

  const handleSelect = async (walletId: string) => {
    const addr = await connect(walletId);
    if (addr) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Select Wallet</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        <p className="mb-5 text-xs text-zinc-400">
          Choose a Stellar wallet to connect. Session persists across reloads.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => void handleSelect('freighter')}
            disabled={isConnecting}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            <span>Freighter</span>
            <span className="text-[10px] font-mono text-zinc-400">
              {hasFreighter() ? 'Available' : 'Install'}
            </span>
          </button>

          <button
            onClick={() => void handleSelect('lobstr')}
            disabled={isConnecting}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            <span>LOBSTR</span>
            <span className="text-[10px] font-mono text-zinc-400">
              {hasLobstr() ? 'Available' : 'Install'}
            </span>
          </button>
        </div>

        {isConnecting && <p className="mt-4 text-center text-xs text-zinc-400">Connecting...</p>}
      </div>
    </div>
  );
};
