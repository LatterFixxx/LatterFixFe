import { useState } from 'react';
import { Zap } from 'lucide-react';
import { BulkPaymentStatusTracker } from '../components/BulkPaymentStatusTracker';
import { EmployeeList, type Employee } from '../components/EmployeeList';
import { useWallet } from '../hooks/useWallet';
import { useHorizonAccount } from '../hooks/useHorizonAccount';

// Payroll runs are scoped server-side by the signed-in employer JWT (see
// bulkPaymentStatus.ts), so this id is a placeholder until org-scoped auth exists.
const ORGANIZATION_ID = 1;

export default function BulkPaymentTracker() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { address, connect } = useWallet();
  const { balances, isLoading: balancesLoading, accountExists } = useHorizonAccount(address);

  const handleAddEmployee = (employee: Employee) => {
    setEmployees((prev) => [...prev, employee]);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEmployees((prev) => prev.map((e) => (e.id === employee.id ? employee : e)));
  };

  const handleRemoveEmployee = (id: string) => {
    setEmployees((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="space-y-8 page-fade">
      <div className="border-b border-white/5 pb-6">
        <h1 className="text-3xl font-black text-white tracking-tight">Bulk Payment Tracker</h1>
        <p className="text-xs text-muted">
          Manage your workforce, fund your distribution account, and track bulk payroll runs
          against the backend audit log and on-chain confirmation state from the bulk_payment
          contract.
        </p>
      </div>

      <EmployeeList
        employees={employees}
        onAddEmployee={handleAddEmployee}
        onEditEmployee={handleEditEmployee}
        onRemoveEmployee={handleRemoveEmployee}
      />

      {/* Fund Distribution Account */}
      <div id="tour-init-payroll" className="card glass noise p-6 space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">
          Distribution Account{' '}
          <span className="text-[10px] font-normal text-muted ml-2">
            Funds payroll runs for your organization
          </span>
        </h3>

        {!address && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-muted">
              Connect your organization's Stellar wallet to view and fund its balance.
            </p>
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2.5 bg-accent text-bg font-extrabold rounded-xl hover:scale-105 transition-transform text-xs shrink-0"
            >
              <Zap className="w-3.5 h-3.5" /> Connect Wallet
            </button>
          </div>
        )}

        {address && (
          <div className="flex flex-wrap items-center gap-6">
            {(['XLM', 'USDC', 'EURC'] as const).map((token) => (
              <div key={token} className="text-center">
                <p className="text-lg font-black text-white">
                  {balancesLoading ? '...' : parseFloat(balances[token]).toFixed(4)}
                </p>
                <p className="text-[10px] text-muted">{token}</p>
              </div>
            ))}
            {!accountExists && !balancesLoading && (
              <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl flex-1 min-w-[200px]">
                ⚠ Distribution account not yet funded on Stellar Testnet.{' '}
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
        )}
      </div>

      <div id="tour-payroll">
        <BulkPaymentStatusTracker organizationId={ORGANIZATION_ID} />
      </div>
    </div>
  );
}
