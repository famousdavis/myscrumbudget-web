// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { BaseDialog, dialogButtonStyles } from '@/components/BaseDialog';
import { TOS_URL, PRIVACY_URL, TOS_VERSION } from '@/lib/tos/tosConstants';
import { setTosAcceptedVersion } from '@/lib/tos/tosHelpers';

interface TosConsentModalProps {
  onAccept: () => void;
  onCancel: () => void;
}

export function TosConsentModal({ onAccept, onCancel }: TosConsentModalProps) {
  const [agreed, setAgreed] = useState(false);

  const linkClass = 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline';

  const handleContinue = () => {
    // Set optimistically before the OAuth popup resolves so that a tab-close
    // during sign-in does not re-prompt on the next visit. The Firestore
    // write in AuthProvider.recordTosAcceptance reconciles the server record
    // after successful authentication.
    setTosAcceptedVersion(TOS_VERSION);
    onAccept();
  };

  return (
    <BaseDialog
      title="Terms of Service"
      actions={
        <>
          <button onClick={onCancel} className={dialogButtonStyles.cancel}>
            Cancel
          </button>
          <button
            onClick={handleContinue}
            disabled={!agreed}
            className={dialogButtonStyles.primary}
          >
            Continue
          </button>
        </>
      }
    >
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Use is governed by the Terms of Service and Privacy Policy for SPERT&reg; Suite web apps.
      </p>
      <label className="mt-4 flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-blue-600"
        />
        <span>
          I have read and agree to the{' '}
          <a href={TOS_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Terms of Service
          </a>{' '}
          and{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Privacy Policy
          </a>
          .
        </span>
      </label>
    </BaseDialog>
  );
}
