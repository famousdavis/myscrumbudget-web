// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReforecastNotes } from '../ReforecastNotes';

function open() {
  fireEvent.click(screen.getByRole('button', { name: /Notes/ }));
}

describe('ReforecastNotes', () => {
  it('expands and collapses on header click', () => {
    render(<ReforecastNotes value="" onChange={() => {}} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    open();
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('forwards typed value via onChange', () => {
    const onChange = vi.fn();
    render(<ReforecastNotes value="" onChange={onChange} />);
    open();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('calls onBeginEdit on focus', () => {
    const onBeginEdit = vi.fn();
    render(<ReforecastNotes value="" onChange={() => {}} onBeginEdit={onBeginEdit} />);
    open();
    fireEvent.focus(screen.getByRole('textbox'));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onEndEdit on blur', () => {
    const onEndEdit = vi.fn();
    render(<ReforecastNotes value="" onChange={() => {}} onEndEdit={onEndEdit} />);
    open();
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onEndEdit).toHaveBeenCalledTimes(1);
  });

  it('defensively calls onBeginEdit on every keystroke (idempotent at the consumer)', () => {
    const onBeginEdit = vi.fn();
    render(<ReforecastNotes value="" onChange={() => {}} onBeginEdit={onBeginEdit} />);
    open();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'a' } });
    fireEvent.change(textarea, { target: { value: 'ab' } });
    fireEvent.change(textarea, { target: { value: 'abc' } });
    // Three keystrokes — three onBeginEdit calls (consumer's beginUndoGroup
    // is the one that early-returns when already active).
    expect(onBeginEdit).toHaveBeenCalledTimes(3);
  });

  it('works without optional callbacks', () => {
    render(<ReforecastNotes value="hello" onChange={() => {}} />);
    open();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello');
    // No throw on focus/blur/change.
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'world' } });
    fireEvent.blur(textarea);
  });
});
