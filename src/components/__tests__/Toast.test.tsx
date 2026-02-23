import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../Toast';

vi.mock('@/lib/utils/id', () => {
  let counter = 0;
  return { generateId: () => `toast-${++counter}` };
});

function TestConsumer({ message = 'Test toast', variant }: { message?: string; variant?: 'success' | 'error' | 'info' }) {
  const { addToast } = useToast();
  return <button onClick={() => addToast(message, variant)}>Add Toast</button>;
}

describe('useToast', () => {
  it('throws when used outside provider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow();
    spy.mockRestore();
  });
});

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <p>Hello</p>
      </ToastProvider>,
    );
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('shows toast when addToast is called', () => {
    render(
      <ToastProvider>
        <TestConsumer message="Success!" variant="success" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Toast'));
    expect(screen.getByText('Success!')).toBeDefined();
  });

  it('auto-dismisses toast after 4 seconds', () => {
    render(
      <ToastProvider>
        <TestConsumer message="Vanishing" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Toast'));
    expect(screen.getByText('Vanishing')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Vanishing')).toBeNull();
  });

  it('dismisses toast manually via close button', () => {
    render(
      <ToastProvider>
        <TestConsumer message="Closeable" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Toast'));
    expect(screen.getByText('Closeable')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Closeable')).toBeNull();
  });

  it('renders success variant styling', () => {
    render(
      <ToastProvider>
        <TestConsumer message="Done" variant="success" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Toast'));
    const toast = screen.getByText('Done').closest('[role="status"]')!;
    expect(toast.className).toContain('border-l-green');
  });

  it('renders error variant styling', () => {
    render(
      <ToastProvider>
        <TestConsumer message="Oops" variant="error" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Toast'));
    const toast = screen.getByText('Oops').closest('[role="status"]')!;
    expect(toast.className).toContain('border-l-red');
  });

  it('renders info variant styling (default)', () => {
    render(
      <ToastProvider>
        <TestConsumer message="Note" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Add Toast'));
    const toast = screen.getByText('Note').closest('[role="status"]')!;
    expect(toast.className).toContain('border-l-blue');
  });

  it('has aria-live polite region', () => {
    const { container } = render(
      <ToastProvider>
        <p>Child</p>
      </ToastProvider>,
    );
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('can show multiple toasts', () => {
    render(
      <ToastProvider>
        <TestConsumer message="First" />
      </ToastProvider>,
    );
    const btn = screen.getByText('Add Toast');
    fireEvent.click(btn);
    fireEvent.click(btn);
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBe(2);
  });
});
