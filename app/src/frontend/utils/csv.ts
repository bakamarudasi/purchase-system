import type { Application } from '../types';

const CSV_HEADERS = [
  '申請日時',
  '申請者',
  '部署',
  '商品名',
  '数量',
  '単価',
  '合計金額',
  '購入理由',
  '商品URL',
  'ステータス',
  '承認者',
  '承認日時',
  'コメント',
] as const;

/**
 * 1セルを CSV としてエスケープする。
 * - 値に カンマ / ダブルクォート / 改行 が含まれる場合はダブルクォートで囲み、
 *   ダブルクォートはエスケープ用に2連続にする
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsvDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function applicationsToCsv(apps: Application[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.map(escapeCsvCell).join(','));
  for (const a of apps) {
    lines.push(
      [
        formatCsvDate(a.timestamp),
        a.name,
        a.department,
        a.itemName,
        a.quantity,
        a.unitPrice,
        a.totalPrice,
        a.reason,
        a.productUrl ?? '',
        a.status,
        a.approver,
        formatCsvDate(a.approvalDate),
        a.comment,
      ]
        .map(escapeCsvCell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}

/**
 * UTF-8 BOM 付きで CSV をダウンロードさせる（Excel for Windows 日本語対応）
 */
export function downloadCsv(filename: string, csv: string): void {
  const BOM = '﻿';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
