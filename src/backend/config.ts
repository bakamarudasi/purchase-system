/**
 * システム設定
 * スプレッドシートIDやシート名などの定数を管理
 */

/**
 * シート名定数
 */
export const SHEET_NAMES = {
    /** メインの申請データシート */
    APPLICATIONS: '申請データ',
    /** 社員名簿シート */
    EMPLOYEE_LIST: '社員名簿',
    /** 承認者リストシート */
    APPROVER_LIST: '承認者リスト',
    /** アーカイブ用の過去の申請シート */
    PAST_APPLICATIONS: '過去の申請',
} as const;

/**
 * 列インデックス（0-based）
 * スプレッドシートの列位置を定義
 */
export const COLUMN_INDEX = {
    TIMESTAMP: 0,        // A列: タイムスタンプ
    NAME: 1,             // B列: 申請者名
    DEPARTMENT: 2,       // C列: 部署
    ITEM_NAME: 3,        // D列: 商品名
    QUANTITY: 4,         // E列: 数量
    UNIT_PRICE: 5,       // F列: 単価
    TOTAL_PRICE: 6,      // G列: 合計金額
    REASON: 7,           // H列: 購入理由
    FILE_URL: 8,         // I列: 添付ファイルURL
    PRODUCT_URL: 9,      // J列: 購入商品URL
    STATUS: 10,          // K列: ステータス
    APPROVER: 11,        // L列: 承認者
    APPROVAL_DATE: 12,   // M列: 承認日
    COMMENT: 13,         // N列: コメント
} as const;

/**
 * ステータス値
 */
export const STATUS = {
    PENDING: '未対応',
    APPROVED: '承認',
    REJECTED: '却下',
    PURCHASED: '購入済',
    CLEAR: '完了',
} as const;

/**
 * デフォルト設定
 */
export const DEFAULT_CONFIG = {
    /** 表示する申請の期間（日数） */
    DISPLAY_PERIOD_DAYS: 90,

    /** 1ページあたりの表示件数 */
    PAGE_SIZE: 50,

    /** Google Driveの添付ファイル保存フォルダ名 */
    ATTACHMENT_FOLDER_NAME: '購入申請_添付ファイル',

    /** Google Driveの添付ファイル保存フォルダID */
    ATTACHMENT_FOLDER_ID: '1VygUYeul0mwZGsVZAOKZ04CrIM-_jq3I',

    /** 許可するファイル形式 */
    ALLOWED_MIME_TYPES: [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-excel', // xls
    ],

    /** ファイルサイズ上限（バイト） */
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * エラーメッセージ
 */
export const ERROR_MESSAGES = {
    SHEET_NOT_FOUND: (name: string) => `シート「${name}」が見つかりません`,
    INVALID_ROW_INDEX: 'rowIndexが無効です',
    FILE_TOO_LARGE: `ファイルサイズは${DEFAULT_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB以下にしてください`,
    INVALID_FILE_TYPE: '許可されていないファイル形式です',
    APPROVAL_FAILED: '承認処理に失敗しました',
    REJECTION_FAILED: '却下処理に失敗しました',
} as const;

/**
 * スプレッドシートIDを取得
 * 現在アクティブなスプレッドシートのIDを返す
 */
export function getSpreadsheetId(): string {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
        throw new Error('アクティブなスプレッドシートが見つかりません');
    }
    return ss.getId();
}

/**
 * スプレッドシートを取得
 */
export function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
        throw new Error('アクティブなスプレッドシートが見つかりません');
    }
    return ss;
}
