import { useEffect, useRef, useState } from 'react';

/**
 * 任意の値を localStorage に永続化する小さなフック。
 *
 * - 初回マウント時に保存済みの値があれば返す（なければ null）
 * - `save(value)` を呼ぶと debounce 付きで保存
 * - `clear()` で削除
 *
 * 容量の小さい下書きデータを想定しているので IndexedDB ではなく localStorage を使う。
 */
export function usePersistentDraft<T>(key: string, debounceMs = 500) {
  const [initial, setInitial] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setInitial(JSON.parse(raw) as T);
      }
    } catch {
      // パース失敗 = 古いフォーマット。安全側に倒して破棄。
      localStorage.removeItem(key);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [key]);

  const save = (value: T) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // 容量超過などは黙って無視（下書きは fail-safe で良い）
      }
    }, debounceMs);
  };

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.removeItem(key);
    setInitial(null);
  };

  return { initial, save, clear };
}
