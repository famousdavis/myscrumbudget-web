// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Settings } from '@/types/domain';
import { ThresholdSettings } from '../ThresholdSettings';

const baseSettings: Settings = {
  discountRateAnnual: 0.03,
  laborRates: [],
  holidays: [],
  trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
};

const defaultProps = {
  amberPercent: 5,
  redPercent: 15,
  violetPercent: 20,
  onUpdate: vi.fn<(updater: (prev: Settings) => Settings) => void>(),
};

function expand() {
  fireEvent.click(screen.getByRole('button', { name: /Dashboard Thresholds/i }));
}

describe('ThresholdSettings', () => {
  it('renders inputs after expanding', () => {
    render(<ThresholdSettings {...defaultProps} />);
    expand();
    expect(screen.getByLabelText('Amber above (%)')).toBeDefined();
    expect(screen.getByLabelText('Red above (%)')).toBeDefined();
    expect(screen.getByLabelText('Violet under (%)')).toBeDefined();
  });

  it('does NOT call onUpdate while typing (local buffer)', () => {
    const onUpdate = vi.fn();
    render(<ThresholdSettings {...defaultProps} onUpdate={onUpdate} />);
    expand();
    const amber = screen.getByLabelText('Amber above (%)');
    fireEvent.focus(amber);
    fireEvent.change(amber, { target: { value: '10' } });
    fireEvent.change(amber, { target: { value: '12' } });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('commits amber to onUpdate on blur', () => {
    const onUpdate = vi.fn();
    render(<ThresholdSettings {...defaultProps} onUpdate={onUpdate} />);
    expand();
    const amber = screen.getByLabelText('Amber above (%)');
    fireEvent.focus(amber);
    fireEvent.change(amber, { target: { value: '8' } });
    fireEvent.blur(amber);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updater = onUpdate.mock.calls[0][0] as (prev: Settings) => Settings;
    const result = updater(baseSettings);
    expect(result.trafficLightThresholds.amberPercent).toBe(8);
    expect(result.trafficLightThresholds.redPercent).toBe(15);
    expect(result.trafficLightThresholds.violetPercent).toBe(20);
  });

  it('reverts to prop value on blur with invalid (negative) input', () => {
    render(<ThresholdSettings {...defaultProps} />);
    expand();
    const amber = screen.getByLabelText('Amber above (%)') as HTMLInputElement;
    fireEvent.focus(amber);
    fireEvent.change(amber, { target: { value: '-5' } });
    fireEvent.blur(amber);
    expect(amber.value).toBe('5');
  });

  it('updates field from prop when NOT focused (cloud sync)', () => {
    const { rerender } = render(
      <ThresholdSettings {...defaultProps} amberPercent={5} onUpdate={vi.fn()} />,
    );
    expand();
    const amber = screen.getByLabelText('Amber above (%)') as HTMLInputElement;
    expect(amber.value).toBe('5');
    rerender(<ThresholdSettings {...defaultProps} amberPercent={10} onUpdate={vi.fn()} />);
    expect(amber.value).toBe('10');
  });

  it('preserves draft when prop changes while focused (echo guard)', () => {
    const { rerender } = render(
      <ThresholdSettings {...defaultProps} amberPercent={5} onUpdate={vi.fn()} />,
    );
    expand();
    const amber = screen.getByLabelText('Amber above (%)') as HTMLInputElement;
    fireEvent.focus(amber);
    fireEvent.change(amber, { target: { value: '7' } });
    rerender(<ThresholdSettings {...defaultProps} amberPercent={10} onUpdate={vi.fn()} />);
    expect(amber.value).toBe('7');
  });

  it('unmount-commit: commits only the focused field on navigate-away unmount', () => {
    const onUpdate = vi.fn();
    const { unmount } = render(
      <ThresholdSettings {...defaultProps} onUpdate={onUpdate} />,
    );
    expand();
    const amber = screen.getByLabelText('Amber above (%)');
    fireEvent.focus(amber);
    fireEvent.change(amber, { target: { value: '9' } });
    unmount();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updater = onUpdate.mock.calls[0][0] as (prev: Settings) => Settings;
    const result = updater(baseSettings);
    expect(result.trafficLightThresholds.amberPercent).toBe(9);
    expect(result.trafficLightThresholds.redPercent).toBe(15);   // unchanged
    expect(result.trafficLightThresholds.violetPercent).toBe(20); // unchanged
  });

  it('unmount-commit: skips commit for invalid in-progress value', () => {
    const onUpdate = vi.fn();
    const { unmount } = render(
      <ThresholdSettings {...defaultProps} onUpdate={onUpdate} />,
    );
    expand();
    const amber = screen.getByLabelText('Amber above (%)');
    fireEvent.focus(amber);
    fireEvent.change(amber, { target: { value: '-3' } });
    unmount();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
