import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Refresh, Trash, X } from '../icons';
import { usePersistentDraft } from '../hooks/usePersistentDraft';
import type { Approver, CurrentUser } from '../types';

export interface SubmitPayload {
  name: string;
  department: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  productUrl?: string;
  selectedApprover?: string;
  accountCategory?: string;
  chargingDepartment?: string;
  file?: { name: string; mimeType: string; data: string };
}

interface DraftPayload {
  itemName: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  productUrl: string;
  selectedApprover: string;
  accountCategory: string;
  chargingDepartmentSelection: string;
  chargingDepartmentOther: string;
  savedAt: string;
}

const DRAFT_KEY_PREFIX = 'purchase-system:draft:';

interface Props {
  currentUser: CurrentUser;
  approvers: Approver[];
  accountCategories: string[];
  chargingDepartments: string[];
  /** 物品申請が必要になる金額しきい値（円） */
  itemRequestThreshold: number;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onPushToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function NewApplicationForm({
  currentUser,
  approvers,
  accountCategories,
  chargingDepartments,
  itemRequestThreshold,
  onClose,
  onSubmit,
  onPushToast,
}: Props) {
  // 数量・単価は数値で管理する (旧コードは文字列で持っていて NaN になっていた)
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [reason, setReason] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');
  const [accountCategory, setAccountCategory] = useState('');
  // 負担部署は「選択値」と「その他自由入力」を別 state で持つ
  const [chargingDepartmentSelection, setChargingDepartmentSelection] =
    useState('');
  const [chargingDepartmentOther, setChargingDepartmentOther] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restorePromptShown, setRestorePromptShown] = useState(false);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);

  const isOther = chargingDepartmentSelection === 'その他';
  // 実際にサーバへ送る負担部署文字列
  const chargingDepartmentValue = isOther
    ? chargingDepartmentOther.trim()
    : chargingDepartmentSelection;

  // ユーザー単位で下書きを分離（複数アカウントが同じブラウザを使うケース対策）
  const draftKey = `${DRAFT_KEY_PREFIX}${currentUser.email || 'guest'}`;
  const draft = usePersistentDraft<DraftPayload>(draftKey);
  const initialDraft = draft.initial;
  const draftSave = draft.save;
  const draftClear = draft.clear;
  const hasMountedRef = useRef(false);

  const totalPrice = quantity * unitPrice;

  // 下書きが存在する場合、復元ダイアログを表示する
  useEffect(() => {
    if (!hasMountedRef.current && initialDraft) {
      setRestorePromptShown(true);
      hasMountedRef.current = true;
    }
  }, [initialDraft]);

  useEffect(() => {
    if (approvers.length > 0 && !selectedApprover) {
      setSelectedApprover(approvers[0].email);
    }
  }, [approvers, selectedApprover]);

  useEffect(() => {
    if (accountCategories.length > 0 && !accountCategory) {
      setAccountCategory(accountCategories[0]);
    }
  }, [accountCategories, accountCategory]);

  useEffect(() => {
    if (chargingDepartments.length > 0 && !chargingDepartmentSelection) {
      setChargingDepartmentSelection(chargingDepartments[0]);
    }
  }, [chargingDepartments, chargingDepartmentSelection]);

  // 入力内容を debounce 付きで自動保存
  useEffect(() => {
    // 何も入力されていない真っ新な状態は保存しない（ノイズ防止）
    if (!itemName && !reason && !productUrl && quantity === 0 && unitPrice === 0) {
      return;
    }
    const now = new Date().toISOString();
    setAutoSavedAt(now);
    draftSave({
      itemName,
      quantity,
      unitPrice,
      reason,
      productUrl,
      selectedApprover,
      accountCategory,
      chargingDepartmentSelection,
      chargingDepartmentOther,
      savedAt: now,
    });
  }, [
    itemName,
    quantity,
    unitPrice,
    reason,
    productUrl,
    selectedApprover,
    accountCategory,
    chargingDepartmentSelection,
    chargingDepartmentOther,
    draftSave,
  ]);

  const handleRestoreDraft = () => {
    if (!initialDraft) return;
    setItemName(initialDraft.itemName ?? '');
    setQuantity(initialDraft.quantity ?? 0);
    setUnitPrice(initialDraft.unitPrice ?? 0);
    setReason(initialDraft.reason ?? '');
    setProductUrl(initialDraft.productUrl ?? '');
    if (initialDraft.selectedApprover) {
      setSelectedApprover(initialDraft.selectedApprover);
    }
    if (initialDraft.accountCategory) {
      setAccountCategory(initialDraft.accountCategory);
    }
    if (initialDraft.chargingDepartmentSelection) {
      setChargingDepartmentSelection(initialDraft.chargingDepartmentSelection);
    }
    if (initialDraft.chargingDepartmentOther) {
      setChargingDepartmentOther(initialDraft.chargingDepartmentOther);
    }
    setRestoredAt(initialDraft.savedAt);
    setRestorePromptShown(false);
  };

  const handleDiscardDraft = () => {
    draftClear();
    setRestorePromptShown(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) {
      setFile(null);
      return;
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      onPushToast('info', 'PDF / 画像 / Excel ファイルのいずれかを選択してください');
      e.target.value = '';
      setFile(null);
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      onPushToast(
        'error',
        `ファイルサイズは ${MAX_FILE_SIZE / 1024 / 1024}MB 以下にしてください`,
      );
      e.target.value = '';
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      onPushToast('info', '商品名を入力してください');
      return;
    }
    if (quantity <= 0 || unitPrice <= 0) {
      onPushToast('info', '数量と単価は 1 以上を入力してください');
      return;
    }
    if (!accountCategory) {
      onPushToast('info', '勘定科目を選択してください');
      return;
    }
    if (!chargingDepartmentValue) {
      onPushToast(
        'info',
        isOther
          ? '負担部署（その他）の名称を入力してください'
          : '負担部署を選択してください',
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const base: SubmitPayload = {
        name: currentUser.name,
        department: currentUser.department,
        itemName,
        quantity,
        unitPrice,
        reason,
        productUrl: productUrl || undefined,
        selectedApprover: selectedApprover || undefined,
        accountCategory,
        chargingDepartment: chargingDepartmentValue,
      };

      if (file) {
        const data = await readFileAsBase64(file);
        base.file = { name: file.name, mimeType: file.type, data };
      }

      await onSubmit(base);
      // 送信成功後は下書きをクリア
      draftClear();
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPriceForWarning = quantity * unitPrice;
  const showThresholdWarning =
    itemRequestThreshold > 0 && totalPriceForWarning >= itemRequestThreshold;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-8 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-none md:rounded-3xl shadow-2xl max-w-2xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden md:border-4 md:border-stone-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 md:p-8 pb-2 md:pb-4 flex-shrink-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-stone-800">新規購入申請</h2>
              {(autoSavedAt || restoredAt) && (
                <div className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  下書き自動保存中
                  {restoredAt && (
                    <span className="text-stone-400">
                      （前回 {formatDraftTime(restoredAt)} の下書きを復元）
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center justify-center text-stone-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {restorePromptShown && initialDraft && (
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-amber-900">
                  保存された下書きがあります
                </div>
                <div className="text-xs text-amber-700 mt-1 truncate">
                  {formatDraftTime(initialDraft.savedAt)} 時点 ・
                  {initialDraft.itemName ? ` 「${initialDraft.itemName}」` : ' 未入力の下書き'}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <Refresh size={14} />
                  復元する
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-100 text-stone-600 text-sm font-semibold rounded-lg border border-stone-200 transition-colors"
                  title="下書きを破棄"
                >
                  <Trash size={14} />
                  破棄
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="px-4 md:px-8 pb-4 md:pb-8 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-stone-600 mb-2 block">
                承認者
              </label>
              <select
                value={selectedApprover}
                onChange={(e) => setSelectedApprover(e.target.value)}
                className="w-full px-4 py-3 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-900 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {approvers.map((a) => (
                  <option key={a.email} value={a.email}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-600 mb-2 block">
                商品名
              </label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="例: 高機能オフィスチェア"
                className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-600 mb-2 block">
                購入商品URL
              </label>
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://example.com/product/123"
                className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-semibold text-stone-600 mb-2 block">
                  数量
                </label>
                <input
                  type="number"
                  min={0}
                  value={quantity || ''}
                  onChange={(e) =>
                    setQuantity(parseInt(e.target.value || '0', 10))
                  }
                  placeholder="0"
                  className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-stone-600 mb-2 block">
                  単価
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-stone-500">
                    ¥
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={unitPrice || ''}
                    onChange={(e) =>
                      setUnitPrice(parseFloat(e.target.value || '0'))
                    }
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-4 text-right">
              <span className="text-sm text-stone-600">合計金額</span>
              <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-700 to-orange-700">
                ¥{totalPrice.toLocaleString()}
              </p>
            </div>

            {showThresholdWarning && (
              <div className="p-4 rounded-2xl border-2 border-amber-300 bg-amber-50 flex items-start gap-3">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-200 text-amber-800">
                  <AlertTriangle size={18} />
                </span>
                <div className="text-sm text-amber-900 leading-relaxed">
                  <div className="font-bold mb-1">
                    ¥{itemRequestThreshold.toLocaleString()} 以上の購入は別途「物品申請」が必要です
                  </div>
                  <div>
                    物品申請後、購入担当者が対応します。
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-stone-600 mb-2 block">
                  勘定科目
                </label>
                <select
                  value={accountCategory}
                  onChange={(e) => setAccountCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {accountCategories.length === 0 && (
                    <option value="">（勘定科目が未登録）</option>
                  )}
                  {accountCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-stone-600 mb-2 block">
                  負担部署
                </label>
                <select
                  value={chargingDepartmentSelection}
                  onChange={(e) =>
                    setChargingDepartmentSelection(e.target.value)
                  }
                  className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {chargingDepartments.length === 0 && (
                    <option value="">（負担部署が未登録）</option>
                  )}
                  {chargingDepartments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {isOther && (
                  <input
                    type="text"
                    value={chargingDepartmentOther}
                    onChange={(e) =>
                      setChargingDepartmentOther(e.target.value)
                    }
                    placeholder="負担部署名を入力"
                    className="mt-2 w-full px-4 py-3 bg-white border-2 border-amber-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-600 mb-2 block">
                購入理由
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="例: 腰痛改善のため、現在の椅子の買い替え"
                className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-stone-600 mb-2 block">
                添付ファイル (PDF / 画像 / Excel, 最大 10MB)
              </label>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,.xlsx,.xls"
                onChange={handleFileChange}
                className="w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
              />
            </div>
          </div>
        </div>
        <div className="p-4 md:p-8 pt-4 md:pt-6 mt-auto bg-white border-t-2 border-stone-100 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold transition-colors"
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : '申請する'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDraftTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}時間前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('ファイル読み込みに失敗しました'));
        return;
      }
      // result は "data:<mime>;base64,<data>" の形式
      const data = result.split(',')[1] ?? '';
      resolve(data);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
