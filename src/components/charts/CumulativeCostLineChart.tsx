// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import { useState } from 'react';
import { useDarkMode } from '@/hooks/useDarkMode';
import { createLinearScale, computeNiceTicks, formatAxisValue, getChartColors, CHART_WIDTH, CHART_HEIGHT, MARGIN, PLOT_W, PLOT_H } from './svg-utils';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrency } from '@/lib/utils/format';
import { formatShortMonth } from '@/lib/utils/dates';
import type { ChartDataPoint } from '@/lib/utils/buildChartData';

interface CumulativeCostLineChartProps {
  monthlyData: ChartDataPoint[];
  baselineBudget: number;
}

const DOT_RADIUS = 4;

export function CumulativeCostLineChart({
  monthlyData,
  baselineBudget,
}: CumulativeCostLineChartProps) {
  const isDark = useDarkMode();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (monthlyData.length === 0) {
    return <p className="text-sm text-zinc-500">No data to chart.</p>;
  }

  // chartData's cumulativeCost is authoritative (legacy mode applies the offset
  // upstream; historical mode recomputes across the merged series).
  const maxCumulative = Math.max(
    ...monthlyData.map((d) => d.cumulativeCost),
    baselineBudget,
  );
  const ticks = computeNiceTicks(0, maxCumulative, 5);
  const yMax = ticks[ticks.length - 1] ?? maxCumulative;

  const yScale = createLinearScale([0, yMax], [PLOT_H, 0]);
  const n = monthlyData.length;
  const xStep = n > 1 ? PLOT_W / (n - 1) : PLOT_W / 2;

  const points = monthlyData.map((d, i) => ({
    x: n > 1 ? i * xStep : PLOT_W / 2,
    y: yScale(d.cumulativeCost),
  }));

  // Find the last point that contains any actuals (historical or blended) —
  // split point between the solid past-trajectory and the dashed forecast.
  // The blended point IS where the transition occurs and belongs to the
  // solid (past) segment for visual continuity.
  let lastActualIdx = -1;
  for (let i = 0; i < monthlyData.length; i++) {
    if (monthlyData[i].segment !== 'forecast') lastActualIdx = i;
  }
  const hasActuals = lastActualIdx >= 0;
  const hasForecast = monthlyData.some((d) => d.segment === 'forecast');
  const isMixed = hasActuals && hasForecast;

  const palette = getChartColors(isDark);
  const colors = {
    line: palette.primary,
    historicalLine: palette.secondary,
    areaFill: palette.areaFill,
    baseline: palette.baseline,
    dot: palette.primary,
    dotHover: palette.primaryHover,
    historicalDot: palette.secondary,
    historicalDotHover: palette.secondaryHover,
    grid: palette.grid,
    text: palette.text,
    overBudget: palette.overBudget,
  };

  // Area path spans the whole series (single fill regardless of split)
  const fullLinePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${fullLinePath} L${points[points.length - 1].x},${PLOT_H} L${points[0].x},${PLOT_H} Z`;

  // Build the visible line — single solid path when not mixed, two segments when mixed.
  // In mixed mode the forecast segment starts at lastActualIdx so the segments visually connect.
  const historicalPath = isMixed
    ? points.slice(0, lastActualIdx + 1).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : null;
  const forecastPath = isMixed
    ? points.slice(lastActualIdx).map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : null;

  const baselineY = yScale(baselineBudget);

  return (
    <div>
      {isMixed && (
        <div className="mb-2 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.historicalLine }}
              aria-hidden="true"
            />
            Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.line }}
              aria-hidden="true"
            />
            Forecast
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        width="100%"
        className="select-none"
        role="img"
        aria-label="Cumulative cost line chart"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grid lines + Y-axis ticks */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                y1={yScale(tick)}
                x2={PLOT_W}
                y2={yScale(tick)}
                stroke={colors.grid}
                strokeWidth={0.5}
              />
              <text
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill={colors.text}
                fontSize={13}
              >
                {formatAxisValue(tick)}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {monthlyData.map((d, i) => (
            <text
              key={d.month}
              x={points[i].x}
              y={PLOT_H + 18}
              textAnchor="middle"
              fill={colors.text}
              fontSize={15}
            >
              {formatShortMonth(d.month)}
            </text>
          ))}

          {/* Area fill — single span beneath the whole line */}
          <path d={areaPath} fill={colors.areaFill} />

          {/* Cumulative line: split into historical (solid teal) + forecast (dashed blue)
              when mixed; single solid line otherwise. */}
          {isMixed ? (
            <>
              <path
                d={historicalPath ?? ''}
                fill="none"
                stroke={colors.historicalLine}
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <path
                d={forecastPath ?? ''}
                fill="none"
                stroke={colors.line}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeDasharray="6,4"
              />
            </>
          ) : (
            <path
              d={fullLinePath}
              fill="none"
              stroke={colors.line}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}

          {/* Baseline reference line (dashed) */}
          <line
            x1={0}
            y1={baselineY}
            x2={PLOT_W}
            y2={baselineY}
            stroke={colors.baseline}
            strokeWidth={1.5}
            strokeDasharray="6,4"
          />
          <text
            x={PLOT_W + 4}
            y={baselineY}
            dominantBaseline="middle"
            fill={colors.baseline}
            fontSize={13}
          >
            Budget
          </text>

          {/* Data dots + hit areas. Blended points (which contain actuals) use
              the historical color, matching the bar chart's bottom teal stack. */}
          {points.map((p, i) => {
            const isHovered = hoverIndex === i;
            const segment = monthlyData[i].segment;
            const hasActuals = segment !== 'forecast';
            const overBudget = monthlyData[i].cumulativeCost > baselineBudget;
            const baseFill = hasActuals ? colors.historicalDot : colors.dot;
            const hoverFill = hasActuals ? colors.historicalDotHover : colors.dotHover;
            return (
              <circle
                key={monthlyData[i].month}
                cx={p.x}
                cy={p.y}
                r={isHovered ? DOT_RADIUS + 2 : DOT_RADIUS}
                fill={overBudget ? colors.overBudget : (isHovered ? hoverFill : baseFill)}
                stroke={isDark ? '#18181b' : '#ffffff'}
                strokeWidth={1.5}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}

          {/* Tooltip */}
          {hoverIndex !== null && (
            <ChartTooltip x={points[hoverIndex].x} y={points[hoverIndex].y} visible chartWidth={PLOT_W}>
              <p className="font-medium">{monthlyData[hoverIndex].month}</p>
              <p>Cumulative: {formatCurrency(monthlyData[hoverIndex].cumulativeCost)}</p>
            </ChartTooltip>
          )}
        </g>
      </svg>
    </div>
  );
}
