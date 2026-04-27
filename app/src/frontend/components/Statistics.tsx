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
              value={stats.pending}
              label="未対応"
            />
            <Divider />
            <CompactCard
              icon={<CheckCircle className="text-white" size={16} />}
              gradient="from-emerald-500 to-green-600"
              value={stats.approved}
              label="承認済み"
            />
            <Divider />
            <CompactCard
              icon={<BarChart3 className="text-white" size={16} />}
              gradient="from-amber-600 to-orange-700"
              value={`¥${(stats.totalApprovedAmount / 10000).toFixed(0)}万`}
              label="承認金額"
            />
          </div>
        </div>
      )}

      <div
        className={`grid grid-cols-4 gap-6 transition-all duration-300 overflow-hidden ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-96 opacity-100'
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
          value={stats.pending}
          label="未対応"
        />
        <DetailCard
          icon={<CheckCircle className="text-white" size={24} />}
          gradient="from-emerald-500 to-green-600"
          accent={
            <div className="text-xs text-emerald-600 font-semibold">
              +{stats.approved}
            </div>
          }
          value={stats.approved}
          label="承認済み"
        />
        <DetailCard
          icon={<BarChart3 className="text-white" size={24} />}
          gradient="from-amber-600 to-orange-700"
          value={`¥${stats.totalApprovedAmount.toLocaleString()}`}
          label="承認金額"
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
    <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-12 h-12 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center shadow-md`}
        >
          {icon}
        </div>
        {accent}
      </div>
      <div className="text-3xl font-bold text-stone-800 mb-1">{value}</div>
      <div className="text-sm text-stone-600">{label}</div>
    </div>
  );
}
