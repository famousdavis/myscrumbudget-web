// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

/**
 * Charter Budget panel — the PM completes a five-question risk profile and the
 * model derives a CV and a charter budget at a chosen percentile/distribution,
 * with ETC pre-populating as the cost basis. An explainable parametric
 * contingency heuristic — every contingency dollar traces to a selection — and
 * explicitly NOT a guarantee.
 *
 * Reactivity: the engine result is a useMemo on [profile, distribution,
 * percentile, etc], NOT computed in onChange handlers — so a reforecast switch
 * or inbound cloud sync (which updates the `etc` prop, not a form field) reflows
 * the cost basis before Apply.
 *
 * Reseed-on-Edit: the page keys this panel by the active reforecast id, so a
 * reforecast switch remounts it and the useState initializers re-seed from the
 * new reforecast's stored charter (§7.6).
 *
 * The hook (applyCharterBudget) is ignorant of the model: THIS panel owns the
 * single mapping from (engine result + form inputs + calculatedAt) → the stored
 * CharterBudget object (handleApply).
 */

import { useId, useMemo, useRef, useEffect, useState } from 'react';
import type {
  RiskProfile,
  Distribution,
  CharterBudget,
} from '@/types/domain';
import {
  BASE_CV,
  ADJUSTMENTS,
  computeCV,
  computeCharterBudget,
  CV_FLOOR,
  CV_CEILING,
  UPLIFT_MAX,
  ALLOWED_PERCENTILES,
} from '@/lib/calc/charterBudget';
import { formatCurrency } from '@/lib/utils/format';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { useDarkMode } from '@/hooks/useDarkMode';
import { drawCharterChart } from './charterChart';

interface CharterBudgetPanelProps {
  /** Live ETC (the cost basis); null when there are no allocations. */
  etc: number | null;
  /** Stored charter on the active reforecast (for Edit restore); undefined = none. */
  existing?: CharterBudget;
  /** True when the live ETC has drifted from the stored charter's etcAtCalculation. */
  stale: boolean;
  /** Controlled open state (the summary-bar link opens this). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (charterBudget: CharterBudget) => void;
}

const selectClass =
  'w-full rounded border border-zinc-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900';
const numInputClass =
  'w-20 rounded border border-zinc-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900';
const cardClass = 'rounded-lg border border-zinc-200 p-3 dark:border-zinc-800';

const PROJECT_TYPE_OPTIONS: { value: RiskProfile['projectType']; label: string }[] = [
  { value: 'vendor', label: 'COTS / vendor implementation' },
  { value: 'infra', label: 'Infrastructure / cloud migration' },
  { value: 'biz', label: 'Business process / org transformation' },
  { value: 'custom', label: 'Custom software development' },
  { value: 'data', label: 'Data engineering / analytics / BI' },
  { value: 'ai', label: 'AI / ML / data science' },
];
const REQUIREMENTS_OPTIONS: { value: RiskProfile['requirementsClarity']; label: string }[] = [
  { value: 'well', label: 'Well-defined' },
  { value: 'partial', label: 'Partially defined' },
  { value: 'expl', label: 'Exploratory' },
];
const EXPERIENCE_OPTIONS: { value: RiskProfile['teamExperience']; label: string }[] = [
  { value: 'high', label: 'High (done before)' },
  { value: 'some', label: 'Some' },
  { value: 'new', label: 'New to team' },
];
const ORGCHANGE_OPTIONS: { value: RiskProfile['orgChangeImpact']; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'mod', label: 'Moderate' },
  { value: 'high', label: 'High' },
];
const INTEGRATION_OPTIONS: { value: RiskProfile['integrationComplexity']; label: string }[] = [
  { value: 'solo', label: 'Standalone' },
  { value: 'mod', label: 'Moderate' },
  { value: 'high', label: 'High / many systems' },
];
const DISTRIBUTION_OPTIONS: { value: Distribution; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'lognormal', label: 'Lognormal' },
  { value: 'beta_pert', label: 'Beta-PERT' },
];

const pct = (f: number, d = 1) => `${(f * 100).toFixed(d)}%`;
const signedPct = (f: number) => `${f >= 0 ? '+' : '−'}${Math.abs(f * 100).toFixed(0)}%`;

/** Parse a percentage UI input into a clamped fraction. NaN → fallback. */
function parseFractionPercent(input: string, min: number, max: number, fallback: number): number {
  const parsed = parseFloat(input.replace('%', '').trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed / 100));
}

export function CharterBudgetPanel({
  etc,
  existing,
  stale,
  open,
  onOpenChange,
  onApply,
}: CharterBudgetPanelProps) {
  const ids = useId();
  const isDark = useDarkMode();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- form state (seeded once from `existing`; page remounts per reforecast) ---
  const [projectType, setProjectType] = useState<RiskProfile['projectType']>(
    existing?.riskProfile.projectType ?? 'custom',
  );
  const [requirementsClarity, setRequirementsClarity] = useState<RiskProfile['requirementsClarity']>(
    existing?.riskProfile.requirementsClarity ?? 'partial',
  );
  const [teamExperience, setTeamExperience] = useState<RiskProfile['teamExperience']>(
    existing?.riskProfile.teamExperience ?? 'some',
  );
  const [orgChangeImpact, setOrgChangeImpact] = useState<RiskProfile['orgChangeImpact']>(
    existing?.riskProfile.orgChangeImpact ?? 'mod',
  );
  const [integrationComplexity, setIntegrationComplexity] = useState<RiskProfile['integrationComplexity']>(
    existing?.riskProfile.integrationComplexity ?? 'mod',
  );
  const [distribution, setDistribution] = useState<Distribution>(existing?.distribution ?? 'normal');
  const [percentile, setPercentile] = useState<number>(existing?.targetPercentile ?? 80);
  const [etcIsP80Schedule, setEtcIsP80Schedule] = useState<boolean>(existing?.etcIsP80Schedule ?? false);

  const seedOverride = existing?.riskProfile.cvOverride ?? null;
  const [cvOverrideEnabled, setCvOverrideEnabled] = useState<boolean>(seedOverride != null);
  const [cvOverrideInput, setCvOverrideInput] = useState<string>(
    seedOverride != null ? String(Math.round(seedOverride * 100)) : '',
  );

  const seedUplift = existing?.riskProfile.optimismUpliftPct ?? 0;
  const [upliftEnabled, setUpliftEnabled] = useState<boolean>(seedUplift > 0);
  const [upliftInput, setUpliftInput] = useState<string>(
    seedUplift > 0 ? String(Math.round(seedUplift * 100)) : '',
  );

  // --- derived fractions ---
  const cvOverrideFraction = cvOverrideEnabled
    ? parseFractionPercent(cvOverrideInput, CV_FLOOR, CV_CEILING, CV_FLOOR)
    : null;
  const upliftFraction = upliftEnabled
    ? parseFractionPercent(upliftInput, 0, UPLIFT_MAX, 0)
    : 0;

  const profile = useMemo<RiskProfile>(
    () => ({
      projectType,
      requirementsClarity,
      teamExperience,
      orgChangeImpact,
      integrationComplexity,
      cvOverride: cvOverrideFraction,
      optimismUpliftPct: upliftFraction,
    }),
    [
      projectType,
      requirementsClarity,
      teamExperience,
      orgChangeImpact,
      integrationComplexity,
      cvOverrideFraction,
      upliftFraction,
    ],
  );

  const cvResult = useMemo(() => computeCV(profile), [profile]);
  const result = useMemo(
    () => (etc != null ? computeCharterBudget(profile, distribution, percentile, etc) : null),
    [profile, distribution, percentile, etc],
  );

  // --- mini chart ---
  useEffect(() => {
    if (!open || !result || !canvasRef.current) return;
    drawCharterChart(canvasRef.current, {
      distribution,
      center: result.center,
      sigma: result.sigma,
      etc: result.etc,
      charterAmount: result.charterAmount,
      medianAmount: result.medianAmount,
      percentile,
      isDark,
    });
  }, [open, result, distribution, percentile, isDark]);

  const handleApply = () => {
    if (!result) return;
    // SINGLE mapping place: engine result + form inputs + calculatedAt → stored
    // CharterBudget. Field names diverge here (cv→derivedCV, center→
    // adjustedCostBasis, etc→etcAtCalculation, charterAmount→charterBudgetAmount).
    // charterBudgetAmount is rounded to the nearest whole dollar because it
    // becomes the reforecast's baselineBudget — a charter budget is a sponsor-
    // facing dollar figure, not a sub-cent quantile. Rounding happens HERE, not
    // in the engine (the §4.7 golden tests assert the raw charterAmount/ETC
    // multiples) and NOT on etcAtCalculation (it is compared cents-wise against
    // live ETC for staleness; rounding it would falsely flag a fresh charter as
    // stale immediately after Apply).
    const charterBudget: CharterBudget = {
      riskProfile: profile,
      distribution,
      targetPercentile: percentile,
      etcIsP80Schedule,
      derivedCV: result.cv,
      derivedSigma: result.sigma,
      etcAtCalculation: result.etc,
      adjustedCostBasis: result.center,
      charterBudgetAmount: Math.round(result.charterAmount),
      medianAmount: result.medianAmount,
      calculatedAt: new Date().toISOString(),
    };
    onApply(charterBudget);
    onOpenChange(false);
  };

  const breakdownRows: { label: string; delta: number; isBase?: boolean }[] = [
    { label: 'Base (project type)', delta: BASE_CV[projectType], isBase: true },
    { label: 'Requirements clarity', delta: ADJUSTMENTS.requirements[requirementsClarity] },
    { label: 'Team experience', delta: ADJUSTMENTS.experience[teamExperience] },
    { label: 'Org-change impact', delta: ADJUSTMENTS.orgChange[orgChangeImpact] },
    { label: 'Integration complexity', delta: ADJUSTMENTS.integration[integrationComplexity] },
  ];

  return (
    <div className="mt-6">
      <CollapsibleSection title="Charter Budget" open={open} onOpenChange={onOpenChange}>
        {etc == null ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Enter team allocations first — a charter budget needs an ETC cost basis.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ---------- LEFT: risk profile ---------- */}
            <div className="space-y-4 text-sm">
              <div>
                <label htmlFor={`${ids}-ptype`} className="mb-1 block font-medium">
                  Project type
                </label>
                <select
                  id={`${ids}-ptype`}
                  name="charterProjectType"
                  className={selectClass}
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value as RiskProfile['projectType'])}
                >
                  {PROJECT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${ids}-req`} className="mb-1 block font-medium">
                    Requirements clarity
                  </label>
                  <select
                    id={`${ids}-req`}
                    name="charterRequirements"
                    className={selectClass}
                    value={requirementsClarity}
                    onChange={(e) =>
                      setRequirementsClarity(e.target.value as RiskProfile['requirementsClarity'])
                    }
                  >
                    {REQUIREMENTS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${ids}-exp`} className="mb-1 block font-medium">
                    Team experience
                  </label>
                  <select
                    id={`${ids}-exp`}
                    name="charterExperience"
                    className={selectClass}
                    value={teamExperience}
                    onChange={(e) => setTeamExperience(e.target.value as RiskProfile['teamExperience'])}
                  >
                    {EXPERIENCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${ids}-org`} className="mb-1 block font-medium">
                    Org-change impact
                  </label>
                  <select
                    id={`${ids}-org`}
                    name="charterOrgChange"
                    className={selectClass}
                    value={orgChangeImpact}
                    onChange={(e) => setOrgChangeImpact(e.target.value as RiskProfile['orgChangeImpact'])}
                  >
                    {ORGCHANGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${ids}-int`} className="mb-1 block font-medium">
                    Integration complexity
                  </label>
                  <select
                    id={`${ids}-int`}
                    name="charterIntegration"
                    className={selectClass}
                    value={integrationComplexity}
                    onChange={(e) =>
                      setIntegrationComplexity(e.target.value as RiskProfile['integrationComplexity'])
                    }
                  >
                    {INTEGRATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${ids}-pct`} className="mb-1 block font-medium">
                    Percentile
                  </label>
                  <select
                    id={`${ids}-pct`}
                    name="charterPercentile"
                    className={`${selectClass} ${etcIsP80Schedule && percentile !== 60 ? 'ring-1 ring-amber-400' : ''}`}
                    value={percentile}
                    onChange={(e) => setPercentile(Number(e.target.value))}
                  >
                    {ALLOWED_PERCENTILES.map((p) => (
                      <option key={p} value={p}>
                        P{p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={`${ids}-dist`} className="mb-1 block font-medium">
                    Distribution
                  </label>
                  <select
                    id={`${ids}-dist`}
                    name="charterDistribution"
                    className={selectClass}
                    value={distribution}
                    onChange={(e) => setDistribution(e.target.value as Distribution)}
                  >
                    {DISTRIBUTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Manual CV override */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    name="charterCvOverrideEnabled"
                    checked={cvOverrideEnabled}
                    onChange={(e) => setCvOverrideEnabled(e.target.checked)}
                  />
                  Manual CV override
                </label>
                {cvOverrideEnabled && (
                  <div className="flex items-center gap-2 pl-6">
                    <input
                      id={`${ids}-cvov`}
                      name="charterCvOverride"
                      type="number"
                      min={Math.round(CV_FLOOR * 100)}
                      max={Math.round(CV_CEILING * 100)}
                      step={1}
                      autoComplete="off"
                      className={numInputClass}
                      value={cvOverrideInput}
                      onChange={(e) => setCvOverrideInput(e.target.value)}
                      aria-label="Manual CV override percent"
                    />
                    <span className="text-zinc-500 dark:text-zinc-400">
                      % (range {Math.round(CV_FLOOR * 100)}–{Math.round(CV_CEILING * 100)})
                    </span>
                  </div>
                )}
              </div>

              {/* Optimism-bias uplift */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    name="charterUpliftEnabled"
                    checked={upliftEnabled}
                    onChange={(e) => setUpliftEnabled(e.target.checked)}
                  />
                  Optimism-bias adjustment
                </label>
                {upliftEnabled && (
                  <div className="flex items-center gap-2 pl-6">
                    <input
                      id={`${ids}-uplift`}
                      name="charterUplift"
                      type="number"
                      min={0}
                      max={Math.round(UPLIFT_MAX * 100)}
                      step={1}
                      autoComplete="off"
                      className={numInputClass}
                      value={upliftInput}
                      onChange={(e) => setUpliftInput(e.target.value)}
                      aria-label="Optimism-bias uplift percent"
                    />
                    <span className="text-zinc-500 dark:text-zinc-400">% added to ETC before contingency</span>
                  </div>
                )}
              </div>

              {/* CV breakdown */}
              <div className={cardClass}>
                <p className="mb-2 font-medium">CV breakdown</p>
                <table className="w-full text-sm">
                  <tbody>
                    {breakdownRows.map((row) => (
                      <tr key={row.label}>
                        <td className="py-0.5 text-zinc-600 dark:text-zinc-400">{row.label}</td>
                        <td
                          className={`py-0.5 text-right font-medium ${
                            row.isBase || row.delta === 0
                              ? ''
                              : row.delta < 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {row.isBase ? pct(row.delta, 0) : signedPct(row.delta)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="py-0.5 font-medium text-blue-700 dark:text-blue-300">
                        Composite{cvResult.overrideActive ? ' (overridden)' : ''}
                      </td>
                      <td className="py-0.5 text-right font-medium text-blue-700 dark:text-blue-300">
                        {pct(Math.max(0, cvResult.composite))}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-medium">Applied CV</td>
                      <td className="py-0.5 text-right font-medium">{pct(cvResult.applied)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {result?.cvWarn && (
                <p className="rounded bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Consider P85 — tail risk is understated above 30% CV.
                </p>
              )}
              {cvResult.ceilingActive && (
                <p className="rounded bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  CV clamped to the 50% ceiling — output is least reliable; consider re-scoping before
                  chartering.
                </p>
              )}
            </div>

            {/* ---------- RIGHT: results ---------- */}
            <div className="space-y-3 text-sm">
              {stale && existing && (
                <p className="rounded bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  ETC changed since this charter was set (was {formatCurrency(existing.etcAtCalculation)},
                  now {formatCurrency(etc)}). Re-apply to refresh.
                </p>
              )}

              <div className={cardClass}>
                <p className="text-zinc-500 dark:text-zinc-400">Cost basis (ETC)</p>
                <p className="text-base font-medium">{formatCurrency(etc)}</p>
                {result && upliftFraction > 0 && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Adjusted basis (+{pct(upliftFraction, 0)}): {formatCurrency(result.center)}
                  </p>
                )}
              </div>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="charterScheduleSource"
                  className="mt-0.5"
                  checked={etcIsP80Schedule}
                  onChange={(e) => setEtcIsP80Schedule(e.target.checked)}
                />
                <span>ETC based on a P80+ schedule forecast (e.g., SPERT&reg; Forecaster)</span>
              </label>
              {etcIsP80Schedule && (
                <p className="rounded bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  Targeting P60 recommended — stacking P80 cost on a P80 schedule ETC gives
                  &asymp; P88&ndash;P90 effective coverage.
                </p>
              )}
              {etcIsP80Schedule && upliftFraction > 0 && (
                <p className="rounded bg-amber-50 px-3 py-2 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  These settings encode opposite assumptions — a conservative (P80) schedule basis but
                  optimistic cost allocations. Confirm both apply to this project.
                </p>
              )}

              {result && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={cardClass}>
                      <p className="text-zinc-500 dark:text-zinc-400">Applied CV</p>
                      <p className="text-base font-medium">{pct(result.cv)}</p>
                    </div>
                    <div className={cardClass}>
                      <p className="text-zinc-500 dark:text-zinc-400">&sigma; (std dev)</p>
                      <p className="text-base font-medium">{formatCurrency(result.sigma)}</p>
                    </div>
                  </div>

                  <div className={cardClass}>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      {distribution === 'lognormal' ? 'Expected median (P50)' : 'Median (P50)'}
                    </p>
                    <p className="text-base font-medium">{formatCurrency(result.medianAmount)}</p>
                  </div>

                  {/* Charter breakdown (two honest lines when uplift > 0) */}
                  <div className={cardClass}>
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="py-0.5 text-zinc-600 dark:text-zinc-400">Expected cost (ETC)</td>
                          <td className="py-0.5 text-right">{formatCurrency(result.etc)}</td>
                        </tr>
                        {upliftFraction > 0 && (
                          <>
                            <tr>
                              <td className="py-0.5 text-zinc-600 dark:text-zinc-400">
                                Optimism-bias adjustment ({signedPct(upliftFraction)})
                              </td>
                              <td className="py-0.5 text-right">+{formatCurrency(result.upliftAmount)}</td>
                            </tr>
                            <tr>
                              <td className="py-0.5 text-zinc-600 dark:text-zinc-400">Adjusted cost basis</td>
                              <td className="py-0.5 text-right">{formatCurrency(result.center)}</td>
                            </tr>
                          </>
                        )}
                        <tr>
                          <td className="py-0.5 text-zinc-600 dark:text-zinc-400">
                            Risk contingency (P{percentile})
                          </td>
                          <td className="py-0.5 text-right">+{formatCurrency(result.contingencyAmt)}</td>
                        </tr>
                        <tr className="border-t border-zinc-200 dark:border-zinc-800">
                          <td className="py-1 font-semibold">Charter Budget (P{percentile})</td>
                          <td className="py-1 text-right text-base font-semibold text-blue-700 dark:text-blue-300">
                            {formatCurrency(result.charterAmount)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <canvas
                    ref={canvasRef}
                    className="h-40 w-full rounded border border-zinc-200 dark:border-zinc-800"
                  />
                </>
              )}

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Assumes the chartered scope is delivered; in fixed-budget Scrum, overruns may surface as
                reduced scope. This is a planning heuristic, not a guarantee.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!result}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600"
                >
                  Apply as baseline budget
                </button>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
