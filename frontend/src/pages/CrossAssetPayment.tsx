import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRightLeft, ShieldCheck, Zap, AlertCircle, Loader2 } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { useNotification } from '../hooks/useNotification';
import { useSocket } from '../hooks/useSocket';
import { getContractId } from '../services/sorobanTaskContract';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { parseContractError, type ContractErrorDetail } from '../utils/contractErrorParser';
import {
  fetchConversionPaths,
  submitCrossAssetPayment,
  type ConversionPath,
  type PathfindRequest,
} from '../services/crossAssetPayment';

const ASSET_OPTIONS = ['USDC', 'NGN', 'BRL', 'XLM', 'EURC'];

export default function CrossAssetPayment() {
  const { address, signTransaction } = useWallet();
  const { notifySuccess, notifyError } = useNotification();
  const { subscribeToTransaction } = useSocket();

  const [fromAsset, setFromAsset] = useState('USDC');
  const [toAsset, setToAsset] = useState('NGN');
  const [amountStr, setAmountStr] = useState('');
  const [receiver, setReceiver] = useState('');

  const [paths, setPaths] = useState<ConversionPath[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [isPathfinding, setIsPathfinding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<{ id: string; status: string } | null>(null);
  const [contractError, setContractError] = useState<ContractErrorDetail | null>(null);

  const amount = parseFloat(amountStr);

  const performPathfinding = useCallback(
    async (req: PathfindRequest) => {
      setIsPathfinding(true);
      try {
        const availablePaths = await fetchConversionPaths(req);
        setPaths(availablePaths);
        if (availablePaths.length > 0) {
          setSelectedPathId(availablePaths[0].id);
        } else {
          setSelectedPathId(null);
        }
      } catch (err) {
        console.error(err);
        notifyError('Failed to fetch conversion paths.');
      } finally {
        setIsPathfinding(false);
      }
    },
    [notifyError]
  );

  useEffect(() => {
    if (!amount || amount <= 0 || !fromAsset || !toAsset) {
      queueMicrotask(() => {
        setPaths([]);
        setSelectedPathId(null);
      });
      return;
    }
    const timer = setTimeout(() => {
      void performPathfinding({ fromAsset, toAsset, amount });
    }, 500); // debounce 500ms

    return () => clearTimeout(timer);
  }, [fromAsset, toAsset, amount, performPathfinding]);

  const handleSwapAssets = () => {
    const temp = fromAsset;
    setFromAsset(toAsset);
    setToAsset(temp);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      notifyError('Please connect your wallet first.');
      return;
    }
    if (!amount || amount <= 0 || !receiver || !selectedPathId) {
      notifyError('Please fill out all fields and select a path.');
      return;
    }

    setIsSubmitting(true);
    setTxStatus(null);
    setContractError(null);
    try {
      const contractId = getContractId();
      const result = await submitCrossAssetPayment({
        contractId,
        sourceAddress: address,
        signTransaction,
        amount,
        fromAsset,
        toAsset,
        receiver,
        selectedPathId,
      });

      notifySuccess('Transaction submitted successfully!', `Hash: ${result.txHash.slice(0, 8)}...`);
      setTxStatus({ id: result.txHash, status: 'Submitted. Waiting for network...' });

      // Subscribe to real-time status updates via socket
      subscribeToTransaction(result.txHash);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const rawXdr =
        err != null && typeof err === 'object' && 'resultXdr' in err
          ? (err as { resultXdr: unknown }).resultXdr
          : undefined;
      const resultXdr = typeof rawXdr === 'string' && rawXdr.length > 0 ? rawXdr : undefined;
      setContractError(parseContractError(resultXdr, errorMessage));
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPath = paths.find((p) => p.id === selectedPathId);

  return (
    <div className="max-w-3xl mx-auto space-y-8 page-fade pb-10">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ArrowRightLeft className="w-8 h-8 text-accent" />
          Cross-Asset Payment
        </h1>
        <p className="text-sm text-muted mt-2">
          Send a payment in one asset and settle in another. Path-finding evaluates the Stellar DEX
          for optimal conversion rates.
        </p>
      </div>

      <ContractErrorPanel error={contractError} onClear={() => setContractError(null)} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Payment Form */}
        <div className="card glass noise p-6 space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                Receiver Address
              </label>
              <input
                type="text"
                placeholder="G..."
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                value={receiver}
                onChange={(e) => setReceiver(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Send Asset
                </label>
                <select
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                  value={fromAsset}
                  onChange={(e) => setFromAsset(e.target.value)}
                >
                  {ASSET_OPTIONS.map((asset) => (
                    <option key={asset} value={asset} className="bg-slate-900">
                      {asset}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleSwapAssets}
                className="mt-6 p-3 rounded-full bg-white/5 hover:bg-white/10 text-muted hover:text-white transition"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  Receive Asset
                </label>
                <select
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                  value={toAsset}
                  onChange={(e) => setToAsset(e.target.value)}
                >
                  {ASSET_OPTIONS.map((asset) => (
                    <option key={asset} value={asset} className="bg-slate-900">
                      {asset}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">
                Amount to Send
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.0000001"
                  step="any"
                  placeholder="0.00"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-xl font-mono text-white focus:outline-none focus:border-accent transition-colors"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  required
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                  {fromAsset}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !selectedPathId}
              className="w-full py-3.5 bg-accent text-bg rounded-xl font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              {isSubmitting ? 'Simulating & Submitting...' : 'Submit Payment'}
            </button>
          </form>
        </div>

        {/* Pathfinding & Settlement Preview */}
        <div className="space-y-6">
          <div className="card glass noise p-6">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              Settlement Preview
            </h3>

            {isPathfinding ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted">
                <Loader2 className="w-6 h-6 animate-spin mb-3 text-accent" />
                <p className="text-xs">Finding optimal paths...</p>
              </div>
            ) : paths.length > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    Available Paths
                  </label>
                  {paths.map((path) => (
                    <button
                      key={path.id}
                      type="button"
                      onClick={() => setSelectedPathId(path.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedPathId === path.id
                          ? 'border-accent bg-accent/10 shadow-sm shadow-accent/20'
                          : 'border-white/10 bg-black/20 hover:border-white/20'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-white">Rate: {path.rate}</span>
                        <span className="text-[10px] font-mono text-accent">
                          ~{path.estimatedDestinationAmount} {toAsset}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted font-mono flex items-center gap-1.5 flex-wrap">
                        {path.hops.map((hop, idx) => (
                          // eslint-disable-next-line react-x/no-array-index-key
                          <React.Fragment key={`${hop}-${idx}`}>
                            <span>{hop}</span>
                            {idx < path.hops.length - 1 && <span>→</span>}
                          </React.Fragment>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>

                {selectedPath && (
                  <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Estimated Delivery</span>
                      <span className="font-bold text-green-400">
                        {selectedPath.estimatedDestinationAmount} {toAsset}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Network Fee</span>
                      <span className="font-mono text-white/80">
                        {selectedPath.fee} {fromAsset}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted">Slippage Tolerance</span>
                      <span className="font-mono text-white/80">{selectedPath.slippage}%</span>
                    </div>
                  </div>
                )}
              </div>
            ) : amount > 0 ? (
              <div className="py-8 text-center text-xs text-muted flex flex-col items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400" />
                No conversion paths found for {fromAsset} → {toAsset}.
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                Enter an amount to see settlement previews.
              </div>
            )}
          </div>

          {/* Live Status Updates */}
          {txStatus && (
            <div className="card glass noise p-4 bg-accent/5 border-accent/20 flex flex-col gap-2 animate-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-accent uppercase tracking-wider">Live Status</span>
                <span className="text-[10px] font-mono text-muted">
                  {txStatus.id.slice(0, 8)}...
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
                <span className="text-white/90">{txStatus.status}</span>
              </div>
              <p className="text-[10px] text-muted mt-1 leading-relaxed">
                Updates will appear here automatically via Socket connection.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
