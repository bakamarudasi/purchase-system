import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileCheck,
} from '../icons';
import { formatDate, formatYen } from '../utils/format';
import type { Application, CurrentUser } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  applications: Application[];
  currentUser: CurrentUser;
  onSelect: (app: Application) => void;
  onJumpToList: () => void;
}

interface TaskGroup {
  key: string;
  title: string;
  description: string;
  apps: Application[];
  emptyText: string;
  accent: 'amber' | 'sky' | 'violet';
}

/**
 * 自分が今やるべきこと（あなたのToDo）を一画面に集約するホーム。
 *
 * - 承認者: 自分宛で「承認待ち」の申請
 * - 確認者: 全社の「確認待ち」の申請
 * - 購入者: 全社の「購入待ち」の申請
 * - 申請者（共通）: 自分の進行中の申請
 */
export function HomeView({
  applications,
  currentUser,
  onSelect,
  onJumpToList,
}: Props) {
  const groups = useMemo<TaskGroup[]>(() => {
    const result: TaskGroup[] = [];
    const myEmail = currentUser.email.toLowerCase();
    const myName = currentUser.name;

    if (currentUser.isApprover) {
      result.push({
        key: 'approve',
        title: '承認待ち（あなた宛）',
        description: '内容を確認して承認 / 却下してください',
        apps: applications.filter(
          (a) =>
            a.status === '承認待ち' &&
            a.approver.toLowerCase() === myEmail &&
            !a.clientStatus,
        ),
        emptyText: '対応すべき承認はありません',
        accent: 'amber',
      });
    }

    if (currentUser.isConfirmer) {
      result.push({
        key: 'confirm',
        title: '確認待ち',
        description: '承認済の内容を確認し、購入者に回してください',
        apps: applications.filter(
          (a) => a.status === '確認待ち' && !a.clientStatus,
        ),
        emptyText: '対応すべき確認はありません',
        accent: 'sky',
      });
    }

    if (currentUser.isPurchaser) {
      result.push({
        key: 'purchase',
        title: '購入待ち',
        description: '商品を購入したら「注文済」を登録してください',
        apps: applications.filter(
          (a) => a.status === '購入待ち' && !a.clientStatus,
        ),
        emptyText: '対応すべき購入はありません',
        accent: 'violet',
      });
    }

    // 自分の申請の進行中
    const myInProgress = applications.filter((a) => {
      const isMine =
        (myName && a.name === myName) ||
        (myEmail && a.name.toLowerCase() === myEmail);
      return (
        isMine &&
        (a.status === '承認待ち' ||
          a.status === '確認待ち' ||
          a.status === '購入待ち' ||
          a.status === '未対応' ||
          a.status === '承認') &&
        !a.clientStatus
      );
    });
    result.push({
      key: 'mine',
      title: 'あなたの申請（進行中）',
      description: '承認・確認・購入のいずれかで進行中の申請',
      apps: myInProgress,
      emptyText: '進行中の申請はありません',
      accent: 'amber',
    });

    return result;
  }, [applications, currentUser]);

  const totalTasks = groups
    .filter((g) => g.key !== 'mine')
    .reduce((sum, g) => sum + g.apps.length, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm text-stone-500">
              こんにちは、{currentUser.name || 'ゲスト'}さん
            </div>
            <h2 className="text-2xl font-bold text-stone-800 mt-1">
              {totalTasks > 0
                ? `あなたのタスクが ${totalTasks} 件あります`
                : '対応すべきタスクはありません 🎉'}
            </h2>
            <div className="text-xs text-stone-500 mt-1">
              {[
                currentUser.isApprover && '承認者',
                currentUser.isConfirmer && '確認者',
                currentUser.isPurchaser && '購入者',
              ]
                .filter(Boolean)
                .join(' / ') || '申請者'}
              として表示しています
            </div>
          </div>
          {currentUser.role === 'admin' && (
            <button
              type="button"
              onClick={onJumpToList}
              className="flex-shrink-0 px-4 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold shadow-sm"
            >
              全件を見る
            </button>
          )}
        </div>
      </div>

      {groups.map((group) => (
        <TaskGroupSection
          key={group.key}
          group={group}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

const ACCENT_CLASSES: Record<
  TaskGroup['accent'],
  { bg: string; border: string; text: string; icon: JSX.Element }
> = {
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: <Clock size={18} />,
  },
  sky: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    icon: <CheckCircle size={18} />,
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    icon: <FileCheck size={18} />,
  },
};

function TaskGroupSection({
  group,
  onSelect,
}: {
  group: TaskGroup;
  onSelect: (app: Application) => void;
}) {
  const accent = ACCENT_CLASSES[group.accent];
  return (
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${accent.bg} ${accent.text} border ${accent.border}`}
          >
            {accent.icon}
          </span>
          <div>
            <h3 className="text-lg font-semibold text-stone-800">
              {group.title}
            </h3>
            <p className="text-xs text-stone-500">{group.description}</p>
          </div>
        </div>
        <span className="text-sm font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-full">
          {group.apps.length} 件
        </span>
      </div>

      {group.apps.length === 0 ? (
        <div className="text-center py-10 text-stone-400 text-sm border-2 border-dashed border-stone-200 rounded-xl">
          {group.emptyText}
        </div>
      ) : (
        <ul className="space-y-2">
          {group.apps.map((app) => (
            <TaskRow key={app.rowIndex} app={app} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({
  app,
  onSelect,
}: {
  app: Application;
  onSelect: (a: Application) => void;
}) {
  const elapsed = elapsedLabel(app.timestamp);
  const isStale = elapsedHours(app.timestamp) >= 72;
  return (
    <li>
      <button
        onClick={() => onSelect(app)}
        className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:bg-amber-50/50 hover:border-amber-200 transition-all"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-800 truncate">
              {app.itemName}
            </span>
            <StatusBadge status={app.status} />
            {isStale && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                <AlertTriangle size={10} />
                滞留 {elapsed}
              </span>
            )}
          </div>
          <div className="text-xs text-stone-500 mt-1 flex flex-wrap gap-x-3">
            <span>{app.name}</span>
            <span>{formatDate(app.timestamp)}</span>
            <span>数量 {app.quantity}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-stone-800">
            {formatYen(app.totalPrice)}
          </div>
          <div className="text-[10px] text-stone-400">{elapsed}</div>
        </div>
      </button>
    </li>
  );
}

function elapsedHours(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return (Date.now() - t) / 3_600_000;
}

function elapsedLabel(iso: string | null): string {
  const h = elapsedHours(iso);
  if (h < 1) return '1時間以内';
  if (h < 24) return `${Math.floor(h)}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}

