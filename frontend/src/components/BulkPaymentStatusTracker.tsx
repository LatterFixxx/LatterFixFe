import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotification } from '../hooks/useNotification';
import { useRealTimeUpdates } from '../hooks/useRealTimeUpdates';
import { useFeeEstimation } from '../hooks/useFeeEstimation';
import { useWallet } from '../hooks/useWallet';
import { type PreflightResult } from '../services/preflightCheck';
import { AlertTriangle, CheckCircle2, Download, RefreshCw, PlayCircle } from 'lucide-react';
import {
  fetchPayrollRuns,
  fetchPayrollRunSummary,
  getTxExplorerUrl,
  type PayrollRecipientStatus,
  type PayrollRunRecord,
  type PayrollRunSummary,
} from '../services/bulkPaymentStatus';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';

const RETRY_UNAVAILABLE_REASON =
  'Retrying a failed recipient requires a backend endpoint that resubmits only the failed items. That endpoint does not exist yet — re-running the batch would also re-pay recipients who already succeeded.';

interface BulkPaymentStatusTrackerProps {
  organizationId: number;
}

type ConfirmationMap = Record<string, number>;

function toRecipientStatus(
  status: PayrollRecipientStatus['status']
): 'pending' | 'confirmed' | 'failed' {
  if (status === 'completed') return 'confirmed';
  if (status === 'failed') return 'failed';
  return 'pending';
}

function getEmployeeName(recipient: PayrollRecipientStatus): string {
  const fullName =
    `${recipient.employee_first_name ?? ''} ${recipient.employee_last_name ?? ''}`.trim();
  return fullName || recipient.employee_email || `Employee #${recipient.employee_id}`;
}

function findRunTxHash(summary?: PayrollRunSummary): string | null {
  if (!summary) return null;
  const txHash = summary.items.find((item) => Boolean(item.tx_hash))?.tx_hash;
  return txHash || null;
}

export function BulkPaymentStatusTracker({ organizationId }: BulkPaymentStatusTrackerProps) {
  const [runs, setRuns] = useState<PayrollRunRecord[]>([]);
  const [summaries, setSummaries] = useState<Record<number, PayrollRunSummary>>({});
  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [confirmations, setConfirmations] = useState<ConfirmationMap>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { notifyError } = useNotification();

  // Use unified real-time updates hook
  const { isPolling, subscribeToTransaction, forceRefresh } = useRealTimeUpdates({
    enablePollingFallback: true,
    showNotifications: true,
    pollingInterval: 10000, // Poll every 10 seconds for bulk payment status
  });

  const loadRuns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchPayrollRuns(organizationId, 1, 20);
      setRuns(payload.data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load bulk runs';
      setError(message);
      notifyError('Bulk payment load failed', message);
    } finally {
      setIsLoading(false);
    }
  }, [notifyError, organizationId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const loadSummary = useCallback(
    async (runId: number) => {
      if (summaries[runId]) return;
      try {
        const summary = await fetchPayrollRunSummary(runId);
        setSummaries((prev) => ({ ...prev, [runId]: summary }));
      } catch (summaryError) {
        const message =
          summaryError instanceof Error
            ? summaryError.message
            : 'Failed to load per-recipient status';
        notifyError('Failed to load batch details', message);
      }
    },
    [notifyError, summaries]
  );

  // Subscribe to bulk payment updates via WebSocket
  useEffect(() => {
    runs.forEach((run) => {
      // Subscribe to each batch for real-time confirmation updates
      subscribeToTransaction(run.batch_id);
    });
  }, [runs, subscribeToTransaction]);

  // Handle manual refresh with force polling if needed
  const handleRefresh = useCallback(async () => {
    await loadRuns();
    if (isPolling) {
      await forceRefresh();
    }
  }, [loadRuns, isPolling, forceRefresh]);

  const handleToggleExpand = async (runId: number) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    await loadSummary(runId);
  };

  // Listen for bulk confirmation events from the store
  useEffect(() => {
    const handleBulkConfirmation = (
      event: CustomEvent<{ batchId: string; confirmations: number }>
    ) => {
      const { batchId, confirmations: count } = event.detail;
      setConfirmations((prev) => ({
        ...prev,
        [batchId]: count,
      }));
    };

    window.addEventListener('bulk:confirmation', handleBulkConfirmation as EventListener);

    return () => {
      window.removeEventListener('bulk:confirmation', handleBulkConfirmation as EventListener);
    };
  }, []);

  const rows = useMemo(() => {
    return runs.map((run) => {
      const summary = summaries[run.id];
      const employeeCount = summary?.summary.total_employees ?? 0;
      const txHash = findRunTxHash(summary);
      const confirmationCount = confirmations[run.batch_id] ?? 0;
      const hasFailedRecipients = summary?.items.some((item) => item.status === 'failed') ?? false;

      return {
        run,
        summary,
        employeeCount,
        txHash,
        confirmationCount,
        hasFailedRecipients,
      };
    });
  }, [confirmations, runs, summaries]);

  return (
    <div className="card glass noise mt-8">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold">Bulk Payment Status Tracker</h3>
          <ConnectionStatusIndicator />
        </div>
        <button
          type="button"
          onClick={() => {
            void handleRefresh();
          }}
          className="text-xs font-semibold text-accent hover:text-accent/80"
        >
          Refresh
        </button>
      </div>

      {isLoading ? <p className="text-sm text-muted">Loading bulk payroll runs...</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!isLoading && rows.length === 0 ? (
        <p className="text-sm text-muted">No payroll batch runs found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted border-b border-hi">
              <tr>
                <th className="py-2 pr-4">Batch</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Employees</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Confirmations</th>
                <th className="py-2 pr-4">Tx Hash</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ({
                  run,
                  summary,
                  employeeCount,
                  txHash,
                  confirmationCount,
                  hasFailedRecipients,
                }) => (
                  <FragmentRow
                    key={run.id}
                    run={run}
                    summary={summary}
                    employeeCount={employeeCount}
                    txHash={txHash}
                    confirmationCount={confirmationCount}
                    expanded={expandedRunId === run.id}
                    hasFailedRecipients={hasFailedRecipients}
                    onToggleExpand={() => {
                      void handleToggleExpand(run.id);
                    }}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface FragmentRowProps {
  run: PayrollRunRecord;
  summary?: PayrollRunSummary;
  employeeCount: number;
  txHash: string | null;
  confirmationCount: number;
  expanded: boolean;
  hasFailedRecipients: boolean;
  onToggleExpand: () => void;
}

function FragmentRow({
  run,
  summary,
  employeeCount,
  txHash,
  confirmationCount,
  expanded,
  hasFailedRecipients,
  onToggleExpand,
}: FragmentRowProps) {
  const { address } = useWallet();
  const { runPreflight } = useFeeEstimation();
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [isPreflighting, setIsPreflighting] = useState(false);

  const performPreflight = useCallback(async () => {
    if (!summary || !address || run.status !== 'draft') return;
    setIsPreflighting(true);
    try {
      const result = await runPreflight(
        address,
        run.asset_code,
        run.asset_issuer || null,
        run.total_amount,
        summary.items
      );
      setPreflightResult(result);
    } catch (e) {
      console.error('Preflight error', e);
    } finally {
      setIsPreflighting(false);
    }
  }, [summary, address, run, runPreflight]);

  // Auto-run on expand if draft and summary is loaded
  useEffect(() => {
    if (expanded && run.status === 'draft' && summary && !preflightResult && !isPreflighting) {
      void performPreflight();
    }
  }, [expanded, run.status, summary, preflightResult, isPreflighting, performPreflight]);

  const handleDownloadCsv = () => {
    if (!preflightResult) return;
    const rows = [['Employee ID', 'Name', 'Email', 'Amount', 'Failure Reason']];
    summary?.items.forEach((item) => {
      const issue = preflightResult.recipientIssues.find((i) => i.employee_id === item.employee_id);
      if (issue) {
        rows.push([
          String(item.employee_id),
          getEmployeeName(item),
          item.employee_email || '',
          item.amount,
          issue.reason,
        ]);
      }
    });

    const csvContent = rows.map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `preflight_failures_${run.batch_id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <tr className="border-b border-hi/40 hover:bg-white/5 transition-colors">
        <td className="py-3 pr-4 font-mono text-xs">{run.batch_id.slice(0, 8)}...</td>
        <td className="py-3 pr-4 capitalize">
          <span
            className={`px-2 py-1 rounded text-xs font-semibold ${
              run.status === 'draft'
                ? 'bg-yellow-500/20 text-yellow-400'
                : run.status === 'completed'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-accent/20 text-accent'
            }`}
          >
            {run.status}
          </span>
        </td>
        <td className="py-3 pr-4">{employeeCount}</td>
        <td className="py-3 pr-4 font-semibold">
          {run.total_amount} <span className="text-muted text-xs">{run.asset_code}</span>
        </td>
        <td className="py-3 pr-4">{confirmationCount}</td>
        <td className="py-3 pr-4">
          {txHash ? (
            <a
              href={getTxExplorerUrl(txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline text-xs"
            >
              {txHash.slice(0, 10)}...
            </a>
          ) : (
            <span className="text-muted text-xs">N/A</span>
          )}
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-accent hover:text-accent/80 font-semibold text-xs"
            >
              {expanded ? 'Hide Details' : 'View Details'}
            </button>
            {hasFailedRecipients && run.status !== 'draft' ? (
              <button
                type="button"
                disabled
                title={RETRY_UNAVAILABLE_REASON}
                className="text-danger opacity-60 cursor-not-allowed text-xs"
              >
                Retry Failed
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-hi/40 bg-black/20">
          <td colSpan={7} className="p-4">
            {!summary ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <RefreshCw className="w-4 h-4 animate-spin" /> Loading batch details...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preflight Banner for Drafts */}
                {run.status === 'draft' && (
                  <div
                    className={`p-4 rounded-xl border ${
                      isPreflighting
                        ? 'border-blue-500/30 bg-blue-500/10'
                        : preflightResult?.isReady
                          ? 'border-green-500/30 bg-green-500/10'
                          : 'border-red-500/30 bg-red-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isPreflighting ? (
                          <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />
                        ) : preflightResult?.isReady ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                          <h4 className="font-bold">
                            {isPreflighting
                              ? 'Running Preflight Checks...'
                              : preflightResult?.isReady
                                ? 'Ready to Submit'
                                : 'Issues Detected'}
                          </h4>
                          <p className="text-xs text-muted mt-1">
                            {isPreflighting
                              ? 'Verifying balances, trustlines, and account existence.'
                              : preflightResult?.isReady
                                ? 'All checks passed. You can safely execute this payroll run.'
                                : 'Please resolve the following issues before execution.'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void performPreflight()}
                          disabled={isPreflighting}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded bg-white/5 hover:bg-white/10 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${isPreflighting ? 'animate-spin' : ''}`}
                          />
                          Re-run Checks
                        </button>
                        {preflightResult && !preflightResult.isReady && (
                          <button
                            onClick={handleDownloadCsv}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download Failures CSV
                          </button>
                        )}
                        {preflightResult?.isReady && (
                          <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded bg-accent text-bg hover:brightness-110 shadow-lg shadow-accent/20">
                            <PlayCircle className="w-3.5 h-3.5" />
                            Execute Payroll
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Org Level Issues */}
                    {preflightResult?.orgIssues && preflightResult.orgIssues.length > 0 && (
                      <div className="mt-3 p-3 bg-red-500/20 rounded border border-red-500/30">
                        <h5 className="text-xs font-bold text-red-400 mb-2">
                          Organization Wallet Issues:
                        </h5>
                        <ul className="list-disc list-inside text-xs text-red-300 space-y-1">
                          {preflightResult.orgIssues.map((issue, idx) => (
                            <li key={idx}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Recipient List */}
                <div className="bg-black/20 rounded-lg border border-hi overflow-hidden">
                  <div className="grid grid-cols-4 gap-4 p-3 bg-white/5 text-xs font-semibold text-muted uppercase tracking-wider">
                    <div>Recipient</div>
                    <div>Amount</div>
                    <div>Status</div>
                    <div>Preflight Result</div>
                  </div>
                  <div className="divide-y divide-hi/50 max-h-64 overflow-y-auto">
                    {summary.items.map((recipient) => {
                      const issue = preflightResult?.recipientIssues.find(
                        (i) => i.employee_id === recipient.employee_id
                      );
                      return (
                        <div
                          key={recipient.id}
                          className="grid grid-cols-4 gap-4 p-3 text-sm hover:bg-white/5 items-center"
                        >
                          <div>
                            <div className="font-medium">{getEmployeeName(recipient)}</div>
                            <div className="text-xs text-muted font-mono mt-0.5">
                              {recipient.wallet_address
                                ? `${recipient.wallet_address.slice(0, 6)}...${recipient.wallet_address.slice(-4)}`
                                : 'No wallet linked'}
                            </div>
                          </div>
                          <div className="font-mono">
                            {recipient.amount}{' '}
                            <span className="text-muted text-xs">{run.asset_code}</span>
                          </div>
                          <div>
                            <span className="capitalize text-xs font-medium px-2 py-1 rounded bg-white/5">
                              {toRecipientStatus(recipient.status)}
                            </span>
                          </div>
                          <div>
                            {run.status === 'draft' && preflightResult ? (
                              issue ? (
                                <span className="text-xs text-red-400 flex items-center gap-1.5 bg-red-500/10 px-2 py-1 rounded">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  <span className="truncate" title={issue.reason}>
                                    {issue.reason}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Passed
                                </span>
                              )
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
