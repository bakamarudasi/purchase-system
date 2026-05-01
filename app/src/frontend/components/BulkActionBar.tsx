import { useState } from 'react';
import { CheckCircle, X } from '../icons';

interface Props {
  count: number;
  onApprove: (comment: string) => Promise<void>;
  onReject: (comment: string) => Promise<void>;
  onClear: () => void;
}

export function BulkActionBar({ count, onApprove, onReject, onClear }: Props) {
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove(comment);
      setComment('');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(comment);
      setComment('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-[88px] z-30 mb-4">
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl shadow-2xl border border-amber-700 px-5 py-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-shrink-0">
          <CheckCircle size={20} />
          <span className="font-bold text-lg">{count}</span>
          <span className="text-sm opacity-90">件 選択中</span>
        </div>

        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="コメント (任意)"
          disabled={busy}
          className="flex-1 min-w-[180px] px-3 py-2 bg-white/15 border border-white/30 rounded-lg text-sm placeholder-white/70 text-white focus:outline-none focus:ring-2 focus:ring-white/50"
        />

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleApprove}
            disabled={busy}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg shadow disabled:opacity-50"
          >
            {busy ? '処理中...' : '一括承認'}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-lg shadow disabled:opacity-50"
          >
            {busy ? '処理中...' : '一括却下'}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={busy}
            className="w-9 h-9 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-lg disabled:opacity-50"
            title="選択を解除"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
