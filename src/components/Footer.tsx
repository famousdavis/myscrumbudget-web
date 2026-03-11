// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { TOS_URL, PRIVACY_URL } from '@/lib/tos/tosConstants';

const legalLinkClass = 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300';

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-zinc-100 pb-6 pt-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
      <div>
        &copy; 2026 William W. Davis, MSPM, PMP |{' '}
        <Link
          href="/changelog"
          className={legalLinkClass}
        >
          Version {APP_VERSION}
        </Link>{' '}
        | Licensed under GNU GPL v3
      </div>
      <div className="mt-1">
        <a href={TOS_URL} target="_blank" rel="noopener noreferrer" className={legalLinkClass}>
          Terms of Service
        </a>
        {' | '}
        <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className={legalLinkClass}>
          Privacy Policy
        </a>
      </div>
    </footer>
  );
}
