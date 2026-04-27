/**
 * 申請ステータス
 * - 未対応: 承認待ち
 * - 承認: 承認済み
 * - 却下: 却下済み
 * - 購入済: 購入処理済（将来用）
 * - 完了: 申請クローズ（将来用）
 */
export type ApplicationStatus =
    | '未対応'
    | '承認'
    | '却下'
    | '購入済'
    | '完了';

/**
 * 承認者（社員名簿のサブセット）
 */
export interface Approver {
    email: string;
    name: string;
}

/**
 * 添付ファイル情報
 */
export interface FileInfo {
    id: string;
    name: string;
    mimeType: string;
    size: string;
    url: string;
    thumbnailUrl?: string;
}

/**
 * 購入申請データ
 * スプレッドシートの行データに対応
 */
export interface Application {
    /** スプレッドシートの行番号（2から始まる） */
    rowIndex: number;
    /** 申請日時 */
    timestamp: string | null;
    /** 申請者名 */
    name: string;
    /** 部署 */
    department: string;
    /** 商品名 */
    itemName: string;
    /** 数量 */
    quantity: number;
    /** 単価 */
    unitPrice: number;
    /** 合計金額 */
    totalPrice: number;
    /** 購入理由 */
    reason: string;
    /** 商品のURL */
    productUrl: string | null;
    /** 添付ファイル情報 */
    fileInfo: FileInfo | null;
    /** ステータス */
    status: ApplicationStatus;
    /** 承認者メールアドレス */
    approver: string;
    /** 承認日時 */
    approvalDate: string | null;
    /** コメント */
    comment: string;
}