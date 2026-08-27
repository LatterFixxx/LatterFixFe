import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PayrollScheduleCard } from '../PayrollScheduleCard';

describe('PayrollScheduleCard component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders active schedule with countdown timer and preview dates when config exists', () => {
    render(<PayrollScheduleCard />);

    expect(screen.getByText('Next Scheduled Payroll Run')).toBeDefined();
    expect(screen.getByText('Countdown to Run Execution')).toBeDefined();
    expect(screen.getByText('Upcoming 3 Payment Run Dates Preview')).toBeDefined();
  });

  it('opens wizard on clicking Edit Wizard button', () => {
    render(<PayrollScheduleCard />);

    fireEvent.click(screen.getByRole('button', { name: /edit wizard/i }));
    expect(screen.getByText('Step 1: Set Run Schedule')).toBeDefined();
  });
});
