// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridKeyboard } from '../useGridKeyboard';
import type { TeamMember } from '@/types/domain';
import { buildAllocationMap } from '@/lib/calc/allocationMap';

const TEAM: TeamMember[] = [
  { id: 'm1', name: 'Alice', role: 'BA' },
  { id: 'm2', name: 'Bob', role: 'IT-SoftEng' },
  { id: 'm3', name: 'Carol', role: 'Manager' },
];

const MONTHS = ['2026-01', '2026-02', '2026-03'];

function makeAllocMap(entries: { memberId: string; month: string; allocation: number }[] = []) {
  return buildAllocationMap(entries);
}

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

function makeOptions(overrides: Partial<Parameters<typeof useGridKeyboard>[0]> = {}) {
  return {
    readonly: false,
    focusedCell: { row: 1, col: 1 },
    editingCell: null,
    selection: { startRow: 1, startCol: 1, endRow: 1, endCol: 1 },
    teamMembers: TEAM,
    months: MONTHS,
    allocationMap: makeAllocMap(),
    onAllocationChange: vi.fn(),
    onAllocationsChange: vi.fn(),
    commitEdit: vi.fn(),
    setFocusedCell: vi.fn(),
    setSelection: vi.fn(),
    setEditingCell: vi.fn(),
    setInputValue: vi.fn(),
    setSelectOnEditorOpen: vi.fn(),
    ...overrides,
  };
}

describe('useGridKeyboard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when readonly is true', () => {
    const opts = makeOptions({ readonly: true });
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowUp');
    expect(opts.setFocusedCell).not.toHaveBeenCalled();
  });

  it('does nothing when focusedCell is null', () => {
    const opts = makeOptions({ focusedCell: null });
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowUp');
    expect(opts.setFocusedCell).not.toHaveBeenCalled();
  });

  it('does nothing when teamMembers is empty', () => {
    const opts = makeOptions({ teamMembers: [] });
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowUp');
    expect(opts.setFocusedCell).not.toHaveBeenCalled();
  });

  it('moves focus up on ArrowUp', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowUp');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 0, col: 1 });
    expect(opts.setSelection).toHaveBeenCalledWith({ startRow: 0, startCol: 1, endRow: 0, endCol: 1 });
  });

  it('moves focus down on ArrowDown', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowDown');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 2, col: 1 });
  });

  it('moves focus left on ArrowLeft', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowLeft');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 1, col: 0 });
  });

  it('moves focus right on ArrowRight', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowRight');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 1, col: 2 });
  });

  it('clamps movement at grid boundaries', () => {
    const opts = makeOptions({ focusedCell: { row: 0, col: 0 } });
    renderHook(() => useGridKeyboard(opts));
    fireKey('ArrowUp');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 0, col: 0 });
  });

  it('Tab moves right, Shift+Tab moves left', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));

    fireKey('Tab');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 1, col: 2 });

    vi.mocked(opts.setFocusedCell).mockClear();
    fireKey('Tab', { shiftKey: true });
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 1, col: 0 });
  });

  it('Enter enters edit mode with current allocation value', () => {
    const allocMap = makeAllocMap([{ memberId: 'm2', month: '2026-02', allocation: 0.5 }]);
    const opts = makeOptions({ allocationMap: allocMap });
    renderHook(() => useGridKeyboard(opts));
    fireKey('Enter');
    expect(opts.setEditingCell).toHaveBeenCalledWith({ row: 1, col: 1 });
    expect(opts.setInputValue).toHaveBeenCalledWith('50');
  });

  it('Enter on zero-allocation cell opens empty input', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));
    fireKey('Enter');
    expect(opts.setEditingCell).toHaveBeenCalledWith({ row: 1, col: 1 });
    expect(opts.setInputValue).toHaveBeenCalledWith('');
  });

  it('Enter while editing commits and moves down', () => {
    const opts = makeOptions({ editingCell: { row: 1, col: 1 } });
    renderHook(() => useGridKeyboard(opts));
    fireKey('Enter');
    expect(opts.commitEdit).toHaveBeenCalled();
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 2, col: 1 });
  });

  it('Enter while editing wraps from bottom row to top', () => {
    const opts = makeOptions({
      focusedCell: { row: 2, col: 1 },
      editingCell: { row: 2, col: 1 },
    });
    renderHook(() => useGridKeyboard(opts));
    fireKey('Enter');
    expect(opts.setFocusedCell).toHaveBeenCalledWith({ row: 0, col: 1 });
  });

  it('Escape cancels editing', () => {
    const opts = makeOptions({ editingCell: { row: 1, col: 1 } });
    renderHook(() => useGridKeyboard(opts));
    fireKey('Escape');
    expect(opts.setEditingCell).toHaveBeenCalledWith(null);
    expect(opts.commitEdit).not.toHaveBeenCalled();
  });

  /*
   * [CRITERION 5, Delete half] v0.37.24: the whole range is ONE batched call,
   * so clearing it costs one undo entry rather than one per cell.
   *
   * ⚠️ THIS CANNOT PROVE ONE UNDO ENTRY. There is no undo stack at this level -
   * these are bare vi.fn() spies. It proves the ROUTE (one call, N entries, and
   * the per-cell callback untouched); the SEMANTICS are pinned in
   * src/features/reforecast/hooks/__tests__/undoGrouping.test.ts, which drives
   * the real useProject reducer.
   *
   * ⚠️ The `onAllocationChange` zero-call assertion is load-bearing, not
   * decoration: without it an implementation that called BOTH would pass.
   */
  it('Delete zeroes the selected range as ONE batched call', () => {
    const opts = makeOptions({
      selection: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
    });
    renderHook(() => useGridKeyboard(opts));
    fireKey('Delete');
    expect(opts.onAllocationsChange, 'the whole range is one call').toHaveBeenCalledTimes(1);
    expect(opts.onAllocationsChange, 'carrying every cell of the range, row-major').toHaveBeenCalledWith([
      { memberId: 'm1', month: '2026-01', value: 0 },
      { memberId: 'm1', month: '2026-02', value: 0 },
      { memberId: 'm2', month: '2026-01', value: 0 },
      { memberId: 'm2', month: '2026-02', value: 0 },
    ]);
    expect(
      opts.onAllocationChange,
      'the per-cell route must be unused - calling both would still write correctly and still cost N entries',
    ).not.toHaveBeenCalled();
  });

  it('digit key enters edit mode with that digit', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));
    fireKey('5');
    expect(opts.setEditingCell).toHaveBeenCalledWith({ row: 1, col: 1 });
    expect(opts.setInputValue).toHaveBeenCalledWith('5');
  });

  it('ignores non-grid input key events', () => {
    const opts = makeOptions();
    renderHook(() => useGridKeyboard(opts));

    // Simulate an event from a regular input (no data-grid-input attr)
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    document.body.removeChild(input);

    expect(opts.setFocusedCell).not.toHaveBeenCalled();
  });
});
