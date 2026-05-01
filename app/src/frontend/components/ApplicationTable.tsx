import { useMemo } from 'react';
import { StatusBadge } from './StatusBadge';
import { AlertTriangle } from '../icons';
import { formatDate } from '../utils/format';
import type { Application, SortConfig } from '../types';
import type { Anomaly } from '../hooks/useAnomalies';

interface Props {
  applications: Application[];
  sortConfig: SortConfig;
  onSort: (key: SortConfig['key']) => void;
  onSelect: (app: Application) => void;
  /** 一括操作用の選択行（rowIndex の集合）。undefined の場合は選択UIを出さない */
  selectedRowIndices?: Set<number>;
  onSelectionChange?: (next: Set<number>) => void;
  /** rowIndex → 異常検知結果（あれば） */
  anomalies?: Map<number, Anomaly[]>;
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
  selectedRowIndices,
  onSelectionChange,
  anomalies,
}: Props) {
  const selectionEnabled = !!selectedRowIndices && !!onSelectionChange;
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

  // 一括選択のために、選択可能な行（pending かつ楽観UIでない行）の rowIndex を抽出
  const selectableRowIndices = sorted
    .filter((a) => a.status === '未対応' && !a.clientStatus)
    .map((a) => a.rowIndex);
  const allSelected =
    selectionEnabled &&
    selectableRowIndices.length > 0 &&
    selectableRowIndices.every((idx) => selectedRowIndices?.has(idx));
  const someSelected =
    selectionEnabled &&
    selectableRowIndices.some((idx) => selectedRowIndices?.has(idx)) &&
    !allSelected;

  const toggleAll = () => {
    if (!selectionEnabled || !onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedRowIndices);
      selectableRowIndices.forEach((idx) => next.delete(idx));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedRowIndices);
      selectableRowIndices.forEach((idx) => next.add(idx));
      onSelectionChange(next);
    }
  };

  const toggleOne = (rowIndex: number) => {
    if (!selectionEnabled || !onSelectionChange) return;
    const next = new Set(selectedRowIndices);
    if (next.has(rowIndex)) next.delete(rowIndex);
    else next.add(rowIndex);
    onSelectionChange(next);
  };

  return (
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-3 md:p-6 shadow-lg">
      {/* モバイル: カードレイアウト */}
      <ul className="md:hidden space-y-2">
        {sorted.map((app) => {
          const checkable =
            selectionEnabled && app.status === '未対応' && !app.clientStatus;
          const checked = selectedRowIndices?.has(app.rowIndex) ?? false;
          const rowAnomalies = anomalies?.get(app.rowIndex);
          return (
            <li
              key={app.rowIndex}
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                checked
                  ? 'border-amber-400 bg-amber-50/70'
                  : app.clientStatus === 'sending'
                    ? 'border-sky-200 bg-sky-50/40 opacity-70'
                    : app.clientStatus === 'failed'
                      ? 'border-rose-200 bg-rose-50/40'
                      : 'border-stone-200 hover:bg-amber-50/40'
              }`}
              onClick={() => onSelect(app)}
            >
              <div className="flex items-start gap-3">
                {selectionEnabled && (
                  <div
                    className="pt-1 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {checkable ? (
                      <input
                        type="checkbox"
                        aria-label={`${app.itemName} を選択`}
                        checked={checked}
                        onChange={() => toggleOne(app.rowIndex)}
                        className="w-5 h-5 accent-amber-600"
                      />
                    ) : (
                      <span className="block w-5 text-center text-stone-300 text-xs">
                        -
                      </span>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-stone-800 flex items-center gap-2 min-w-0">
                      <span className="truncate">{app.itemName}</span>
                      {rowAnomalies && (
                        <span
                          title={rowAnomalies
                            .map((x) => `⚠ ${x.message}`)
                            .join('\n')}
                          className="inline-flex items-center justify-center w-5 h-5 flex-shrink-0 rounded-full bg-amber-100 text-amber-700 border border-amber-300"
                        >
                          <AlertTriangle size={12} />
                        </span>
                      )}
                    </div>
                    <StatusBadge
                      status={
                        app.clientStatus === 'sending'
                          ? '送信中'
                          : app.clientStatus === 'failed'
                            ? '送信失敗'
                            : app.status
                      }
                    />
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    {app.name} ・ {app.department} ・ {formatDate(app.timestamp)}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-stone-600">
                      数量 {app.quantity}個
                    </div>
                    <div className="font-bold text-stone-800">
                      ¥{app.totalPrice.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* デスクトップ: テーブル */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-stone-200">
              {selectionEnabled && (
                <th className="px-4 py-4 w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="全選択"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-amber-600 cursor-pointer"
                  />
                </th>
              )}
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
            {sorted.map((app) => {
              const checkable =
                selectionEnabled && app.status === '未対応' && !app.clientStatus;
              const checked = selectedRowIndices?.has(app.rowIndex) ?? false;
              return (
              <tr
                key={app.rowIndex}
                className={`border-b border-stone-100 hover:bg-amber-50/50 transition-colors cursor-pointer ${
                  checked
                    ? 'bg-amber-50/70'
                    : app.clientStatus === 'sending'
                      ? 'opacity-70 bg-sky-50/40'
                      : app.clientStatus === 'failed'
                        ? 'bg-rose-50/40'
                        : ''
                }`}
                onClick={() => onSelect(app)}
              >
                {selectionEnabled && (
                  <td
                    className="px-4 py-4 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {checkable ? (
                      <input
                        type="checkbox"
                        aria-label={`${app.itemName} を選択`}
                        checked={checked}
                        onChange={() => toggleOne(app.rowIndex)}
                        className="w-4 h-4 accent-amber-600 cursor-pointer"
                      />
                    ) : (
                      <span className="text-stone-300 text-xs">-</span>
                    )}
                  </td>
                )}
                <td className="px-6 py-4 text-sm text-stone-600">
                  {formatDate(app.timestamp)}
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-stone-800">{app.name}</div>
                  <div className="text-xs text-stone-500">{app.department}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-stone-800 flex items-center gap-2">
                    <span>{app.itemName}</span>
                    {anomalies?.get(app.rowIndex) && (
                      <span
                        title={anomalies
                          .get(app.rowIndex)!
                          .map((x) => `⚠ ${x.message}`)
                          .join('\n')}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300"
                      >
                        <AlertTriangle size={12} />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-stone-700">{app.quantity}個</td>
                <td className="px-6 py-4 text-right">
                  <div className="font-semibold text-stone-800">
                    ¥{app.totalPrice.toLocaleString()}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <StatusBadge
                    status={
                      app.clientStatus === 'sending'
                        ? '送信中'
                        : app.clientStatus === 'failed'
                          ? '送信失敗'
                          : app.status
                    }
                  />
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
