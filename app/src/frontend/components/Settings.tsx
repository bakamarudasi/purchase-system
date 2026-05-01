import { useState } from 'react';
import { Mail, Plus, Settings as SettingsIcon, Trash, User } from '../icons';
import type { Approver, CurrentUser } from '../types';

type RoleKey = 'approver' | 'confirmer' | 'purchaser';

interface Props {
  currentUser: CurrentUser;
  approvers: Approver[];
  confirmers: Approver[];
  purchasers: Approver[];
  onAddApprover: (email: string, name: string) => Promise<void>;
  onRemoveApprover: (email: string) => Promise<void>;
  onAddConfirmer: (email: string, name: string) => Promise<void>;
  onRemoveConfirmer: (email: string) => Promise<void>;
  onAddPurchaser: (email: string, name: string) => Promise<void>;
  onRemovePurchaser: (email: string) => Promise<void>;
  onPushToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const ROLE_LABELS: Record<RoleKey, string> = {
  approver: '承認者',
  confirmer: '確認者',
  purchaser: '購入者',
};

const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
  approver: '承認・却下を行うユーザー（GRリーダーなど）',
  confirmer: '承認後の内容確認を行うユーザー（武藤さんなど）',
  purchaser: '実際に商品を購入するユーザー（高橋さん・高松さんなど）',
};

export function Settings({
  currentUser,
  approvers,
  confirmers,
  purchasers,
  onAddApprover,
  onRemoveApprover,
  onAddConfirmer,
  onRemoveConfirmer,
  onAddPurchaser,
  onRemovePurchaser,
  onPushToast,
}: Props) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-stone-600 to-stone-800 rounded-2xl flex items-center justify-center text-white shadow-md">
            <SettingsIcon size={28} />
          </div>
          <div>
            <div className="text-sm text-stone-500">設定</div>
            <h2 className="text-2xl font-bold text-stone-800">役割管理</h2>
            <div className="text-xs text-stone-500 mt-0.5">
              承認者 → 確認者 → 購入者 の各ロールにユーザーを登録します
            </div>
          </div>
        </div>
      </div>

      <RoleSection
        roleKey="approver"
        members={approvers}
        currentUser={currentUser}
        onAdd={onAddApprover}
        onRemove={onRemoveApprover}
        onPushToast={onPushToast}
      />
      <RoleSection
        roleKey="confirmer"
        members={confirmers}
        currentUser={currentUser}
        onAdd={onAddConfirmer}
        onRemove={onRemoveConfirmer}
        onPushToast={onPushToast}
      />
      <RoleSection
        roleKey="purchaser"
        members={purchasers}
        currentUser={currentUser}
        onAdd={onAddPurchaser}
        onRemove={onRemovePurchaser}
        onPushToast={onPushToast}
      />
    </div>
  );
}

interface RoleSectionProps {
  roleKey: RoleKey;
  members: Approver[];
  currentUser: CurrentUser;
  onAdd: (email: string, name: string) => Promise<void>;
  onRemove: (email: string) => Promise<void>;
  onPushToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

function RoleSection({
  roleKey,
  members,
  currentUser,
  onAdd,
  onRemove,
  onPushToast,
}: RoleSectionProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const label = ROLE_LABELS[roleKey];

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
      onPushToast('success', `${label}を追加しました`);
    } catch (e) {
      console.error(`${label}追加エラー:`, e);
      onPushToast('error', `${label}の追加に失敗しました`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (target: Approver) => {
    if (!confirm(`${target.name} (${target.email}) を${label}から外しますか？`)) {
      return;
    }
    setBusy(true);
    try {
      await onRemove(target.email);
      onPushToast('success', `${label}を削除しました`);
    } catch (e) {
      console.error(`${label}削除エラー:`, e);
      const msg = e instanceof Error ? e.message : `${label}の削除に失敗しました`;
      onPushToast('error', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-stone-800">{label}リスト</h3>
        <div className="text-xs text-stone-500 mt-0.5">
          {ROLE_DESCRIPTIONS[roleKey]}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end mb-6">
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

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-stone-600">
          登録ずみ {label}
        </span>
        <span className="text-xs text-stone-500">{members.length}名</span>
      </div>
      {members.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm border border-dashed border-stone-200 rounded-xl">
          まだ{label}がいません
        </div>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const isMe =
              m.email.trim().toLowerCase() ===
              currentUser.email.trim().toLowerCase();
            // 承認者だけは「自分自身を削除できない」制約あり
            const cannotRemoveSelf = roleKey === 'approver' && isMe;
            return (
              <li
                key={m.email}
                className="flex items-center gap-4 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-stone-300 to-stone-400 rounded-full flex items-center justify-center text-white">
                  <User size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-800 flex items-center gap-2">
                    <span className="truncate">{m.name}</span>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                        自分
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} />
                    {m.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(m)}
                  disabled={busy || cannotRemoveSelf}
                  title={
                    cannotRemoveSelf ? '自分自身は削除できません' : `${label}から外す`
                  }
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
  );
}
