import { useMemo } from 'react';
import type { Application } from '../types';

export type AnomalyType = 'duplicate' | 'price_drift';

export interface Anomaly {
  type: AnomalyType;
  severity: 'warning' | 'info';
  message: string;
}

const DUPLICATE_WINDOW_DAYS = 30;
const PRICE_DRIFT_THRESHOLD = 0.5; // 過去平均 ±50% を逸脱で警告
const MIN_HISTORY_FOR_PRICE_DRIFT = 2;

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * 申請データから異常検知の結果を rowIndex キーで返す。
 *
 * 検知ロジック:
 * - duplicate: 同一品目を「異なる申請者」が直近 30 日に申請済み
 * - price_drift: 同一品目の過去平均単価から ±50% 以上ズレている
 *
 * 完全に過去の申請（既に承認/却下済み）も計算対象に含めるが、
 * 自分自身（同じ rowIndex）は除外する。
 */
export function useAnomalies(applications: Application[]): Map<number, Anomaly[]> {
  return useMemo(() => {
    const result = new Map<number, Anomaly[]>();

    // 品目名でインデックス化（小文字化して空白除去）
    const indexByItem = new Map<string, Application[]>();
    for (const a of applications) {
      if (!a.itemName) continue;
      const key = normalizeItemName(a.itemName);
      const list = indexByItem.get(key) ?? [];
      list.push(a);
      indexByItem.set(key, list);
    }

    const now = Date.now();
    const windowMs = DUPLICATE_WINDOW_DAYS * 24 * 3_600_000;

    for (const a of applications) {
      // 楽観UIの仮データはスキップ
      if (a.rowIndex < 0 || a.clientStatus) continue;
      if (!a.itemName) continue;

      const peers = indexByItem.get(normalizeItemName(a.itemName)) ?? [];
      const others = peers.filter((p) => p.rowIndex !== a.rowIndex);
      if (others.length === 0) continue;

      const anomalies: Anomaly[] = [];

      // 重複検出: 直近 30 日に「他の申請者」が同一品目を申請しているか
      const myTime = a.timestamp ? new Date(a.timestamp).getTime() : now;
      const recentDups = others.filter((p) => {
        if (p.name === a.name) return false;
        if (!p.timestamp) return false;
        const t = new Date(p.timestamp).getTime();
        if (isNaN(t)) return false;
        return Math.abs(myTime - t) <= windowMs;
      });
      if (recentDups.length > 0) {
        const sample = recentDups[0];
        anomalies.push({
          type: 'duplicate',
          severity: 'warning',
          message: `直近 ${DUPLICATE_WINDOW_DAYS} 日に同じ商品を ${sample.name} が申請済み (${recentDups.length}件)`,
        });
      }

      // 相場乖離: 同一品目の過去平均単価との差が ±50% 超
      const otherPrices = others
        .map((p) => p.unitPrice)
        .filter((p) => p > 0);
      if (otherPrices.length >= MIN_HISTORY_FOR_PRICE_DRIFT && a.unitPrice > 0) {
        const avg = otherPrices.reduce((s, v) => s + v, 0) / otherPrices.length;
        if (avg > 0) {
          const drift = (a.unitPrice - avg) / avg;
          if (Math.abs(drift) >= PRICE_DRIFT_THRESHOLD) {
            const sign = drift > 0 ? '高い' : '安い';
            anomalies.push({
              type: 'price_drift',
              severity: 'warning',
              message: `相場との乖離: 過去平均 ¥${Math.round(avg).toLocaleString()} より ${Math.round(Math.abs(drift) * 100)}% ${sign}`,
            });
          }
        }
      }

      if (anomalies.length > 0) {
        result.set(a.rowIndex, anomalies);
      }
    }

    return result;
  }, [applications]);
}
