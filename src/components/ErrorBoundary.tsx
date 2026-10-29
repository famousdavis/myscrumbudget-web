// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  /** Shown in place of the children once one of them throws while rendering. */
  fallback: ReactNode;
  /** A short identifier logged with the error; never data from the project. */
  label: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Contains a render error to the part of the page that raised it (v0.44.6).
 *
 * A project document can be written by any of its members, and a value of the
 * wrong shape inside a reforecast used to throw during render. With no boundary
 * anywhere in the app, that blanked the whole page — on the dashboard, every
 * project with it. Each dashboard tile and the project page now sit inside one,
 * so the rest of the app keeps working. A boundary changes no data: the project
 * is stored exactly as it was.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    // The error's name only: its message can quote a value from the document.
    const name = error instanceof Error ? error.name : typeof error;
    console.error(`[error-boundary] ${this.props.label}: ${name}`);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
