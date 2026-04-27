import { useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../utils/format';
import type { Application, SortConfig } from '../types';

interface Props {
  applications: Application[];
  sortConfig: SortConfig;
  onSort: (key: SortConfig['key']) => void;
  onSelect: (app: Application) => void;
}

interface ColumnDef {
  key: SortConfig['key'];
  label: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: ColumnDef[] = [
  { key: 'timestamp', label: '申請日時', align: 'left' },
  { key: 'name', label: '申請者', align: 'left' },
  { key: 'itemName', label: '商品名', align: 'left' },
  { key: 'quantity', label: '数量', align: 'left' },
  { key: 'totalPrice', label: '金額', align: 'right' },
  { key: 'status', label: 'ステータス', align: 'center' },
];

export function ApplicationTable({
  applications,
  sortConfig,
  onSort,
  onSelect,
}: Props) {
  const sorted = useMemo(() => {
    const items = [...applications];
    items.sort((a, b) => {
      const av = a[sortConfig.key];
      const bv = b[sortConfig.key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (av > bv) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return items;
  }, [applications, sortConfig]);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-6xl mb-4">🔍</div>
        <p className="text-stone-500">該当する申請がありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-stone-200">
              {COLUMNS.map(({ key, label, align }) => (
                <th
                  key={key}
                  onClick={() => onSort(key)}
                  className={`px-6 py-4 text-${align} text-xs font-semibold text-stone-600 uppercase tracking-wider cursor-pointer hover:bg-stone-100 transition-colors`}
                >
                  <div
                    className={`flex items-center gap-2 ${
                      align === 'right' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>{label}</span>
                    {sortConfig.key === key && (
                      <span className="text-amber-600">
                        {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
              <th className="px-6 py-4 text-center text-xs font-semibold text-stone-600 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((app) => (
              <tr
                key={app.rowIndex}
                className="border-b border-stone-100 hover:bg-amber-50/50 transition-colors cursor-pointer"
                onClick={() => onSelect(app)}
              >
                <td className="px-6 py-4 text-sm text-stone-600">
                  {formatDate(app.timestamp)}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-stone-800">{app.name}</div>
                  <div className="text-xs text-stone-500">{app.department}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-stone-800">{app.itemName}</div>
                </td>
                <td className="px-6 py-4 text-stone-700">{app.quantity}個</td>
                <td className="px-6 py-4 text-right">
                  <div className="font-semibold text-stone-800">
                    ¥{app.totalPrice.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge status={app.status} />
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(app);
                    }}
                    className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors text-sm font-medium border border-amber-300"
                  >
                    詳細
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
