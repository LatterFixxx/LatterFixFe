import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  X,
  ExternalLink,
  Loader2,
  RefreshCw,
  Zap,
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
} from 'lucide-react';
import { useTaskStore } from '../services/taskStore';
import { useWallet } from '../hooks/useWallet';
import {
  fetchAccountTransactions,
  fetchClaimableBalancesForClaimant,
  fetchContractEvents,
  fetchNetworkFeeStats,
  getExplorerTxUrl,
  getExplorerAccountUrl,
  type HorizonTransaction,
  type ClaimableBalanceRecord,
  type SorobanContractEvent,
  type NetworkFeeStats,
} from '../services/transactionHistory';
import { getContractId } from '../services/sorobanTaskContract';

const CURRENT_LEDGER_APPROX = 5_000_000; // Safe fallback start ledger for testnet events

export default function PaymentHistory() {
  const { payments } = useTaskStore();
  const { address, connect } = useWallet();

  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<('Funding' | 'Payout' | 'Fee')[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // ── Active filter count ──
  const activeFilterCount =
    categoryFilters.length +
    (dateRange.from ? 1 : 0) +
    (dateRange.to ? 1 : 0) +
    (employeeQuery.trim() ? 1 : 0);

  // ── Unique employee addresses for suggestions ──
  const employeeSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of payments) {
      if (!seen.has(p.sender)) {
        seen.add(p.sender);
        result.push(p.sender);
      }
      if (!seen.has(p.recipient)) {
        seen.add(p.recipient);
        result.push(p.recipient);
      }
    }
    return result.slice(0, 20);
  }, [payments]);

  // ── Clear all filters ──
  const clearAllFilters = () => {
    setCategoryFilters([]);
    setDateRange({ from: '', to: '' });
    setEmployeeQuery('');
    setSearch('');
  };

  const removeCategory = (cat: 'Funding' | 'Payout' | 'Fee') => {
    setCategoryFilters((prev) => prev.filter((c) => c !== cat));
  };

  // Local payments filter
  const filteredPayments = payments.filter((pay) => {
    const matchesSearch =
      pay.taskTitle.toLowerCase().includes(search.toLowerCase()) ||
      pay.txHash.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = categoryFilters.length === 0 || categoryFilters.includes(pay.type);

    const matchesEmployee =
      !employeeQuery.trim() ||
      pay.recipient.toLowerCase().includes(employeeQuery.trim().toLowerCase()) ||
      pay.sender.toLowerCase().includes(employeeQuery.trim().toLowerCase());

    let matchesDate = true;
    if (dateRange.from) {
      matchesDate = matchesDate && pay.timestamp >= `${dateRange.from} 00:00:00`;
    }
    if (dateRange.to) {
      matchesDate = matchesDate && pay.timestamp <= `${dateRange.to} 23:59:59`;
    }

    return matchesSearch && matchesCategory && matchesEmployee && matchesDate;
  });

  // Live on-chain state
  const [onChainTxs, setOnChainTxs] = useState<HorizonTransaction[]>([]);
  const [claimableBalances, setClaimableBalances] = useState<ClaimableBalanceRecord[]>([]);
  const [contractEvents, setContractEvents] = useState<SorobanContractEvent[]>([]);
  const [feeStats, setFeeStats] = useState<NetworkFeeStats | null>(null);
  const [onChainLoading, setOnChainLoading] = useState(false);
  const [onChainError, setOnChainError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'local' | 'onchain' | 'events' | 'claims'>('local');

  // Load live fee stats on mount
  useEffect(() => {
    fetchNetworkFeeStats()
      .then(setFeeStats)
      .catch(() => null);
  }, []);

  // Load on-chain data when wallet connects or tab changes
  const loadOnChainData = useCallback(async () => {
    if (!address) return;
    setOnChainLoading(true);
    setOnChainError(null);

    try {
      if (activeTab === 'onchain') {
        const { transactions, nextCursor: cursor } = await fetchAccountTransactions(address, 15);
        setOnChainTxs(transactions);
        setNextCursor(cursor);
      } else if (activeTab === 'claims') {
        const balances = await fetchClaimableBalancesForClaimant(address);
        setClaimableBalances(balances);
      } else if (activeTab === 'events') {
        const events = await fetchContractEvents(getContractId(), CURRENT_LEDGER_APPROX, 20);
        setContractEvents(events);
      }
    } catch (err) {
      setOnChainError(err instanceof Error ? err.message : 'Failed to load on-chain data');
    } finally {
      setOnChainLoading(false);
    }
  }, [address, activeTab]);

  useEffect(() => {
    void loadOnChainData();
  }, [loadOnChainData]);

  const loadMore = async () => {
    if (!address || !nextCursor || onChainLoading) return;
    setOnChainLoading(true);
    try {
      const { transactions, nextCursor: cursor } = await fetchAccountTransactions(
        address,
        15,
        nextCursor
      );
      setOnChainTxs((prev) => [...prev, ...transactions]);
      setNextCursor(cursor);
    } catch (err) {
      setOnChainError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setOnChainLoading(false);
    }
  };

  const congestionColor =
    feeStats?.congestion === 'low'
      ? 'text-green-400'
      : feeStats?.congestion === 'moderate'
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="space-y-8 page-fade">
      {/* Header */}
      <div className="border-b border-white/5 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Payment Ledger</h1>
          <p className="text-xs text-muted">
            On-chain transaction history from Stellar Horizon + Soroban RPC contract events.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!address ? (
            <button
              onClick={connect}
              className="text-xs font-bold px-4 py-2 bg-accent text-bg rounded-xl hover:scale-105 transition-transform flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" /> Connect Wallet
            </button>
          ) : (
            <span className="text-xs font-mono bg-green-500/10 border border-green-500/20 text-green-400 px-3 py-1.5 rounded-xl">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
          <button
            onClick={loadOnChainData}
            disabled={!address || onChainLoading}
            className="text-xs font-bold px-3 py-2 bg-white/5 border border-white/10 text-muted rounded-xl hover:text-white hover:bg-white/10 transition flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${onChainLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Network Fee Stats */}
      {feeStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {
              label: 'Network Congestion',
              value: feeStats.congestion.toUpperCase(),
              className: congestionColor,
            },
            { label: 'Base Fee', value: `${feeStats.baseFee} stroops`, className: 'text-white' },
            { label: 'p50 Fee', value: `${feeStats.p50Fee} stroops`, className: 'text-white' },
            {
              label: 'Last Ledger',
              value: `#${feeStats.lastLedger.toLocaleString()}`,
              className: 'text-accent',
            },
          ].map((stat) => (
            <div key={stat.label} className="card glass noise p-4 space-y-1">
              <p className={`text-sm font-black ${stat.className}`}>{stat.value}</p>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'local', label: `Local History (${payments.length})` },
          { key: 'onchain', label: 'On-chain Txs (Horizon)' },
          { key: 'claims', label: 'Claimable Balances' },
          { key: 'events', label: 'Contract Events (RPC)' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === key
                ? 'bg-accent text-bg'
                : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
            }`}
          >
            {key === 'events' && <Activity className="w-3.5 h-3.5" />}
            {key === 'onchain' && <History className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* On-chain Error */}
      {onChainError && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p>{onChainError}</p>
        </div>
      )}

      {/* LOCAL TAB */}
      {activeTab === 'local' && (
        <>
          <div className="flex flex-col gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
            {/* Search row */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  placeholder="Search by task title or tx hash..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/25 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent/40"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    filtersExpanded || activeFilterCount > 0
                      ? 'bg-accent text-bg font-black'
                      : 'bg-white/5 text-muted hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="bg-white/20 text-bg text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  {filtersExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 text-muted hover:text-white hover:bg-white/10 transition flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Expanded filter panel */}
            {filtersExpanded && (
              <div className="flex flex-col md:flex-row gap-4 pt-2 border-t border-white/5">
                {/* Category multi-select */}
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
                    Category
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(['Funding', 'Payout', 'Fee'] as const).map((cat) => {
                      const selected = categoryFilters.includes(cat);
                      return (
                        <button
                          key={cat}
                          onClick={() => {
                            if (selected) {
                              removeCategory(cat);
                            } else {
                              setCategoryFilters((prev) => [...prev, cat]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                            selected
                              ? 'bg-accent/20 text-accent border-accent/40'
                              : 'bg-white/5 text-muted border-white/10 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date range */}
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Date Range
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                      className="w-full bg-black/25 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                    <span className="text-muted text-xs">—</span>
                    <input
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                      className="w-full bg-black/25 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                  </div>
                </div>

                {/* Employee name filter */}
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Address
                  </p>
                  <div className="relative">
                    <input
                      type="text"
                      list="employee-suggestions"
                      placeholder="Filter by sender or recipient..."
                      value={employeeQuery}
                      onChange={(e) => setEmployeeQuery(e.target.value)}
                      className="w-full bg-black/25 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent/40"
                    />
                    <datalist id="employee-suggestions">
                      {employeeSuggestions.map((addr) => (
                        <option key={addr} value={addr} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            )}

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {categoryFilters.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-[10px] font-semibold"
                  >
                    {cat}
                    <button
                      onClick={() => removeCategory(cat)}
                      className="hover:text-white transition"
                      aria-label={`Remove ${cat} filter`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {dateRange.from && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-[10px] font-semibold">
                    From: {dateRange.from}
                    <button
                      onClick={() => setDateRange((prev) => ({ ...prev, from: '' }))}
                      className="hover:text-white transition"
                      aria-label="Remove from date filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {dateRange.to && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-[10px] font-semibold">
                    To: {dateRange.to}
                    <button
                      onClick={() => setDateRange((prev) => ({ ...prev, to: '' }))}
                      className="hover:text-white transition"
                      aria-label="Remove to date filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {employeeQuery.trim() && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent/15 text-accent text-[10px] font-semibold">
                    Address: {employeeQuery.trim()}
                    <button
                      onClick={() => setEmployeeQuery('')}
                      className="hover:text-white transition"
                      aria-label="Remove address filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="card glass noise p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] uppercase tracking-wider font-mono text-muted">
                    <th className="p-4 sm:p-5">Task / Details</th>
                    <th className="p-4 sm:p-5">Type</th>
                    <th className="p-4 sm:p-5">Amount</th>
                    <th className="p-4 sm:p-5">Timestamp</th>
                    <th className="p-4 sm:p-5">Stellar Addresses</th>
                    <th className="p-4 sm:p-5 text-right">TX Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-white/95">
                  {filteredPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-white/2 transition">
                      <td className="p-4 sm:p-5 max-w-xs sm:max-w-sm">
                        <p className="font-bold truncate">{pay.taskTitle}</p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">Ref: {pay.taskId}</p>
                      </td>
                      <td className="p-4 sm:p-5">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            pay.type === 'Payout'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : pay.type === 'Funding'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          }`}
                        >
                          {pay.type}
                        </span>
                      </td>
                      <td className="p-4 sm:p-5 font-black text-sm">
                        {pay.amount.toLocaleString()}{' '}
                        <span className="text-[10px] font-normal text-muted">{pay.token}</span>
                      </td>
                      <td className="p-4 sm:p-5 text-muted font-mono whitespace-nowrap">
                        {pay.timestamp}
                      </td>
                      <td className="p-4 sm:p-5 font-mono text-[10px] text-muted max-w-[150px]">
                        <div className="truncate">From: {pay.sender}</div>
                        <div className="truncate mt-0.5">To: {pay.recipient}</div>
                      </td>
                      <td className="p-4 sm:p-5 text-right">
                        <a
                          href={getExplorerTxUrl(pay.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline bg-accent/5 px-2 py-1 rounded border border-accent/15"
                        >
                          {pay.txHash.slice(0, 6)}...{pay.txHash.slice(-4)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                  {filteredPayments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted">
                        No transactions on this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ON-CHAIN TXS TAB */}
      {activeTab === 'onchain' && (
        <div className="card glass noise p-0 overflow-hidden">
          {!address ? (
            <div className="text-center py-16 text-muted text-sm">
              Connect your wallet to load on-chain transaction history from Horizon.
            </div>
          ) : onChainLoading && onChainTxs.length === 0 ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
              <p className="text-xs text-muted">Loading from Stellar Horizon...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2 text-[10px] uppercase tracking-wider font-mono text-muted">
                      <th className="p-4">Ledger</th>
                      <th className="p-4">Kind</th>
                      <th className="p-4">Source</th>
                      <th className="p-4">Fee (stroops)</th>
                      <th className="p-4">Created</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Hash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {onChainTxs.map((tx) => (
                      <tr key={tx.hash} className="hover:bg-white/2 transition">
                        <td className="p-4 font-mono text-muted">#{tx.ledger}</td>
                        <td className="p-4">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                              tx.kind === 'soroban_invoke'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-white/5 text-muted border-white/10'
                            }`}
                          >
                            {tx.label}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-muted text-[10px] max-w-[120px] truncate">
                          <a
                            href={getExplorerAccountUrl(tx.sourceAccount)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-accent"
                          >
                            {tx.sourceAccount.slice(0, 8)}...
                          </a>
                        </td>
                        <td className="p-4 font-mono text-white">{tx.feeCharged}</td>
                        <td className="p-4 text-muted whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <span
                            className={`text-[9px] font-bold ${tx.successful ? 'text-green-400' : 'text-red-400'}`}
                          >
                            {tx.successful ? '✓ Success' : '✗ Failed'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline"
                          >
                            {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                    {onChainTxs.length === 0 && !onChainLoading && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-muted">
                          No transactions found for this account on Stellar Horizon.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {nextCursor && (
                <div className="text-center p-4 border-t border-white/5">
                  <button
                    onClick={loadMore}
                    disabled={onChainLoading}
                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1.5 mx-auto disabled:opacity-40"
                  >
                    {onChainLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Load more transactions
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* CLAIMABLE BALANCES TAB */}
      {activeTab === 'claims' && (
        <div className="card glass noise p-0 overflow-hidden">
          {!address ? (
            <div className="text-center py-16 text-muted text-sm">
              Connect wallet to view claimable balances.
            </div>
          ) : onChainLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
              <p className="text-xs text-muted">Loading claimable balances from Horizon...</p>
            </div>
          ) : claimableBalances.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm p-6">
              No claimable balances for this address on{' '}
              {getExplorerAccountUrl(address) ? 'Testnet' : 'Mainnet'}.
              <br />
              <span className="text-xs">
                These appear when a creator sends you a payment via CreateClaimableBalance.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] uppercase tracking-wider font-mono text-muted">
                    <th className="p-4">Balance ID</th>
                    <th className="p-4">Asset</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Sponsor</th>
                    <th className="p-4">Claimants</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {claimableBalances.map((cb) => (
                    <tr key={cb.id} className="hover:bg-white/2 transition">
                      <td className="p-4 font-mono text-muted">{cb.id.slice(0, 20)}...</td>
                      <td className="p-4 font-bold text-accent">{cb.asset}</td>
                      <td className="p-4 font-black text-white">
                        {parseFloat(cb.amount).toFixed(4)}
                      </td>
                      <td className="p-4 font-mono text-muted">
                        {cb.sponsor ? `${cb.sponsor.slice(0, 8)}...` : 'None'}
                      </td>
                      <td className="p-4 text-muted">{cb.claimants.length} claimant(s)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTRACT EVENTS TAB */}
      {activeTab === 'events' && (
        <div className="card glass noise p-0 overflow-hidden">
          {onChainLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin mx-auto mb-3" />
              <p className="text-xs text-muted">Querying Soroban RPC getEvents()...</p>
            </div>
          ) : contractEvents.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm p-6">
              No contract events found for LatterFix TaskManagerContract.
              <br />
              <span className="text-xs">
                Events appear once tasks are created/completed on-chain.
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/2 text-[10px] uppercase tracking-wider font-mono text-muted">
                    <th className="p-4">Ledger</th>
                    <th className="p-4">Event Type</th>
                    <th className="p-4">Topics</th>
                    <th className="p-4">Value</th>
                    <th className="p-4">Closed At</th>
                    <th className="p-4 text-right">TX Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {contractEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-white/2 transition">
                      <td className="p-4 font-mono text-muted">#{ev.ledger}</td>
                      <td className="p-4">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                          {ev.type}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-accent text-[10px] max-w-[200px]">
                        {ev.topics.slice(0, 2).join(', ')}
                        {ev.topics.length > 2 ? ` +${ev.topics.length - 2} more` : ''}
                      </td>
                      <td className="p-4 font-mono text-muted text-[10px] truncate max-w-[100px]">
                        {ev.value}
                      </td>
                      <td className="p-4 text-muted whitespace-nowrap">
                        {new Date(ev.ledgerClosedAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <a
                          href={getExplorerTxUrl(ev.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:underline"
                        >
                          {ev.txHash.slice(0, 6)}...
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
