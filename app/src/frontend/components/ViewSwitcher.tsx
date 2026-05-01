import { LayoutDashboard, List, User } from '../icons';
import type { UserRole } from '../types';

export type ViewKey = 'list' | 'mine' | 'dashboard';

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
  // 全社の申請一覧は管理者だけが見られる
  { key: 'list', label: '申請一覧', Icon: List, roles: ['admin'] },
  { key: 'mine', label: 'マイページ', Icon: User },
  { key: 'dashboard', label: 'ダッシュボード', Icon: LayoutDashboard },
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
