/**
 * 申請管理サービス
 * スプレッドシートとのデータ連携、承認・却下処理を担当
 */

import { Application, ApplicationStatus, FileInfo } from '../models/Application';
import { SHEET_NAMES, COLUMN_INDEX, STATUS, ERROR_MESSAGES, getSpreadsheet, DEFAULT_CONFIG } from '../config';
//import { formatDateTime } from '../utils/date';  使ってないからｺﾒﾝﾄアウトで修正　将来用に宣言ぐらいはしておく'
import { safeParseInt, safeParseFloat } from '../utils/format';

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
        const row = sheet.getRange(rowIndex, 1, 1, 14).getValues()[0];

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
     */
    static approveApplication(rowIndex: number, approver: string, comment: string): void {
        this.updateApplicationStatus(rowIndex, STATUS.APPROVED, approver, comment);
    }

    /**
     * 申請を却下
     */
    static rejectApplication(rowIndex: number, approver: string, comment: string): void {
        this.updateApplicationStatus(rowIndex, STATUS.REJECTED, approver, comment);
    }

    /**
     * 新規申請を追加
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
        const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
        const timestamp = new Date();
        const totalPrice = data.quantity * data.unitPrice;
        let fileUrl = '';

        if (data.file) {
            try {
                const decodedData = Utilities.base64Decode(data.file.data);
                const blob = Utilities.newBlob(decodedData, data.file.mimeType, data.file.name);
                const folder = DriveApp.getFolderById(DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID);
                const newFile = folder.createFile(blob);
                fileUrl = newFile.getUrl();
            } catch (e) {
                Logger.log(`ファイルアップロードエラー: ${e}`);
            }
        }

        const row = [
            timestamp,           // A: タイムスタンプ
            data.name,          // B: 名前
            data.department,    // C: 部署
            data.itemName,      // D: 商品名
            data.quantity,      // E: 数量
            data.unitPrice,     // F: 単価
            totalPrice,         // G: 合計金額
            data.reason,        // H: 購入理由
            fileUrl,            // I: 添付ファイルURL
            data.productUrl || '', // J: 購入商品URL
            STATUS.PENDING,     // K: ステータス（初期値は未対応）
            data.selectedApprover || '', // L: 承認者
            '',                 // M: 承認日
            '',                 // N: コメント
        ];

        sheet.appendRow(row);

        const newRowIndex = sheet.getLastRow();
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
            approver: data.selectedApprover || '',
            approvalDate: null,
            comment: ''
        };

        return newApplication;
    }

    /**
     * 承認者リストを取得
     */
    static getApproverList(): string[] {
        try {
            const approverSheet = this.getSheet(SHEET_NAMES.APPROVER_LIST);
            // A列の2行目から最後まで取得
            const data = approverSheet.getRange('B2:B').getValues();
            // 配列をフラットにし、空のセルを除外
            return data.flat().filter(name => name !== '');
        } catch (e) {
            Logger.log(`承認者リストの取得エラー: ${e}`);
            return [];
        }
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
        comment: string
    ): void {
        if (rowIndex < 2) {
            throw new Error(ERROR_MESSAGES.INVALID_ROW_INDEX);
        }

        const sheet = this.getSheet(SHEET_NAMES.APPLICATIONS);
        const now = new Date();

        // K列: ステータス
        sheet.getRange(rowIndex, COLUMN_INDEX.STATUS + 1).setValue(status);

        // L列: 承認者
        sheet.getRange(rowIndex, COLUMN_INDEX.APPROVER + 1).setValue(approver);

        // M列: 承認日
        sheet.getRange(rowIndex, COLUMN_INDEX.APPROVAL_DATE + 1).setValue(now);

        // N列: コメント
        sheet.getRange(rowIndex, COLUMN_INDEX.COMMENT + 1).setValue(comment);
    }

    /**
     * スプレッドシート行をApplicationオブジェクトに変換
     */
    private static parseRowToApplication(row: any[], rowIndex: number): Application | null {
        try {
            const timestamp = row[COLUMN_INDEX.TIMESTAMP];
            const fileUrl = row[COLUMN_INDEX.FILE_URL];

            // タイムスタンプが空の場合はスキップ
            if (!timestamp) return null;

            const app: Application = {
                rowIndex,
                timestamp: this.parseDate(timestamp)?.toISOString() || null,
                name: String(row[COLUMN_INDEX.NAME] || ''),
                department: String(row[COLUMN_INDEX.DEPARTMENT] || ''),
                itemName: String(row[COLUMN_INDEX.ITEM_NAME] || ''),
                quantity: safeParseInt(row[COLUMN_INDEX.QUANTITY], 0),
                unitPrice: safeParseFloat(row[COLUMN_INDEX.UNIT_PRICE], 0),
                totalPrice: safeParseFloat(row[COLUMN_INDEX.TOTAL_PRICE], 0),
                reason: String(row[COLUMN_INDEX.REASON] || ''),
                productUrl: String(row[COLUMN_INDEX.PRODUCT_URL] || ''),
                fileInfo: fileUrl ? this.parseFileInfo(fileUrl) : null,
                status: (row[COLUMN_INDEX.STATUS] || STATUS.PENDING) as ApplicationStatus,
                approver: String(row[COLUMN_INDEX.APPROVER] || ''),
                approvalDate: this.parseDate(row[COLUMN_INDEX.APPROVAL_DATE])?.toISOString() || null,
                comment: String(row[COLUMN_INDEX.COMMENT] || ''),
            };

            return app;
        } catch (error) {
            Logger.log(`行${rowIndex}のパースエラー: ${error}`);
            return null;
        }
    }

    /**
     * 日付をパース
     */
    private static parseDate(value: any): Date | null {
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
     */
    private static parseFileInfo(url: string): FileInfo | null {
        if (!url) return null;

        try {
            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (!match) return null;
            const fileId = match[1];

            const file = DriveApp.getFileById(fileId);
            const size = this.formatBytes(file.getSize());

            return {
                id: fileId,
                name: file.getName(),
                mimeType: file.getMimeType(),
                size: size,
                url: url,
            };
        } catch (e) {
            Logger.log(`parseFileInfoでエラー: ${e}`);
            // エラーが起きても、最低限の情報を返す
            return {
                id: '',
                name: 'ファイル名取得失敗',
                mimeType: 'application/pdf',
                size: '不明',
                url: url,
            };
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