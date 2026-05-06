import { useMemo } from 'react';
import {
  BarChart3,
  CheckCircle,
  Clock,
  FileCheck,
  TrendingUp,
  User,
  X,
} from '../icons';
import { formatDate, formatYen } from '../utils/format';
import type { Application, CurrentUser } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  applications: Application[];
  currentUser: CurrentUser;
  onSelect: (app: Application) => void;
}

interface MyStats {
  total: number;
  /** 進行中（承認待ち + 確認待ち + 購入待ち） */
  inProgress: number;
  /** 進行中の合計金額 */
  inProgressAmount: number;
  ordered: number;
  rejected: number;
  orderedAmount: number;
  thisMonthCount: number;
  thisMonthAmount: number;
}

function calcStats(apps: Application[]): MyStats {
  const now = new Date();
  const ym = now.getFullYear() * 100 + now.getMonth();

  let inProgress = 0;
  let ordered = 0;
  let rejected = 0;
  let orderedAmount = 0;
  let inProgressAmount = 0;
  let thisMonthCount = 0;
  let thisMonthAmount = 0;

  for (const a of apps) {
    if (a.status === '承認待ち' || a.status === '確認待ち' || a.status === '購入待ち') {
      inProgress++;
      inProgressAmount += a.totalPrice;
    } else if (a.status === '注文済') {
      ordered++;
      orderedAmount += a.actualAmount ?? a.totalPrice;
    } else if (a.status === '却下') {
      rejected++;
    }

    if (a.timestamp) {
      const d = new Date(a.timestamp);
      if (!isNaN(d.getTime()) && d.getFullYear() * 100 + d.getMonth() === ym) {
        thisMonthCount++;
        thisMonthAmount += a.totalPrice;
      }
    }
  }

  return {
    total: apps.length,
    inProgress,
    inProgressAmount,
    ordered,
    rejected,
    orderedAmount,
    thisMonthCount,
    thisMonthAmount,
  };
}

export function MyHistory({ applications, currentUser, onSelect }: Props) {
  const myApps = useMemo(() => {
    if (!currentUser.email && !currentUser.name) return [];
    return applications
      .filter(
        (a) =>
          (currentUser.name && a.name === currentUser.name) ||
          // 過去データに名前ではなく email が入っているケースの保険
          (currentUser.email && a.name === currentUser.email),
      )
      .sort((a, b) => {
        const at = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bt = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bt - at;
      });
  }, [applications, currentUser]);

  const stats = useMemo(() => calcStats(myApps), [myApps]);

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-700 rounded-2xl flex items-center justify-center text-white shadow-md">
            <User size={28} />
          </div>
          <div>
            <div className="text-sm text-stone-500">マイページ</div>
            <h2 className="text-2xl font-bold text-stone-800">
              {currentUser.name || currentUser.email || 'ゲスト'}
            </h2>
            <div className="text-xs text-stone-500 mt-0.5">
              {currentUser.department || '部署未設定'} ・ {currentUser.email || '-'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="今月の申請"
          value={`${stats.thisMonthCount}件`}
          sub={formatYen(stats.thisMonthAmount)}
          icon={<TrendingUp className="text-white" size={20} />}
          gradient="from-blue-500 to-blue-600"
        />
        <KpiCard
          label="進行中"
          value={`${stats.inProgress}件`}
          sub={formatYen(stats.inProgressAmount)}
          icon={<Clock className="text-white" size={20} />}
          gradient="from-amber-500 to-orange-600"
        />
        <KpiCard
          label="注文済 総額"
          value={formatYen(stats.orderedAmount)}
          sub={`${stats.ordered}件`}
          icon={<CheckCircle className="text-white" size={20} />}
          gradient="from-emerald-500 to-green-600"
        />
        <KpiCard
          label="申請総数"
          value={`${stats.total}件`}
          sub={`却下 ${stats.rejected}件`}
          icon={<BarChart3 className="text-white" size={20} />}
          gradient="from-stone-500 to-stone-700"
        />
      </div>

      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-800">あなたの申請履歴</h3>
          <span className="text-sm text-stone-500">{myApps.length}件</span>
        </div>

        {myApps.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-stone-500">まだ申請はありません</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {myApps.map((app) => (
              <li key={app.rowIndex}>
                <button
                  onClick={() => onSelect(app)}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-xl border border-stone-200 hover:bg-amber-50/50 hover:border-amber-200 transition-all"
                >
                  <TimelineDot status={app.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-stone-800 truncate">
                        {app.itemName}
                      </span>
                      <StatusBadge status={app.clientStatus === 'sending' ? '送信中' : app.status} />
                      {app.clientStatus === 'failed' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                          送信失敗
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                      {formatDate(app.timestamp)} ・ 数量 {app.quantity} ・ 承認者 {app.approver || '-'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-stone-800">
                      {formatYen(app.totalPrice)}
                    </div>
                    {app.status === '却下' && (
                      <div className="text-xs text-rose-600 flex items-center justify-end gap-1 mt-0.5">
                        <X size={12} />
                        却下
                      </div>
                    )}
                    {app.status === '注文済' && (
                      <div className="text-xs text-emerald-600 flex items-center justify-end gap-1 mt-0.5">
                        <FileCheck size={12} />
                        注文済
                        {app.actualAmount != null && (
                          <span className="ml-1 text-stone-500">
                            ({formatYen(app.actualAmount)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  icon: JSX.Element;
  gradient: string;
}

function KpiCard({ label, value, sub, icon, gradient }: KpiCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-5 shadow-md">
      <div
        className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md mb-3`}
      >
        {icon}
      </div>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-2xl font-bold text-stone-800 mt-1 truncate">{value}</div>
      <div className="text-xs text-stone-500 mt-1">{sub}</div>
    </div>
  );
}

function TimelineDot({ status }: { status: string }) {
  const colorByStatus: Record<string, string> = {
    承認待ち: 'bg-amber-400',
    確認待ち: 'bg-sky-400',
    購入待ち: 'bg-violet-400',
    注文済: 'bg-emerald-500',
    却下: 'bg-rose-500',
    // 旧ステータス（互換）
    未対応: 'bg-amber-400',
    承認: 'bg-sky-400',
    購入済: 'bg-emerald-500',
    完了: 'bg-stone-400',
  };
  const cls = colorByStatus[status] ?? 'bg-stone-300';
  return (
    <div className="flex flex-col items-center">
      <div className={`w-3 h-3 rounded-full ${cls} ring-4 ring-white shadow`} />
    </div>
  );
}
