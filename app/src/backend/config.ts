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
    /** 確認者リストシート（武藤さんなど） */
    CONFIRMER_LIST: '確認者リスト',
    /** 購入者リストシート（高橋さん、高松さんなど） */
    PURCHASER_LIST: '購入者リスト',
    /** 勘定科目リストシート（A列のみ: 名前） */
    ACCOUNT_CATEGORY_LIST: '勘定科目リスト',
    /** 負担部署リストシート（A列のみ: 名前。「その他」は固定で末尾扱い） */
    CHARGING_DEPARTMENT_LIST: '負担部署リスト',
    /** システム設定シート (A=KEY, B=VALUE) */
    SYSTEM_SETTINGS: 'システム設定',
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
    CONFIRMER: 14,       // O列: 確認者
    CONFIRMED_DATE: 15,  // P列: 確認日
    PURCHASER: 16,       // Q列: 購入者
    ORDERED_DATE: 17,    // R列: 注文日
    ACTUAL_AMOUNT: 18,   // S列: 実際金額
    AMOUNT_DIFF: 19,     // T列: 差額（実際金額 - 申請合計）
    ACCOUNT_CATEGORY: 20,    // U列: 勘定科目
    CHARGING_DEPARTMENT: 21, // V列: 負担部署
} as const;

/**
 * システム設定のキー（システム設定シートに保存）
 */
export const SETTING_KEYS = {
    /** 物品申請が必要になる金額しきい値（円） */
    REQUIRES_ITEM_REQUEST_THRESHOLD: 'REQUIRES_ITEM_REQUEST_THRESHOLD',
} as const;

/**
 * 設定のデフォルト値（シートに値が無い場合に使う）
 */
export const SETTING_DEFAULTS = {
    [SETTING_KEYS.REQUIRES_ITEM_REQUEST_THRESHOLD]: 50_000,
} as const;

/**
 * 負担部署選択肢の固定末尾値（自由入力切替用）
 */
export const OTHER_OPTION_LABEL = 'その他';

/**
 * ステータス値
 */
export const STATUS = {
    PENDING_APPROVAL: '承認待ち',
    PENDING_CONFIRMATION: '確認待ち',
    PENDING_PURCHASE: '購入待ち',
    ORDERED: '注文済',
    REJECTED: '却下',
    /** 旧ステータス（マイグレーション前データの互換用） */
    LEGACY_PENDING: '未対応',
    LEGACY_APPROVED: '承認',
    LEGACY_PURCHASED: '購入済',
    LEGACY_CLEAR: '完了',
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
    CONFIRMATION_FAILED: '確認処理に失敗しました',
    ORDER_FAILED: '注文済処理に失敗しました',
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
