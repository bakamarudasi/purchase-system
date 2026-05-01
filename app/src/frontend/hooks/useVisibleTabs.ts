import { useEffect, useState } from 'react';
import type { VisibleTabs } from '../types';

const STORAGE_KEY = 'visibleTabs';
const DEFAULT_TABS: VisibleTabs = {
  all: true,
  承認待ち: true,
  確認待ち: true,
  購入待ち: true,
  注文済: true,
  却下: true,
};

export function useVisibleTabs() {
  const [visibleTabs, setVisibleTabs] = useState<VisibleTabs>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_TABS, ...JSON.parse(saved) } : DEFAULT_TABS;
    } catch {
      return DEFAULT_TABS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleTabs));
    } catch {
      // localStorage 利用不可環境は無視
    }
  }, [visibleTabs]);

  return [visibleTabs, setVisibleTabs] as const;
}
