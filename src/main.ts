/**
 * Google Apps Script メインファイル
 * Web APIとして公開される関数を定義
 */

import { ApplicationService } from './services';
import { Application, ApplicationStatus } from './models/Application';



/**
 * すべての申請データを取得
 */
function getAllApplications(): Application[] {
    return ApplicationService.getAllApplications();
}

/**
 * 特定のrowIndexの申請を取得
 */
function getApplicationByRowIndex(rowIndex: number): Application | null {
    try {
        return ApplicationService.getApplicationByRowIndex(rowIndex);
    } catch (error) {
        Logger.log(`getApplicationByRowIndex エラー: ${error}`);
        throw error;
    }
}

/**
 * ステータスでフィルタリングした申請を取得
 */
function getApplicationsByStatus(status: ApplicationStatus): Application[] {
    try {
        return ApplicationService.getApplicationsByStatus(status);
    } catch (error) {
        Logger.log(`getApplicationsByStatus エラー: ${error}`);
        throw error;
    }
}

/**
 * 未対応の申請を取得
 */
function getPendingApplications(): Application[] {
    try {
        return ApplicationService.getPendingApplications();
    } catch (error) {
        Logger.log(`getPendingApplications エラー: ${error}`);
        throw error;
    }
}

/**
 * 申請を承認
 */
function approveApplication(rowIndex: number, approver: string, comment: string): void {
    try {
        ApplicationService.approveApplication(rowIndex, approver, comment);
        Logger.log(`申請承認: rowIndex=${rowIndex}, approver=${approver}`);
    } catch (error) {
        Logger.log(`approveApplication エラー: ${error}`);
        throw error;
    }
}

/**
 * 申請を却下
 */
function rejectApplication(rowIndex: number, approver: string, comment: string): void {
    try {
        ApplicationService.rejectApplication(rowIndex, approver, comment);
        Logger.log(`申請却下: rowIndex=${rowIndex}, approver=${approver}`);
    } catch (error) {
        Logger.log(`rejectApplication エラー: ${error}`);
        throw error;
    }
}

/**
 * 新規申請を追加
 */
function addApplication(data: {
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
    try {
        return ApplicationService.addApplication(data);
    } catch (error) {
        Logger.log(`addApplication エラー: ${error}`);
        throw error;
    }
}

/**
 * 統計情報を取得
 */
function getStatistics() {
    try {
        return ApplicationService.getStatistics();
    } catch (error) {
        Logger.log(`getStatistics エラー: ${error}`);
        throw error;
    }
}

function getApproverList(): string[] {
    return ApplicationService.getApproverList();
}

/**
 * ログインユーザー情報を取得
 */
function getCurrentUser(): { email: string; name: string } {
    const email = Session.getActiveUser().getEmail();
    let name = email.split('@')[0]; // デフォルト名

    const sheetName = ApplicationService.getUserName(email);
    if (sheetName) {
        name = sheetName;
    }

    return { email, name };
}

/**
 * テスト用: データ確認
 */
function testGetAllApplications() {
    const apps = getAllApplications();
    if (!apps) {
        Logger.log('アプリケーションの取得に失敗しました。');
        return;
    }
    Logger.log(`取得件数: ${apps.length}`);
    if (apps.length > 0) {
        Logger.log(JSON.stringify(apps[0], null, 2));
    }
}

/**
 * テスト用: 承認処理
 */
function testApproveApplication() {
    approveApplication(2, 'test@example.com', 'テスト承認');
    Logger.log('承認完了');
}

/**
 * テスト用: 統計取得
 */
function testGetStatistics() {
    const stats = getStatistics();
    Logger.log(JSON.stringify(stats, null, 2));
}

/**
 * テスト用: 申請追加
 */
function testAddApplication() {
    const newApp = addApplication({
        name: '山田太郎',
        department: '営業部',
        itemName: 'テスト商品',
        quantity: 1,
        unitPrice: 10000,
        reason: 'テスト申請です',
    });
    Logger.log('申請追加完了');
    Logger.log(JSON.stringify(newApp, null, 2));
}

// --- グローバルに関数を公開 --- //

declare const global: any;


global.getAllApplications = getAllApplications;
global.getApplicationByRowIndex = getApplicationByRowIndex;
global.getApplicationsByStatus = getApplicationsByStatus;
global.getPendingApplications = getPendingApplications;
global.approveApplication = approveApplication;
global.rejectApplication = rejectApplication;
global.addApplication = addApplication;
global.getStatistics = getStatistics;
global.getApproverList = getApproverList;
global.getCurrentUser = getCurrentUser;
global.testGetAllApplications = testGetAllApplications;
global.testApproveApplication = testApproveApplication;
global.testGetStatistics = testGetStatistics;
global.testAddApplication = testAddApplication;