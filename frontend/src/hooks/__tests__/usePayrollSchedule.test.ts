import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePayrollSchedule } from '../usePayrollSchedule';
import { SchedulingConfig } from '../../utils/payrollScheduling';

describe('usePayrollSchedule hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads default scheduling config when localStorage is empty', () => {
    const { result } = renderHook(() => usePayrollSchedule());

    expect(result.current.config).not.toBeNull();
    expect(result.current.config?.frequency).toBe('monthly');
    expect(result.current.nextPaymentDates.length).toBe(3);
    expect(result.current.nextScheduledRun).toBeInstanceOf(Date);
  });

  it('saves new config to localStorage and updates state', () => {
    const { result } = renderHook(() => usePayrollSchedule());

    const newConfig: SchedulingConfig = {
      frequency: 'weekly',
      dayOfWeek: 4, // Thursday
      timeOfDay: '15:00',
      preferences: [{ id: 'emp-10', name: 'David', amount: '5000', currency: 'USDC' }],
      enabled: true,
    };

    act(() => {
      result.current.saveConfig(newConfig);
    });

    expect(result.current.config?.frequency).toBe('weekly');
    expect(result.current.config?.dayOfWeek).toBe(4);
    expect(result.current.config?.timeOfDay).toBe('15:00');
    expect(result.current.nextPaymentDates.length).toBe(3);

    const savedInStorage = JSON.parse(localStorage.getItem('latterfix_payroll_schedule') || '{}');
    expect(savedInStorage.frequency).toBe('weekly');
    expect(savedInStorage.timeOfDay).toBe('15:00');
  });

  it('toggles schedule enabled status', () => {
    const { result } = renderHook(() => usePayrollSchedule());

    act(() => {
      result.current.toggleConfig(false);
    });

    expect(result.current.config?.enabled).toBe(false);
    expect(result.current.nextPaymentDates).toEqual([]);
    expect(result.current.nextScheduledRun).toBeNull();
  });

  it('clears config from state and localStorage', () => {
    const { result } = renderHook(() => usePayrollSchedule());

    act(() => {
      result.current.clearConfig();
    });

    expect(result.current.config).toBeNull();
    expect(localStorage.getItem('latterfix_payroll_schedule')).toBeNull();
    expect(result.current.nextPaymentDates).toEqual([]);
    expect(result.current.nextScheduledRun).toBeNull();
  });
});
