import { useState } from 'react';
import { Mail, Plus, Settings as SettingsIcon, Trash, User } from '../icons';
import type { Approver, CurrentUser } from '../types';

interface Props {
  currentUser: CurrentUser;
  approvers: Approver[];
  onAdd: (email: string, name: string) => Promise<void>;
  onRemove: (email: string) => Promise<void>;
  onPushToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export function Settings({
  currentUser,
  approvers,
  onAdd,
  onRemove,
  onPushToast,
}: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!name.trim() || !email.trim()) {
      onPushToast('info', '名前とメールアドレスを入力してください');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      onPushToast('info', 'メールアドレスの形式が正しくありません');
      return;
    }
    setBusy(true);
    try {
      await onAdd(email.trim(), name.trim());
      setName('');
      setEmail('');
      onPushToast('success', '承認者を追加しました');
    } catch (e) {
      console.error('承認者追加エラー:', e);
      onPushToast('error', '承認者の追加に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: Approver) => {
    if (!confirm(`${target.name} (${target.email}) を承認者から外しますか？`)) {
      return;
    }
    setBusy(true);
    try {
      await onRemove(target.email);
      onPushToast('success', '承認者を削除しました');
    } catch (e) {
      console.error('承認者削除エラー:', e);
      const msg = e instanceof Error ? e.message : '承認者の削除に失敗しました';
      onPushToast('error', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-stone-600 to-stone-800 rounded-2xl flex items-center justify-center text-white shadow-md">
            <SettingsIcon size={28} />
          </div>
          <div>
            <div className="text-sm text-stone-500">設定</div>
            <h2 className="text-2xl font-bold text-stone-800">承認者リスト</h2>
            <div className="text-xs text-stone-500 mt-0.5">
              ここに登録されたユーザーが管理者として承認操作を行えます
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-stone-800 mb-4">新規追加</h3>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 山田 太郎"
              disabled={busy}
              className="w-full px-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@company.com"
              disabled={busy}
              className="w-full px-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg text-sm font-bold shadow hover:from-amber-700 hover:to-orange-700 disabled:opacity-50"
          >
            <Plus size={16} />
            追加
          </button>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-800">登録ずみ承認者</h3>
          <span className="text-sm text-stone-500">{approvers.length}名</span>
        </div>
        {approvers.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-sm">
            まだ承認者がいません
          </div>
        ) : (
          <ul className="space-y-2">
            {approvers.map((a) => {
              const isMe =
                a.email.trim().toLowerCase() ===
                currentUser.email.trim().toLowerCase();
              return (
                <li
                  key={a.email}
                  className="flex items-center gap-4 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-stone-300 to-stone-400 rounded-full flex items-center justify-center text-white">
                    <User size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-800 flex items-center gap-2">
                      <span className="truncate">{a.name}</span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                          自分
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                      <Mail size={12} />
                      {a.email}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(a)}
                    disabled={busy || isMe}
                    title={isMe ? '自分自身は削除できません' : '承認者から外す'}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash size={12} />
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
