/**
 * 申請ステータス
 *
 * 新ワークフロー:
 *   承認待ち → 確認待ち → 購入待ち → 注文済
 *                ↑承認者却下 → 却下
 *
 * 旧ステータス（未対応 / 承認 / 購入済 / 完了）はマイグレーション前データ向けの互換値。
 */
export type ApplicationStatus =
    | '承認待ち'
    | '確認待ち'
    | '購入待ち'
    | '注文済'
    | '却下'
    | '未対応'   // legacy (= 承認待ち)
    | '承認'      // legacy (= 確認待ち)
    | '購入済'    // legacy
    | '完了';    // legacy

/**
 * 承認者・確認者・購入者で共通の最低限のプロフィール
 */
export interface Approver {
    email: string;
    name: string;
}

export type Confirmer = Approver;
export type Purchaser = Approver;

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
    /** 確認者メールアドレス */
    confirmer: string;
    /** 確認日時 */
    confirmedDate: string | null;
    /** 購入者メールアドレス（実際に注文済ボタンを押した人） */
    purchaser: string;
    /** 注文日時 */
    orderedDate: string | null;
    /** 実際の購入金額 */
    actualAmount: number | null;
    /** 申請合計との差額（実際金額 - 合計金額） */
    amountDiff: number | null;
    /**
     * クライアント側でのみ使う一時ステータス。
     * 楽観的UIで「送信中」「送信失敗」を表現する用途。
     * バックエンドからは常に未設定（undefined）。
     */
    clientStatus?: 'sending' | 'failed';
}
