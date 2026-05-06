import { Home, LayoutDashboard, List, Settings, User } from '../icons';
import type { UserRole } from '../types';

export type ViewKey = 'home' | 'list' | 'mine' | 'dashboard' | 'settings';

interface Props {
  view: ViewKey;
  role: UserRole;
  onChange: (view: ViewKey) => void;
}

interface TabDef {
  key: ViewKey;
  label: string;
  Icon: typeof List;
  /** このタブを表示できるロール。指定なし=全ロール */
  roles?: UserRole[];
}

const TABS: TabDef[] = [
  // ホームは管理者だけ（申請者は「マイページ」で十分）
  { key: 'home', label: 'ホーム', Icon: Home, roles: ['admin'] },
  { key: 'list', label: '申請一覧', Icon: List, roles: ['admin'] },
  { key: 'mine', label: 'マイページ', Icon: User },
  { key: 'dashboard', label: 'ダッシュボード', Icon: LayoutDashboard },
  { key: 'settings', label: '設定', Icon: Settings, roles: ['admin'] },
];

export function ViewSwitcher({ view, role, onChange }: Props) {
  const visible = TABS.filter((t) => !t.roles || t.roles.includes(role));
  return (
    <nav
      role="tablist"
      aria-label="メインビュー切り替え"
      className="inline-flex bg-stone-100 border border-stone-200 rounded-xl p-1 gap-1"
    >
      {visible.map(({ key, label, Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            title={label}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              active
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
