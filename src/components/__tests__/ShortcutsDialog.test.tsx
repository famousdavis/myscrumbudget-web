// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsDialog } from '../ShortcutsDialog';

describe('ShortcutsDialog', () => {
  it('renders dialog with title', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Keyboard Shortcuts')).toBeDefined();
  });

  it('renders Allocation Grid group', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Allocation Grid')).toBeDefined();
  });

  it('renders Global group', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Global')).toBeDefined();
  });

  it('renders shortcut descriptions', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Navigate between cells')).toBeDefined();
    expect(screen.getByText('Cancel editing')).toBeDefined();
  });

  it('renders Undo and Redo entries in the Global group', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Undo')).toBeDefined();
    expect(screen.getByText('Redo')).toBeDefined();
  });

  it('renders Close button', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByText('Close')).toBeDefined();
  });

  it('calls onClose when Close button clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutsDialog onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has dialog role', () => {
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });
});
