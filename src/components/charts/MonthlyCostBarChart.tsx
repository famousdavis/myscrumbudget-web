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

interface MonthlyCostBarChartProps {
  monthlyData: ChartDataPoint[];
}

export function MonthlyCostBarChart({ monthlyData }: MonthlyCostBarChartProps) {
  const isDark = useDarkMode();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (monthlyData.length === 0) {
    return <p className="text-sm text-zinc-500">No monthly data to chart.</p>;
  }

  const maxCost = Math.max(...monthlyData.map((d) => d.cost), 0);
  const ticks = computeNiceTicks(0, maxCost, 5);
  const yMax = ticks[ticks.length - 1] ?? maxCost;

  const yScale = createLinearScale([0, yMax], [PLOT_H, 0]);
  const barWidth = Math.max(4, PLOT_W / monthlyData.length - 4);
  const barGap = (PLOT_W - barWidth * monthlyData.length) / (monthlyData.length + 1);

  const palette = getChartColors(isDark);
  const colors = {
    forecast: palette.primary,
    forecastHover: palette.primaryHover,
    historical: palette.secondary,
    historicalHover: palette.secondaryHover,
    grid: palette.grid,
    text: palette.text,
  };

  const hasHistorical = monthlyData.some((d) => d.historicalCost > 0);
  const hasForecast = monthlyData.some((d) => d.forecastCost > 0);
  const showLegend = hasHistorical && hasForecast;

  return (
    <div>
      {showLegend && (
        <div className="mb-2 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.historical }}
              aria-hidden="true"
            />
            Actual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colors.forecast }}
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
        aria-label="Monthly cost bar chart"
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

          {/* Stacked bars: historical (teal) at bottom, forecast (blue) on top.
              For pure-historical or pure-forecast months, only one segment is drawn. */}
          {monthlyData.map((d, i) => {
            const x = barGap + i * (barWidth + barGap);
            const isHovered = hoverIndex === i;
            const histH = Math.max(0, PLOT_H - yScale(d.historicalCost));
            const forecastH = Math.max(0, PLOT_H - yScale(d.forecastCost));
            const histY = PLOT_H - histH;
            const forecastY = histY - forecastH;

            return (
              <g
                key={d.month}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'pointer' }}
              >
                {d.historicalCost > 0 && (
                  <rect
                    x={x}
                    y={histY}
                    width={barWidth}
                    height={histH}
                    fill={isHovered ? colors.historicalHover : colors.historical}
                    rx={d.forecastCost > 0 ? 0 : 2}
                  />
                )}
                {d.forecastCost > 0 && (
                  <rect
                    x={x}
                    y={forecastY}
                    width={barWidth}
                    height={forecastH}
                    fill={isHovered ? colors.forecastHover : colors.forecast}
                    rx={d.historicalCost > 0 ? 0 : 2}
                  />
                )}
                {/* X-axis label */}
                <text
                  x={x + barWidth / 2}
                  y={PLOT_H + 18}
                  textAnchor="middle"
                  fill={colors.text}
                  fontSize={15}
                >
                  {formatShortMonth(d.month)}
                </text>
              </g>
            );
          })}

          {/* Tooltip — shows segment breakdown for blended months */}
          {hoverIndex !== null && (
            <ChartTooltip
              x={barGap + hoverIndex * (barWidth + barGap) + barWidth / 2}
              y={yScale(monthlyData[hoverIndex].cost)}
              visible
              chartWidth={PLOT_W}
            >
              <p className="font-medium">{monthlyData[hoverIndex].month}</p>
              {monthlyData[hoverIndex].segment === 'blended' ? (
                <>
                  <p>Actual: {formatCurrency(monthlyData[hoverIndex].historicalCost)}</p>
                  <p>Forecast: {formatCurrency(monthlyData[hoverIndex].forecastCost)}</p>
                  <p className="font-medium">Total: {formatCurrency(monthlyData[hoverIndex].cost)}</p>
                </>
              ) : (
                <p>{formatCurrency(monthlyData[hoverIndex].cost)}</p>
              )}
            </ChartTooltip>
          )}
        </g>
      </svg>
    </div>
  );
}
