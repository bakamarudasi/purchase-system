import { useMemo, useState } from 'react';
import { Download, X } from '../icons';
import { applicationsToCsv, downloadCsv } from '../utils/csv';
import type { Application, ApplicationStatus } from '../types';

interface Props {
  applications: Application[];
  onClose: () => void;
  onDone: (count: number) => void;
}

type StatusFilter = 'all' | ApplicationStatus;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: '未対応', label: '未対応' },
  { value: '承認', label: '承認' },
  { value: '却下', label: '却下' },
  { value: '購入済', label: '購入済' },
  { value: '完了', label: '完了' },
];

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function ExportModal({ applications, onClose, onDone }: Props) {
  const [from, setFrom] = useState(thirtyDaysAgoIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return applications.filter((a) => {
      if (!a.timestamp) return false;
      const t = new Date(a.timestamp).getTime();
      if (isNaN(t)) return false;
      if (t < fromTs || t > toTs) return false;
      if (status !== 'all' && a.status !== status) return false;
      // 楽観UIの仮データは除外
      if (a.rowIndex < 0 || a.clientStatus) return false;
      return true;
    });
  }, [applications, from, to, status]);

  const handleDownload = () => {
    const csv = applicationsToCsv(filtered);
    const filename = `purchase_applications_${from}_to_${to}.csv`;
    downloadCsv(filename, csv);
    onDone(filtered.length);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border-4 border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-orange-700 rounded-xl flex items-center justify-center text-white">
              <Download size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">CSVエクスポート</h2>
              <p className="text-xs text-stone-500">
                Excel 用 UTF-8 BOM 付きで出力
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center justify-center text-stone-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">
                開始日
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">
                終了日
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              ステータス
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="w-full px-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm text-stone-700">
            出力対象: <span className="font-bold text-amber-700">{filtered.length}件</span>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-sm font-semibold"
          >
            キャンセル
          </button>
          <button
            onClick={handleDownload}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-semibold shadow hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            ダウンロード
          </button>
        </div>
      </div>
    </div>
  );
}
