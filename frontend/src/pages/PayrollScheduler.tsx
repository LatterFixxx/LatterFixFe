import React, { useEffect, useState } from 'react';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';
import { AutosaveIndicator } from '../components/AutosaveIndicator';
import { useAutosave } from '../hooks/useAutosave';
import { ContractErrorPanel } from '../components/ContractErrorPanel';
import { parseContractError, type ContractErrorDetail } from '../utils/contractErrorParser';
import { useWallet } from '../hooks/useWallet';
import { useSorobanContract } from '../hooks/useSorobanContract';
import { contractService } from '../services/contracts';
import { getActiveNetwork } from '../services/networkConfig';

interface PayrollFormState {
  employeeName: string;
  amount: string;
  frequency: 'weekly' | 'monthly';
  startDate: string;
}

const initialFormState: PayrollFormState = {
  employeeName: '',
  amount: '',
  frequency: 'monthly',
  startDate: '',
};

export default function PayrollScheduler() {
  const { address } = useWallet();
  const [formData, setFormData] = useState<PayrollFormState>(initialFormState);
  const [contractError, setContractError] = useState<ContractErrorDetail | null>(null);
  const [payrollContractId, setPayrollContractId] = useState<string | null>(null);

  const { saving, lastSaved, loadSavedData } = useAutosave<PayrollFormState>(
    'payroll-scheduler-draft',
    formData
  );

  const { invoke: invokePayroll, loading: isPayrollSubmitting } = useSorobanContract(
    payrollContractId ?? 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH3KI'
  );

  useEffect(() => {
    const saved = loadSavedData();
    if (saved && typeof saved === 'object') {
      const raw = saved as Partial<PayrollFormState>;
      const isValidDate = (value: unknown): boolean => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [y, m, d] = value.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d));
        return (
          date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
        );
      };
      const normalized: PayrollFormState = {
        employeeName: typeof raw.employeeName === 'string' ? raw.employeeName : '',
        amount: typeof raw.amount === 'string' ? raw.amount : '',
        frequency:
          raw.frequency === 'weekly' || raw.frequency === 'monthly' ? raw.frequency : 'monthly',
        startDate: isValidDate(raw.startDate) ? (raw.startDate as string) : '',
      };
      setFormData(normalized);
    }
  }, [loadSavedData]);

  useEffect(() => {
    contractService
      .initialize()
      .then(() => {
        // Payroll Streams contract is not yet deployed in the registry; do not
        // fall back to unrelated vesting_escrow/bulk_payment ABIs which lack
        // create_payroll_stream and would fail every submission.
        const id = (
          contractService.getContractId as unknown as (
            type: string,
            network: ReturnType<typeof getActiveNetwork>
          ) => string | null
        )('payroll_stream', getActiveNetwork());
        setPayrollContractId(id ?? null);
      })
      .catch(() => {
        // keep null - submission will surface a not-initialized error via the panel
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContractError(null);

    if (
      typeof formData.employeeName !== 'string' ||
      typeof formData.amount !== 'string' ||
      !formData.employeeName.trim() ||
      !formData.amount.trim() ||
      !formData.startDate
    ) {
      setContractError(parseContractError(undefined, 'Error(Contract, 6)'));
      return;
    }

    const parseAmountToStroops = (value: string): bigint | null => {
      const trimmed = value.trim();
      if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
      const [intPart, fracPart = ''] = trimmed.split('.');
      if (fracPart.length > 7) return null;
      const fracPadded = (fracPart + '0000000').slice(0, 7);
      try {
        const stroops = BigInt(intPart) * 10_000_000n + BigInt(fracPadded);
        if (stroops <= 0n) return null;
        if (stroops > 170141183460469231731687303715884105727n) return null;
        return stroops;
      } catch {
        return null;
      }
    };

    const amountStroops = parseAmountToStroops(formData.amount);
    if (amountStroops === null) {
      setContractError(parseContractError(undefined, 'Error(Contract, 6)'));
      return;
    }

    if (!address) {
      setContractError(parseContractError(undefined, 'Error(Contract, 3)'));
      return;
    }

    if (!payrollContractId) {
      setContractError(parseContractError(undefined, 'Error(Contract, 2)'));
      return;
    }

    try {
      const startTime = Math.floor(new Date(formData.startDate).getTime() / 1000);

      await invokePayroll({
        method: 'create_payroll_stream',
        args: [
          new Address(address),
          nativeToScVal(formData.employeeName),
          amountStroops,
          BigInt(startTime),
          nativeToScVal(formData.frequency),
        ],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payroll submission failed';
      const rawXdr =
        err != null && typeof err === 'object' && 'resultXdr' in err
          ? (err as { resultXdr: unknown }).resultXdr
          : undefined;
      const resultXdr = typeof rawXdr === 'string' && rawXdr.length > 0 ? rawXdr : undefined;
      setContractError(parseContractError(resultXdr, message));
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-12 max-w-4xl mx-auto w-full">
      <div className="w-full mb-12 flex items-end justify-between border-b border-hi pb-8">
        <div>
          <h1 className="text-4xl font-black mb-2 tracking-tight">
            Payroll <span className="text-accent">Scheduler</span>
          </h1>
          <p className="text-muted font-mono text-sm tracking-wider uppercase">
            Automated distribution engine
          </p>
        </div>
        <AutosaveIndicator saving={saving} lastSaved={lastSaved} />
      </div>

      <ContractErrorPanel error={contractError} onClear={() => setContractError(null)} />

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 card glass noise"
      >
        <div className="md:col-span-2">
          <label
            htmlFor="payroll-employeeName"
            className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1"
          >
            Employee Name
          </label>
          <input
            id="payroll-employeeName"
            type="text"
            name="employeeName"
            value={formData.employeeName}
            onChange={handleChange}
            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-medium"
            placeholder="e.g. Satoshi Nakamoto"
          />
        </div>

        <div>
          <label
            htmlFor="payroll-amount"
            className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1"
          >
            Amount (USD equivalent)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-mono">$</span>
            <input
              id="payroll-amount"
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              className="w-full bg-black/20 border border-hi rounded-xl p-4 pl-8 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="payroll-frequency"
            className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1"
          >
            Distribution Frequency
          </label>
          <select
            id="payroll-frequency"
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all appearance-none cursor-pointer"
          >
            <option value="weekly" className="bg-surface">
              Weekly
            </option>
            <option value="monthly" className="bg-surface">
              Monthly
            </option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="payroll-startDate"
            className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1"
          >
            Commencement Date
          </label>
          <input
            id="payroll-startDate"
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none focus:border-accent/50 focus:bg-accent/5 transition-all font-mono"
          />
        </div>

        <div className="md:col-span-2 pt-6">
          <button
            id="tour-init-payroll"
            type="submit"
            disabled={isPayrollSubmitting}
            className="w-full py-4 bg-accent text-bg font-black rounded-xl hover:scale-[1.01] transition-transform shadow-lg shadow-accent/10 uppercase tracking-widest text-sm disabled:opacity-50"
          >
            {isPayrollSubmitting ? 'Submitting...' : 'Initialize Payroll Stream'}
          </button>
        </div>
      </form>
    </div>
  );
}
