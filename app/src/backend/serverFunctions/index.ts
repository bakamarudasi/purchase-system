/**
 * フロントエンドから呼び出し可能な関数群
 * gas-client 経由で `serverFunctions.xxx()` の形で呼ばれる
 */

import { ApplicationService } from '../services';
import type {
  Application,
  ApplicationStatus,
  Approver,
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
  file?: { name: string; mimeType: string; data: string };
}): Application {
  return ApplicationService.addApplication(data);
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

export type UserRole = 'admin' | 'applicant';

export function getCurrentUser(): {
  email: string;
  name: string;
  department: string;
  role: UserRole;
} {
  const email = Session.getActiveUser().getEmail();
  const fallbackName = email ? email.split('@')[0] : 'ゲスト';

  const profile = ApplicationService.getUserProfile(email);
  // 承認者リストに乗っているユーザーを管理者とみなす
  const role: UserRole = ApplicationService.isApprover(email) ? 'admin' : 'applicant';
  return {
    email,
    name: profile?.name ?? fallbackName,
    department: profile?.department ?? '',
    role,
  };
}
