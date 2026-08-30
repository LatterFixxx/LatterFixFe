import React from 'react';
import { AlertTriangle, CheckCircle, Download, Loader2, RefreshCw, XCircle } from 'lucide-react';
import {
  PREFLIGHT_FAILURE_LABELS,
  type PreflightCheckResult,
  type PreflightFailureReason,
} from '../services/feeEstimation';
import { downloadCsv } from '../utils/csvExport';

interface PreflightCheckPanelProps {
  result: PreflightCheckResult | null;
  isRunning: boolean;
  error: Error | null;
  onRerun: () => void;
}

function failureLabel(reason: PreflightFailureReason): string {
  return PREFLIGHT_FAILURE_LABELS[reason];
}

export const PreflightCheckPanel: React.FC<PreflightCheckPanelProps> = ({
  result,
  isRunning,
  error,
  onRerun,
}) => {
  const handleDownloadFailures = () => {
    if (!result) return;
    const failed = result.employees.filter((e) => !e.ok);
    if (failed.length === 0) return;

    downloadCsv(
      `preflight-failures-${result.checkedAt.slice(0, 10)}.csv`,
      failed.map((e) => ({
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        destination: e.destination,
        assetCode: e.assetCode,
        amount: e.amount,
        failureReasons: e.failureReasons.map(failureLabel).join('; '),
      }))
    );
  };

  if (isRunning && !result) {
    return (
      <div className="card glass noise p-6 flex items-center gap-3 text-sm text-muted">
        <Loader2 className="w-4 h-4 animate-spin text-accent" />
        Running preflight checks against the Stellar network...
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="card glass noise p-6 space-y-3">
        <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/30 rounded-2xl">
          <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Preflight check failed</p>
            <p className="text-xs text-muted mt-1">{error.message}</p>
          </div>
        </div>
        <button
          onClick={onRerun}
          className="flex items-center gap-2 px-4 py-2 bg-accent text-bg font-bold rounded-lg text-xs hover:brightness-110 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  if (!result) return null;

  const failedCount = result.employees.filter((e) => !e.ok).length;

  return (
    <div id="tour-preflight-check" className="card glass noise p-6 space-y-5">
      {/* Status banner */}
      <div
        className={`flex items-start gap-3 p-4 rounded-2xl border ${
          result.readyToSubmit
            ? 'bg-green-500/5 border-green-500/30'
            : 'bg-yellow-500/5 border-yellow-500/30'
        }`}
      >
        {result.readyToSubmit ? (
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${result.readyToSubmit ? 'text-green-400' : 'text-yellow-400'}`}>
            {result.readyToSubmit ? 'Ready to Submit' : 'Issues Detected'}
          </p>
          <p className="text-xs text-muted mt-1">
            {result.readyToSubmit
              ? `All ${result.employees.length} recipients passed preflight checks.`
              : `${failedCount} of ${result.employees.length} recipients have issues that must be resolved before signing.`}
          </p>
        </div>
        <button
          onClick={onRerun}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 glass border-hi text-white font-bold rounded-lg text-[11px] uppercase tracking-wider hover:bg-white/5 transition disabled:opacity-50 shrink-0"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Re-run
        </button>
      </div>

      {/* XLM + trustline summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          className={`p-4 rounded-xl border text-xs space-y-1 ${
            result.xlm.sufficient ? 'border-hi' : 'border-red-500/30 bg-red-500/5'
          }`}
        >
          <p className="font-bold text-white">XLM Fees + Reserve</p>
          <p className="text-muted">
            Required: {result.xlm.totalRequiredXLM} XLM ({result.xlm.requiredFeesXLM} fees +{' '}
            {result.xlm.minReserveXLM} reserve)
          </p>
          <p className={result.xlm.sufficient ? 'text-green-400' : 'text-red-400'}>
            Available: {result.xlm.availableXLM} XLM
          </p>
        </div>

        {result.assets.map((asset) => (
          <div
            key={`${asset.assetCode}:${asset.assetIssuer ?? ''}`}
            className={`p-4 rounded-xl border text-xs space-y-1 ${
              asset.sufficient ? 'border-hi' : 'border-red-500/30 bg-red-500/5'
            }`}
          >
            <p className="font-bold text-white">{asset.assetCode} Trustline &amp; Balance</p>
            <p className="text-muted">
              {asset.orgHasTrustline ? 'Trustline active' : 'No trustline'} — Required:{' '}
              {asset.totalRequired}
            </p>
            <p className={asset.sufficient ? 'text-green-400' : 'text-red-400'}>
              Available: {asset.orgBalance}
            </p>
          </div>
        ))}
      </div>

      {/* Per-employee results */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted">
            Recipient Checks
          </h4>
          <button
            onClick={handleDownloadFailures}
            disabled={failedCount === 0}
            className="flex items-center gap-1.5 text-[11px] font-bold text-accent hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Download Failed Checks (CSV)
          </button>
        </div>

        <div className="overflow-x-auto border border-hi rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface/50 text-xs uppercase text-muted tracking-wider border-b border-hi">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Failure Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hi">
              {result.employees.map((employee) => (
                <tr key={employee.employeeId} className="bg-black/10">
                  <td className="px-4 py-3 font-medium">{employee.employeeName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {employee.destination.slice(0, 6)}...{employee.destination.slice(-4)}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted">
                    {employee.amount} {employee.assetCode}
                  </td>
                  <td className="px-4 py-3">
                    {employee.ok ? (
                      <span className="inline-flex items-center gap-1 text-green-400 text-xs font-bold">
                        <CheckCircle className="w-3.5 h-3.5" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-400 text-xs font-bold">
                        <XCircle className="w-3.5 h-3.5" /> Issue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-300">
                    {employee.failureReasons.length > 0 ? (
                      <ul className="space-y-0.5">
                        {employee.failureReasons.map((reason) => (
                          <li key={reason}>• {failureLabel(reason)}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PreflightCheckPanel;
