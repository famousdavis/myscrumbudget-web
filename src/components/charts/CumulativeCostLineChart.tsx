'use client';

import { useState } from 'react';
import type { MonthlyCalculation } from '@/types/domain';
import { useDarkMode } from '@/hooks/useDarkMode';
import { createLinearScale, computeNiceTicks, formatAxisValue } from './svg-utils';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrency } from '@/lib/utils/format';

interface CumulativeCostLineChartProps {
  monthlyData: MonthlyCalculation[];
  baselineBudget: number;
}

const CHART_WIDTH = 700;
const CHART_HEIGHT = 240;
const MARGIN = { top: 16, right: 16, bottom: 40, left: 60 };
const PLOT_W = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
const DOT_RADIUS = 4;

function shortMonth(month: string): string {
  const [, m] = month.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[m - 1] ?? month;
}

export function CumulativeCostLineChart({
  monthlyData,
  baselineBudget,
}: CumulativeCostLineChartProps) {
  const isDark = useDarkMode();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (monthlyData.length === 0) {
    return <p className="text-sm text-zinc-500">No data to chart.</p>;
  }

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

  // Build line and area paths
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x},${PLOT_H} L${points[0].x},${PLOT_H} Z`;

  const colors = {
    line: isDark ? '#60a5fa' : '#3b82f6',
    areaFill: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(59,130,246,0.1)',
    baseline: isDark ? '#4ade80' : '#22c55e',
    dot: isDark ? '#60a5fa' : '#3b82f6',
    dotHover: isDark ? '#93c5fd' : '#2563eb',
    grid: isDark ? '#3f3f46' : '#e4e4e7',
    text: isDark ? '#a1a1aa' : '#71717a',
    overBudget: isDark ? '#f87171' : '#ef4444',
  };

  const baselineY = yScale(baselineBudget);

  return (
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
              fontSize={10}
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
            y={PLOT_H + 16}
            textAnchor="middle"
            fill={colors.text}
            fontSize={9}
          >
            {shortMonth(d.month)}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={colors.areaFill} />

        {/* Main cumulative line */}
        <path
          d={linePath}
          fill="none"
          stroke={colors.line}
          strokeWidth={2}
          strokeLinejoin="round"
        />

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
          fontSize={9}
        >
          Budget
        </text>

        {/* Data dots + hit areas */}
        {points.map((p, i) => {
          const isHovered = hoverIndex === i;
          const overBudget = monthlyData[i].cumulativeCost > baselineBudget;
          return (
            <circle
              key={monthlyData[i].month}
              cx={p.x}
              cy={p.y}
              r={isHovered ? DOT_RADIUS + 2 : DOT_RADIUS}
              fill={overBudget ? colors.overBudget : (isHovered ? colors.dotHover : colors.dot)}
              stroke={isDark ? '#18181b' : '#ffffff'}
              strokeWidth={1.5}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: 'pointer' }}
            />
          );
        })}

        {/* Tooltip */}
        {hoverIndex !== null && (() => {
          const d = monthlyData[hoverIndex];
          const p = points[hoverIndex];
          return (
            <ChartTooltip x={p.x} y={p.y} visible chartWidth={PLOT_W}>
              <p className="font-medium">{d.month}</p>
              <p>Cumulative: {formatCurrency(d.cumulativeCost)}</p>
            </ChartTooltip>
          );
        })()}
      </g>
    </svg>
  );
}
