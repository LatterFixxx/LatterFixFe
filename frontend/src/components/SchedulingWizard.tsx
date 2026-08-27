import React, { useState } from 'react';
import {
  SchedulingConfig,
  EmployeePreference,
  DAY_NAMES,
  SUPPORTED_CURRENCIES,
  calculateNextPaymentDates,
} from '../utils/payrollScheduling';
import {
  Calendar,
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Trash2,
  UserPlus,
} from 'lucide-react';

interface SchedulingWizardProps {
  onComplete: (config: SchedulingConfig) => void;
  onCancel: () => void;
  initialConfig?: SchedulingConfig | null;
}

export const SchedulingWizard: React.FC<SchedulingWizardProps> = ({
  onComplete,
  onCancel,
  initialConfig,
}) => {
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<SchedulingConfig>(() => {
    if (initialConfig) return initialConfig;
    return {
      frequency: 'monthly',
      dayOfMonth: 1,
      dayOfWeek: 1,
      timeOfDay: '09:00',
      preferences: [
        { id: 'emp-1', name: 'Alice Smith', amount: '2500', currency: 'USDC' },
        { id: 'emp-2', name: 'Bob Johnson', amount: '3200', currency: 'XLM' },
        { id: 'emp-3', name: 'Carol Williams', amount: '2800', currency: 'EURC' },
      ],
      enabled: true,
    };
  });

  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeAmount, setNewEmployeeAmount] = useState('');
  const [newEmployeeCurrency, setNewEmployeeCurrency] = useState('USDC');
  const [showAddEmployeeForm, setShowAddEmployeeForm] = useState(false);

  const handleNext = () => setStep((s) => Math.min(s + 1, 3));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleAddEmployee = () => {
    if (!newEmployeeName.trim() || !newEmployeeAmount.trim()) return;
    const newEmp: EmployeePreference = {
      id: `emp-${Date.now()}`,
      name: newEmployeeName.trim(),
      amount: newEmployeeAmount.trim(),
      currency: newEmployeeCurrency,
    };
    setConfig((prev) => ({
      ...prev,
      preferences: [...prev.preferences, newEmp],
    }));
    setNewEmployeeName('');
    setNewEmployeeAmount('');
    setShowAddEmployeeForm(false);
  };

  const handleRemoveEmployee = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      preferences: prev.preferences.filter((emp) => emp.id !== id),
    }));
  };

  const handleCurrencyChange = (id: string, currency: string) => {
    setConfig((prev) => ({
      ...prev,
      preferences: prev.preferences.map((emp) => (emp.id === id ? { ...emp, currency } : emp)),
    }));
  };

  const previewDates = calculateNextPaymentDates(config, 3);

  return (
    <div className="card glass noise w-full p-6 sm:p-8 flex flex-col gap-6 shadow-2xl border-white/10">
      {/* Wizard Step Navigation Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent font-bold">
            Payroll Automation Setup
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
            {step === 1 && 'Step 1: Set Run Schedule'}
            {step === 2 && 'Step 2: Employee Currency Preferences'}
            {step === 3 && 'Step 3: Preview & Confirm Schedule'}
          </h2>
        </div>

        {/* Step dots / indicators */}
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                className={`w-8 h-8 rounded-full font-mono text-xs font-black flex items-center justify-center transition-all ${
                  step === i
                    ? 'bg-accent text-slate-950 shadow-md shadow-accent/20 scale-105'
                    : step > i
                      ? 'bg-accent/20 text-accent cursor-pointer hover:bg-accent/30'
                      : 'bg-surface-hi text-muted opacity-50 cursor-not-allowed'
                }`}
              >
                {step > i ? '✓' : i}
              </button>
              {i < 3 && (
                <div className={`h-0.5 w-6 rounded ${step > i ? 'bg-accent/40' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Frequency, Day, Time Selectors */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
          {/* Frequency selector */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
              Payment Frequency
            </label>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {(['weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setConfig({ ...config, frequency: freq })}
                  className={`py-3.5 px-4 rounded-xl border text-sm font-bold capitalize transition-all flex flex-col items-center gap-1 touch-target ${
                    config.frequency === freq
                      ? 'border-accent text-accent bg-accent/10 shadow-lg shadow-accent/5'
                      : 'border-white/10 text-muted hover:border-accent/40 hover:text-white bg-black/20'
                  }`}
                >
                  <Calendar className="w-5 h-5 opacity-80" />
                  <span>{freq}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Day Selector based on frequency */}
          {(config.frequency === 'weekly' || config.frequency === 'biweekly') && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                Day of Week
              </label>
              <div className="relative">
                <select
                  value={config.dayOfWeek ?? 1}
                  onChange={(e) =>
                    setConfig({ ...config, dayOfWeek: parseInt(e.target.value, 10) })
                  }
                  className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white text-sm font-semibold outline-none focus:border-accent/50 focus:bg-accent/5 transition-all cursor-pointer input-mobile"
                >
                  {DAY_NAMES.map((day, i) => (
                    <option key={day} value={i} className="bg-slate-900 text-white">
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {config.frequency === 'monthly' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1">
                Day of Month (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={config.dayOfMonth ?? 1}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(31, parseInt(e.target.value, 10) || 1));
                  setConfig({ ...config, dayOfMonth: val });
                }}
                className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white text-sm font-mono outline-none focus:border-accent/50 focus:bg-accent/5 transition-all input-mobile"
              />
            </div>
          )}

          {/* Time Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-3 ml-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-accent" />
              Scheduled Run Time (UTC)
            </label>
            <input
              type="time"
              value={config.timeOfDay}
              onChange={(e) => setConfig({ ...config, timeOfDay: e.target.value })}
              className="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-white text-sm font-mono outline-none focus:border-accent/50 focus:bg-accent/5 transition-all input-mobile cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Step 2: Currency Preferences per Employee */}
      {step === 2 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/20 p-4 rounded-xl border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Employee Payout Preferences</p>
              <p className="text-xs text-muted">
                Specify the asset/currency in which each team member receives their scheduled
                salary.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddEmployeeForm(!showAddEmployeeForm)}
              className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto touch-target"
            >
              <UserPlus className="w-4 h-4" />
              {showAddEmployeeForm ? 'Cancel Add' : 'Add Employee'}
            </button>
          </div>

          {/* Add Employee Form */}
          {showAddEmployeeForm && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-accent/20 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="text"
                placeholder="Employee Name"
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white outline-none focus:border-accent"
              />
              <input
                type="number"
                placeholder="Amount"
                value={newEmployeeAmount}
                onChange={(e) => setNewEmployeeAmount(e.target.value)}
                className="w-full sm:w-32 bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono outline-none focus:border-accent"
              />
              <select
                value={newEmployeeCurrency}
                onChange={(e) => setNewEmployeeCurrency(e.target.value)}
                className="w-full sm:w-32 bg-black/40 border border-white/10 rounded-lg p-2.5 text-xs text-white font-bold outline-none focus:border-accent"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr} value={curr} className="bg-slate-900">
                    {curr}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddEmployee}
                disabled={!newEmployeeName.trim() || !newEmployeeAmount.trim()}
                className="w-full sm:w-auto px-4 py-2.5 bg-accent text-slate-950 font-bold rounded-lg text-xs hover:brightness-110 disabled:opacity-50 transition"
              >
                Save
              </button>
            </div>
          )}

          {/* Table of employees */}
          <div className="overflow-x-auto border border-white/10 rounded-xl bg-black/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-hi/60 text-xs uppercase text-muted tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 font-bold">Employee</th>
                  <th className="px-4 py-3 font-bold">Scheduled Amount</th>
                  <th className="px-4 py-3 font-bold">Preferred Payout Asset</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {config.preferences.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted text-xs">
                      No employee preferences added yet. Click &quot;Add Employee&quot; above.
                    </td>
                  </tr>
                ) : (
                  config.preferences.map((emp) => (
                    <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold text-xs flex items-center justify-center">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        {emp.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-white/90">${emp.amount}</td>
                      <td className="px-4 py-3">
                        <select
                          value={emp.currency}
                          onChange={(e) => handleCurrencyChange(emp.id, e.target.value)}
                          className="bg-slate-900 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-accent font-bold outline-none focus:border-accent cursor-pointer"
                        >
                          {SUPPORTED_CURRENCIES.map((curr) => (
                            <option key={curr} value={curr} className="bg-slate-900 text-white">
                              {curr}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(emp.id)}
                          className="text-red-400/70 hover:text-red-400 p-1 rounded transition"
                          title="Remove employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Preview Logic & Confirmation */}
      {step === 3 && (
        <div className="flex flex-col gap-6 animate-fade-in">
          {/* Summary Card */}
          <div className="bg-accent/10 border border-accent/25 rounded-2xl p-6 glow-mint">
            <div className="flex items-center justify-between border-b border-accent/20 pb-4 mb-4">
              <h3 className="text-accent font-bold text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-accent" />
                Configured Payroll Automation Summary
              </h3>
              <span className="px-3 py-1 bg-accent/20 border border-accent/30 text-accent text-[10px] uppercase font-mono font-bold rounded-full">
                Active Schedule
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted block text-[10px] uppercase font-mono tracking-wider">
                  Frequency
                </span>
                <span className="font-bold capitalize text-white text-base">
                  {config.frequency}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-mono tracking-wider">
                  Schedule Target
                </span>
                <span className="font-bold text-white text-base">
                  {config.frequency === 'monthly'
                    ? `Day ${config.dayOfMonth || 1} of month`
                    : DAY_NAMES[config.dayOfWeek ?? 1]}
                </span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-mono tracking-wider">
                  Execution Time
                </span>
                <span className="font-mono text-accent text-base">{config.timeOfDay} UTC</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-mono tracking-wider">
                  Total Recipients
                </span>
                <span className="font-bold text-white text-base">
                  {config.preferences.length} Employees
                </span>
              </div>
            </div>
          </div>

          {/* Upcoming 3 Payment Runs Preview */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              Preview of Next 3 Payment Runs
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {previewDates.map((date, i) => (
                <div
                  key={date.toISOString()}
                  className="bg-black/30 border border-white/10 p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-extrabold uppercase text-accent bg-accent/10 px-2 py-0.5 rounded">
                      Run #{i + 1}
                    </span>
                    <Clock className="w-3.5 h-3.5 text-muted" />
                  </div>
                  <div className="font-mono font-bold text-sm text-white mt-1">
                    {date.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  <div className="font-mono text-xs text-accent">
                    {date.toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}{' '}
                    UTC
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex justify-between items-center mt-2 border-t border-white/10 pt-5">
        <button
          type="button"
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-muted hover:text-white hover:bg-white/5 transition flex items-center gap-2 touch-target"
          onClick={step === 1 ? onCancel : handleBack}
        >
          {step === 1 ? (
            'Cancel'
          ) : (
            <>
              <ArrowLeft className="w-4 h-4" /> Back
            </>
          )}
        </button>

        {step < 3 ? (
          <button
            type="button"
            className="px-6 py-2.5 rounded-xl bg-accent text-slate-950 font-extrabold text-sm hover:brightness-110 shadow-lg shadow-accent/20 transition-all flex items-center gap-2 touch-target"
            onClick={handleNext}
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            className="px-6 py-2.5 rounded-xl bg-accent text-slate-950 font-black text-sm hover:brightness-110 shadow-lg shadow-accent/20 transition-all flex items-center gap-2 touch-target"
            onClick={() => onComplete(config)}
          >
            Confirm & Save Schedule
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
