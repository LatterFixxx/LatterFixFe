import { useState, useCallback, useMemo } from 'react';
import {
  SchedulingConfig,
  calculateNextPaymentDates,
  EmployeePreference,
} from '../utils/payrollScheduling';

const STORAGE_KEY = 'latterfix_payroll_schedule';

const DEFAULT_EMPLOYEES: EmployeePreference[] = [
  { id: 'emp-1', name: 'Alice Smith', amount: '2500', currency: 'USDC' },
  { id: 'emp-2', name: 'Bob Johnson', amount: '3200', currency: 'XLM' },
  { id: 'emp-3', name: 'Carol Williams', amount: '2800', currency: 'EURC' },
];

export const DEFAULT_SCHEDULING_CONFIG: SchedulingConfig = {
  frequency: 'monthly',
  dayOfMonth: 1,
  timeOfDay: '09:00',
  preferences: DEFAULT_EMPLOYEES,
  enabled: true,
};

export function usePayrollSchedule() {
  const [config, setConfigState] = useState<SchedulingConfig | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as SchedulingConfig;
      }
    } catch (e) {
      console.warn('Failed to parse payroll schedule from localStorage', e);
    }
    return DEFAULT_SCHEDULING_CONFIG;
  });

  const saveConfig = useCallback((newConfig: SchedulingConfig) => {
    const fullConfig: SchedulingConfig = {
      ...newConfig,
      enabled: newConfig.enabled ?? true,
    };
    setConfigState(fullConfig);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fullConfig));
    } catch (e) {
      console.error('Failed to save payroll schedule to localStorage', e);
    }
  }, []);

  const clearConfig = useCallback(() => {
    setConfigState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear payroll schedule from localStorage', e);
    }
  }, []);

  const toggleConfig = useCallback((enabled: boolean) => {
    setConfigState((prev) => {
      if (!prev) return null;
      const updated = { ...prev, enabled };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to update payroll schedule state', e);
      }
      return updated;
    });
  }, []);

  const nextPaymentDates = useMemo(() => {
    if (!config || config.enabled === false) return [];
    return calculateNextPaymentDates(config, 3);
  }, [config]);

  const nextScheduledRun = useMemo(() => {
    return nextPaymentDates.length > 0 ? nextPaymentDates[0] : null;
  }, [nextPaymentDates]);

  return {
    config,
    saveConfig,
    clearConfig,
    toggleConfig,
    nextPaymentDates,
    nextScheduledRun,
  };
}
