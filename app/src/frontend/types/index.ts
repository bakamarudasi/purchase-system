/**
 * フロントで利用するドメイン型はバックエンドの定義をそのまま再エクスポートする。
 * 実装ではなく型のみを参照するので、Vite ビルド時にバックエンドコードがバンドル
 * されることはない（type-only import）。
 */
export type {
  Application,
  ApplicationStatus,
  Approver,
  Confirmer,
  Purchaser,
  FileInfo,
} from '../../backend/models/Application';

export interface Statistics {
  total: number;
  pendingApproval: number;
  pendingConfirmation: number;
  pendingPurchase: number;
  ordered: number;
  rejected: number;
  totalOrderedAmount: number;
}

export type UserRole = 'admin' | 'applicant';

export interface CurrentUser {
  email: string;
  name: string;
  department: string;
  role: UserRole;
  isApprover: boolean;
  isConfirmer: boolean;
  isPurchaser: boolean;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export type SortDirection = 'ascending' | 'descending';

export interface SortConfig {
  key: keyof import('../../backend/models/Application').Application;
  direction: SortDirection;
}

export interface VisibleTabs {
  all: boolean;
  承認待ち: boolean;
  確認待ち: boolean;
  購入待ち: boolean;
  注文済: boolean;
  却下: boolean;
}
