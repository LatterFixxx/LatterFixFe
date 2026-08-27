import React, { useEffect, useState, useRef } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  FreighterModule,
  xBullModule,
  LobstrModule,
} from '@creit.tech/stellar-wallets-kit';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../hooks/useNotification';
import { WalletContext } from '../hooks/useWallet';
import { useNetwork } from '../hooks/useNetwork';

const LAST_WALLET_STORAGE_KEY = 'payd:last_wallet_name';

function hasAnyWalletExtension(): boolean {
  if (typeof window === 'undefined') return true;
  const extendedWindow = window as Window &
    typeof globalThis & {
      freighterApi?: unknown;
      xBullSDK?: unknown;
      lobstr?: unknown;
    };

  return Boolean(extendedWindow.freighterApi || extendedWindow.xBullSDK || extendedWindow.lobstr);
}

function showWalletExtensionWarning(notify: (message: string) => void) {
  notify(
    'Wallet extension not detected. Install Freighter, xBull, or Lobstr to sign transactions.'
  );
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletExtensionAvailable, setWalletExtensionAvailable] = useState(true);
  const [extensionWarningShown, setExtensionWarningShown] = useState(false);
  const kitRef = useRef<StellarWalletsKit | null>(null);
  const isFirstNetworkRun = useRef(true);
  const { t } = useTranslation();
  const { notify, notifySuccess, notifyError } = useNotification();
  const { network } = useNetwork();

  useEffect(() => {
    const available = hasAnyWalletExtension();
    setWalletExtensionAvailable(available);

    if (!available && !extensionWarningShown) {
      showWalletExtensionWarning(notify);
      setExtensionWarningShown(true);
    }

    const newKit = new StellarWalletsKit({
      network: network === 'mainnet' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule()],
    });
    kitRef.current = newKit;

    if (!isFirstNetworkRun.current) {
      setAddress(null);
      setIsConnecting(false);
      setIsInitialized(true);
      notify(
        `Wallet reset — reconnect to continue on ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}.`
      );
      return;
    }
    isFirstNetworkRun.current = false;

    const attemptSilentReconnect = async () => {
      const lastWalletName = localStorage.getItem(LAST_WALLET_STORAGE_KEY);
      if (!lastWalletName) {
        setIsInitialized(true);
        return;
      }

      setIsConnecting(true);

      try {
        try {
          newKit.setWallet(lastWalletName);
        } catch {
          try {
            localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
          } catch {
            // best-effort
          }
          setWalletName(null);
          return;
        }
        setWalletName(lastWalletName);
        const account = await newKit.getAddress();
        if (account?.address) {
          setAddress(account.address);
          notifySuccess(
            'Wallet reconnected',
            `${account.address.slice(0, 6)}...${account.address.slice(-4)} via ${lastWalletName}`
          );
        }
      } catch {
        // Silent reconnection should not block app flow.
      } finally {
        setIsConnecting(false);
        setIsInitialized(true);
      }
    };

    void attemptSilentReconnect();
  }, [network, notify, notifySuccess, extensionWarningShown]);

  const connect = async (walletId?: unknown): Promise<string | null> => {
    const kit = kitRef.current;
    if (!kit) return null;

    setIsConnecting(true);
    try {
      if (typeof walletId === 'string' && walletId) {
        try {
          kit.setWallet(walletId);
          const { address } = await kit.getAddress();
          setAddress(address);
          setWalletName(walletId);
          try {
            localStorage.setItem(LAST_WALLET_STORAGE_KEY, walletId);
          } catch {
            // persistence is best-effort — connection still succeeds
          }
          notifySuccess(
            'Wallet connected',
            `${address.slice(0, 6)}...${address.slice(-4)} via ${walletId}`
          );
          setIsConnecting(false);
          return address;
        } catch (error) {
          notifyError(
            'Wallet connection failed',
            error instanceof Error ? error.message : 'Please try again.'
          );
          setIsConnecting(false);
          return null;
        }
      }

      const selectedAddress = await new Promise<string | null>((resolve) => {
        void kit.openModal({
          modalTitle: t('wallet.modalTitle'),
          onWalletSelected: (option) => {
            void (async () => {
              try {
                kit.setWallet(option.id);
                const { address } = await kit.getAddress();
                setAddress(address);
                setWalletName(option.id);
                try {
                  localStorage.setItem(LAST_WALLET_STORAGE_KEY, option.id);
                } catch {
                  // persistence is best-effort — connection still succeeds
                }
                notifySuccess(
                  'Wallet connected',
                  `${address.slice(0, 6)}...${address.slice(-4)} via ${option.id}`
                );
                resolve(address);
              } catch (error) {
                notifyError(
                  'Wallet connection failed',
                  error instanceof Error ? error.message : 'Please try again.'
                );
                resolve(null);
              }
            })();
          },
          onClosed: () => {
            setIsConnecting(false);
            resolve(null);
          },
        });
      });

      return selectedAddress;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      notifyError(
        'Wallet connection failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
      setIsConnecting(false);
      return null;
    }
  };

  const requireWallet = async (): Promise<string | null> => {
    if (address) return address;
    notifyError('Wallet required', 'Connect your wallet to continue with this contract action.');
    return connect();
  };

  const disconnect = () => {
    setAddress(null);
    setWalletName(null);
    localStorage.removeItem(LAST_WALLET_STORAGE_KEY);
    notify('Wallet disconnected');
  };

  const signTransaction = async (xdr: string) => {
    const kit = kitRef.current;
    if (!kit) throw new Error('Wallet kit not initialized');
    const result = await kit.signTransaction(xdr);
    return result.signedTxXdr;
  };

  return (
    <>
      <WalletContext
        value={{
          address,
          walletName,
          isConnecting,
          isInitialized,
          walletExtensionAvailable,
          connect,
          requireWallet,
          disconnect,
          signTransaction,
        }}
      >
        {isInitialized ? (
          children
        ) : (
          <div className="w-full px-4 py-3 text-xs text-zinc-400">Restoring wallet session...</div>
        )}
      </WalletContext>
    </>
  );
};
