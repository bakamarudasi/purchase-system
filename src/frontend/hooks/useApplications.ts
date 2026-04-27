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
  const total = apps.length;
  const pending = apps.filter((a) => a.status === '未対応').length;
  const approved = apps.filter((a) => a.status === '承認').length;
  const rejected = apps.filter((a) => a.status === '却下').length;
  const totalApprovedAmount = apps
    .filter((a) => a.status === '承認')
    .reduce((sum, a) => sum + a.totalPrice, 0);
  return { total, pending, approved, rejected, totalApprovedAmount };
}

const isProd = import.meta.env.PROD;

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
      await serverFunctions.approveApplication(rowIndex, approver, comment);
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
    },
    [],
  );

  const reject = useCallback(
    async (rowIndex: number, approver: string, comment: string) => {
      if (!isProd) return;
      await serverFunctions.rejectApplication(rowIndex, approver, comment);
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
    },
    [],
  );

  const submitNew = useCallback(
    async (data: Parameters<typeof serverFunctions.addApplication>[0]) => {
      if (!isProd) {
        // 開発時はローカルでスタブ Application を作って画面を確認できるようにする
        const stub: Application = {
          rowIndex: Date.now(),
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
        };
        setApps((prev) => {
          const next = [stub, ...prev];
          setStats(calculateStats(next));
          return next;
        });
        return stub;
      }
      const created = await serverFunctions.addApplication(data);
      setApps((prev) => {
        const next = [created, ...prev];
        setStats(calculateStats(next));
        return next;
      });
      return created;
    },
    [],
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
  };
}
