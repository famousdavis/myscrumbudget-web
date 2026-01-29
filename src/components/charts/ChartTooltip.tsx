'use client';

import type { ReactNode } from 'react';

interface ChartTooltipProps {
  x: number;
  y: number;
  visible: boolean;
  children: ReactNode;
  /** Width of the parent SVG viewBox — used to clamp position */
  chartWidth: number;
}

const TOOLTIP_WIDTH = 140;
const TOOLTIP_OFFSET = 8;

export function ChartTooltip({
  x,
  y,
  visible,
  children,
  chartWidth,
}: ChartTooltipProps) {
  if (!visible) return null;

  // Clamp horizontally so tooltip doesn't overflow the viewBox
  let tx = x + TOOLTIP_OFFSET;
  if (tx + TOOLTIP_WIDTH > chartWidth) {
    tx = x - TOOLTIP_WIDTH - TOOLTIP_OFFSET;
  }
  const ty = Math.max(0, y - 30);

  return (
    <foreignObject x={tx} y={ty} width={TOOLTIP_WIDTH} height={60}>
      <div className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {children}
      </div>
    </foreignObject>
  );
}
