import { useState } from 'react';
import { PlayCircle } from 'lucide-react';
import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';
import { EmployeeList, type Employee } from '../components/EmployeeList';
import { PreflightCheckPanel } from '../components/PreflightCheckPanel';
import { useFeeEstimation } from '../hooks/useFeeEstimation';
import { useWallet } from '../hooks/useWallet';
import { KNOWN_ISSUERS, type SupportedToken } from '../hooks/useHorizonAccount';
import type { PreflightBatchItem } from '../services/feeEstimation';

// Payroll runs are scoped server-side by the signed-in employer JWT (see
// bulkPaymentStatus.ts), so this id is a placeholder until org-scoped auth exists.
const ORGANIZATION_ID = 1;

const BATCH_ASSETS: SupportedToken[] = ['XLM', 'USDC', 'EURC'];

function toBatchItem(employee: Employee, assetCode: SupportedToken): PreflightBatchItem {
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    destination: employee.wallet ?? '',
    assetCode,
    assetIssuer: assetCode === 'XLM' ? null : KNOWN_ISSUERS[assetCode],
    amount: (employee.salary ?? 0).toFixed(7),
  };
}

export default function BulkPaymentTracker() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [batchAsset, setBatchAsset] = useState<SupportedToken>('USDC');
  const { address } = useWallet();
  const { preflightResult, isPreflightRunning, preflightError, runPreflight } =
    useFeeEstimation();

  const handleAddEmployee = (employee: Employee) => {
    setEmployees((prev) => [...prev, employee]);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === employee.id ? employee : e)));
  };

  const handleRemoveEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  const activeEmployees = employees.filter((e) => e.status !== 'Inactive');

  const handleFinalizeBatch = () => {
    if (!address || activeEmployees.length === 0) return;
    const batch = activeEmployees.map((employee) => toBatchItem(employee, batchAsset));
    void runPreflight(address, batch);
  };

  return (
    <div className="space-y-8 page-fade">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight">
          Bulk Payment & Payroll Scheduling
        </h1>
        <p className="text-xs text-muted">
          Manage your workforce, finalize a payroll batch, and track bulk payroll runs against the
          backend audit log and on-chain confirmation state from the bulk_payment contract.
        </p>
      </div>

      <EmployeeList
        employees={employees}
        onAddEmployee={handleAddEmployee}
        onEditEmployee={handleEditEmployee}
        onRemoveEmployee={handleRemoveEmployee}
      />

      {/* Finalize payroll batch */}
      <div className="card glass noise p-6 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">
          Finalize Payroll Batch
          <span className="text-[10px] font-normal text-muted ml-2">
            Runs a preflight balance check before you sign
          </span>
        </h3>

        {!address && (
          <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl">
            Connect your organization's Stellar wallet to finalize a payroll batch.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <label className="text-xs font-bold uppercase tracking-widest text-muted">
            Pay in
            <select
              value={batchAsset}
              onChange={(e) => setBatchAsset(e.target.value as SupportedToken)}
              className="ml-3 bg-black/20 border border-hi rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
            >
              {BATCH_ASSETS.map((asset) => (
                <option key={asset} value={asset} className="bg-slate-900">
                  {asset}
                </option>
              ))}
            </select>
          </label>

          <span className="text-xs text-muted">
            {activeEmployees.length} active employee{activeEmployees.length === 1 ? '' : 's'} in
            batch
          </span>

          <button
            onClick={handleFinalizeBatch}
            disabled={!address || activeEmployees.length === 0 || isPreflightRunning}
            className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-accent text-bg font-extrabold rounded-xl hover:scale-105 transition-transform text-xs disabled:opacity-50 disabled:hover:scale-100"
          >
            <PlayCircle className="w-4 h-4" /> Finalize Batch &amp; Run Preflight
          </button>
        </div>
      </div>

      <PreflightCheckPanel
        result={preflightResult}
        isRunning={isPreflightRunning}
        error={preflightError}
        onRerun={handleFinalizeBatch}
      />

      <BulkPaymentStatusTracker organizationId={ORGANIZATION_ID} />
    </div>
  );
}
