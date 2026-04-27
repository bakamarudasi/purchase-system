/**
 * 数値・文字列フォーマットユーティリティ
 */

/**
 * 数値を日本円形式にフォーマット
 * @param amount - 金額
 * @returns "¥1,234,567" 形式の文字列
 */
export function formatCurrency(amount: number | string | null | undefined): string {
    if (amount === null || amount === undefined) return '¥0';

    const num = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(num)) return '¥0';

    return '¥' + num.toLocaleString('ja-JP');
}

/**
 * 数値を3桁カンマ区切りにフォーマット
 * @param num - 数値
 * @returns "1,234,567" 形式の文字列
 */
export function formatNumber(num: number | string | null | undefined): string {
    if (num === null || num === undefined) return '0';

    const n = typeof num === 'string' ? parseFloat(num) : num;

    if (isNaN(n)) return '0';

    return n.toLocaleString('ja-JP');
}

/**
 * ファイルサイズをヒューマンリーダブルな形式にフォーマット
 * @param bytes - バイト数
 * @returns "1.5 MB" のような文字列
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * 安全にparseIntを実行（失敗時はデフォルト値を返す）
 * @param value - パース対象の値
 * @param defaultValue - デフォルト値
 * @returns パース結果
 */
export function safeParseInt(
    value: string | number | null | undefined,
    defaultValue: number = 0
): number {
    if (value === null || value === undefined) return defaultValue;

    const num = typeof value === 'string' ? parseInt(value, 10) : value;

    return isNaN(num) ? defaultValue : num;
}

/**
 * 安全にparseFloatを実行（失敗時はデフォルト値を返す）
 * @param value - パース対象の値
 * @param defaultValue - デフォルト値
 * @returns パース結果
 */
export function safeParseFloat(
    value: string | number | null | undefined,
    defaultValue: number = 0
): number {
    if (value === null || value === undefined) return defaultValue;

    const num = typeof value === 'string' ? parseFloat(value) : value;

    return isNaN(num) ? defaultValue : num;
}

/**
 * 例外オブジェクトを文字列化（スタックトレース付き）
 * Logger.log で例外を出力する際に使う
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return `${error.message}\n${error.stack ?? ''}`;
    }
    return String(error);
}