import { CheckCircle, Clock, X } from '../icons';
import { formatDate } from '../utils/format';
import type { Application } from '../types';

interface Props {
  application: Application;
}

interface StepDef {
  key: 'submit' | 'approve' | 'confirm' | 'purchase' | 'ordered';
  label: string;
}

const STEPS: StepDef[] = [
  { key: 'submit', label: '申請' },
  { key: 'approve', label: '承認' },
  { key: 'confirm', label: '確認' },
  { key: 'purchase', label: '購入' },
  { key: 'ordered', label: '注文済' },
];

type StepState = 'done' | 'active' | 'upcoming' | 'rejected' | 'skipped';

interface StepView {
  state: StepState;
  who?: string;
  when?: string | null;
  note?: string;
}

/**
 * 申請のワークフロー進捗をステップ表示する。
 *
 * 状態遷移:
 *   申請 → 承認 → 確認 → 購入 → 注文済
 *           └却下 (以降のステップは skipped)
 */
function buildSteps(app: Application): Record<StepDef['key'], StepView> {
  // 旧ステータスを正規化
  const status =
    app.status === '未対応'
      ? '承認待ち'
      : app.status === '承認'
        ? '確認待ち'
        : app.status;

  const isRejected = status === '却下';

  // 申請: 常に完了
  const submit: StepView = {
    state: 'done',
    who: app.name,
    when: app.timestamp,
  };

  // 承認
  let approve: StepView;
  if (isRejected) {
    approve = {
      state: 'rejected',
      who: app.approver,
      when: app.approvalDate,
      note: app.comment,
    };
  } else if (status === '承認待ち') {
    approve = { state: 'active', who: app.approver };
  } else {
    approve = {
      state: 'done',
      who: app.approver,
      when: app.approvalDate,
      note: app.comment,
    };
  }

  // 確認
  let confirm: StepView;
  if (isRejected) {
    confirm = { state: 'skipped' };
  } else if (status === '承認待ち') {
    confirm = { state: 'upcoming' };
  } else if (status === '確認待ち') {
    confirm = { state: 'active' };
  } else {
    confirm = {
      state: 'done',
      who: app.confirmer,
      when: app.confirmedDate,
    };
  }

  // 購入
  let purchase: StepView;
  if (isRejected) {
    purchase = { state: 'skipped' };
  } else if (status === '承認待ち' || status === '確認待ち') {
    purchase = { state: 'upcoming' };
  } else if (status === '購入待ち') {
    purchase = { state: 'active' };
  } else {
    purchase = {
      state: 'done',
      who: app.purchaser,
      when: app.orderedDate,
    };
  }

  // 注文済（最終ステート表示用）
  let ordered: StepView;
  if (isRejected) {
    ordered = { state: 'skipped' };
  } else if (status === '注文済') {
    ordered = {
      state: 'done',
      when: app.orderedDate,
      note:
        app.actualAmount != null
          ? `実際金額 ¥${app.actualAmount.toLocaleString()}`
          : undefined,
    };
  } else {
    ordered = { state: 'upcoming' };
  }

  return { submit, approve, confirm, purchase, ordered };
}

export function WorkflowStepper({ application }: Props) {
  const steps = buildSteps(application);

  return (
    <div className="bg-white border-2 border-stone-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-stretch">
        {STEPS.map((def, i) => {
          const view = steps[def.key];
          const isLast = i === STEPS.length - 1;
          return (
            <div key={def.key} className="flex-1 flex flex-col">
              <div className="flex items-center">
                <Marker state={view.state} />
                {!isLast && <Connector nextState={steps[STEPS[i + 1].key].state} />}
              </div>
              <div className="mt-2 pr-2">
                <div
                  className={`text-xs font-bold ${labelColor(view.state)}`}
                >
                  {def.label}
                  {view.state === 'rejected' && '（却下）'}
                  {view.state === 'active' && '（対応中）'}
                </div>
                {view.who && (
                  <div className="text-[11px] text-stone-600 truncate">
                    {view.who}
                  </div>
                )}
                {view.when && (
                  <div className="text-[10px] text-stone-400">
                    {formatDate(view.when)}
                  </div>
                )}
                {view.note && (
                  <div className="text-[10px] text-stone-500 truncate italic">
                    {view.note}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Marker({ state }: { state: StepState }) {
  const base =
    'flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center border-2';
  switch (state) {
    case 'done':
      return (
        <div
          className={`${base} bg-emerald-500 border-emerald-500 text-white shadow`}
        >
          <CheckCircle size={16} />
        </div>
      );
    case 'active':
      return (
        <div
          className={`${base} bg-amber-100 border-amber-500 text-amber-700 animate-pulse`}
        >
          <Clock size={16} />
        </div>
      );
    case 'rejected':
      return (
        <div className={`${base} bg-rose-500 border-rose-500 text-white shadow`}>
          <X size={16} />
        </div>
      );
    case 'skipped':
      return (
        <div
          className={`${base} bg-stone-100 border-stone-200 text-stone-300`}
        >
          <X size={14} />
        </div>
      );
    case 'upcoming':
    default:
      return (
        <div
          className={`${base} bg-white border-stone-300 text-stone-400`}
        />
      );
  }
}

function Connector({ nextState }: { nextState: StepState }) {
  // 次のステップが done または active なら塗る、それ以外はグレー
  const tone =
    nextState === 'done' || nextState === 'active' || nextState === 'rejected'
      ? 'bg-stone-300'
      : 'bg-stone-200';
  return <div className={`flex-1 h-0.5 mx-1 ${tone}`} />;
}

function labelColor(state: StepState): string {
  switch (state) {
    case 'done':
      return 'text-emerald-700';
    case 'active':
      return 'text-amber-700';
    case 'rejected':
      return 'text-rose-700';
    case 'skipped':
      return 'text-stone-300';
    case 'upcoming':
    default:
      return 'text-stone-400';
  }
}
