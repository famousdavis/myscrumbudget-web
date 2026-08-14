// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Hydration-safety and behaviour tests for FirstRunBanner.
 *
 * The bug these exist to prevent (v0.36.2): the component initialised its
 * `visible` state from localStorage inside a lazy `useState` initializer, behind
 * a `typeof window === 'undefined'` guard that looked SSR-safe and was the exact
 * opposite. The server returned false, the client's FIRST render returned the
 * real localStorage value, and React reported a #418 hydration error in
 * PRODUCTION on every page load for every visitor who had not dismissed the
 * banner. `LocalStorageWarningBanner` had the identical bug fixed in v0.21.6;
 * this component was missed for 15 releases because its comment claimed the
 * pattern was safe.
 *
 * The first test below is the guard against a regression. It asserts the
 * invariant directly rather than the symptom: the FIRST render must not depend
 * on localStorage. `renderToStaticMarkup` runs no effects, so it captures
 * exactly what hydration compares — and in jsdom `window` is defined, so a
 * revived `typeof window` guard would NOT protect it. That is deliberate: it
 * makes this test fail for the buggy code rather than pass for the wrong reason.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FirstRunBanner } from '../FirstRunBanner';

const FIRST_RUN_KEY = 'spert_firstRun_seen';

beforeEach(() => {
  localStorage.clear();
});

describe('FirstRunBanner — hydration safety', () => {
  it('renders nothing on the first render even when localStorage says to show it', () => {
    // The dangerous state: not dismissed, ToS not accepted — the banner IS due.
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBeNull();

    // First-render output must be empty regardless, because the real server has
    // no localStorage and hydration compares this against the server's markup.
    expect(renderToStaticMarkup(<FirstRunBanner />)).toBe('');
  });

  it('renders nothing on the first render when it is dismissed, too', () => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    expect(renderToStaticMarkup(<FirstRunBanner />)).toBe('');
  });

  it('produces IDENTICAL first-render output in both storage states', () => {
    // This is the invariant in one line: if first-render output can differ by
    // stored state, the server and client can disagree and hydration fails.
    localStorage.removeItem(FIRST_RUN_KEY);
    const due = renderToStaticMarkup(<FirstRunBanner />);
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    const dismissed = renderToStaticMarkup(<FirstRunBanner />);
    expect(due).toBe(dismissed);
  });
});

describe('FirstRunBanner — behaviour after mount', () => {
  it('appears after hydration when it has not been dismissed', () => {
    render(<FirstRunBanner />);
    expect(screen.getByText(/free to use/)).toBeInTheDocument();
  });

  it('stays hidden after hydration once dismissed', () => {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
    render(<FirstRunBanner />);
    expect(screen.queryByText(/free to use/)).not.toBeInTheDocument();
  });

  it('dismissing hides it and records the dismissal', () => {
    render(<FirstRunBanner />);
    fireEvent.click(screen.getByRole('button', { name: /Got it/i }));

    expect(screen.queryByText(/free to use/)).not.toBeInTheDocument();
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('true');
  });
});
