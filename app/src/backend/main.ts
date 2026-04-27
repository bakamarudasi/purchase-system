/**
 * GAS エントリポイント
 * - doGet: ビルド済み HTML を返却
 * - serverFunctions/* をグローバルに公開（フロントから google.script.run で呼ばれる）
 *
 * 注意: rollup-plugin-google-apps-script がトップレベルの代入を解析して
 * GAS が認識できる function 宣言を生成するため、明示的に列挙する。
 */

import {
  getAllApplications,
  getApplicationByRowIndex,
  getApplicationsByStatus,
  getPendingApplications,
  approveApplication,
  rejectApplication,
  addApplication,
  getStatistics,
  getApproverList,
  getCurrentUser,
} from './serverFunctions';

declare const global: {
  [key: string]: unknown;
};

global.doGet = (): GoogleAppsScript.HTML.HtmlOutput => {
  return HtmlService.createHtmlOutputFromFile('dist/index')
    .setTitle('購入申請システム')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
};

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
