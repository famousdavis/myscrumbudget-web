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

  it('shows the incoming value prop initially', () => {
    render(<ReforecastNotes value="initial notes" onChange={() => {}} />);
    open();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('initial notes');
  });

  it('calls onChange on every keystroke (per-keystroke commit — undo/redo preserved)', () => {
    const onChange = vi.fn();
    render(<ReforecastNotes value="" onChange={onChange} />);
    open();
    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'a' } });
    fireEvent.change(textarea, { target: { value: 'ab' } });
    fireEvent.change(textarea, { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith('abc');
  });

  it('does NOT update textarea from incoming prop change while focused (echo guard)', () => {
    const { rerender } = render(<ReforecastNotes value="original" onChange={() => {}} />);
    open();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'my draft' } });
    rerender(<ReforecastNotes value="stale-from-server" onChange={() => {}} />);
    expect(textarea.value).toBe('my draft');
  });

  it('updates textarea from prop change when NOT focused (cloud sync)', () => {
    const { rerender } = render(<ReforecastNotes value="v1" onChange={() => {}} />);
    open();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('v1');
    rerender(<ReforecastNotes value="v2 from cloud" onChange={() => {}} />);
    expect(textarea.value).toBe('v2 from cloud');
  });

  it('calls onBeginEdit on focus', () => {
    const onBeginEdit = vi.fn();
    render(<ReforecastNotes value="" onChange={() => {}} onBeginEdit={onBeginEdit} />);
    open();
    fireEvent.focus(screen.getByRole('textbox'));
    expect(onBeginEdit).toHaveBeenCalledTimes(1);
  });

  it('defensively calls onBeginEdit on every keystroke (idempotent at consumer)', () => {
    const onBeginEdit = vi.fn();
    render(<ReforecastNotes value="" onChange={() => {}} onBeginEdit={onBeginEdit} />);
    open();
    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'a' } });
    fireEvent.change(textarea, { target: { value: 'ab' } });
    expect(onBeginEdit).toHaveBeenCalledTimes(3); // 1 focus + 2 keystrokes
  });

  it('calls onBeginEdit BEFORE onChange on each keystroke (undo-group seeding order)', () => {
    const order: string[] = [];
    const onBeginEdit = vi.fn(() => { order.push('onBeginEdit'); });
    const onChange = vi.fn(() => { order.push('onChange'); });
    render(<ReforecastNotes value="" onChange={onChange} onBeginEdit={onBeginEdit} />);
    open();
    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    order.length = 0;
    fireEvent.change(textarea, { target: { value: 'x' } });
    expect(order).toEqual(['onBeginEdit', 'onChange']);
  });

  it('does NOT call onChange on blur (no defensive commit — protects mid-edit undo)', () => {
    const onChange = vi.fn();
    render(<ReforecastNotes value="" onChange={onChange} />);
    open();
    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'draft' } });
    const callsBeforeBlur = onChange.mock.calls.length;
    fireEvent.blur(textarea);
    expect(onChange.mock.calls.length).toBe(callsBeforeBlur);
  });

  it('calls onEndEdit on blur', () => {
    const onEndEdit = vi.fn();
    render(<ReforecastNotes value="" onChange={() => {}} onEndEdit={onEndEdit} />);
    open();
    const textarea = screen.getByRole('textbox');
    fireEvent.focus(textarea);
    fireEvent.blur(textarea);
    expect(onEndEdit).toHaveBeenCalledTimes(1);
  });

  it('onBlur realigns textarea with the current value prop (mid-edit Ctrl+Z recovery)', () => {
    const { rerender } = render(<ReforecastNotes value="typed" onChange={() => {}} />);
    open();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(textarea);
    rerender(<ReforecastNotes value="" onChange={() => {}} />);
    expect(textarea.value).toBe('typed'); // echo guard blocks sync while focused
    fireEvent.blur(textarea);
    expect(textarea.value).toBe('');      // setLocalValue(value) snaps on blur
  });

  it('works without optional callbacks', () => {
    render(<ReforecastNotes value="hello" onChange={() => {}} />);
    open();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('hello');
    fireEvent.focus(textarea);
    fireEvent.change(textarea, { target: { value: 'world' } });
    fireEvent.blur(textarea);
  });
});
