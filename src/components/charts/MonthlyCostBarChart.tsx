'use client';

import { useState } from 'react';
import type { MonthlyCalculation } from '@/types/domain';
import { useDarkMode } from '@/hooks/useDarkMode';
import { createLinearScale, computeNiceTicks, formatAxisValue, CHART_WIDTH, CHART_HEIGHT, MARGIN, PLOT_W, PLOT_H } from './svg-utils';
import { ChartTooltip } from './ChartTooltip';
import { formatCurrency } from '@/lib/utils/format';
import { formatShortMonth } from '@/lib/utils/dates';

interface MonthlyCostBarChartProps {
  monthlyData: MonthlyCalculation[];
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

  const colors = {
    bar: isDark ? '#60a5fa' : '#3b82f6',
    barHover: isDark ? '#93c5fd' : '#2563eb',
    grid: isDark ? '#3f3f46' : '#e4e4e7',
    text: isDark ? '#a1a1aa' : '#71717a',
  };

  return (
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
              fontSize={10}
            >
              {formatAxisValue(tick)}
            </text>
          </g>
        ))}

        {/* Bars */}
        {monthlyData.map((d, i) => {
          const x = barGap + i * (barWidth + barGap);
          const barH = PLOT_H - yScale(d.cost);
          const isHovered = hoverIndex === i;
          return (
            <g key={d.month}>
              <rect
                x={x}
                y={yScale(d.cost)}
                width={barWidth}
                height={Math.max(0, barH)}
                fill={isHovered ? colors.barHover : colors.bar}
                rx={2}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'pointer' }}
              />
              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={PLOT_H + 16}
                textAnchor="middle"
                fill={colors.text}
                fontSize={9}
              >
                {formatShortMonth(d.month)}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {hoverIndex !== null && (() => {
          const d = monthlyData[hoverIndex];
          const x = barGap + hoverIndex * (barWidth + barGap) + barWidth / 2;
          const y = yScale(d.cost);
          return (
            <ChartTooltip x={x} y={y} visible chartWidth={PLOT_W}>
              <p className="font-medium">{d.month}</p>
              <p>{formatCurrency(d.cost)}</p>
            </ChartTooltip>
          );
        })()}
      </g>
    </svg>
  );
}
