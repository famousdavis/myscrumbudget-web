// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useId, useState, useRef, useEffect } from 'react';
import type { Settings } from '@/types/domain';
import { CollapsibleSection } from '@/components/CollapsibleSection';

interface ThresholdSettingsProps {
  amberPercent: number;
  redPercent: number;
  violetPercent: number;
  onUpdate: (updater: (prev: Settings) => Settings) => void;
}

export function ThresholdSettings({ amberPercent, redPercent, violetPercent, onUpdate }: ThresholdSettingsProps) {
  const baseId = useId();
  const amberId = `${baseId}-amber`;
  const redId = `${baseId}-red`;
  const violetId = `${baseId}-violet`;

  // ── A3 local buffer ──────────────────────────────────────────────────────
  // ThresholdSettings renders CollapsibleSection as its child. Toggling the
  // section's internal isOpen only unmounts the inner <div>{children}</div>,
  // NOT ThresholdSettings itself. In most browsers, collapse fires a focus
  // shift: mousedown on the toggle button → input fires blur → commitField.
  //
  // The mount-only useEffect cleanup below fires when ThresholdSettings fully
  // unmounts — this happens when the user navigates away from the Settings
  // page while a field is focused (e.g., user is typing in Amber, then clicks
  // a sidebar link to Dashboard). This is the unmount-commit path.
  //
  // Known limitation: if the user focuses a threshold field, types, collapses
  // the section WITHOUT blurring (e.g., keyboard activation of the toggle),
  // then focuses a DIFFERENT threshold field and navigates away, the first
  // field's typed value will be lost — only the second field commits. To save,
  // blur (Tab or click out) before collapsing.
  //
  // Unmount-commit commits ONLY the focused field. Only one field can be
  // focused at a time; others were committed (or reverted to prop) on blur.
  const [localAmber, setLocalAmber] = useState(String(amberPercent));
  const [localRed, setLocalRed] = useState(String(redPercent));
  const [localViolet, setLocalViolet] = useState(String(violetPercent));
  const focusedFieldRef = useRef<'amberPercent' | 'redPercent' | 'violetPercent' | null>(null);
  // Latest-state refs for the mount-only unmount-commit effect below.
  // The cleanup closure captures these by reference rather than by value so
  // it sees the user's last-typed values at navigate-away time. Refs are
  // synced inside an effect (not during render) to satisfy react-hooks/refs.
  const latestRef = useRef({
    localAmber,
    localRed,
    localViolet,
    onUpdate,
  });
  useEffect(() => {
    latestRef.current = { localAmber, localRed, localViolet, onUpdate };
  });

  useEffect(() => {
    if (focusedFieldRef.current !== 'amberPercent') setLocalAmber(String(amberPercent));
  }, [amberPercent]);
  useEffect(() => {
    if (focusedFieldRef.current !== 'redPercent') setLocalRed(String(redPercent));
  }, [redPercent]);
  useEffect(() => {
    if (focusedFieldRef.current !== 'violetPercent') setLocalViolet(String(violetPercent));
  }, [violetPercent]);

  // Unmount-commit: fires when ThresholdSettings fully unmounts (navigate-away).
  useEffect(() => {
    return () => {
      const field = focusedFieldRef.current;
      if (field === null) return;
      const { localAmber, localRed, localViolet, onUpdate } = latestRef.current;
      let rawValue: string;
      if (field === 'amberPercent') rawValue = localAmber;
      else if (field === 'redPercent') rawValue = localRed;
      else rawValue = localViolet;
      const parsed = parseFloat(rawValue);
      if (!Number.isFinite(parsed) || parsed < 0) return;
      onUpdate((prev) => ({
        ...prev,
        trafficLightThresholds: { ...prev.trafficLightThresholds, [field]: parsed },
      }));
    };
  }, []);

  const commitField = (field: 'amberPercent' | 'redPercent' | 'violetPercent', rawValue: string) => {
    focusedFieldRef.current = null;
    const parsed = parseFloat(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      if (field === 'amberPercent') setLocalAmber(String(amberPercent));
      if (field === 'redPercent') setLocalRed(String(redPercent));
      if (field === 'violetPercent') setLocalViolet(String(violetPercent));
      return;
    }
    onUpdate((prev) => ({
      ...prev,
      trafficLightThresholds: { ...prev.trafficLightThresholds, [field]: parsed },
    }));
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <CollapsibleSection title="Dashboard Thresholds">
      <div className="max-w-md space-y-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Set variance percentage thresholds for project status indicators on the dashboard.
        </p>
        <div className="flex items-center gap-4">
          <label htmlFor={amberId} className="w-32 text-sm text-zinc-600 dark:text-zinc-400">
            Amber above (%)
          </label>
          <input id={amberId} name="amberThresholdPercent" type="number" autoComplete="off"
            min={0} max={100} step={1} value={localAmber}
            onChange={(e) => setLocalAmber(e.target.value)}
            onFocus={() => { focusedFieldRef.current = 'amberPercent'; }}
            onBlur={(e) => commitField('amberPercent', e.target.value)}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div className="flex items-center gap-4">
          <label htmlFor={redId} className="w-32 text-sm text-zinc-600 dark:text-zinc-400">
            Red above (%)
          </label>
          <input id={redId} name="redThresholdPercent" type="number" autoComplete="off"
            min={0} max={100} step={1} value={localRed}
            onChange={(e) => setLocalRed(e.target.value)}
            onFocus={() => { focusedFieldRef.current = 'redPercent'; }}
            onBlur={(e) => commitField('redPercent', e.target.value)}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        <div className="flex items-center gap-4">
          <label htmlFor={violetId} className="w-32 text-sm text-zinc-600 dark:text-zinc-400">
            Violet under (%)
          </label>
          <input id={violetId} name="violetThresholdPercent" type="number" autoComplete="off"
            min={0} max={100} step={1} value={localViolet}
            onChange={(e) => setLocalViolet(e.target.value)}
            onFocus={() => { focusedFieldRef.current = 'violetPercent'; }}
            onBlur={(e) => commitField('violetPercent', e.target.value)}
            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
        </div>
        {parseFloat(localRed) < parseFloat(localAmber) && !isNaN(parseFloat(localRed)) && !isNaN(parseFloat(localAmber)) && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Red threshold is below amber — the amber band will be empty.
          </p>
        )}
        {parseFloat(localViolet) === 0 && !isNaN(parseFloat(localViolet)) && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Violet threshold is 0 — any under-budget project will trigger Violet.
          </p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          Green: between violet and amber thresholds. Amber: above amber, at or below red. Red: above red threshold. Violet: under budget by more than the violet threshold.
        </p>
      </div>
    </CollapsibleSection>
  );
}
