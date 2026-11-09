// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/RepositoryProvider', () => ({
  useRepository: () => ({ repository: {}, isCloud: false }),
}));
vi.mock('@/components/Toast', () => ({ useToast: () => ({ addToast: vi.fn() }) }));

import { DataPortability } from '../DataPortability';

describe('DataPortability', () => {
  it('points to the Dashboard button by its current name, Import (v0.44.7)', () => {
    render(<DataPortability />);
    expect(
      screen.getByText(/To import a workspace, use the .Import. button on the Dashboard\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Import JSON/)).not.toBeInTheDocument();
  });
});
