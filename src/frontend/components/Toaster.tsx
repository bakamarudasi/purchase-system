import type { Toast } from '../types';

interface Props {
  toasts: Toast[];
}

const colorByType: Record<Toast['type'], string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  info: 'bg-stone-50 border-stone-200 text-stone-800',
};

export function Toaster({ toasts }: Props) {
  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-lg shadow-lg border text-sm animate-fade-in-down ${colorByType[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
