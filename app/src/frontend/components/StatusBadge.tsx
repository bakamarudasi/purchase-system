import { CheckCircle, Clock, FileCheck, FileText, Send, X } from '../icons';
import type { ApplicationStatus } from '../types';

interface Props {
  status: ApplicationStatus | '送信中' | '送信失敗' | string;
}

interface BadgeStyle {
  className: string;
  icon: JSX.Element;
}

const styles: Record<string, BadgeStyle> = {
  未対応: {
    className: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: <Clock size={14} className="mr-1.5" />,
  },
  承認: {
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: <CheckCircle size={14} className="mr-1.5" />,
  },
  却下: {
    className: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: <X size={14} />,
  },
  購入済: {
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: <FileCheck size={14} className="mr-1.5" />,
  },
  完了: {
    className: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: <FileText size={14} className="mr-1.5" />,
  },
  送信中: {
    className: 'bg-sky-100 text-sky-800 border-sky-300 animate-pulse',
    icon: <Send size={14} className="mr-1.5" />,
  },
  送信失敗: {
    className: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: <X size={14} className="mr-1.5" />,
  },
};

export function StatusBadge({ status }: Props) {
  const config = styles[status] ?? styles['完了'];
  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold border ${config.className}`}
    >
      {config.icon}
      <span>{status}</span>
    </span>
  );
}
