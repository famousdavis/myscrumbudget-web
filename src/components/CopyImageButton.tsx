// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { useToast } from './Toast';
import { copyChartAsPng } from './charts/export-chart';

const IS_FIREFOX =
  typeof navigator !== 'undefined' && /Firefox\//i.test(navigator.userAgent);

const CLIPBOARD_IMAGE_SUPPORTED =
  typeof navigator !== 'undefined' &&
  !IS_FIREFOX &&
  typeof ClipboardItem !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';

const UNSUPPORTED_MESSAGE =
  'Copy image is not supported in this browser — try Chrome, Edge, or Safari';

interface CopyImageButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  label?: string;
}

export function CopyImageButton({ targetRef, label = 'Copy image' }: CopyImageButtonProps) {
  const [copying, setCopying] = useState(false);
  const { addToast } = useToast();

  const handleClick = async () => {
    if (!CLIPBOARD_IMAGE_SUPPORTED || !targetRef.current || copying) return;
    setCopying(true);
    try {
      await copyChartAsPng(targetRef.current);
      addToast('Chart copied to clipboard', 'success');
    } catch (err) {
      console.error('[CopyImageButton] copy failed:', err);
      addToast('Copy failed — clipboard not available', 'error');
    } finally {
      setCopying(false);
    }
  };

  const disabled = !CLIPBOARD_IMAGE_SUPPORTED || copying;
  const accessibleLabel = !CLIPBOARD_IMAGE_SUPPORTED ? UNSUPPORTED_MESSAGE : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className="copy-image-button rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 print:hidden"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
        />
      </svg>
    </button>
  );
}
