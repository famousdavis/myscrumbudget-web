// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

'use client';

import type { ReactNode } from 'react';

interface ChartTooltipProps {
  x: number;
  y: number;
  visible: boolean;
  children: ReactNode;
  /** Width of the parent SVG viewBox — used to clamp position */
  chartWidth: number;
  /** Number of text lines inside the tooltip. Default 2 (line chart and
   *  non-blended bar chart). Bar chart's blended-month variant passes 4
   *  (Month + Actual + Forecast + Total). The tooltip auto-sizes its
   *  height so it hugs the data point on the 2-line case. */
  lineCount?: number;
}

const TOOLTIP_WIDTH = 220;
const TOOLTIP_OFFSET = 8;
// At text-base (16px) the line-height is ~24px. py-2 contributes 16px,
// borders 2px, and we add a small visual buffer.
const LINE_HEIGHT = 24;
const VERTICAL_PADDING = 24;

export function ChartTooltip({
  x,
  y,
  visible,
  children,
  chartWidth,
  lineCount = 2,
}: ChartTooltipProps) {
  if (!visible) return null;

  const height = lineCount * LINE_HEIGHT + VERTICAL_PADDING;

  // Clamp horizontally so tooltip doesn't overflow the viewBox
  let tx = x + TOOLTIP_OFFSET;
  if (tx + TOOLTIP_WIDTH > chartWidth) {
    tx = x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
  }
  // Position the tooltip's bottom edge ~TOOLTIP_OFFSET above the hovered
  // point. Clamp to 0 so the tooltip never extends above the chart.
  const ty = Math.max(0, y - height - TOOLTIP_OFFSET);

  return (
    <foreignObject x={tx} y={ty} width={TOOLTIP_WIDTH} height={height}>
      <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-base shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {children}
      </div>
    </foreignObject>
  );
}
