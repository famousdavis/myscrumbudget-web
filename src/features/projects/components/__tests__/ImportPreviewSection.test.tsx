// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { ImportPreviewSection, ImportBanner } from '../ImportPreviewSection';
import type { MergePreview, ImportMergeResult } from '@/lib/utils/importUtils';
import type { AppState, Project } from '@/types/domain';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Demo',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    activeReforecastId: 'rf1',
    reforecasts: [
      {
        id: 'rf1',
        name: 'Baseline',
        createdAt: '2026-01-01T00:00:00.000Z',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        reforecastDate: '2026-01-01',
        allocations: [],
        assignments: [],
        productivityWindows: [],
        actualCost: 0,
        baselineBudget: 100000,
      },
    ],
    ...overrides,
  };
}

function makePreview(over: Partial<MergePreview> = {}): MergePreview {
  const projects = over.incomingState?.projects ?? [makeProject({ id: 'p1', name: 'Demo' })];
  const incomingState: AppState = {
    version: '0.30.0',
    msbExportKind: 'dataset',
    settings: {
      discountRateAnnual: 0.05,
      laborRates: [],
      holidays: [],
      trafficLightThresholds: { amberPercent: 5, redPercent: 15, violetPercent: 20 },
    },
    teamPool: [],
    projects,
  };
  return {
    incomingState,
    existingProjects: over.existingProjects ?? [],
    decisions: over.decisions ?? { p1: 'add' },
    conflicts: over.conflicts ?? {},
    settingsDecision: over.settingsDecision ?? 'keep',
    teamPoolDecision: over.teamPoolDecision ?? 'merge',
    mode: over.mode ?? 'local',
    duplicatesDropped: over.duplicatesDropped ?? 0,
  };
}

function noopProps() {
  return {
    onDecision: vi.fn(),
    onSettingsDecision: vi.fn(),
    onTeamPoolDecision: vi.fn(),
    onApply: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe('ImportPreviewSection', () => {
  it('renders per-project rows for each incoming project', () => {
    const preview = makePreview({
      incomingState: undefined,
    });
    // Use override projects
    const projects = [
      makeProject({ id: 'a', name: 'Alpha' }),
      makeProject({ id: 'b', name: 'Beta' }),
    ];
    const previewMulti = makePreview({
      incomingState: { ...preview.incomingState, projects },
      decisions: { a: 'add', b: 'add' },
    });

    render(
      <ImportPreviewSection
        preview={previewMulti}
        isApplying={false}
        {...noopProps()}
      />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('decision buttons toggle and aria-pressed reflects current decision', () => {
    const onDecision = vi.fn();
    render(
      <ImportPreviewSection
        preview={makePreview({ decisions: { p1: 'add' } })}
        isApplying={false}
        {...noopProps()}
        onDecision={onDecision}
      />,
    );

    const group = screen.getByRole('group', { name: /Decision for Demo/i });
    const addBtn = within(group).getByRole('button', { name: 'Add' });
    const skipBtn = within(group).getByRole('button', { name: 'Skip' });
    const replaceBtn = within(group).getByRole('button', { name: 'Replace' });

    expect(addBtn).toHaveAttribute('aria-pressed', 'true');
    expect(skipBtn).toHaveAttribute('aria-pressed', 'false');
    expect(replaceBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(replaceBtn);
    expect(onDecision).toHaveBeenCalledWith('p1', 'replace');
  });

  it('replace decision shows warning copy', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({ decisions: { p1: 'replace' } })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(
      screen.getByText(/All reforecasts and assignments in the existing project will be overwritten/i),
    ).toBeInTheDocument();
  });

  it('conflict label shown for ID conflicts', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({
          conflicts: {
            p1: { type: 'id', existingId: 'p1', existingName: 'Existing Foo' },
          },
        })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(screen.getByText(/ID conflict with "Existing Foo"/)).toBeInTheDocument();
  });

  it('conflict label shown for name conflicts', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({
          conflicts: {
            p1: { type: 'name', existingId: 'p_other', existingName: 'Existing Bar' },
          },
        })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(screen.getByText(/Name conflict with "Existing Bar"/)).toBeInTheDocument();
  });

  it('cancel button calls onCancel; disabled during isApplying', () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <ImportPreviewSection
        preview={makePreview()}
        isApplying={false}
        {...noopProps()}
        onCancel={onCancel}
      />,
    );
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalled();

    rerender(
      <ImportPreviewSection
        preview={makePreview()}
        isApplying={true}
        {...noopProps()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('Apply button enabled even when all decisions are skip + keep + keep (pitfall #71)', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({
          decisions: { p1: 'skip' },
          settingsDecision: 'keep',
          teamPoolDecision: 'keep',
        })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply Import' })).toBeEnabled();
  });

  it('aria-busy=true on Apply button during apply', () => {
    render(
      <ImportPreviewSection
        preview={makePreview()}
        isApplying={true}
        {...noopProps()}
      />,
    );
    expect(screen.getByRole('button', { name: /Importing/ })).toHaveAttribute('aria-busy', 'true');
  });

  it('duplicate notice rendered when duplicatesDropped > 0; count correct (singular)', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({ duplicatesDropped: 1 })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(
      screen.getByText('1 project had a duplicate ID and was removed from the import.'),
    ).toBeInTheDocument();
  });

  it('duplicate notice rendered when duplicatesDropped > 0; count correct (plural)', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({ duplicatesDropped: 3 })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(
      screen.getByText('3 projects had duplicate IDs and were removed from the import.'),
    ).toBeInTheDocument();
  });

  it('"N of M from file" label shown when duplicatesDropped > 0', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({ duplicatesDropped: 2 })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    // 1 shown + 2 dropped = 3 total
    expect(screen.getByText('Projects (1 of 3 from file)')).toBeInTheDocument();
  });

  it('cloud-mode hydration hint when mode=cloud, existingProjects empty, shownCount>0', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({ mode: 'cloud', existingProjects: [] })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(
      screen.getByText(/If you just enabled cloud sync, your existing projects may still be loading/i),
    ).toBeInTheDocument();
  });

  it('cloud-mode hydration hint NOT shown when existingProjects is non-empty', () => {
    render(
      <ImportPreviewSection
        preview={makePreview({
          mode: 'cloud',
          existingProjects: [makeProject({ id: 'existing-1' })],
        })}
        isApplying={false}
        {...noopProps()}
      />,
    );
    expect(
      screen.queryByText(/cloud sync/i),
    ).not.toBeInTheDocument();
  });

  describe('cloudDataReady prop — Apply button gating', () => {
    it('disables Apply and shows tooltip when cloudDataReady=false in cloud mode', () => {
      render(
        <ImportPreviewSection
          {...noopProps()}
          isApplying={false}
          preview={makePreview({ mode: 'cloud' })}
          cloudDataReady={false}
        />,
      );
      const applyBtn = screen.getByRole('button', { name: /Apply Import/i });
      expect(applyBtn).toBeDisabled();
      expect(applyBtn).toHaveAttribute('title', expect.stringContaining('Waiting'));
    });

    it('enables Apply when cloudDataReady=true in cloud mode', () => {
      render(
        <ImportPreviewSection
          {...noopProps()}
          isApplying={false}
          preview={makePreview({ mode: 'cloud' })}
          cloudDataReady={true}
        />,
      );
      expect(screen.getByRole('button', { name: /Apply Import/i })).not.toBeDisabled();
    });

    it('enables Apply in local mode regardless of cloudDataReady', () => {
      render(
        <ImportPreviewSection
          {...noopProps()}
          isApplying={false}
          preview={makePreview({ mode: 'local' })}
          cloudDataReady={false}
        />,
      );
      expect(screen.getByRole('button', { name: /Apply Import/i })).not.toBeDisabled();
    });
  });
});

describe('ImportBanner', () => {
  function makeResult(over: Partial<ImportMergeResult> = {}): ImportMergeResult {
    return {
      addedCount: 0,
      replacedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errorMessages: [],
      ...over,
    };
  }

  it('renders with role=status for no-error result', () => {
    render(<ImportBanner result={makeResult({ addedCount: 1 })} onDismiss={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders with role=alert for error result', () => {
    render(
      <ImportBanner
        result={makeResult({ errorCount: 1, errorMessages: ['boom'] })}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows error messages list when errorCount > 0', () => {
    render(
      <ImportBanner
        result={makeResult({ errorCount: 2, errorMessages: ['err A', 'err B'] })}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText('err A')).toBeInTheDocument();
    expect(screen.getByText('err B')).toBeInTheDocument();
  });
});

