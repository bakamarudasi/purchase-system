import { LayoutDashboard, List, User } from '../icons';

export type ViewKey = 'list' | 'mine' | 'dashboard';

interface Props {
  view: ViewKey;
  onChange: (view: ViewKey) => void;
}

const TABS: { key: ViewKey; label: string; Icon: typeof List }[] = [
  { key: 'list', label: '申請一覧', Icon: List },
  { key: 'mine', label: 'マイページ', Icon: User },
  { key: 'dashboard', label: 'ダッシュボード', Icon: LayoutDashboard },
];

export function ViewSwitcher({ view, onChange }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="メインビュー切り替え"
      className="inline-flex bg-stone-100 border border-stone-200 rounded-xl p-1 gap-1"
    >
      {TABS.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              active
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
