'use client';

import { useState } from 'react';
import { getExportAttribution, setExportAttribution } from '@/lib/storage/fingerprint';

export function ExportAttribution() {
  const [name, setName] = useState(() => getExportAttribution().name);
  const [id, setId] = useState(() => getExportAttribution().id);

  const handleNameChange = (value: string) => {
    setName(value);
    setExportAttribution({ name: value, id });
  };

  const handleIdChange = (value: string) => {
    setId(value);
    setExportAttribution({ name, id: value });
  };

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Export Attribution
      </h3>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        Identify yourself on exported files. These fields are included in JSON exports for traceability.
      </p>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="exportAttrName"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Name
          </label>
          <input
            id="exportAttrName"
            type="text"
            maxLength={100}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Jane Smith"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor="exportAttrId"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Identifier
          </label>
          <input
            id="exportAttrId"
            type="text"
            maxLength={100}
            value={id}
            onChange={(e) => handleIdChange(e.target.value)}
            placeholder="e.g., student ID, email, or team name"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
    </div>
  );
}
