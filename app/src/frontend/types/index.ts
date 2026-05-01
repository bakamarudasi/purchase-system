/**
 * フロントで利用するドメイン型はバックエンドの定義をそのまま再エクスポートする。
 * 実装ではなく型のみを参照するので、Vite ビルド時にバックエンドコードがバンドル
 * されることはない（type-only import）。
 */
export type {
  Application,
  ApplicationStatus,
  Approver,
  FileInfo,
} from '../../backend/models/Application';

export interface Statistics {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalApprovedAmount: number;
}

export type UserRole = 'admin' | 'applicant';

export interface CurrentUser {
  email: string;
  name: string;
  department: string;
  role: UserRole;
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
  未対応: boolean;
  承認: boolean;
  却下: boolean;
}
