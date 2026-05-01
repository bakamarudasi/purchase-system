/**
 * フロントエンドから呼び出し可能な関数群
 * gas-client 経由で `serverFunctions.xxx()` の形で呼ばれる
 */

import { ApplicationService } from '../services';
import type {
  Application,
  ApplicationStatus,
  Approver,
  Confirmer,
  Purchaser,
} from '../models/Application';

export function getAllApplications(): Application[] {
  return ApplicationService.getAllApplications();
}

export function getApplicationByRowIndex(
  rowIndex: number,
): Application | null {
  return ApplicationService.getApplicationByRowIndex(rowIndex);
}

export function getApplicationsByStatus(
  status: ApplicationStatus,
): Application[] {
  return ApplicationService.getApplicationsByStatus(status);
}

export function getPendingApplications(): Application[] {
  return ApplicationService.getPendingApplications();
}

export function approveApplication(
  rowIndex: number,
  approver: string,
  comment: string,
): void {
  ApplicationService.approveApplication(rowIndex, approver, comment);
}

export function rejectApplication(
  rowIndex: number,
  approver: string,
  comment: string,
): void {
  ApplicationService.rejectApplication(rowIndex, approver, comment);
}

export function confirmApplication(rowIndex: number): void {
  ApplicationService.confirmApplication(rowIndex);
}

export function markAsOrdered(rowIndex: number, actualAmount: number): void {
  ApplicationService.markAsOrdered(rowIndex, actualAmount);
}

export function processBulk(
  rowIndices: number[],
  action: 'approve' | 'reject',
  approver: string,
  comment: string,
): { success: number[]; failed: { rowIndex: number; error: string }[] } {
  return ApplicationService.processBulk(rowIndices, action, approver, comment);
}

export function addApplication(data: {
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
  return ApplicationService.addApplication(data);
}

export function getAccountCategoryList(): string[] {
  return ApplicationService.getAccountCategoryList();
}

export function addAccountCategory(name: string): string[] {
  return ApplicationService.addAccountCategory(name);
}

export function removeAccountCategory(name: string): string[] {
  return ApplicationService.removeAccountCategory(name);
}

export function getChargingDepartmentList(): string[] {
  return ApplicationService.getChargingDepartmentList();
}

export function addChargingDepartment(name: string): string[] {
  return ApplicationService.addChargingDepartment(name);
}

export function removeChargingDepartment(name: string): string[] {
  return ApplicationService.removeChargingDepartment(name);
}

export function getSystemSettings(): Record<string, string> {
  return ApplicationService.getSystemSettings();
}

export function updateSystemSetting(
  key: string,
  value: string,
): Record<string, string> {
  return ApplicationService.updateSystemSetting(key, value);
}

export function getStatistics() {
  return ApplicationService.getStatistics();
}

export function getApproverList(): Approver[] {
  return ApplicationService.getApproverList();
}

export function addApprover(email: string, name: string): Approver[] {
  return ApplicationService.addApprover(email, name);
}

export function removeApprover(email: string): Approver[] {
  return ApplicationService.removeApprover(email);
}

export function getConfirmerList(): Confirmer[] {
  return ApplicationService.getConfirmerList();
}

export function addConfirmer(email: string, name: string): Confirmer[] {
  return ApplicationService.addConfirmer(email, name);
}

export function removeConfirmer(email: string): Confirmer[] {
  return ApplicationService.removeConfirmer(email);
}

export function getPurchaserList(): Purchaser[] {
  return ApplicationService.getPurchaserList();
}

export function addPurchaser(email: string, name: string): Purchaser[] {
  return ApplicationService.addPurchaser(email, name);
}

export function removePurchaser(email: string): Purchaser[] {
  return ApplicationService.removePurchaser(email);
}

/**
 * 旧データのステータスを新ワークフロー用に一括移行する。
 * 初回デプロイ時に承認者が手動実行する想定。
 */
export function migrateLegacyStatuses(): { pending: number; approved: number } {
  return ApplicationService.migrateLegacyStatuses();
}

export type UserRole = 'admin' | 'applicant';

export interface CurrentUserDTO {
  email: string;
  name: string;
  department: string;
  /** 申請者か管理者か（管理画面の出し分け用） */
  role: UserRole;
  /** 承認者リストに登録されているか */
  isApprover: boolean;
  /** 確認者リストに登録されているか */
  isConfirmer: boolean;
  /** 購入者リストに登録されているか */
  isPurchaser: boolean;
}

export function getCurrentUser(): CurrentUserDTO {
  const email = Session.getActiveUser().getEmail();
  const fallbackName = email ? email.split('@')[0] : 'ゲスト';

  const profile = ApplicationService.getUserProfile(email);
  const isApprover = ApplicationService.isApprover(email);
  const isConfirmer = ApplicationService.isConfirmer(email);
  const isPurchaser = ApplicationService.isPurchaser(email);
  // 何らかの権限ロールを持っているユーザーを admin として扱う
  const role: UserRole =
    isApprover || isConfirmer || isPurchaser ? 'admin' : 'applicant';
  return {
    email,
    name: profile?.name ?? fallbackName,
    department: profile?.department ?? '',
    role,
    isApprover,
    isConfirmer,
    isPurchaser,
  };
}
