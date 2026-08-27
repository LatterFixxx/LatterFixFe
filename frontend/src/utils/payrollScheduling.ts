export interface EmployeePreference {
  id: string;
  name: string;
  amount: string;
  currency: string;
}

export interface SchedulingConfig {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfMonth?: number; // 1-31
  timeOfDay: string; // HH:mm format (24-hour)
  preferences: EmployeePreference[];
  enabled?: boolean;
}

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const SUPPORTED_CURRENCIES = ['USDC', 'XLM', 'EURC', 'USDT', 'PYUSD'];

/**
 * Calculates upcoming payment dates based on scheduling configuration.
 */
export function calculateNextPaymentDates(
  config: SchedulingConfig,
  count: number = 3,
  fromDate: Date = new Date()
): Date[] {
  const dates: Date[] = [];
  const [hoursStr, minutesStr] = (config.timeOfDay || '09:00').split(':');
  const hours = parseInt(hoursStr || '9', 10);
  const minutes = parseInt(minutesStr || '0', 10);

  const { frequency } = config;

  if (frequency === 'weekly' || frequency === 'biweekly') {
    const targetDay = typeof config.dayOfWeek === 'number' ? config.dayOfWeek : 1;
    const intervalDays = frequency === 'weekly' ? 7 : 14;

    const start = new Date(fromDate);
    const currentDay = start.getDay();
    const daysToAdd = (targetDay - currentDay + 7) % 7;

    const candidate = new Date(start);
    candidate.setDate(start.getDate() + daysToAdd);
    candidate.setHours(hours, minutes, 0, 0);

    if (candidate.getTime() <= fromDate.getTime()) {
      candidate.setDate(candidate.getDate() + intervalDays);
    }

    for (let i = 0; i < count; i++) {
      const d = new Date(candidate);
      d.setDate(candidate.getDate() + i * intervalDays);
      dates.push(d);
    }
  } else if (frequency === 'monthly') {
    const targetDayOfMonth = config.dayOfMonth || 1;

    let year = fromDate.getFullYear();
    let month = fromDate.getMonth();

    while (dates.length < count) {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const actualDay = Math.min(targetDayOfMonth, daysInMonth);

      const candidate = new Date(year, month, actualDay, hours, minutes, 0, 0);

      if (candidate.getTime() > fromDate.getTime()) {
        dates.push(candidate);
      }

      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }
  }

  return dates;
}
