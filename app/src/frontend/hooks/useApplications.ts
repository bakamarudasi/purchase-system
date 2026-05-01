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

const EMPTY_USER: CurrentUser = { email: '', name: '', department: '' };

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
        setCurrentUser({
          email: 'dev@example.com',
          name: '開発ユーザー',
          department: '開発部',
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
  };
}
