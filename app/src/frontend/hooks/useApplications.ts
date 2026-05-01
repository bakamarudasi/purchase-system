import { useCallback, useEffect, useState } from 'react';
import { GASClient } from 'gas-client';
import type * as serverFns from '../../backend/serverFunctions';
import type {
  Application,
  Approver,
  CurrentUser,
  Statistics,
} from '../types';

const { serverFunctions } = new GASClient<typeof serverFns>();

const EMPTY_STATS: Statistics = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  totalApprovedAmount: 0,
};

const EMPTY_USER: CurrentUser = { email: '', name: '', department: '', role: 'applicant' };

function calculateStats(apps: Application[]): Statistics {
  // 楽観UIの仮データ（rowIndex < 0）は集計から除外する
  const real = apps.filter((a) => a.rowIndex >= 0 && !a.clientStatus);
  const total = real.length;
  const pending = real.filter((a) => a.status === '未対応').length;
  const approved = real.filter((a) => a.status === '承認').length;
  const rejected = real.filter((a) => a.status === '却下').length;
  const totalApprovedAmount = real
    .filter((a) => a.status === '承認')
    .reduce((sum, a) => sum + a.totalPrice, 0);
  return { total, pending, approved, rejected, totalApprovedAmount };
}

const isProd = import.meta.env.PROD;

type SubmitPayload = Parameters<typeof serverFunctions.addApplication>[0];

export function useApplications(onError: (msg: string) => void) {
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<Statistics>(EMPTY_STATS);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(EMPTY_USER);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isProd) {
        const data = await serverFunctions.getAllApplications();
        const list = data ?? [];
        setApps(list);
        setStats(calculateStats(list));
      } else {
        // 開発時のローカルモック
        setApps([]);
        setStats(EMPTY_STATS);
      }
    } catch (e) {
      console.error('データ取得エラー:', e);
      onError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();

    const loadUser = async () => {
      if (!isProd) {
        // dev では URL クエリ ?role=admin で管理者プレビューに切替できるようにする
        const params = new URLSearchParams(window.location.search);
        const devRole = params.get('role') === 'admin' ? 'admin' : 'applicant';
        setCurrentUser({
          email: devRole === 'admin' ? 'admin@example.com' : 'dev@example.com',
          name: devRole === 'admin' ? '管理者 ユーザー' : '開発ユーザー',
          department: '開発部',
          role: devRole,
        });
        return;
      }
      try {
        const user = await serverFunctions.getCurrentUser();
        setCurrentUser(user);
      } catch (e) {
        console.error('ユーザー取得エラー:', e);
      }
    };

    const loadApprovers = async () => {
      if (!isProd) {
        setApprovers([
          { email: 'boss@example.com', name: '部長 太郎' },
          { email: 'lead@example.com', name: 'リーダー 花子' },
        ]);
        return;
      }
      try {
        const list = await serverFunctions.getApproverList();
        setApprovers(list);
      } catch (e) {
        console.error('承認者取得エラー:', e);
      }
    };

    void loadUser();
    void loadApprovers();
  }, [refresh]);

  const approve = useCallback(
    async (rowIndex: number, approver: string, comment: string) => {
      if (!isProd) return;
      setApps((prev) => {
        const next = prev.map((app) =>
          app.rowIndex === rowIndex
            ? {
                ...app,
                status: '承認' as const,
                approver,
                approvalDate: new Date().toISOString(),
                comment,
              }
            : app,
        );
        setStats(calculateStats(next));
        return next;
      });
      try {
        await serverFunctions.approveApplication(rowIndex, approver, comment);
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [refresh],
  );

  const reject = useCallback(
    async (rowIndex: number, approver: string, comment: string) => {
      if (!isProd) return;
      setApps((prev) => {
        const next = prev.map((app) =>
          app.rowIndex === rowIndex
            ? {
                ...app,
                status: '却下' as const,
                approver,
                approvalDate: new Date().toISOString(),
                comment,
              }
            : app,
        );
        setStats(calculateStats(next));
        return next;
      });
      try {
        await serverFunctions.rejectApplication(rowIndex, approver, comment);
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [refresh],
  );

  /**
   * 新規申請の楽観送信。
   *
   * 1. 仮の Application を作って先に一覧に差し込む（clientStatus = 'sending'）
   * 2. サーバ応答が返ったら本物に置き換える
   * 3. 失敗したら clientStatus を 'failed' に変更
   */
  const submitNew = useCallback(
    async (
      data: SubmitPayload,
    ): Promise<{ tempId: number; finalRowIndex: number | null }> => {
      const tempId = -Date.now();
      const optimistic: Application = {
        rowIndex: tempId,
        timestamp: new Date().toISOString(),
        name: data.name,
        department: data.department,
        itemName: data.itemName,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.quantity * data.unitPrice,
        reason: data.reason,
        productUrl: data.productUrl ?? null,
        fileInfo: null,
        status: '未対応',
        approver: data.selectedApprover ?? '',
        approvalDate: null,
        comment: '',
        clientStatus: 'sending',
      };

      setApps((prev) => {
        const next = [optimistic, ...prev];
        setStats(calculateStats(next));
        return next;
      });

      if (!isProd) {
        setApps((prev) => {
          const next = prev.map((a) =>
            a.rowIndex === tempId ? { ...a, clientStatus: undefined } : a,
          );
          setStats(calculateStats(next));
          return next;
        });
        return { tempId, finalRowIndex: tempId };
      }

      try {
        const created = await serverFunctions.addApplication(data);
        setApps((prev) => {
          const next = prev.map((a) => (a.rowIndex === tempId ? created : a));
          setStats(calculateStats(next));
          return next;
        });
        return { tempId, finalRowIndex: created.rowIndex };
      } catch (e) {
        setApps((prev) => {
          const next = prev.map((a) =>
            a.rowIndex === tempId ? { ...a, clientStatus: 'failed' as const } : a,
          );
          setStats(calculateStats(next));
          return next;
        });
        throw e;
      }
    },
    [],
  );

  const addApprover = useCallback(async (email: string, name: string) => {
    if (!isProd) {
      setApprovers((prev) =>
        prev.some((a) => a.email === email) ? prev : [...prev, { email, name }],
      );
      return;
    }
    const list = await serverFunctions.addApprover(email, name);
    setApprovers(list);
  }, []);

  const removeApprover = useCallback(async (email: string) => {
    if (!isProd) {
      setApprovers((prev) => prev.filter((a) => a.email !== email));
      return;
    }
    const list = await serverFunctions.removeApprover(email);
    setApprovers(list);
  }, []);

  /**
   * 楽観UI で失敗した仮データを一覧から削除
   */
  const discardOptimistic = useCallback((tempId: number) => {
    setApps((prev) => {
      const next = prev.filter((a) => a.rowIndex !== tempId);
      setStats(calculateStats(next));
      return next;
    });
  }, []);

  /**
   * 複数の申請を一括で承認/却下する。
   * 結果は { success, failed } で返す。
   */
  const processBulk = useCallback(
    async (
      rowIndices: number[],
      action: 'approve' | 'reject',
      approver: string,
      comment: string,
    ): Promise<{ success: number[]; failed: { rowIndex: number; error: string }[] }> => {
      if (!isProd) {
        // dev 環境ではすべて成功扱いで楽観反映
        const newStatus = action === 'approve' ? '承認' : '却下';
        setApps((prev) => {
          const next = prev.map((a) =>
            rowIndices.includes(a.rowIndex)
              ? {
                  ...a,
                  status: newStatus as Application['status'],
                  approver,
                  approvalDate: new Date().toISOString(),
                  comment,
                }
              : a,
          );
          setStats(calculateStats(next));
          return next;
        });
        return { success: rowIndices, failed: [] };
      }

      try {
        const result = await serverFunctions.processBulk(
          rowIndices,
          action,
          approver,
          comment,
        );
        // 成功した行だけ画面に反映
        const successSet = new Set(result.success);
        const newStatus = action === 'approve' ? '承認' : '却下';
        setApps((prev) => {
          const next = prev.map((a) =>
            successSet.has(a.rowIndex)
              ? {
                  ...a,
                  status: newStatus as Application['status'],
                  approver,
                  approvalDate: new Date().toISOString(),
                  comment,
                }
              : a,
          );
          setStats(calculateStats(next));
          return next;
        });
        return result;
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [refresh],
  );

  return {
    apps,
    stats,
    currentUser,
    approvers,
    loading,
    refresh,
    approve,
    reject,
    submitNew,
    discardOptimistic,
    processBulk,
    addApprover,
    removeApprover,
  };
}
