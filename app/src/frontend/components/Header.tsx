import { Plus } from '../icons';
import type { CurrentUser } from '../types';

interface Props {
  currentUser: CurrentUser;
  onNewApplication: () => void;
}

export function Header({ currentUser, onNewApplication }: Props) {
  const initial = (currentUser.name || currentUser.email || '?').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-stone-200 shadow-sm">
      <div className="px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">購入申請システム</h1>
          <p className="text-sm text-stone-600 mt-1">効率的な予算管理と承認フロー</p>
        </div>
        <div className="flex items-center gap-4">
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
