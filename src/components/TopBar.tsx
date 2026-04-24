// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StorageStatusPill } from '@/components/StorageStatusPill';
import { CloudStorageModal } from '@/components/CloudStorageModal';

export function TopBar() {
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  return (
    <>
      <div className="mb-6 flex items-center justify-end gap-2">
        <ThemeToggle />
        <StorageStatusPill onOpen={() => setCloudModalOpen(true)} />
      </div>
      {cloudModalOpen && (
        <CloudStorageModal onClose={() => setCloudModalOpen(false)} />
      )}
    </>
  );
}
