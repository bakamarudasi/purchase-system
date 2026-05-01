import { Plus, Wifi, WifiOff } from '../icons';
import type { CurrentUser } from '../types';
import { ViewSwitcher, type ViewKey } from './ViewSwitcher';

interface Props {
  currentUser: CurrentUser;
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  online: boolean;
  onNewApplication: () => void;
}

export function Header({
  currentUser,
  view,
  onViewChange,
  online,
  onNewApplication,
}: Props) {
  const initial = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stone-200 shadow-sm">
      <div className="px-8 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-stone-800">購入申請システム</h1>
            <p className="text-sm text-stone-600 mt-1">効率的な予算管理と承認フロー</p>
          </div>
          <ViewSwitcher view={view} onChange={onViewChange} />
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
              online
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
            title={online ? 'オンライン' : 'オフライン: 一部機能が制限されます'}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{online ? 'オンライン' : 'オフライン'}</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-stone-100 rounded-xl border border-stone-200">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-orange-700 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </div>
            <span className="text-stone-700 text-sm">{currentUser.email || 'ゲスト'}</span>
          </div>
          <button
            onClick={onNewApplication}
            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg"
          >
            <Plus size={16} />
            <span>新規申請</span>
          </button>
        </div>
      </div>
    </header>
  );
}
