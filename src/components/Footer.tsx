import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="mt-16 border-t-2 border-zinc-100 pb-6 pt-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
      &copy; 2026 William W. Davis, MSPM, PMP |{' '}
      <Link
        href="/changelog"
        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
      >
        Version {APP_VERSION}
      </Link>{' '}
      | Licensed under GNU GPL v3
    </footer>
  );
}
