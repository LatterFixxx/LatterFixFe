import React, { useState } from 'react';
import { usePayrollSchedule } from '../hooks/usePayrollSchedule';
import { SchedulingWizard } from './SchedulingWizard';
import { CountdownTimer } from './CountdownTimer';
import { DAY_NAMES, SchedulingConfig } from '../utils/payrollScheduling';
import {
  Calendar,
  Clock,
  Edit3,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  Trash2,
  Users,
} from 'lucide-react';

export const PayrollScheduleCard: React.FC = () => {
  const { config, saveConfig, clearConfig, toggleConfig, nextPaymentDates, nextScheduledRun } =
    usePayrollSchedule();

  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleCompleteWizard = (newConfig: SchedulingConfig) => {
    saveConfig(newConfig);
    setIsWizardOpen(false);
  };

  if (isWizardOpen) {
    return (
      <SchedulingWizard
        initialConfig={config}
        onComplete={handleCompleteWizard}
        onCancel={() => setIsWizardOpen(false)}
      />
    );
  }

  if (!config) {
    return (
      <div className="card glass noise p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border-white/10">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold text-white flex items-center justify-center sm:justify-start gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Payroll Scheduling Automation
          </h3>
          <p className="text-xs text-muted max-w-lg">
            No active payroll schedule configured. Set up recurring automated payouts (weekly,
            biweekly, or monthly) with per-employee currency preferences and live execution
            countdown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="px-6 py-3 rounded-xl bg-accent text-slate-950 font-black text-sm hover:brightness-110 shadow-lg shadow-accent/20 transition-all flex items-center gap-2 shrink-0 touch-target"
        >
          <PlusCircle className="w-4 h-4" />
          Configure Schedule
        </button>
      </div>
    );
  }

  const isEnabled = config.enabled !== false;

  return (
    <div className="card glass noise p-6 sm:p-8 flex flex-col gap-6 border-white/10 shadow-2xl">
      {/* Header section with Countdown & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-white/10 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isEnabled ? 'bg-accent animate-pulse' : 'bg-muted'
              }`}
            />
            <span className="text-[10px] font-mono uppercase tracking-widest text-accent font-bold">
              {isEnabled ? 'Automated Schedule Active' : 'Schedule Paused'}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-6 h-6 text-accent" />
            Next Scheduled Payroll Run
          </h3>
          <p className="text-xs text-muted">
            Frequency: <strong className="text-white capitalize">{config.frequency}</strong> •
            Target:{' '}
            <strong className="text-white">
              {config.frequency === 'monthly'
                ? `Day ${config.dayOfMonth || 1}`
                : DAY_NAMES[config.dayOfWeek ?? 1]}
            </strong>{' '}
            at <strong className="text-accent font-mono">{config.timeOfDay} UTC</strong>
          </p>
        </div>

        {/* Real-time Countdown Timer component */}
        {isEnabled && nextScheduledRun ? (
          <div className="flex flex-col items-start lg:items-end gap-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold">
              Countdown to Run Execution
            </span>
            <CountdownTimer targetDate={nextScheduledRun} />
          </div>
        ) : (
          <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-muted italic">
            Schedule paused. Enable to resume countdown.
          </div>
        )}
      </div>

      {/* Overview & Upcoming Payment Dates Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Config Overview Card */}
        <div className="bg-black/20 border border-white/10 p-5 rounded-2xl flex flex-col justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold mb-2">
              Configuration Overview
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Total Employees:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  {config.preferences.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Total Amount / Run:</span>
                <span className="font-mono font-bold text-accent">
                  $
                  {config.preferences
                    .reduce((sum, emp) => sum + (parseFloat(emp.amount) || 0), 0)
                    .toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Currencies Used:</span>
                <span className="font-mono text-white font-semibold">
                  {Array.from(new Set(config.preferences.map((p) => p.currency))).join(', ')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsWizardOpen(true)}
              className="flex-1 py-2 px-3 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 text-xs font-bold transition flex items-center justify-center gap-1.5 touch-target"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Wizard
            </button>
            <button
              type="button"
              onClick={() => toggleConfig(!isEnabled)}
              className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-center touch-target ${
                isEnabled
                  ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10'
                  : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
              }`}
              title={isEnabled ? 'Pause schedule' : 'Resume schedule'}
            >
              {isEnabled ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={clearConfig}
              className="p-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold transition flex items-center justify-center touch-target"
              title="Delete schedule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Next 3 Scheduled Run Preview Cards */}
        <div className="md:col-span-2 bg-black/20 border border-white/10 p-5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted font-bold">
              Upcoming 3 Payment Run Dates Preview
            </span>
            <Clock className="w-4 h-4 text-accent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
            {nextPaymentDates.map((date, i) => (
              <div
                key={date.toISOString()}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-1 transition-all ${
                  i === 0
                    ? 'bg-accent/10 border-accent/30 shadow-md shadow-accent/5'
                    : 'bg-black/30 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold uppercase text-accent">
                    {i === 0 ? 'Next Immediate Run' : `Run #${i + 1}`}
                  </span>
                  {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />}
                </div>
                <div className="font-mono font-bold text-xs text-white mt-1">
                  {date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="font-mono text-[11px] text-accent">
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
    </div>
  );
};
