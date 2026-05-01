import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { AlertTriangle, X } from '../icons';
import { formatDate, getDriveFileId } from '../utils/format';
import type { Application, CurrentUser } from '../types';
import type { Anomaly } from '../hooks/useAnomalies';

interface Props {
  application: Application;
  currentUser: CurrentUser;
  onClose: () => void;
  onApprove: (rowIndex: number, comment: string) => Promise<void>;
  onReject: (rowIndex: number, comment: string) => Promise<void>;
  onConfirm: (rowIndex: number) => Promise<void>;
  onMarkOrdered: (rowIndex: number, actualAmount: number) => Promise<void>;
  anomalies?: Anomaly[];
}

export function ApplicationDetail({
  application,
  currentUser,
  onClose,
  onApprove,
  onReject,
  onConfirm,
  onMarkOrdered,
  anomalies,
}: Props) {
  const [comment, setComment] = useState('');
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actualAmountInput, setActualAmountInput] = useState<string>(
    String(application.totalPrice),
  );

  // 承認可能判定: 承認待ち + ログイン中ユーザー = 当該申請の承認者
  const canApprove =
    application.status === '承認待ち' &&
    currentUser.email !== '' &&
    application.approver === currentUser.email;

  // 確認可能判定: 確認待ち + ログイン中ユーザーが確認者リストに登録済み
  const canConfirm =
    application.status === '確認待ち' && currentUser.isConfirmer;

  // 注文済登録可能判定: 購入待ち + ログイン中ユーザーが購入者リストに登録済み
  const canMarkOrdered =
    application.status === '購入待ち' && currentUser.isPurchaser;

  const fileId = application.fileInfo
    ? getDriveFileId(application.fileInfo.url)
    : null;
  const canPreview = !!fileId;

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      await onApprove(application.rowIndex, comment);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      await onReject(application.rowIndex, comment);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm(application.rowIndex);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkOrdered = async () => {
    const amount = Number(actualAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      alert('実際金額は0以上の数値で入力してください');
      return;
    }
    setIsLoading(true);
    try {
      await onMarkOrdered(application.rowIndex, amount);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-8 z-50"
      onClick={() => {
        onClose();
        setIsPreviewingPdf(false);
      }}
    >
      <div
        className="bg-white rounded-none md:rounded-3xl shadow-2xl max-w-5xl w-full h-full md:h-[90vh] overflow-hidden md:border-4 md:border-stone-200 flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 md:p-8 pb-0 flex-shrink-0">
          <button
            onClick={() => {
              onClose();
              setIsPreviewingPdf(false);
            }}
            className="absolute top-4 right-4 md:top-8 md:right-8 w-10 h-10 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center justify-center text-stone-700 transition-colors z-10"
          >
            <X size={20} />
          </button>
          <div className="mb-6">
            <h2 className="text-xl md:text-3xl font-bold text-stone-800 mb-2 pr-12">
              {application.itemName}
            </h2>
            <div className="flex items-center gap-4 text-sm text-stone-600">
              <span>{application.name}</span>
              <span>•</span>
              <span>{application.department}</span>
              <span>•</span>
              <span>{formatDate(application.timestamp)}</span>
            </div>
          </div>
          {anomalies && anomalies.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl border-2 border-amber-300 bg-amber-50">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-amber-200 text-amber-800">
                  <AlertTriangle size={18} />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-bold text-amber-900 mb-1">
                    注意: 異常が検知されました
                  </div>
                  <ul className="space-y-1">
                    {anomalies.map((a, i) => (
                      <li key={i} className="text-sm text-amber-800">
                        ・{a.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {isPreviewingPdf && fileId ? (
          <div className="flex-grow flex flex-col h-full">
            <div className="px-4 md:px-8 pb-4">
              <button
                onClick={() => setIsPreviewingPdf(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors text-sm font-medium"
              >
                ← 詳細に戻る
              </button>
            </div>
            <iframe
              title="添付ファイルプレビュー"
              src={`https://drive.google.com/file/d/${fileId}/preview`}
              className="w-full h-full border-t-2 border-stone-200"
            />
          </div>
        ) : (
          <div className="p-4 md:p-8 pt-0 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
              <div className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-4">
                  申請情報
                </h3>
                <div className="space-y-4">
                  <Row
                    label="数量"
                    value={`${application.quantity}個`}
                  />
                  <Row
                    label="単価"
                    value={`¥${application.unitPrice.toLocaleString()}`}
                  />
                  <Row
                    label="合計金額"
                    value={
                      <span className="font-semibold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-amber-700 to-orange-700">
                        ¥{application.totalPrice.toLocaleString()}
                      </span>
                    }
                  />
                  {application.actualAmount != null && (
                    <Row
                      label="実際金額"
                      value={
                        <span className="font-semibold text-stone-800">
                          ¥{application.actualAmount.toLocaleString()}
                          {application.amountDiff != null && application.amountDiff !== 0 && (
                            <span
                              className={`ml-2 text-sm ${
                                application.amountDiff > 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-600'
                              }`}
                            >
                              ({application.amountDiff > 0 ? '+' : ''}
                              {application.amountDiff.toLocaleString()})
                            </span>
                          )}
                        </span>
                      }
                    />
                  )}
                  <Row
                    label="ステータス"
                    value={<StatusBadge status={application.status} />}
                  />
                  {application.productUrl && (
                    <Row
                      label="商品URL"
                      value={
                        <a
                          href={application.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-amber-700 hover:underline truncate max-w-[200px]"
                        >
                          {application.productUrl}
                        </a>
                      }
                    />
                  )}
                </div>
                {application.reason && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-2">
                      購入理由
                    </h3>
                    <p className="text-stone-700 leading-relaxed">
                      {application.reason}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-4">
                  添付ファイル
                </h3>
                {application.fileInfo ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-stone-100 p-4 rounded-xl border border-stone-200">
                      <div className="text-4xl">📄</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-stone-800 truncate">
                          {application.fileInfo.name}
                        </div>
                        <div className="text-sm text-stone-600">
                          {application.fileInfo.size}
                        </div>
                      </div>
                      {canPreview && (
                        <button
                          onClick={() => setIsPreviewingPdf(true)}
                          className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors text-sm font-medium border border-amber-300"
                        >
                          プレビュー
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
                    <div className="text-4xl mb-2">📎</div>
                    <p>添付ファイルなし</p>
                  </div>
                )}
              </div>
            </div>

            {canApprove && (
              <div className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-6 mb-4">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-4">
                  承認アクション
                </h3>
                <input
                  type="text"
                  placeholder="コメントを入力(任意)"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
                  disabled={isLoading}
                />
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleApprove}
                    className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? '処理中...' : '✓ 承認する'}
                  </button>
                  <button
                    onClick={handleReject}
                    className="px-6 py-4 bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-xl font-semibold hover:from-rose-700 hover:to-red-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                  >
                    {isLoading ? '処理中...' : '✗ 却下する'}
                  </button>
                </div>
              </div>
            )}

            {canConfirm && (
              <div className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-6 mb-4">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-4">
                  確認アクション
                </h3>
                <p className="text-sm text-stone-600 mb-4">
                  内容に問題がなければ「確認」ボタンを押してください。購入者に購入依頼が通知されます。
                </p>
                <button
                  onClick={handleConfirm}
                  className="w-full px-6 py-4 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-xl font-semibold hover:from-sky-700 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? '処理中...' : '✓ 確認する'}
                </button>
              </div>
            )}

            {canMarkOrdered && (
              <div className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-6 mb-4">
                <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-4">
                  注文済登録
                </h3>
                <p className="text-sm text-stone-600 mb-4">
                  商品を購入したら、実際の購入金額を入力して「注文済」ボタンを押してください。申請者に通知されます。
                </p>
                <label className="block text-sm font-semibold text-stone-700 mb-2">
                  実際金額 <span className="text-rose-600">*</span>
                </label>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-stone-600">¥</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={actualAmountInput}
                    onChange={(e) => setActualAmountInput(e.target.value)}
                    className="flex-1 px-4 py-3 bg-white border-2 border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    disabled={isLoading}
                  />
                </div>
                <button
                  onClick={handleMarkOrdered}
                  className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-semibold hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? '処理中...' : '📦 注文済として登録'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: React.ReactNode;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-stone-200">
      <span className="text-sm text-stone-600">{label}</span>
      <span className="font-semibold text-stone-800">{value}</span>
    </div>
  );
}
