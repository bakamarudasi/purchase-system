import { useState } from 'react';
import { Filter } from '../icons';
import type { Statistics, VisibleTabs } from '../types';

export type FilterKey = 'all' | '未対応' | '承認' | '却下';

interface Props {
  filter: FilterKey;
  stats: Statistics;
  visibleTabs: VisibleTabs;
  onFilterChange: (key: FilterKey) => void;
  onVisibleTabsChange: (tabs: VisibleTabs) => void;
}

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: '未対応', label: '未対応' },
  { key: '承認', label: '承認済み' },
  { key: '却下', label: '却下' },
];

export function FilterBar({
  filter,
  stats,
  visibleTabs,
  onFilterChange,
  onVisibleTabsChange,
}: Props) {
  const [configOpen, setConfigOpen] = useState(false);

  const countOf = (key: FilterKey): number => {
    switch (key) {
      case 'all':
        return stats.total;
      case '未対応':
        return stats.pending;
      case '承認':
        return stats.approved;
      case '却下':
        return stats.rejected;
    }
  };

  return (
    <div className="flex items-center gap-4 relative">
      <Filter size={20} className="text-stone-600" />
      <div className="flex gap-2 flex-1" role="tablist" aria-label="ステータスフィルタ">
        {TABS.filter(({ key }) => key === 'all' || visibleTabs[key]).map(
          ({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => onFilterChange(key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                filter === key
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {label}
              <span className="ml-2 text-xs opacity-75">({countOf(key)})</span>
            </button>
          ),
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={configOpen}
          onClick={() => setConfigOpen((v) => !v)}
          className="px-3 py-2 bg-stone-100 text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-200 text-sm"
        >
          表示切替
        </button>

        {configOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-xl shadow-xl p-3 z-10">
            <div className="text-xs font-semibold text-stone-500 mb-2">表示するタブ</div>
            {(['未対応', '承認', '却下'] as const).map((k) => (
              <label
                key={k}
                className="flex items-center gap-2 py-1 text-sm text-stone-700"
              >
                <input
                  type="checkbox"
                  checked={visibleTabs[k]}
                  onChange={(e) =>
                    onVisibleTabsChange({ ...visibleTabs, [k]: e.target.checked })
                  }
                />
                {k === '承認' ? '承認済み' : k}
              </label>
            ))}
            <div className="mt-2 text-right">
              <button
                onClick={() => setConfigOpen(false)}
                className="px-3 py-1 text-sm text-stone-600 hover:text-stone-800"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
