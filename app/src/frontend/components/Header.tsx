import { Plus, Wifi, WifiOff } from '../icons';
import type { CurrentUser } from '../types';
import { ViewSwitcher, type ViewKey } from './ViewSwitcher';

interface Props {
  currentUser: CurrentUser;
  view: ViewKey;
  onViewChange: (view: ViewKey) => void;
  online: boolean;
  onNewApplication: () => void;
  /** 自分宛の承認待ち件数。管理者のみ意味を持つ */
  pendingForMeCount?: number;
  /** バッジクリック時に「自分宛の承認待ち」絞り込みに飛ばす */
  onPendingForMeClick?: () => void;
}

export function Header({
  currentUser,
  view,
  onViewChange,
  online,
  onNewApplication,
  pendingForMeCount = 0,
  onPendingForMeClick,
}: Props) {
  const initial = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();
  const isAdmin = currentUser.role === 'admin';

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stone-200 shadow-sm">
      <div className="px-8 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-6 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-stone-800">購入申請システム</h1>
            <p className="text-sm text-stone-600 mt-1">効率的な予算管理と承認フロー</p>
          </div>
          <ViewSwitcher view={view} role={currentUser.role} onChange={onViewChange} />
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && pendingForMeCount > 0 && (
            <button
              type="button"
              onClick={onPendingForMeClick}
              className="relative flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors"
              title="自分宛の承認待ちにジャンプ"
            >
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-rose-600 text-white text-xs font-bold rounded-full">
                {pendingForMeCount}
              </span>
              <span>承認待ち</span>
            </button>
          )}
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
            <div className="flex flex-col leading-tight">
              <span className="text-stone-700 text-sm">{currentUser.email || 'ゲスト'}</span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  isAdmin ? 'text-amber-700' : 'text-stone-500'
                }`}
              >
                {isAdmin ? '管理者' : '申請者'}
              </span>
            </div>
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
