/**
 * 申請管理サービス
 * スプレッドシートとのデータ連携、承認・却下処理を担当
 */

import {
    Application,
    ApplicationStatus,
    Approver,
    FileInfo,
} from '../models/Application';
import {
    SHEET_NAMES,
    COLUMN_INDEX,
    STATUS,
    ERROR_MESSAGES,
    getSpreadsheet,
    DEFAULT_CONFIG,
} from '../config';
import { safeParseInt, safeParseFloat, formatError } from '../utils/format';

const COLUMN_COUNT = Object.keys(COLUMN_INDEX).length;
const LOCK_TIMEOUT_MS = 10_000;

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
     * 未対応の申請のみを取得
     */
    static getPendingApplications(): Application[] {
        return this.getApplicationsByStatus(STATUS.PENDING);
    }

    /**
     * 申請を承認
     * 承認者リストに登録されている操作者しか実行できない
     */
    static approveApplication(rowIndex: number, approver: string, comment: string): void {
        this.assertCallerIsApprover();
        this.updateApplicationStatus(rowIndex, STATUS.APPROVED, approver, comment);
    }

    /**
     * 申請を却下
     * 承認者リストに登録されている操作者しか実行できない
     */
    static rejectApplication(rowIndex: number, approver: string, comment: string): void {
        this.assertCallerIsApprover();
        this.updateApplicationStatus(rowIndex, STATUS.REJECTED, approver, comment);
    }

    /**
     * 一括承認/却下の戻り値
     */
    static processBulk(
        rowIndices: number[],
        action: 'approve' | 'reject',
        approver: string,
        comment: string,
    ): { success: number[]; failed: { rowIndex: number; error: string }[] } {
        this.assertCallerIsApprover();
        const status = action === 'approve' ? STATUS.APPROVED : STATUS.REJECTED;
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
                    sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).setValue(status);
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

        return { success, failed };
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
            STATUS.PENDING,             // K: ステータス（初期値は未対応）
            approver,                   // L: 承認者 (email)
            '',                         // M: 承認日
            '',                         // N: コメント
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
            status: STATUS.PENDING,
            approver,
            approvalDate: null,
            comment: ''
        };

        return newApplication;
    }

    /**
     * 承認者リストを取得
     */
    static getApproverList(): Approver[] {
        try {
            const approverSheet = this.getSheet(SHEET_NAMES.APPROVER_LIST);
            // 想定列: A=email, B=名前 (2 行目以降)
            const data = approverSheet.getRange('A2:B').getValues();
            return data
                .filter(row => row[0] && row[1])
                .map(row => ({
                    email: String(row[0]),
                    name: String(row[1]),
                }));
        } catch (e) {
            Logger.log(`承認者リストの取得エラー: ${formatError(e)}`);
            return [];
        }
    }

    /**
     * email が承認者リストに登録されているかどうか
     * 大文字小文字は区別しない（ユーザー入力ゆれ対策）
     */
    static isApprover(email: string): boolean {
        if (!email) return false;
        const target = email.trim().toLowerCase();
        return this.getApproverList().some(
            (a) => a.email.trim().toLowerCase() === target,
        );
    }

    /**
     * メールアドレスからユーザー名を取得（社員名簿から）
     */
    static getUserName(email: string): string | null {
        return this.getUserProfile(email)?.name ?? null;
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
                pending: 0,
                approved: 0,
                rejected: 0,
                totalApprovedAmount: 0,
            };
        }

        const pending = apps.filter(a => a.status === STATUS.PENDING).length;
        const approved = apps.filter(a => a.status === STATUS.APPROVED).length;
        const rejected = apps.filter(a => a.status === STATUS.REJECTED).length;

        const totalApprovedAmount = apps
            .filter(a => a.status === STATUS.APPROVED)
            .reduce((sum, a) => sum + a.totalPrice, 0);

        return {
            total: apps.length,
            pending,
            approved,
            rejected,
            totalApprovedAmount,
        };
    }

    /**
     * 申請ステータスを更新（内部処理）
     */
    private static updateApplicationStatus(
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
                status: (row[COLUMN_INDEX.STATUS] || STATUS.PENDING) as ApplicationStatus,
                approver: String(row[COLUMN_INDEX.APPROVER] ?? ''),
                approvalDate: this.parseDate(row[COLUMN_INDEX.APPROVAL_DATE])?.toISOString() ?? null,
                comment: String(row[COLUMN_INDEX.COMMENT] ?? ''),
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