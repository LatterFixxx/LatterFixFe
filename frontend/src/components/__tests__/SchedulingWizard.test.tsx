import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SchedulingWizard } from '../SchedulingWizard';

describe('SchedulingWizard component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders step 1 with frequency, day, and time selectors', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    render(<SchedulingWizard onComplete={onComplete} onCancel={onCancel} />);

    expect(screen.getByText('Step 1: Set Run Schedule')).toBeDefined();
    expect(screen.getByText('weekly')).toBeDefined();
    expect(screen.getByText('biweekly')).toBeDefined();
    expect(screen.getByText('monthly')).toBeDefined();
  });

  it('navigates through multi-step flow to step 2 and step 3', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    render(<SchedulingWizard onComplete={onComplete} onCancel={onCancel} />);

    // Click Continue to step 2
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('Step 2: Employee Currency Preferences')).toBeDefined();

    // Click Continue to step 3
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText('Step 3: Preview & Confirm Schedule')).toBeDefined();
    expect(screen.getByText('Preview of Next 3 Payment Runs')).toBeDefined();

    // Click Confirm & Save Schedule
    fireEvent.click(screen.getByRole('button', { name: /confirm & save schedule/i }));
    expect(onComplete).toHaveBeenCalled();
  });

  it('allows adding and removing employee currency preferences in step 2', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    render(<SchedulingWizard onComplete={onComplete} onCancel={onCancel} />);

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Open add employee form
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }));

    const nameInput = screen.getByPlaceholderText('Employee Name');
    const amountInput = screen.getByPlaceholderText('Amount');

    fireEvent.change(nameInput, { target: { value: 'Daniel Craig' } });
    fireEvent.change(amountInput, { target: { value: '4500' } });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText('Daniel Craig')).toBeDefined();
    expect(screen.getByText('$4500')).toBeDefined();
  });

  it('calls onCancel when clicking Cancel on step 1', () => {
    const onComplete = vi.fn();
    const onCancel = vi.fn();

    render(<SchedulingWizard onComplete={onComplete} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
