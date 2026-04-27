import { useCallback, useState } from 'react';
import type { Toast, ToastType } from '../types';

const TOAST_LIFETIME_MS = 3000;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_LIFETIME_MS);
  }, []);

  return { toasts, pushToast };
}
