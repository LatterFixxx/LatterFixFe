import React, { useState } from 'react';
import { useWallet } from '../hooks/useWallet';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WalletConnectModal } from './WalletConnectModal';

const ConnectAccount: React.FC = () => {
  const { address, disconnect, isConnecting } = useWallet();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const token = localStorage.getItem('payd_auth_token');

  const handleSocialLogout = () => {
    localStorage.removeItem('payd_auth_token');
    window.location.reload();
  };

  if (address || token) {
    return (
      <div className="flex items-center gap-4">
        {token && (
          <div className="hidden sm:flex flex-col items-end px-3 py-1.5 glass rounded-lg border-hi/5">
            <span className="text-[9px] uppercase tracking-tighter text-accent font-black leading-none mb-1 opacity-70">
              Social Active
            </span>
            <span className="text-[11px] text-white/90 font-bold leading-none">Session Active</span>
          </div>
        )}
        {address && (
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-muted font-mono leading-none mb-1">
              Stellar
            </span>
            <span className="text-xs text-accent font-mono leading-none">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            if (address) void disconnect();
            if (token) handleSocialLogout();
          }}
          className="px-4 py-2 glass border-hi text-[10px] font-black rounded-lg hover:bg-danger/10 hover:border-danger/30 hover:text-danger transition-all uppercase tracking-widest"
        >
          Exit
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => {
          void navigate('/login');
        }}
        className="px-4 py-2.5 glass border-hi text-white font-bold rounded-xl hover:bg-white/5 transition-all text-xs uppercase tracking-wider"
      >
        Sign In
      </button>
      <button
        id="tour-connect"
        onClick={() => setShowModal(true)}
        disabled={isConnecting}
        className="px-6 py-2.5 bg-accent text-bg font-bold rounded-xl hover:scale-105 transition-transform shadow-lg shadow-accent/20 text-[11px] uppercase tracking-widest disabled:opacity-50"
      >
        {isConnecting ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-bg/30 border-t-bg rounded-full animate-spin" />
            {t('connectAccount.connecting') || 'Connecting...'}
          </span>
        ) : (
          <>
            {t('connectAccount.connect') || 'Connect'}{' '}
            <span className="hidden sm:inline">{t('connectAccount.wallet') || 'Wallet'}</span>
          </>
        )}
      </button>
      <WalletConnectModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
};

export default ConnectAccount;
