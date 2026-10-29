// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Thrower(): never {
  throw new TypeError('value from the document: SECRET-42');
}

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary (v0.44.6)', () => {
  it('shows the fallback for the part that failed and leaves its siblings rendered', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <div>
        <ErrorBoundary label="t" fallback={<p>could not be displayed</p>}><Thrower /></ErrorBoundary>
        <ErrorBoundary label="t" fallback={<p>never shown</p>}><p>a healthy sibling</p></ErrorBoundary>
      </div>,
    );
    expect(screen.getByText('could not be displayed')).toBeInTheDocument();
    expect(screen.getByText('a healthy sibling')).toBeInTheDocument();
    expect(screen.queryByText('never shown')).not.toBeInTheDocument();
  });

  it('logs its label and the error name, never the error message', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary label="dashboard-tile" fallback={null}><Thrower /></ErrorBoundary>);
    expect(error).toHaveBeenCalledWith('[error-boundary] dashboard-tile: TypeError');
    const own = error.mock.calls.filter((c) => String(c[0]).startsWith('[error-boundary]'));
    expect(own.flat().join(' ')).not.toContain('SECRET-42');
  });
});
