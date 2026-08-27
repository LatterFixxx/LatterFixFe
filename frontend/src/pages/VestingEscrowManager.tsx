import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Coins,
  ExternalLink,
  Loader2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { contractService } from '../services/contracts';
import { useNotification } from '../hooks/useNotification';
import { useWallet } from '../hooks/useWallet';
import { useVestingEscrowContract, type VestingGrantResult } from '../hooks/usePayrollContracts';
import { getExplorerUrl } from '../services/stellar';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { parseContractError, type ContractErrorDetail } from '../utils/contractErrorParser';

interface VestingGrantState extends VestingGrantResult {
  vestedAmount: string;
  claimableAmount: string;
  progress: number;
}

interface GrantFormState {
  beneficiary: string;
  token: string;
  startDate: string;
  cliffDays: string;
  durationDays: string;
  amount: string;
}

function createDefaultForm(): GrantFormState {
  return {
    beneficiary: '',
    token: (import.meta.env.VITE_VESTING_TOKEN_CONTRACT_ID as string | undefined) || '',
    startDate: new Date().toISOString().slice(0, 10),
    cliffDays: '30',
    durationDays: '180',
    amount: '',
  };
}

function formatAmount(value: string): string {
  const numeric = Number(value || '0');
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toLocaleString('en-US');
}

function toTimestampSeconds(dateValue: string): number {
  return Math.floor(new Date(dateValue).getTime() / 1000);
}

export default function VestingEscrowManager() {
  const { address, connect } = useWallet();
  const { notifyError, notifySuccess } = useNotification();
  const [contractId, setContractId] = useState<string | null>(null);
  const [grants, setGrants] = useState<VestingGrantState[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractError, setContractError] = useState<ContractErrorDetail | null>(null);
  const [lastTx, setLastTx] = useState<{ hash: string; action: string } | null>(null);
  const [form, setForm] = useState<GrantFormState>(createDefaultForm);

  const vestingContract = useVestingEscrowContract(contractId ?? '');

  useEffect(() => {
    let active = true;

    const loadContractId = async () => {
      try {
        await contractService.initialize();
        const resolvedContractId =
          contractService.getContractId('vesting_escrow', 'testnet') ||
          (import.meta.env.VITE_VESTING_ESCROW_CONTRACT_ID as string | undefined) ||
          null;

        if (!active) return;

        if (!resolvedContractId) {
          setError('No vesting escrow contract is configured for this environment.');
          return;
        }

        setContractId(resolvedContractId);
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load contract registry';
        setError(message);
        notifyError('Vesting contract setup failed', message);
      }
    };

    void loadContractId();

    return () => {
      active = false;
    };
  }, [notifyError]);

  useEffect(() => {
    if (!contractId || !address) {
      setGrants([]);
      setError(address ? null : 'Connect your wallet to load the on-chain vesting grants.');
      return;
    }

    let active = true;

    const loadGrants = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const grantResult = await vestingContract.getGrant();
        const grant = grantResult.value as VestingGrantResult | null;

        if (!grant || !active) {
          setGrants([]);
          return;
        }

        const vestedResult = await vestingContract.getVestedAmount();
        const claimableResult = await vestingContract.getClaimableAmount();

        const totalAmount = BigInt(grant.totalAmount || '0');
        const vestedAmount = BigInt(String(vestedResult.value || '0'));
        const claimableAmount = BigInt(String(claimableResult.value || '0'));
        const progress =
          totalAmount > 0n ? Math.min(100, Number((vestedAmount * 10000n) / totalAmount) / 100) : 0;

        setGrants([
          {
            ...grant,
            vestedAmount: vestedAmount.toString(),
            claimableAmount: claimableAmount.toString(),
            progress,
          },
        ]);
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : 'Unable to load vesting grants';
        setError(message);
        notifyError('Vesting grants load failed', message);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadGrants();

    return () => {
      active = false;
    };
  }, [address, contractId, notifyError]);

  const summary = useMemo(() => {
    const totalAmount = grants.reduce(
      (sum: bigint, grant: VestingGrantState) => sum + BigInt(grant.totalAmount || '0'),
      0n
    );
    const vestedAmount = grants.reduce(
      (sum: bigint, grant: VestingGrantState) => sum + BigInt(grant.vestedAmount || '0'),
      0n
    );
    const claimableAmount = grants.reduce(
      (sum: bigint, grant: VestingGrantState) => sum + BigInt(grant.claimableAmount || '0'),
      0n
    );

    return {
      totalAmount,
      vestedAmount,
      claimableAmount,
      progress:
        totalAmount > 0n ? Math.min(100, Number((vestedAmount * 10000n) / totalAmount) / 100) : 0,
    };
  }, [grants]);

  const handleChange = (field: keyof GrantFormState, value: string) => {
    setForm((current: GrantFormState) => ({ ...current, [field]: value }));
  };

  const handleCreateGrant = async (event: FormEvent) => {
    event.preventDefault();

    if (!address) {
      await connect();
      return;
    }

    if (!form.beneficiary || !form.token || !form.amount) {
      notifyError(
        'Incomplete grant',
        'Please provide the beneficiary, token contract, and amount.'
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setContractError(null);

    try {
      const startTime = toTimestampSeconds(form.startDate);
      const cliffSeconds = Number(form.cliffDays) * 24 * 60 * 60;
      const durationSeconds = Number(form.durationDays) * 24 * 60 * 60;

      const result = await vestingContract.createGrant({
        funder: address,
        beneficiary: form.beneficiary,
        token: form.token,
        startTime,
        cliffSeconds,
        durationSeconds,
        amount: form.amount,
        clawbackAdmin: address,
      });

      setLastTx({ hash: result.txHash, action: `Created grant for ${form.beneficiary}` });
      notifySuccess('Grant created', `On-chain transaction submitted: ${result.txHash}`);
      setForm(createDefaultForm());
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Grant creation failed';
      const rawXdr =
        createError != null && typeof createError === 'object' && 'resultXdr' in createError
          ? (createError as { resultXdr: unknown }).resultXdr
          : undefined;
      const resultXdr = typeof rawXdr === 'string' && rawXdr.length > 0 ? rawXdr : undefined;
      setContractError(parseContractError(resultXdr, message));
    } finally {
      setIsSubmitting(false);
      void loadGrants();
    }
  };

  const handleClaim = async (grant: VestingGrantState) => {
    if (!address) {
      await connect();
      return;
    }

    setIsClaiming(true);
    setError(null);
    setContractError(null);

    try {
      const result = await vestingContract.claim();
      setLastTx({
        hash: result.txHash,
        action: `Claimed ${formatAmount(grant.claimableAmount)} tokens`,
      });
      notifySuccess('Claim submitted', `On-chain claim transaction submitted: ${result.txHash}`);
      void loadGrants();
    } catch (claimError) {
      const message = claimError instanceof Error ? claimError.message : 'Claim failed';
      const rawXdr =
        claimError != null && typeof claimError === 'object' && 'resultXdr' in claimError
          ? (claimError as { resultXdr: unknown }).resultXdr
          : undefined;
      const resultXdr = typeof rawXdr === 'string' && rawXdr.length > 0 ? rawXdr : undefined;
      setContractError(parseContractError(resultXdr, message));
    } finally {
      setIsClaiming(false);
    }
  };

  const loadGrants = async () => {
    if (!contractId || !address) {
      setGrants([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const grantResult = await vestingContract.getGrant();
      const grant = grantResult.value as VestingGrantResult | null;

      if (!grant) {
        setGrants([]);
        return;
      }

      const vestedResult = await vestingContract.getVestedAmount();
      const claimableResult = await vestingContract.getClaimableAmount();

      const totalAmount = BigInt(grant.totalAmount || '0');
      const vestedAmount = BigInt(String(vestedResult.value || '0'));
      const claimableAmount = BigInt(String(claimableResult.value || '0'));
      const progress =
        totalAmount > 0n ? Math.min(100, Number((vestedAmount * 10000n) / totalAmount) / 100) : 0;

      setGrants([
        {
          ...grant,
          vestedAmount: vestedAmount.toString(),
          claimableAmount: claimableAmount.toString(),
          progress,
        },
      ]);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load vesting grants';
      setError(message);
      notifyError('Vesting grants load failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 page-fade">
      <div className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Vesting Escrow Manager</h1>
          <p className="text-xs text-muted">
            Create and monitor on-chain vesting grants for employees from the Soroban contract.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!address ? (
            <button
              onClick={() => {
                void connect();
              }}
              className="text-xs font-bold px-4 py-2 bg-accent text-bg rounded-xl hover:scale-105 transition-transform flex items-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5" /> Connect Wallet
            </button>
          ) : (
            <span className="text-xs font-mono bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-xl">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
        </div>
      </div>

      {lastTx ? (
        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl flex items-center gap-3 text-xs">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <div className="flex-1">
            <p className="text-green-400 font-bold">{lastTx.action}</p>
            <p className="text-muted font-mono">{lastTx.hash.slice(0, 32)}...</p>
          </div>
          <a
            href={getExplorerUrl('tx', lastTx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent flex items-center gap-1 hover:underline"
          >
            View <ExternalLink className="w-3 h-3" />
          </a>
          <button onClick={() => setLastTx(null)} className="text-muted hover:text-white">
            ✕
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-xs">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-400">{error}</p>
        </div>
      ) : null}

      <ContractErrorPanel error={contractError} onClear={() => setContractError(null)} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card glass noise p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Total Grant Value
          </p>
          <p className="mt-2 text-xl font-black text-white">
            {formatAmount(summary.totalAmount.toString())}
          </p>
        </div>
        <div className="card glass noise p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Vested</p>
          <p className="mt-2 text-xl font-black text-white">
            {formatAmount(summary.vestedAmount.toString())}
          </p>
        </div>
        <div className="card glass noise p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Claimable</p>
          <p className="mt-2 text-xl font-black text-white">
            {formatAmount(summary.claimableAmount.toString())}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="card glass noise p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Active Vesting Grants</h2>
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider">
                Live on-chain state from{' '}
                {contractId ? contractId.slice(0, 12) : 'the configured contract'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-accent text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> {grants.length} active
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading vesting grant details...
            </div>
          ) : null}

          {!isLoading && grants.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-muted">
              No active vesting grant is available yet. Create one with the form to the right.
            </div>
          ) : null}

          {grants.map((grant) => (
            <div
              key={`${grant.beneficiary}-${grant.startTime}`}
              className="rounded-2xl border border-white/10 bg-black/20 p-5 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">
                    {grant.beneficiary.slice(0, 12)}...{grant.beneficiary.slice(-6)}
                  </p>
                  <p className="text-[11px] text-muted font-mono">
                    Token: {grant.token.slice(0, 12)}...{grant.token.slice(-6)}
                  </p>
                </div>
                <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  {grant.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">Start</p>
                  <p className="mt-1 font-semibold text-white">
                    {new Date(grant.startTime * 1000).toLocaleDateString()}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    Cliff / Duration
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {grant.cliffSeconds / 86400}d / {grant.durationSeconds / 86400}d
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    Total / Claimable
                  </p>
                  <p className="mt-1 font-semibold text-white">
                    {formatAmount(grant.totalAmount)} / {formatAmount(grant.claimableAmount)}
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" /> Vesting progress
                  </span>
                  <span>{grant.progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.max(4, grant.progress)}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs text-muted">
                <div className="flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-accent" />
                  <span>
                    Vested {formatAmount(grant.vestedAmount)} of {formatAmount(grant.totalAmount)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    void handleClaim(grant);
                  }}
                  disabled={isClaiming || Number(grant.claimableAmount) <= 0}
                  className="rounded-xl bg-accent px-3 py-2 font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim'}
                </button>
              </div>
            </div>
          ))}
        </section>

        <section className="card glass noise p-6 space-y-5">
          <div className="border-b border-white/5 pb-3">
            <h2 className="text-lg font-bold text-white">Create New Grant</h2>
            <p className="text-[10px] font-mono text-muted uppercase tracking-wider">
              Start date, cliff, duration, and amount are submitted through the signed XDR flow.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleCreateGrant}>
            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-muted"
                htmlFor="beneficiary"
              >
                Beneficiary Address
              </label>
              <input
                id="beneficiary"
                value={form.beneficiary}
                onChange={(event) => handleChange('beneficiary', event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                placeholder="G..."
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-muted"
                htmlFor="token"
              >
                Token Contract Address
              </label>
              <input
                id="token"
                value={form.token}
                onChange={(event) => handleChange('token', event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                placeholder="CD..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                  htmlFor="startDate"
                >
                  Start Date
                </label>
                <input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => handleChange('startDate', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                  htmlFor="amount"
                >
                  Amount
                </label>
                <input
                  id="amount"
                  value={form.amount}
                  onChange={(event) => handleChange('amount', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                  placeholder="1000000"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                  htmlFor="cliffDays"
                >
                  Cliff (days)
                </label>
                <input
                  id="cliffDays"
                  type="number"
                  min="0"
                  value={form.cliffDays}
                  onChange={(event) => handleChange('cliffDays', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                  htmlFor="durationDays"
                >
                  Duration (days)
                </label>
                <input
                  id="durationDays"
                  type="number"
                  min="1"
                  value={form.durationDays}
                  onChange={(event) => handleChange('durationDays', event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !contractId}
              className="w-full rounded-xl bg-accent px-4 py-3 font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="mx-auto w-4 h-4 animate-spin" />
              ) : (
                'Create Vesting Grant'
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
