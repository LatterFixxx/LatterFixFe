import { describe, it, expect } from 'vitest';
import { calculateNextPaymentDates, SchedulingConfig } from '../payrollScheduling';

describe('calculateNextPaymentDates', () => {
  const baseDate = new Date(2026, 7, 25, 12, 0, 0); // Tue Aug 25 2026 12:00:00

  it('calculates weekly preview dates correctly when target day is in the future', () => {
    const config: SchedulingConfig = {
      frequency: 'weekly',
      dayOfWeek: 5, // Friday
      timeOfDay: '09:00',
      preferences: [],
    };

    const dates = calculateNextPaymentDates(config, 3, baseDate);
    expect(dates).toHaveLength(3);
    // Aug 28 2026 (Friday)
    expect(dates[0].getFullYear()).toBe(2026);
    expect(dates[0].getMonth()).toBe(7); // August
    expect(dates[0].getDate()).toBe(28);
    expect(dates[0].getHours()).toBe(9);
    expect(dates[0].getMinutes()).toBe(0);

    // Sep 4 2026
    expect(dates[1].getDate()).toBe(4);
    expect(dates[1].getMonth()).toBe(8); // September

    // Sep 11 2026
    expect(dates[2].getDate()).toBe(11);
  });

  it('calculates weekly preview dates correctly when target day is today but time has passed', () => {
    const config: SchedulingConfig = {
      frequency: 'weekly',
      dayOfWeek: 2, // Tuesday (today)
      timeOfDay: '10:00', // 10:00 is past 12:00
      preferences: [],
    };

    const dates = calculateNextPaymentDates(config, 3, baseDate);
    expect(dates).toHaveLength(3);
    // Next Tuesday: Sep 1 2026
    expect(dates[0].getDate()).toBe(1);
    expect(dates[0].getMonth()).toBe(8); // Sept
  });

  it('calculates weekly preview dates correctly when target day is today and time is in the future', () => {
    const config: SchedulingConfig = {
      frequency: 'weekly',
      dayOfWeek: 2, // Tuesday (today)
      timeOfDay: '14:30', // 14:30 is after 12:00
      preferences: [],
    };

    const dates = calculateNextPaymentDates(config, 3, baseDate);
    expect(dates).toHaveLength(3);
    // Today Aug 25 14:30
    expect(dates[0].getDate()).toBe(25);
    expect(dates[0].getHours()).toBe(14);
    expect(dates[0].getMinutes()).toBe(30);
  });

  it('calculates biweekly preview dates with 14 day intervals', () => {
    const config: SchedulingConfig = {
      frequency: 'biweekly',
      dayOfWeek: 5, // Friday
      timeOfDay: '09:00',
      preferences: [],
    };

    const dates = calculateNextPaymentDates(config, 3, baseDate);
    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(28); // Aug 28
    expect(dates[1].getDate()).toBe(11); // Sep 11 (+14)
    expect(dates[2].getDate()).toBe(25); // Sep 25 (+14)
  });

  it('calculates monthly preview dates correctly', () => {
    const config: SchedulingConfig = {
      frequency: 'monthly',
      dayOfMonth: 1,
      timeOfDay: '09:00',
      preferences: [],
    };

    const dates = calculateNextPaymentDates(config, 3, baseDate);
    expect(dates).toHaveLength(3);
    expect(dates[0].getFullYear()).toBe(2026);
    expect(dates[0].getMonth()).toBe(8); // Sep 1
    expect(dates[0].getDate()).toBe(1);

    expect(dates[1].getMonth()).toBe(9); // Oct 1
    expect(dates[1].getDate()).toBe(1);

    expect(dates[2].getMonth()).toBe(10); // Nov 1
    expect(dates[2].getDate()).toBe(1);
  });

  it('handles monthly day clamp for shorter months like February', () => {
    const config: SchedulingConfig = {
      frequency: 'monthly',
      dayOfMonth: 31,
      timeOfDay: '09:00',
      preferences: [],
    };

    const janBase = new Date(2027, 0, 31, 10, 0, 0); // Jan 31 2027 10:00
    const dates = calculateNextPaymentDates(config, 3, janBase);

    // Next is Feb 2027 (non-leap year, 28 days) -> Feb 28
    expect(dates[0].getMonth()).toBe(1); // Feb
    expect(dates[0].getDate()).toBe(28);

    // Mar 31
    expect(dates[1].getMonth()).toBe(2); // Mar
    expect(dates[1].getDate()).toBe(31);

    // Apr 30
    expect(dates[2].getMonth()).toBe(3); // Apr
    expect(dates[2].getDate()).toBe(30);
  });
});
