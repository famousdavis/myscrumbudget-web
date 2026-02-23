import type { PoolMember } from '@/types/domain';

interface AllocationGridAddRowProps {
  months: string[];
  pool: PoolMember[];
  addingRow: boolean;
  onAddingRowChange: (adding: boolean) => void;
  onMemberAdd: (poolMemberId: string) => void;
  hasRowControls: boolean;
}

export function AllocationGridAddRow({
  months,
  pool,
  addingRow,
  onAddingRowChange,
  onMemberAdd,
  hasRowControls,
}: AllocationGridAddRowProps) {
  if (!hasRowControls) return null;

  return (
    <tr>
      {addingRow ? (
        <>
          <td
            className="sticky left-0 z-10 border border-zinc-200 bg-white px-1 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <select
              autoFocus
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onMemberAdd(e.target.value);
                }
              }}
              onBlur={() => onAddingRowChange(false)}
              className="w-full rounded border border-zinc-300 px-1 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select member...</option>
              {pool.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name} ({pm.role})
                </option>
              ))}
            </select>
          </td>
          <td
            colSpan={months.length}
            className="border border-zinc-200 dark:border-zinc-700"
          />
          <td className="sticky right-0 z-10 border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950" />
        </>
      ) : (
        <>
          <td
            className="sticky left-0 z-10 border border-zinc-200 bg-white px-3 py-1 dark:border-zinc-700 dark:bg-zinc-950"
          >
            <button
              onClick={() => onAddingRowChange(true)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add member
            </button>
          </td>
          <td
            colSpan={months.length}
            className="border border-zinc-200 dark:border-zinc-700"
          />
          <td className="sticky right-0 z-10 border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950" />
        </>
      )}
    </tr>
  );
}
