import { useMemo } from 'react';
import {
  BarChart3,
  CheckCircle,
  Clock,
  FileCheck,
  TrendingUp,
} from '../icons';
import { formatYen } from '../utils/format';
import type { Application } from '../types';

interface Props {
  applications: Application[];
}

interface MonthlyBucket {
  ym: string; // YYYY-MM
  label: string; // M月
  count: number;
  amount: number;
}

interface DepartmentBucket {
  name: string;
  amount: number;
  count: number;
}

const MONTHS_BACK = 12;

function buildMonthly(apps: Application[]): MonthlyBucket[] {
  const now = new Date();
  const buckets: MonthlyBucket[] = [];
  for (let i = MONTHS_BACK - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      ym,
      label: `${d.getMonth() + 1}月`,
      count: 0,
      amount: 0,
    });
  }

  const indexByYm = new Map(buckets.map((b, idx) => [b.ym, idx]));

  for (const a of apps) {
    if (!a.timestamp) continue;
    const d = new Date(a.timestamp);
    if (isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const idx = indexByYm.get(ym);
    if (idx === undefined) continue;
    buckets[idx].count++;
    if (a.status === '承認') {
      buckets[idx].amount += a.totalPrice;
    }
  }

  return buckets;
}

function buildDepartmentRanking(apps: Application[]): DepartmentBucket[] {
  const map = new Map<string, DepartmentBucket>();
  for (const a of apps) {
    if (a.status !== '承認') continue;
    const key = a.department || '(未設定)';
    const cur = map.get(key) ?? { name: key, amount: 0, count: 0 };
    cur.amount += a.totalPrice;
    cur.count++;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);
}

function calcLeadTime(apps: Application[]): { avgHours: number; sample: number } {
  let totalMs = 0;
  let n = 0;
  for (const a of apps) {
    if ((a.status === '承認' || a.status === '却下') && a.timestamp && a.approvalDate) {
      const t0 = new Date(a.timestamp).getTime();
      const t1 = new Date(a.approvalDate).getTime();
      if (!isNaN(t0) && !isNaN(t1) && t1 >= t0) {
        totalMs += t1 - t0;
        n++;
      }
    }
  }
  if (n === 0) return { avgHours: 0, sample: 0 };
  return { avgHours: totalMs / n / 3_600_000, sample: n };
}

export function Dashboard({ applications }: Props) {
  const monthly = useMemo(() => buildMonthly(applications), [applications]);
  const deptRanking = useMemo(
    () => buildDepartmentRanking(applications),
    [applications],
  );
  const leadTime = useMemo(() => calcLeadTime(applications), [applications]);

  const totalApprovedThisYear = useMemo(() => {
    const yr = new Date().getFullYear();
    return applications
      .filter((a) => {
        if (a.status !== '承認' || !a.timestamp) return false;
        const d = new Date(a.timestamp);
        return !isNaN(d.getTime()) && d.getFullYear() === yr;
      })
      .reduce((sum, a) => sum + a.totalPrice, 0);
  }, [applications]);

  const statusBreakdown = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let other = 0;
    for (const a of applications) {
      if (a.status === '未対応') pending++;
      else if (a.status === '承認') approved++;
      else if (a.status === '却下') rejected++;
      else other++;
    }
    return { pending, approved, rejected, other };
  }, [applications]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="今年の承認総額"
          value={formatYen(totalApprovedThisYear)}
          sub="YTD"
          icon={<TrendingUp className="text-white" size={20} />}
          gradient="from-amber-600 to-orange-700"
        />
        <KpiCard
          label="承認済み件数"
          value={`${statusBreakdown.approved}件`}
          sub={`却下 ${statusBreakdown.rejected}件`}
          icon={<CheckCircle className="text-white" size={20} />}
          gradient="from-emerald-500 to-green-600"
        />
        <KpiCard
          label="承認待ち"
          value={`${statusBreakdown.pending}件`}
          sub="要対応"
          icon={<Clock className="text-white" size={20} />}
          gradient="from-amber-500 to-orange-500"
        />
        <KpiCard
          label="平均承認リードタイム"
          value={
            leadTime.sample === 0 ? '-' : formatHours(leadTime.avgHours)
          }
          sub={`サンプル ${leadTime.sample}件`}
          icon={<BarChart3 className="text-white" size={20} />}
          gradient="from-blue-500 to-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-stone-800">
                月次推移（直近 {MONTHS_BACK} ヶ月）
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                棒: 申請件数 / 折れ線: 承認金額
              </p>
            </div>
          </div>
          <MonthlyChart data={monthly} />
        </div>

        <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-stone-800 mb-4">
            ステータス比率
          </h3>
          <StatusDonut breakdown={statusBreakdown} />
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-stone-800">
            部署別 承認額ランキング (Top 6)
          </h3>
          <FileCheck className="text-stone-400" size={20} />
        </div>
        <DepartmentBars data={deptRanking} />
      </div>
    </div>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}分`;
  if (hours < 24) return `${hours.toFixed(1)}時間`;
  return `${(hours / 24).toFixed(1)}日`;
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

function MonthlyChart({ data }: { data: MonthlyBucket[] }) {
  const W = 720;
  const H = 240;
  const PAD_L = 48;
  const PAD_R = 48;
  const PAD_T = 16;
  const PAD_B = 32;

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const maxAmount = Math.max(1, ...data.map((d) => d.amount));

  const barW = (innerW / data.length) * 0.6;
  const slot = innerW / data.length;

  const linePoints = data
    .map((d, i) => {
      const x = PAD_L + slot * (i + 0.5);
      const y = PAD_T + innerH - (d.amount / maxAmount) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-60">
        <defs>
          <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fcd34d" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = PAD_T + innerH * p;
          return (
            <line
              key={p}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="#e7e5e4"
              strokeDasharray="3 3"
            />
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = PAD_L + slot * (i + 0.5) - barW / 2;
          const h = (d.count / maxCount) * innerH;
          const y = PAD_T + innerH - h;
          return (
            <g key={d.ym}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill="url(#barFill)"
              />
              <text
                x={PAD_L + slot * (i + 0.5)}
                y={H - 12}
                textAnchor="middle"
                className="fill-stone-500"
                fontSize="11"
              >
                {d.label}
              </text>
              {d.count > 0 && (
                <text
                  x={PAD_L + slot * (i + 0.5)}
                  y={y - 4}
                  textAnchor="middle"
                  className="fill-stone-700"
                  fontSize="10"
                  fontWeight="600"
                >
                  {d.count}
                </text>
              )}
            </g>
          );
        })}

        {/* Amount line */}
        <polyline
          fill="none"
          stroke="#ea580c"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={linePoints}
        />
        {data.map((d, i) => {
          const x = PAD_L + slot * (i + 0.5);
          const y = PAD_T + innerH - (d.amount / maxAmount) * innerH;
          return (
            <circle
              key={`pt-${d.ym}`}
              cx={x}
              cy={y}
              r={3.5}
              fill="#ea580c"
              stroke="white"
              strokeWidth="1.5"
            >
              <title>{`${d.label}: ${formatYen(d.amount)} (${d.count}件)`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 text-xs text-stone-600 mt-2 px-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-b from-amber-300 to-amber-500" />
          申請件数
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-orange-600" />
          承認金額
        </span>
      </div>
    </div>
  );
}

function StatusDonut({
  breakdown,
}: {
  breakdown: { pending: number; approved: number; rejected: number; other: number };
}) {
  const segments: { label: string; value: number; color: string }[] = [
    { label: '承認', value: breakdown.approved, color: '#10b981' },
    { label: '未対応', value: breakdown.pending, color: '#f59e0b' },
    { label: '却下', value: breakdown.rejected, color: '#f43f5e' },
    { label: 'その他', value: breakdown.other, color: '#94a3b8' },
  ].filter((s) => s.value > 0);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const R = 60;
  const STROKE = 22;
  const C = 2 * Math.PI * R;

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-stone-400 text-sm">
        データがありません
      </div>
    );
  }

  let acc = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160">
        <g transform="translate(80,80) rotate(-90)">
          {segments.map((s) => {
            const len = (s.value / total) * C;
            const dasharray = `${len} ${C - len}`;
            const dashoffset = -acc;
            acc += len;
            return (
              <circle
                key={s.label}
                r={R}
                cx={0}
                cy={0}
                fill="transparent"
                stroke={s.color}
                strokeWidth={STROKE}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
              >
                <title>{`${s.label}: ${s.value}件`}</title>
              </circle>
            );
          })}
        </g>
        <text
          x={80}
          y={76}
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          className="fill-stone-800"
        >
          {total}
        </text>
        <text
          x={80}
          y={94}
          textAnchor="middle"
          fontSize="11"
          className="fill-stone-500"
        >
          総件数
        </text>
      </svg>
      <ul className="space-y-2 flex-1">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-stone-700">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
            <span className="font-semibold text-stone-800">
              {s.value}
              <span className="text-xs text-stone-500 ml-1">
                ({Math.round((s.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DepartmentBars({ data }: { data: DepartmentBucket[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-stone-400 text-sm">
        承認済みデータがありません
      </div>
    );
  }
  const max = Math.max(...data.map((d) => d.amount));
  return (
    <ul className="space-y-3">
      {data.map((d, i) => {
        const pct = (d.amount / max) * 100;
        return (
          <li key={d.name} className="flex items-center gap-4">
            <div className="w-32 text-sm font-medium text-stone-700 truncate">
              <span className="text-stone-400 mr-1.5">#{i + 1}</span>
              {d.name}
            </div>
            <div className="flex-1 h-7 bg-stone-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-lg flex items-center px-3 text-xs font-semibold text-white"
                style={{ width: `${Math.max(pct, 8)}%` }}
              >
                {formatYen(d.amount)}
              </div>
            </div>
            <div className="w-16 text-right text-xs text-stone-500">
              {d.count}件
            </div>
          </li>
        );
      })}
    </ul>
  );
}
