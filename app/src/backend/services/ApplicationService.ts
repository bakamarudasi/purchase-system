/**
 * 申請管理サービス
 * スプレッドシートとのデータ連携、承認・確認・注文処理を担当
 */

import {
    Application,
    ApplicationStatus,
    Approver,
    Confirmer,
    FileInfo,
    Purchaser,
} from '../models/Application';
import {
    SHEET_NAMES,
    COLUMN_INDEX,
    STATUS,
    ERROR_MESSAGES,
    getSpreadsheet,
    DEFAULT_CONFIG,
    SETTING_KEYS,
    SETTING_DEFAULTS,
} from '../config';
import { safeParseInt, safeParseFloat, formatError } from '../utils/format';
import { NotificationService } from './NotificationService';

const COLUMN_COUNT = Object.keys(COLUMN_INDEX).length;
const LOCK_TIMEOUT_MS = 10_000;

/**
 * 旧ステータス（未対応・承認）は新ステータスに正規化して扱う。
 * 物理的なシート値はマイグレーション関数で書き換えるが、未マイグレ時の保険として
 * パース時にも変換する。
 */
function normalizeStatus(raw: string): ApplicationStatus {
    if (raw === '未対応') return STATUS.PENDING_APPROVAL;
    if (raw === '承認') return STATUS.PENDING_CONFIRMATION;
    return (raw || STATUS.PENDING_APPROVAL) as ApplicationStatus;
}

export class ApplicationService {
    /**
     * 「申請データ」シートから全申請データを取得
     */
    static getAllApplications(): Application[] {
        const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
        const data = sheet.getDataRange().getValues();

        // ヘッダー行をスキップ（1行目）
        const rows = data.slice(1);

        const applications: Application[] = [];

        rows.forEach((row, index) => {
            // 空行はスキップ
            if (!row[COLUMN_INDEX.TIMESTAMP]) return;

            const app = this.parseRowToApplication(row, index + 2); // rowIndexは2から始まる
            if (app) {
                applications.push(app);
            }
        });

        return applications;
    }

    /**
     * rowIndexで特定の申請を取得
     */
    static getApplicationByRowIndex(rowIndex: number): Application | null {
        if (rowIndex < 2) {
            throw new Error(ERROR_MESSAGES.INVALID_ROW_INDEX);
        }

        const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
        const row = sheet.getRange(rowIndex, 1, 1, COLUMN_COUNT).getValues()[0];

        return this.parseRowToApplication(row, rowIndex);
    }

    /**
     * ステータスでフィルタリング
     */
    static getApplicationsByStatus(status: ApplicationStatus): Application[] {
        const allApps = this.getAllApplications();
        if (!allApps) return [];
        return allApps.filter(app => app.status === status);
    }

    /**
     * 承認待ちの申請のみを取得
     */
    static getPendingApplications(): Application[] {
        return this.getApplicationsByStatus(STATUS.PENDING_APPROVAL);
    }

    /**
     * 申請を承認 → ステータスを「確認待ち」に進め、確認者全員にメール通知
     */
    static approveApplication(rowIndex: number, approver: string, comment: string): void {
        this.assertCallerIsApprover();
        this.assertCurrentStatus(rowIndex, STATUS.PENDING_APPROVAL);
        this.updateApprovalFields(rowIndex, STATUS.PENDING_CONFIRMATION, approver, comment);
        this.notifyConfirmersByRow(rowIndex);
        this.notifyDecisionByRow(rowIndex, '承認', approver, comment);
    }

    /**
     * 申請を却下（承認者のみ・承認待ち段階のみ）
     */
    static rejectApplication(rowIndex: number, approver: string, comment: string): void {
        this.assertCallerIsApprover();
        this.assertCurrentStatus(rowIndex, STATUS.PENDING_APPROVAL);
        this.updateApprovalFields(rowIndex, STATUS.REJECTED, approver, comment);
        this.notifyDecisionByRow(rowIndex, '却下', approver, comment);
    }

    /**
     * 確認者が確認 → ステータスを「購入待ち」に進め、購入者全員にメール通知
     */
    static confirmApplication(rowIndex: number): void {
        const callerEmail = Session.getActiveUser().getEmail();
        if (!this.isConfirmer(callerEmail)) {
            throw new Error('権限がありません: 確認者リストに登録されたユーザーのみ実行できます');
        }
        this.assertCurrentStatus(rowIndex, STATUS.PENDING_CONFIRMATION);

        this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
            const now = new Date();
            sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).setValue(STATUS.PENDING_PURCHASE);
            sheet.getRange(rowIndex, COLUMN_INDEX.CONFIRMER + 1).setValue(callerEmail);
            sheet.getRange(rowIndex, COLUMN_INDEX.CONFIRMED_DATE + 1).setValue(now);
            SpreadsheetApp.flush();
        });

        this.notifyPurchasersByRow(rowIndex);
    }

    /**
     * 購入者が注文済登録 → ステータスを「注文済」にし、申請者にメール通知
     */
    static markAsOrdered(rowIndex: number, actualAmount: number): void {
        const callerEmail = Session.getActiveUser().getEmail();
        if (!this.isPurchaser(callerEmail)) {
            throw new Error('権限がありません: 購入者リストに登録されたユーザーのみ実行できます');
        }
        if (!Number.isFinite(actualAmount) || actualAmount < 0) {
            throw new Error('実際金額は0以上の数値で入力してください');
        }
        this.assertCurrentStatus(rowIndex, STATUS.PENDING_PURCHASE);

        const app = this.getApplicationByRowIndex(rowIndex);
        if (!app) throw new Error(ERROR_MESSAGES.ORDER_FAILED);
        const diff = actualAmount - app.totalPrice;

        this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
            const now = new Date();
            sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).setValue(STATUS.ORDERED);
            sheet.getRange(rowIndex, COLUMN_INDEX.PURCHASER + 1).setValue(callerEmail);
            sheet.getRange(rowIndex, COLUMN_INDEX.ORDERED_DATE + 1).setValue(now);
            sheet.getRange(rowIndex, COLUMN_INDEX.ACTUAL_AMOUNT + 1).setValue(actualAmount);
            sheet.getRange(rowIndex, COLUMN_INDEX.AMOUNT_DIFF + 1).setValue(diff);
            SpreadsheetApp.flush();
        });

        this.notifyOrderedByRow(rowIndex, callerEmail, actualAmount, diff);
    }

    /**
     * 確認者全員にメール通知
     */
    private static notifyConfirmersByRow(rowIndex: number): void {
        try {
            const app = this.getApplicationByRowIndex(rowIndex);
            if (!app) return;
            const emails = this.getConfirmerList().map((c) => c.email).filter((e) => !!e);
            NotificationService.notifyConfirmers(app, emails);
        } catch (e) {
            Logger.log(`確認者通知の準備エラー: ${formatError(e)}`);
        }
    }

    /**
     * 購入者全員にメール通知
     */
    private static notifyPurchasersByRow(rowIndex: number): void {
        try {
            const app = this.getApplicationByRowIndex(rowIndex);
            if (!app) return;
            const emails = this.getPurchaserList().map((p) => p.email).filter((e) => !!e);
            NotificationService.notifyPurchasers(app, emails);
        } catch (e) {
            Logger.log(`購入者通知の準備エラー: ${formatError(e)}`);
        }
    }

    /**
     * 申請者に注文済メールを通知
     */
    private static notifyOrderedByRow(
        rowIndex: number,
        purchaser: string,
        actualAmount: number,
        diff: number,
    ): void {
        try {
            const app = this.getApplicationByRowIndex(rowIndex);
            if (!app) return;
            const applicantEmail = this.getEmailByName(app.name);
            if (!applicantEmail) return;
            NotificationService.notifyOrdered(app, applicantEmail, purchaser, actualAmount, diff);
        } catch (e) {
            Logger.log(`注文済通知の準備エラー: ${formatError(e)}`);
        }
    }

    /**
     * 申請者にメール通知（社員名簿で名前→メアドを逆引き）
     * 失敗してもメイン処理は止めない
     */
    private static notifyDecisionByRow(
        rowIndex: number,
        decision: '承認' | '却下',
        approver: string,
        comment: string,
    ): void {
        try {
            const app = this.getApplicationByRowIndex(rowIndex);
            if (!app) return;
            const applicantEmail = this.getEmailByName(app.name);
            if (!applicantEmail) return;
            NotificationService.notifyDecision(app, applicantEmail, decision, approver, comment);
        } catch (e) {
            Logger.log(`結果通知の準備エラー: ${formatError(e)}`);
        }
    }

    /**
     * 一括承認/却下の戻り値
     * 「承認」→確認待ちに進め確認者通知、「却下」→却下し申請者通知
     */
    static processBulk(
        rowIndices: number[],
        action: 'approve' | 'reject',
        approver: string,
        comment: string,
    ): { success: number[]; failed: { rowIndex: number; error: string }[] } {
        this.assertCallerIsApprover();
        const newStatus = action === 'approve' ? STATUS.PENDING_CONFIRMATION : STATUS.REJECTED;
        const success: number[] = [];
        const failed: { rowIndex: number; error: string }[] = [];

        // 1 件ずつロックを取り直すと遅いので、全体を 1 ロックで囲う
        this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
            const now = new Date();
            for (const rowIndex of rowIndices) {
                try {
                    if (rowIndex < 2) {
                        throw new Error(ERROR_MESSAGES.INVALID_ROW_INDEX);
                    }
                    // 承認待ち以外は対象外
                    const currentStatus = String(
                        sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).getValue() ?? '',
                    );
                    const normalized = normalizeStatus(currentStatus);
                    if (normalized !== STATUS.PENDING_APPROVAL) {
                        throw new Error(`このステータスでは操作できません: ${currentStatus}`);
                    }
                    sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).setValue(newStatus);
                    sheet.getRange(rowIndex, COLUMN_INDEX.APPROVER + 1).setValue(approver);
                    sheet.getRange(rowIndex, COLUMN_INDEX.APPROVAL_DATE + 1).setValue(now);
                    sheet.getRange(rowIndex, COLUMN_INDEX.COMMENT + 1).setValue(comment);
                    success.push(rowIndex);
                } catch (e) {
                    failed.push({ rowIndex, error: formatError(e) });
                }
            }
            SpreadsheetApp.flush();
        });

        // ロック外でメール通知
        const decisionLabel: '承認' | '却下' = action === 'approve' ? '承認' : '却下';
        for (const rowIndex of success) {
            this.notifyDecisionByRow(rowIndex, decisionLabel, approver, comment);
            if (action === 'approve') {
                this.notifyConfirmersByRow(rowIndex);
            }
        }

        return { success, failed };
    }

    /**
     * 旧データ（未対応 / 承認）を新ステータスに移行する。
     * 初回デプロイ時に手動実行する想定。
     * 戻り値: 移行件数の内訳
     */
    static migrateLegacyStatuses(): { pending: number; approved: number } {
        let pending = 0;
        let approved = 0;
        this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) return;
            const range = sheet.getRange(2, COLUMN_INDEX.STATUS + 1, lastRow - 1, 1);
            const values = range.getValues();
            const updated = values.map((row) => {
                const v = String(row[0] ?? '');
                if (v === '未対応') {
                    pending++;
                    return [STATUS.PENDING_APPROVAL];
                }
                if (v === '承認') {
                    approved++;
                    return [STATUS.PENDING_CONFIRMATION];
                }
                return [row[0]];
            });
            range.setValues(updated);
            SpreadsheetApp.flush();
        });
        Logger.log(`マイグレーション完了: 未対応=${pending}件, 承認=${approved}件`);
        return { pending, approved };
    }

    /**
     * 現在の操作ユーザーが承認者かを検証する。
     * フロント側のロール分岐は迂回可能なのでサーバー側でも必ずチェックする。
     */
    private static assertCallerIsApprover(): void {
        const callerEmail = Session.getActiveUser().getEmail();
        if (!this.isApprover(callerEmail)) {
            throw new Error('権限がありません: 承認者リストに登録されたユーザーのみ実行できます');
        }
    }

    /**
     * 指定行の現在ステータスが期待通りか検証する。
     * 競合状態（他ユーザーが先に処理）の検出にも使う。
     */
    private static assertCurrentStatus(
        rowIndex: number,
        expected: ApplicationStatus,
    ): void {
        if (rowIndex < 2) {
            throw new Error(ERROR_MESSAGES.INVALID_ROW_INDEX);
        }
        const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
        const raw = String(
            sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).getValue() ?? '',
        );
        const current = normalizeStatus(raw);
        if (current !== expected) {
            throw new Error(`このステータスでは操作できません: ${raw}`);
        }
    }

    /**
     * 新規申請を追加
     *
     * - 添付ファイルがあれば MIME とサイズを検証してから Drive に保存
     * - LockService で同時実行ガードし、appendRow 直後に getLastRow() の競合を防ぐ
     */
    static addApplication(data: {
        name: string;
        department: string;
        itemName: string;
        quantity: number;
        unitPrice: number;
        reason: string;
        productUrl?: string;
        selectedApprover?: string;
        accountCategory?: string;
        chargingDepartment?: string;
        file?: { name: string; mimeType: string; data: string };
    }): Application {
        if (data.file) {
            this.validateFile(data.file);
        }

        const fileUrl = data.file ? this.uploadFile(data.file) : '';
        const timestamp = new Date();
        const totalPrice = data.quantity * data.unitPrice;
        const approver = data.selectedApprover || '';

        const row = [
            timestamp,                  // A: タイムスタンプ
            data.name,                  // B: 名前
            data.department,            // C: 部署
            data.itemName,              // D: 商品名
            data.quantity,              // E: 数量
            data.unitPrice,             // F: 単価
            totalPrice,                 // G: 合計金額
            data.reason,                // H: 購入理由
            fileUrl,                    // I: 添付ファイルURL
            data.productUrl || '',      // J: 購入商品URL
            STATUS.PENDING_APPROVAL,    // K: ステータス（初期値は承認待ち）
            approver,                   // L: 承認者 (email)
            '',                         // M: 承認日
            '',                         // N: コメント
            '',                         // O: 確認者
            '',                         // P: 確認日
            '',                         // Q: 購入者
            '',                         // R: 注文日
            '',                         // S: 実際金額
            '',                         // T: 差額
            data.accountCategory || '', // U: 勘定科目
            data.chargingDepartment || '', // V: 負担部署
        ];

        const newRowIndex = this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
            sheet.appendRow(row);
            SpreadsheetApp.flush();
            return sheet.getLastRow();
        });

        const newApplication: Application = {
            rowIndex: newRowIndex,
            timestamp: timestamp.toISOString(),
            name: data.name,
            department: data.department,
            itemName: data.itemName,
            quantity: data.quantity,
            unitPrice: data.unitPrice,
            totalPrice: totalPrice,
            reason: data.reason,
            productUrl: data.productUrl || null,
            fileInfo: fileUrl ? this.parseFileInfo(fileUrl) : null,
            status: STATUS.PENDING_APPROVAL,
            approver,
            approvalDate: null,
            comment: '',
            confirmer: '',
            confirmedDate: null,
            purchaser: '',
            orderedDate: null,
            actualAmount: null,
            amountDiff: null,
            accountCategory: data.accountCategory || '',
            chargingDepartment: data.chargingDepartment || '',
        };

        // 承認者にメール通知（失敗してもアプリは止めない）
        NotificationService.notifyNewApplication(newApplication, approver);

        return newApplication;
    }

    /**
     * 承認者リストを取得
     */
    static getApproverList(): Approver[] {
        return this.getMemberList(SHEET_NAMES.APPROVER_LIST);
    }

    /**
     * 確認者リストを取得
     */
    static getConfirmerList(): Confirmer[] {
        return this.getMemberList(SHEET_NAMES.CONFIRMER_LIST);
    }

    /**
     * 購入者リストを取得
     */
    static getPurchaserList(): Purchaser[] {
        return this.getMemberList(SHEET_NAMES.PURCHASER_LIST);
    }

    /**
     * 勘定科目リストを取得（A列のみの単一列シート）
     */
    static getAccountCategoryList(): string[] {
        return this.getSimpleNameList(SHEET_NAMES.ACCOUNT_CATEGORY_LIST);
    }

    /**
     * 負担部署リストを取得（A列のみの単一列シート）
     * 末尾に「その他」を必ず付与する（クライアント側で自由入力に切替）
     */
    static getChargingDepartmentList(): string[] {
        const list = this.getSimpleNameList(SHEET_NAMES.CHARGING_DEPARTMENT_LIST);
        // ユーザーがシートで「その他」を登録していたら重複追加しない
        if (list.includes('その他')) return list;
        return [...list, 'その他'];
    }

    /**
     * 単一列シート（A列のみ）からトリム済みの名前リストを取得
     */
    private static getSimpleNameList(sheetName: string): string[] {
        try {
            const sheet = this.getSheet(sheetName);
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) return [];
            const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            return data
                .map((row) => String(row[0] ?? '').trim())
                .filter((v) => v.length > 0);
        } catch (e) {
            Logger.log(`${sheetName}の取得エラー: ${formatError(e)}`);
            return [];
        }
    }

    /**
     * 単一列シートに項目を追加
     */
    private static appendSimpleName(sheetName: string, name: string): string[] {
        const clean = (name || '').trim();
        if (!clean) throw new Error('名前は必須です');
        if (this.getSimpleNameList(sheetName).includes(clean)) {
            return this.getSimpleNameList(sheetName);
        }
        this.withLock(() => {
            const sheet = this.getSheet(sheetName);
            sheet.appendRow([clean]);
            SpreadsheetApp.flush();
        });
        return this.getSimpleNameList(sheetName);
    }

    /**
     * 単一列シートから項目を削除（最初に一致した行を削除）
     */
    private static removeSimpleName(sheetName: string, name: string): string[] {
        const target = (name || '').trim();
        if (!target) throw new Error('名前は必須です');
        this.withLock(() => {
            const sheet = this.getSheet(sheetName);
            const lastRow = sheet.getLastRow();
            if (lastRow < 2) return;
            const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
            for (let i = 0; i < data.length; i++) {
                if (String(data[i][0] ?? '').trim() === target) {
                    sheet.deleteRow(i + 2);
                    SpreadsheetApp.flush();
                    return;
                }
            }
        });
        return this.getSimpleNameList(sheetName);
    }

    static addAccountCategory(name: string): string[] {
        this.assertCallerIsAdmin();
        return this.appendSimpleName(SHEET_NAMES.ACCOUNT_CATEGORY_LIST, name);
    }

    static removeAccountCategory(name: string): string[] {
        this.assertCallerIsAdmin();
        return this.removeSimpleName(SHEET_NAMES.ACCOUNT_CATEGORY_LIST, name);
    }

    static addChargingDepartment(name: string): string[] {
        this.assertCallerIsAdmin();
        if (name.trim() === 'その他') {
            throw new Error('「その他」は固定項目のため追加不要です');
        }
        return this.appendSimpleName(SHEET_NAMES.CHARGING_DEPARTMENT_LIST, name);
    }

    static removeChargingDepartment(name: string): string[] {
        this.assertCallerIsAdmin();
        return this.removeSimpleName(SHEET_NAMES.CHARGING_DEPARTMENT_LIST, name);
    }

    /**
     * 操作者が承認者・確認者・購入者のいずれかであることを保証する。
     * マスタデータ編集（リスト管理・設定変更）の権限境界として使う。
     */
    private static assertCallerIsAdmin(): void {
        const email = Session.getActiveUser().getEmail();
        const isAdmin =
            this.isApprover(email) ||
            this.isConfirmer(email) ||
            this.isPurchaser(email);
        if (!isAdmin) {
            throw new Error('権限がありません: 管理者ロールが必要です');
        }
    }

    /**
     * システム設定を全件取得
     * 値は文字列のまま返す（呼び出し元で変換）
     */
    static getSystemSettings(): Record<string, string> {
        const result: Record<string, string> = {};
        try {
            const sheet = this.getSheet(SHEET_NAMES.SYSTEM_SETTINGS);
            const lastRow = sheet.getLastRow();
            if (lastRow >= 2) {
                const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
                for (const row of data) {
                    const k = String(row[0] ?? '').trim();
                    if (!k) continue;
                    result[k] = String(row[1] ?? '');
                }
            }
        } catch (e) {
            Logger.log(`システム設定の取得エラー: ${formatError(e)}`);
        }
        // デフォルト値で穴埋め
        for (const [k, v] of Object.entries(SETTING_DEFAULTS)) {
            if (!(k in result)) result[k] = String(v);
        }
        return result;
    }

    /**
     * 物品申請が必要になる金額しきい値（数値で取得）
     */
    static getRequiresItemRequestThreshold(): number {
        const settings = this.getSystemSettings();
        const raw = settings[SETTING_KEYS.REQUIRES_ITEM_REQUEST_THRESHOLD];
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0
            ? n
            : SETTING_DEFAULTS[SETTING_KEYS.REQUIRES_ITEM_REQUEST_THRESHOLD];
    }

    /**
     * システム設定を更新（変更は購入者のみ許可）
     */
    static updateSystemSetting(key: string, value: string): Record<string, string> {
        const callerEmail = Session.getActiveUser().getEmail();
        if (!this.isPurchaser(callerEmail)) {
            throw new Error('権限がありません: 購入者のみ設定を変更できます');
        }
        const cleanKey = (key || '').trim();
        if (!cleanKey) throw new Error('設定キーが不正です');

        this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.SYSTEM_SETTINGS);
            const lastRow = sheet.getLastRow();
            if (lastRow >= 2) {
                const range = sheet.getRange(2, 1, lastRow - 1, 2);
                const data = range.getValues();
                for (let i = 0; i < data.length; i++) {
                    if (String(data[i][0] ?? '').trim() === cleanKey) {
                        sheet.getRange(i + 2, 2).setValue(value);
                        SpreadsheetApp.flush();
                        return;
                    }
                }
            }
            // 既存行が無ければ末尾に追加
            sheet.appendRow([cleanKey, value]);
            SpreadsheetApp.flush();
        });

        return this.getSystemSettings();
    }

    /**
     * 共通: 「メール, 名前」2列のシートからメンバーを取得
     */
    private static getMemberList(sheetName: string): Approver[] {
        try {
            const sheet = this.getSheet(sheetName);
            // 想定列: A=email, B=名前 (2 行目以降)
            const data = sheet.getRange('A2:B').getValues();
            return data
                .filter(row => row[0] && row[1])
                .map(row => ({
                    email: String(row[0]),
                    name: String(row[1]),
                }));
        } catch (e) {
            Logger.log(`${sheetName}の取得エラー: ${formatError(e)}`);
            return [];
        }
    }

    /**
     * email が指定リストに登録されているかどうか
     */
    private static isMemberOf(sheetName: string, email: string): boolean {
        if (!email) return false;
        const target = email.trim().toLowerCase();
        return this.getMemberList(sheetName).some(
            (m) => m.email.trim().toLowerCase() === target,
        );
    }

    static isApprover(email: string): boolean {
        return this.isMemberOf(SHEET_NAMES.APPROVER_LIST, email);
    }

    static isConfirmer(email: string): boolean {
        return this.isMemberOf(SHEET_NAMES.CONFIRMER_LIST, email);
    }

    static isPurchaser(email: string): boolean {
        return this.isMemberOf(SHEET_NAMES.PURCHASER_LIST, email);
    }

    /**
     * 承認者を追加。既存ユーザー（重複 email）の場合は何もしない。
     * 操作は管理者（既存承認者）にのみ許可する。
     */
    static addApprover(email: string, name: string): Approver[] {
        this.assertCallerIsApprover();
        return this.appendMember(SHEET_NAMES.APPROVER_LIST, email, name);
    }

    /**
     * 承認者を削除。該当 email の最初の行を削除する。
     * 自分自身は削除できない（管理者がいなくなる事故を防ぐ）。
     */
    static removeApprover(email: string): Approver[] {
        this.assertCallerIsApprover();
        const target = (email || '').trim().toLowerCase();
        const callerEmail = Session.getActiveUser().getEmail().toLowerCase();
        if (target === callerEmail) {
            throw new Error('自分自身は削除できません');
        }
        return this.removeMember(SHEET_NAMES.APPROVER_LIST, email);
    }

    static addConfirmer(email: string, name: string): Confirmer[] {
        this.assertCallerIsApprover();
        return this.appendMember(SHEET_NAMES.CONFIRMER_LIST, email, name);
    }

    static removeConfirmer(email: string): Confirmer[] {
        this.assertCallerIsApprover();
        return this.removeMember(SHEET_NAMES.CONFIRMER_LIST, email);
    }

    static addPurchaser(email: string, name: string): Purchaser[] {
        this.assertCallerIsApprover();
        return this.appendMember(SHEET_NAMES.PURCHASER_LIST, email, name);
    }

    static removePurchaser(email: string): Purchaser[] {
        this.assertCallerIsApprover();
        return this.removeMember(SHEET_NAMES.PURCHASER_LIST, email);
    }

    /**
     * 共通: メンバー追加
     */
    private static appendMember(
        sheetName: string,
        email: string,
        name: string,
    ): Approver[] {
        const cleanEmail = (email || '').trim();
        const cleanName = (name || '').trim();
        if (!cleanEmail || !cleanName) {
            throw new Error('email と name は必須です');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            throw new Error('email の形式が正しくありません');
        }
        if (this.isMemberOf(sheetName, cleanEmail)) {
            return this.getMemberList(sheetName);
        }
        this.withLock(() => {
            const sheet = this.getSheet(sheetName);
            sheet.appendRow([cleanEmail, cleanName]);
            SpreadsheetApp.flush();
        });
        return this.getMemberList(sheetName);
    }

    /**
     * 共通: メンバー削除
     */
    private static removeMember(sheetName: string, email: string): Approver[] {
        const target = (email || '').trim().toLowerCase();
        if (!target) throw new Error('email は必須です');
        this.withLock(() => {
            const sheet = this.getSheet(sheetName);
            const data = sheet.getRange('A2:B').getValues();
            for (let i = 0; i < data.length; i++) {
                if (String(data[i][0]).trim().toLowerCase() === target) {
                    sheet.deleteRow(i + 2);
                    SpreadsheetApp.flush();
                    return;
                }
            }
        });
        return this.getMemberList(sheetName);
    }

    /**
     * メールアドレスからユーザー名を取得（社員名簿から）
     */
    static getUserName(email: string): string | null {
        return this.getUserProfile(email)?.name ?? null;
    }

    /**
     * 名前からメールアドレスを逆引き（社員名簿から）
     * 同名社員がいる場合は最初に見つかったものを返す
     */
    static getEmailByName(name: string): string | null {
        if (!name) return null;
        try {
            const employeeSheet = this.getSheet(SHEET_NAMES.EMPLOYEE_LIST);
            const data = employeeSheet.getDataRange().getValues();
            const row = data.slice(1).find((r) => String(r[1]) === name);
            return row && row[0] ? String(row[0]) : null;
        } catch (e) {
            Logger.log(`社員名簿からの email 逆引きエラー: ${formatError(e)}`);
            return null;
        }
    }

    /**
     * 社員名簿から名前と部署を取得
     * 想定列: A=email, B=名前, C=部署
     */
    static getUserProfile(
        email: string,
    ): { name: string; department: string } | null {
        if (!email) return null;
        try {
            const employeeSheet = this.getSheet(SHEET_NAMES.EMPLOYEE_LIST);
            const data = employeeSheet.getDataRange().getValues();

            const userRow = data.slice(1).find(row => row[0] === email);
            if (!userRow) return null;

            const name = userRow[1] ? String(userRow[1]) : '';
            const department = userRow[2] ? String(userRow[2]) : '';
            if (!name && !department) return null;
            return { name, department };
        } catch (e) {
            Logger.log(`社員名簿からのプロフィール取得エラー: ${e}`);
            return null;
        }
    }

    /**
     * 統計情報を取得
     */
    static getStatistics() {
        const apps = this.getAllApplications();
        if (!apps) {
            return {
                total: 0,
                pendingApproval: 0,
                pendingConfirmation: 0,
                pendingPurchase: 0,
                ordered: 0,
                rejected: 0,
                totalOrderedAmount: 0,
            };
        }

        const pendingApproval = apps.filter(a => a.status === STATUS.PENDING_APPROVAL).length;
        const pendingConfirmation = apps.filter(a => a.status === STATUS.PENDING_CONFIRMATION).length;
        const pendingPurchase = apps.filter(a => a.status === STATUS.PENDING_PURCHASE).length;
        const ordered = apps.filter(a => a.status === STATUS.ORDERED).length;
        const rejected = apps.filter(a => a.status === STATUS.REJECTED).length;

        const totalOrderedAmount = apps
            .filter(a => a.status === STATUS.ORDERED)
            .reduce((sum, a) => sum + (a.actualAmount ?? a.totalPrice), 0);

        return {
            total: apps.length,
            pendingApproval,
            pendingConfirmation,
            pendingPurchase,
            ordered,
            rejected,
            totalOrderedAmount,
        };
    }

    /**
     * 承認系フィールドを更新（ステータス・承認者・承認日・コメント）
     */
    private static updateApprovalFields(
        rowIndex: number,
        status: ApplicationStatus,
        approver: string,
        comment: string,
    ): void {
        if (rowIndex < 2) {
            throw new Error(ERROR_MESSAGES.INVALID_ROW_INDEX);
        }

        this.withLock(() => {
            const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
            const now = new Date();

            sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).setValue(status);
            sheet.getRange(rowIndex, COLUMN_INDEX.APPROVER + 1).setValue(approver);
            sheet.getRange(rowIndex, COLUMN_INDEX.APPROVAL_DATE + 1).setValue(now);
            sheet.getRange(rowIndex, COLUMN_INDEX.COMMENT + 1).setValue(comment);

            SpreadsheetApp.flush();
        });
    }

    /**
     * スプレッドシート行をApplicationオブジェクトに変換
     */
    private static parseRowToApplication(
        row: unknown[],
        rowIndex: number,
    ): Application | null {
        try {
            const timestamp = row[COLUMN_INDEX.TIMESTAMP];
            const fileUrl = row[COLUMN_INDEX.FILE_URL];

            // タイムスタンプが空の場合はスキップ
            if (!timestamp) return null;

            const productUrlRaw = row[COLUMN_INDEX.PRODUCT_URL];
            const productUrl = productUrlRaw ? String(productUrlRaw) : null;

            const actualAmountRaw = row[COLUMN_INDEX.ACTUAL_AMOUNT];
            const amountDiffRaw = row[COLUMN_INDEX.AMOUNT_DIFF];

            const app: Application = {
                rowIndex,
                timestamp: this.parseDate(timestamp)?.toISOString() ?? null,
                name: String(row[COLUMN_INDEX.NAME] ?? ''),
                department: String(row[COLUMN_INDEX.DEPARTMENT] ?? ''),
                itemName: String(row[COLUMN_INDEX.ITEM_NAME] ?? ''),
                quantity: safeParseInt(row[COLUMN_INDEX.QUANTITY] as string | number | null, 0),
                unitPrice: safeParseFloat(row[COLUMN_INDEX.UNIT_PRICE] as string | number | null, 0),
                totalPrice: safeParseFloat(row[COLUMN_INDEX.TOTAL_PRICE] as string | number | null, 0),
                reason: String(row[COLUMN_INDEX.REASON] ?? ''),
                productUrl,
                fileInfo: fileUrl ? this.parseFileInfo(String(fileUrl)) : null,
                status: normalizeStatus(String(row[COLUMN_INDEX.STATUS] ?? '')),
                approver: String(row[COLUMN_INDEX.APPROVER] ?? ''),
                approvalDate: this.parseDate(row[COLUMN_INDEX.APPROVAL_DATE])?.toISOString() ?? null,
                comment: String(row[COLUMN_INDEX.COMMENT] ?? ''),
                confirmer: String(row[COLUMN_INDEX.CONFIRMER] ?? ''),
                confirmedDate: this.parseDate(row[COLUMN_INDEX.CONFIRMED_DATE])?.toISOString() ?? null,
                purchaser: String(row[COLUMN_INDEX.PURCHASER] ?? ''),
                orderedDate: this.parseDate(row[COLUMN_INDEX.ORDERED_DATE])?.toISOString() ?? null,
                actualAmount:
                    actualAmountRaw === '' || actualAmountRaw == null
                        ? null
                        : safeParseFloat(actualAmountRaw as string | number, 0),
                amountDiff:
                    amountDiffRaw === '' || amountDiffRaw == null
                        ? null
                        : safeParseFloat(amountDiffRaw as string | number, 0),
                accountCategory: String(row[COLUMN_INDEX.ACCOUNT_CATEGORY] ?? ''),
                chargingDepartment: String(row[COLUMN_INDEX.CHARGING_DEPARTMENT] ?? ''),
            };

            return app;
        } catch (error) {
            Logger.log(`行${rowIndex}のパースエラー: ${formatError(error)}`);
            return null;
        }
    }

    /**
     * 日付をパース
     */
    private static parseDate(value: unknown): Date | null {
        if (!value) return null;

        if (value instanceof Date) {
            return value;
        }

        if (typeof value === 'string') {
            const date = new Date(value);
            return isNaN(date.getTime()) ? null : date;
        }

        return null;
    }

    /**
     * ファイルURLからFileInfo型を生成
     * Drive 取得に失敗した場合（権限なし等）は最低限の情報を返す
     */
    private static parseFileInfo(url: string): FileInfo | null {
        if (!url) return null;

        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = match ? match[1] : '';

        try {
            if (!fileId) return null;
            const file = DriveApp.getFileById(fileId);
            return {
                id: fileId,
                name: file.getName(),
                mimeType: file.getMimeType(),
                size: this.formatBytes(file.getSize()),
                url,
            };
        } catch (e) {
            Logger.log(`parseFileInfoでエラー: ${formatError(e)}`);
            return {
                id: fileId,
                name: 'ファイル情報の取得に失敗',
                mimeType: 'application/octet-stream',
                size: '不明',
                url,
            };
        }
    }

    /**
     * 添付ファイルのバリデーション
     * - MIME: DEFAULT_CONFIG.ALLOWED_MIME_TYPES に含まれるか
     * - サイズ: DEFAULT_CONFIG.MAX_FILE_SIZE 以下か
     */
    private static validateFile(file: {
        name: string;
        mimeType: string;
        data: string;
    }): void {
        const allowed = DEFAULT_CONFIG.ALLOWED_MIME_TYPES as readonly string[];
        if (!allowed.includes(file.mimeType)) {
            throw new Error(ERROR_MESSAGES.INVALID_FILE_TYPE);
        }

        // base64 文字列から元のバイト長を概算（パディング込み: 4 文字 → 3 バイト）
        const padding = (file.data.match(/=+$/) ?? [''])[0].length;
        const approxBytes = Math.floor((file.data.length * 3) / 4) - padding;
        if (approxBytes > DEFAULT_CONFIG.MAX_FILE_SIZE) {
            throw new Error(ERROR_MESSAGES.FILE_TOO_LARGE);
        }
    }

    /**
     * Drive へファイルをアップロードして URL を返す
     */
    private static uploadFile(file: {
        name: string;
        mimeType: string;
        data: string;
    }): string {
        try {
            const decoded = Utilities.base64Decode(file.data);
            const blob = Utilities.newBlob(decoded, file.mimeType, file.name);
            const folder = DriveApp.getFolderById(
                DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID,
            );
            const newFile = folder.createFile(blob);
            return newFile.getUrl();
        } catch (e) {
            Logger.log(`ファイルアップロードエラー: ${formatError(e)}`);
            throw new Error('添付ファイルの保存に失敗しました');
        }
    }

    /**
     * LockService で排他ロックを取りつつ処理を実行
     * 申請の追加など、行番号の競合が起きうる処理に使う
     */
    private static withLock<T>(fn: () => T): T {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(LOCK_TIMEOUT_MS)) {
            throw new Error(
                '他の処理が進行中です。しばらくしてから再度お試しください。',
            );
        }
        try {
            return fn();
        } finally {
            lock.releaseLock();
        }
    }

    /**
     * ファイルサイズをフォーマット
     */
    private static formatBytes(bytes: number, decimals = 2): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    /**
     * シートを取得
     */
    private static getSheet(sheetName: string): GoogleAppsScript.Spreadsheet.Sheet {
        const ss = getSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            throw new Error(ERROR_MESSAGES.SHEET_NOT_FOUND(sheetName));
        }

        return sheet;
    }
}
