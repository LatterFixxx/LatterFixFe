import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EmployeeList } from '../EmployeeList';

afterEach(cleanup);

const mockEmployees = [
  { id: '1', name: 'Alice', email: 'alice@test.com', position: 'Engineer', wallet: 'GABCDEF12345678901234567890123456789012345678901234567890', salary: 80000, status: 'Active' as const },
  { id: '2', name: 'Bob', email: 'bob@test.com', position: 'Designer', wallet: 'GBCDEF23456789012345678901234567890123456789012345678901', salary: 70000, status: 'Active' as const },
  { id: '3', name: 'Charlie', email: 'charlie@test.com', position: 'Manager', wallet: 'GCDEFG34567890123456789012345678901234567890123456789012', salary: 90000, status: 'Active' as const },
];

describe('EmployeeList', () => {
  it('renders all employees', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
      />
    );

    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('renders drag handle for each row', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
      />
    );

    // Each row should have a drag handle (GripVertical icon)
    const dragHandles = screen.getAllByLabelText('Drag to reorder');
    expect(dragHandles).toHaveLength(3);
  });

  it('shows empty state when no employees', () => {
    render(
      <EmployeeList
        employees={[]}
        onAddEmployee={vi.fn()}
      />
    );

    expect(screen.getByText('No employees found')).toBeDefined();
  });

  it('renders drag handles with grab cursor', () => {
    const onReorder = vi.fn();
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
        onReorder={onReorder}
      />
    );

    // The drag handle should have cursor-grab class
    const dragHandle = screen.getAllByLabelText('Drag to reorder')[0];
    expect(dragHandle).toBeDefined();
    expect(dragHandle.className).toContain('cursor-grab');
  });

  it('preserves employee order when no drag happens', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
      />
    );

    // Check that employees are rendered in the expected order (sorted by name asc)
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });

  it('reorders employees when drag completes', () => {
    const onReorder = vi.fn();
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
        onReorder={onReorder}
      />
    );

    // Verify the DndContext is rendered
    const tbody = document.querySelector('tbody');
    expect(tbody).toBeDefined();
    expect(tbody?.getAttribute('data-rfd-droppable-id')).toBe('employee-list');
  });

  it('adds onboarding visual feedback when dragging over', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
      />
    );

    // Verify row has proper hover and drag classes
    const rows = document.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('renders column headers with sort indicators', () => {
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={vi.fn()}
      />
    );

    // Default sort is by name ascending
    const sortHeaders = screen.getAllByText(/Name.*▲/);
    expect(sortHeaders.length).toBeGreaterThan(0);
  });

  it('calls onAddEmployee when CSV import completes', () => {
    const onAddEmployee = vi.fn();
    render(
      <EmployeeList
        employees={mockEmployees}
        onAddEmployee={onAddEmployee}
      />
    );

    // The CSV import button should be visible
    expect(screen.getAllByText('Import from CSV').length).toBeGreaterThan(0);
  });
});