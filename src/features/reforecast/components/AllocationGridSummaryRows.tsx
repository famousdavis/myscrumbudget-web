import type { MonthlyCalculation } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/format';

interface AllocationGridSummaryRowsProps {
  months: string[];
  monthlyData: MonthlyCalculation[];
  hasRowControls: boolean;
}

export function AllocationGridSummaryRows({
  months,
  monthlyData,
  hasRowControls,
}: AllocationGridSummaryRowsProps) {
  if (monthlyData.length === 0) return null;

  return (
    <>
      <tr>
        <td className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900">
          Monthly Cost
        </td>
        {months.map((month) => {
          const md = monthlyData.find((d) => d.month === month);
          return (
            <td
              key={`cost-${month}`}
              className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
            >
              {md ? formatCurrency(md.cost) : ''}
            </td>
          );
        })}
        {hasRowControls && (
          <td className="sticky right-0 z-10 border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
        )}
      </tr>
      <tr>
        <td className="sticky left-0 z-10 border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900">
          Monthly Hours
        </td>
        {months.map((month) => {
          const md = monthlyData.find((d) => d.month === month);
          return (
            <td
              key={`hours-${month}`}
              className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-center text-sm font-medium whitespace-nowrap dark:border-zinc-700 dark:bg-zinc-900"
            >
              {md ? Math.round(md.hours) : ''}
            </td>
          );
        })}
        {hasRowControls && (
          <td className="sticky right-0 z-10 border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
        )}
      </tr>
    </>
  );
}
