import {
  BarChart3,
  CheckCircle,
  ChevronUp,
  Clock,
  FileCheck,
  TrendingUp,
} from '../icons';
import type { Statistics as StatsType } from '../types';

interface Props {
  stats: StatsType;
  collapsed: boolean;
  onToggle: () => void;
}

export function Statistics({ stats, collapsed, onToggle }: Props) {
  // 進行中（承認待ち + 確認待ち + 購入待ち）
  const inProgress =
    stats.pendingApproval + stats.pendingConfirmation + stats.pendingPurchase;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-700">統計サマリー</h2>
        <button
          onClick={onToggle}
          className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur border border-stone-200 rounded-xl text-stone-600 font-medium text-sm shadow-sm hover:shadow-md hover:-translate-y-px active:scale-95 transition-all duration-200"
        >
          <span>{collapsed ? '詳細表示' : 'コンパクト表示'}</span>
          <ChevronUp
            size={16}
            className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {collapsed && (
        <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-xl p-4 shadow-md">
          <div className="flex items-center justify-around gap-4">
            <CompactCard
              icon={<FileCheck className="text-white" size={16} />}
              gradient="from-blue-500 to-blue-600"
              value={stats.total}
              label="全申請"
            />
            <Divider />
            <CompactCard
              icon={<Clock className="text-white" size={16} />}
              gradient="from-amber-500 to-orange-600"
              value={inProgress}
              label="進行中"
            />
            <Divider />
            <CompactCard
              icon={<CheckCircle className="text-white" size={16} />}
              gradient="from-emerald-500 to-green-600"
              value={stats.ordered}
              label="注文済"
            />
            <Divider />
            <CompactCard
              icon={<BarChart3 className="text-white" size={16} />}
              gradient="from-amber-600 to-orange-700"
              value={`¥${(stats.totalOrderedAmount / 10000).toFixed(0)}万`}
              label="注文金額"
            />
          </div>
        </div>
      )}

      <div
        className={`grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 transition-all duration-300 overflow-hidden ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100'
        }`}
      >
        <DetailCard
          icon={<FileCheck className="text-white" size={24} />}
          gradient="from-blue-500 to-blue-600"
          accent={<TrendingUp className="text-blue-500" size={20} />}
          value={stats.total}
          label="全申請"
        />
        <DetailCard
          icon={<Clock className="text-white" size={24} />}
          gradient="from-amber-500 to-orange-600"
          accent={
            <div className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-semibold">
              要対応
            </div>
          }
          value={inProgress}
          label={`進行中 (承認${stats.pendingApproval}/確認${stats.pendingConfirmation}/購入${stats.pendingPurchase})`}
        />
        <DetailCard
          icon={<CheckCircle className="text-white" size={24} />}
          gradient="from-emerald-500 to-green-600"
          accent={
            <div className="text-xs text-emerald-600 font-semibold">
              +{stats.ordered}
            </div>
          }
          value={stats.ordered}
          label="注文済"
        />
        <DetailCard
          icon={<BarChart3 className="text-white" size={24} />}
          gradient="from-amber-600 to-orange-700"
          value={`¥${stats.totalOrderedAmount.toLocaleString()}`}
          label="注文金額"
        />
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-10 bg-stone-200" />;
}

interface CompactCardProps {
  icon: JSX.Element;
  gradient: string;
  value: number | string;
  label: string;
}

function CompactCard({ icon, gradient, value, label }: CompactCardProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center`}
      >
        {icon}
      </div>
      <div>
        <div className="text-xl font-bold text-stone-800">{value}</div>
        <div className="text-xs text-stone-500">{label}</div>
      </div>
    </div>
  );
}

interface DetailCardProps {
  icon: JSX.Element;
  gradient: string;
  accent?: JSX.Element;
  value: number | string;
  label: string;
}

function DetailCard({ icon, gradient, accent, value, label }: DetailCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div
          className={`w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md`}
        >
          {icon}
        </div>
        {accent}
      </div>
      <div className="text-xl md:text-3xl font-bold text-stone-800 mb-1 truncate">
        {value}
      </div>
      <div className="text-xs md:text-sm text-stone-600">{label}</div>
    </div>
  );
}
