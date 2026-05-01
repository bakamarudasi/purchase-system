import { useState } from 'react';
import { Filter } from '../icons';
import type { Statistics, VisibleTabs } from '../types';

export type FilterKey = 'all' | '承認待ち' | '確認待ち' | '購入待ち' | '注文済' | '却下';

interface Props {
  filter: FilterKey;
  stats: Statistics;
  visibleTabs: VisibleTabs;
  onFilterChange: (key: FilterKey) => void;
  onVisibleTabsChange: (tabs: VisibleTabs) => void;
}

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: '承認待ち', label: '承認待ち' },
  { key: '確認待ち', label: '確認待ち' },
  { key: '購入待ち', label: '購入待ち' },
  { key: '注文済', label: '注文済' },
  { key: '却下', label: '却下' },
];

const TOGGLEABLE: Exclude<FilterKey, 'all'>[] = [
  '承認待ち',
  '確認待ち',
  '購入待ち',
  '注文済',
  '却下',
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
      case '承認待ち':
        return stats.pendingApproval;
      case '確認待ち':
        return stats.pendingConfirmation;
      case '購入待ち':
        return stats.pendingPurchase;
      case '注文済':
        return stats.ordered;
      case '却下':
        return stats.rejected;
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 relative">
      <Filter size={20} className="text-stone-600 hidden sm:block" />
      <div className="flex gap-2 flex-1 flex-wrap" role="tablist" aria-label="ステータスフィルタ">
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
            {TOGGLEABLE.map((k) => (
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
                {k}
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
