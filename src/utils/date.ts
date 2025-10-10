/**
 * 日付フォーマットユーティリティ
 */

/**
 * 日付を "YYYY/MM/DD HH:mm" 形式にフォーマット
 * @param date - Date型 または ISO文字列
 * @returns フォーマット済み文字列。無効な日付の場合は '-'
 */
export function formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '-';

    const d = typeof date === 'string' ? new Date(date) : date;

    // 無効な日付チェック
    if (isNaN(d.getTime())) return '-';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return `${year}/${month}/${day} ${hours}:${minutes}`;
}

/**
 * 日付を "YYYY/MM/DD" 形式にフォーマット
 * @param date - Date型 または ISO文字列
 * @returns フォーマット済み文字列。無効な日付の場合は '-'
 */
export function formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-';

    const d = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(d.getTime())) return '-';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
}

/**
 * 今日の0時0分0秒のDateオブジェクトを取得
 */
export function getToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * N日前の0時0分0秒のDateオブジェクトを取得
 * @param days - 日数
 */
export function getDaysAgo(days: number): Date {
    const today = getToday();
    return new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
}