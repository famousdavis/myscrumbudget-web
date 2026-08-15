// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

/**
 * Canvas renderer for the Charter Budget mini distribution chart. Draws the
 * probability density curve for the chosen distribution, a dashed P50/median
 * line, a solid Pₙ (charter) line, and — when an optimism uplift shifted the
 * center — a faint tick at the raw ETC. Shape-only (densities are normalized to
 * the peak), so the un-normalized constants don't matter.
 *
 * Dark-mode-safe: colors are chosen from the shared chart palette by the
 * `isDark` flag the caller reads from `useDarkMode()`.
 */

import type { Distribution } from '@/types/domain';
import { getChartColors } from '@/components/charts/svg-utils';

export interface CharterChartParams {
  distribution: Distribution;
  center: number;
  sigma: number;
  etc: number; // raw ETC (faint tick when center !== etc)
  charterAmount: number;
  medianAmount: number;
  percentile: number;
  isDark: boolean;
}

function normalDensity(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z); // un-normalized; shape only
}

function lognormalDensity(x: number, mu: number, sigma: number): number {
  if (x <= 0) return 0;
  const cv = sigma / mu;
  const sigmaLn = Math.sqrt(Math.log(1 + cv * cv));
  const muLn = Math.log(mu) - (sigmaLn * sigmaLn) / 2;
  const z = (Math.log(x) - muLn) / sigmaLn;
  return Math.exp(-0.5 * z * z) / x; // un-normalized; shape only
}

/** Symmetric Beta(3,3) density on [O, Pb]; ∝ t²(1−t)². */
function betaPertDensity(x: number, O: number, Pb: number): number {
  if (x < O || x > Pb) return 0;
  const t = (x - O) / (Pb - O);
  return t * t * (1 - t) * (1 - t);
}

/**
 * The x-domain the chart is drawn over, and the β-PERT support that goes with it.
 *
 * Extracted from drawCharterChart (v0.37.0) because this is where the chart's
 * decisions live — the three kernels above are two-line `exp` shapes with nothing
 * to get wrong, while everything here is a judgement that changes what the reader
 * sees. It is also the only part testable at all: drawCharterChart is void-returning
 * Canvas 2D, and this repo's jsdom returns null from getContext('2d').
 */
export interface ChartDomain {
  /** Upper end of the x-axis. The domain always starts at 0. */
  upper: number;
  /** β-PERT support lower bound; 0 for the other distributions. */
  betaO: number;
  /** β-PERT support upper bound; 0 for the other distributions. */
  betaPb: number;
}

export function computeChartDomain(p: CharterChartParams): ChartDomain {
  const sqrt7 = Math.sqrt(7);
  let curveMax: number;
  let betaO = 0;
  let betaPb = 0;
  if (p.distribution === 'beta_pert') {
    betaO = p.center - sqrt7 * p.sigma;
    betaPb = p.center + sqrt7 * p.sigma;
    if (betaO < 0) {
      // A symmetric window would put mass below zero, which is meaningless for a
      // cost. Anchor at 0 and mirror the width about the centre instead.
      betaO = 0;
      betaPb = 2 * p.center;
    }
    curveMax = betaPb;
  } else if (p.distribution === 'lognormal') {
    curveMax = p.center + 5 * p.sigma;
  } else {
    curveMax = p.center + 4 * p.sigma;
  }
  // The axis must contain the curve AND both vertical markers, with headroom so
  // the Pₙ line and its label are never flush against the right edge.
  const upper = Math.max(curveMax, p.charterAmount * 1.08, p.center * 1.05);
  return { upper, betaO, betaPb };
}

/**
 * Un-normalized density at `x` for the selected distribution — shape only.
 * Values are meaningful relative to each other, never as probabilities.
 */
export function densityAt(x: number, p: CharterChartParams, d: ChartDomain): number {
  if (p.distribution === 'lognormal') return lognormalDensity(x, p.center, p.sigma);
  if (p.distribution === 'beta_pert') return betaPertDensity(x, d.betaO, d.betaPb);
  return x < 0 ? 0 : normalDensity(x, p.center, p.sigma); // truncated at 0
}

export function drawCharterChart(
  canvas: HTMLCanvasElement,
  p: CharterChartParams,
): void {
  if (typeof window === 'undefined') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const colors = getChartColors(p.isDark);
  const cssW = canvas.clientWidth || 320;
  const cssH = canvas.clientHeight || 160;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const padX = 8;
  const padTop = 10;
  const padBottom = 18;
  const plotW = cssW - padX * 2;
  const plotH = cssH - padTop - padBottom;
  const baseY = padTop + plotH;

  // ---- x-domain: always start at 0; upper bound covers the curve + Pₙ line ----
  const domain = computeChartDomain(p);
  const { upper } = domain;

  const density = (x: number): number => densityAt(x, p, domain);

  const xToPx = (v: number) => padX + (v / upper) * plotW;

  // ---- sample + normalize ----
  const N = 180;
  const xs: number[] = [];
  const ds: number[] = [];
  let maxD = 0;
  for (let i = 0; i <= N; i++) {
    const x = (upper * i) / N;
    const d = density(x);
    xs.push(x);
    ds.push(d);
    if (d > maxD) maxD = d;
  }
  if (maxD <= 0) maxD = 1;

  // ---- filled curve ----
  ctx.beginPath();
  ctx.moveTo(xToPx(0), baseY);
  for (let i = 0; i <= N; i++) {
    const y = baseY - (ds[i] / maxD) * plotH;
    ctx.lineTo(xToPx(xs[i]), y);
  }
  ctx.lineTo(xToPx(upper), baseY);
  ctx.closePath();
  ctx.fillStyle = p.isDark ? 'rgba(96,165,250,0.22)' : 'rgba(37,99,235,0.16)';
  ctx.fill();
  ctx.strokeStyle = colors.primary;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const px = xToPx(xs[i]);
    const py = baseY - (ds[i] / maxD) * plotH;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // ---- baseline axis ----
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, baseY);
  ctx.lineTo(padX + plotW, baseY);
  ctx.stroke();

  const vLine = (v: number, color: string, dash: number[]) => {
    const px = xToPx(v);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(px, padTop);
    ctx.lineTo(px, baseY);
    ctx.stroke();
    ctx.restore();
    return px;
  };

  // raw-ETC tick when the center was shifted by an uplift
  if (Math.abs(p.center - p.etc) > 0.5) {
    vLine(p.etc, colors.text, [2, 3]);
  }
  // P50 / median (dashed gray) and Pₙ charter (solid blue)
  vLine(p.medianAmount, colors.text, [4, 3]);
  const pnPx = vLine(p.charterAmount, colors.primary, []);

  // Pₙ label
  ctx.fillStyle = colors.primary;
  ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
  const label = `P${p.percentile}`;
  const lw = ctx.measureText(label).width;
  const lx = Math.min(Math.max(pnPx - lw / 2, padX), padX + plotW - lw);
  ctx.fillText(label, lx, padTop - 1 + 9);
}
