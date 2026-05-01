import { useCallback, useEffect, useState } from 'react';
import { GASClient } from 'gas-client';
import type * as serverFns from '../../backend/serverFunctions';
import type {
  Application,
  Approver,
  Confirmer,
  CurrentUser,
  Purchaser,
  Statistics,
} from '../types';

const { serverFunctions } = new GASClient<typeof serverFns>();

const EMPTY_STATS: Statistics = {
  total: 0,
  pendingApproval: 0,
  pendingConfirmation: 0,
  pendingPurchase: 0,
  ordered: 0,
  rejected: 0,
  totalOrderedAmount: 0,
};

const EMPTY_USER: CurrentUser = {
  email: '',
  name: '',
  department: '',
  role: 'applicant',
  isApprover: false,
  isConfirmer: false,
  isPurchaser: false,
};

function calculateStats(apps: Application[]): Statistics {
  // 楽観UIの仮データ（rowIndex < 0）は集計から除外する
  const real = apps.filter((a) => a.rowIndex >= 0 && !a.clientStatus);
  const total = real.length;
  const pendingApproval = real.filter((a) => a.status === '承認待ち').length;
  const pendingConfirmation = real.filter((a) => a.status === '確認待ち').length;
  const pendingPurchase = real.filter((a) => a.status === '購入待ち').length;
  const ordered = real.filter((a) => a.status === '注文済').length;
  const rejected = real.filter((a) => a.status === '却下').length;
  const totalOrderedAmount = real
    .filter((a) => a.status === '注文済')
    .reduce((sum, a) => sum + (a.actualAmount ?? a.totalPrice), 0);
  return {
    total,
    pendingApproval,
    pendingConfirmation,
    pendingPurchase,
    ordered,
    rejected,
    totalOrderedAmount,
  };
}

const isProd = import.meta.env.PROD;

type SubmitPayload = Parameters<typeof serverFunctions.addApplication>[0];

export function useApplications(onError: (msg: string) => void) {
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<Statistics>(EMPTY_STATS);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(EMPTY_USER);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [confirmers, setConfirmers] = useState<Confirmer[]>([]);
  const [purchasers, setPurchasers] = useState<Purchaser[]>([]);
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
        const isAdmin = devRole === 'admin';
        setCurrentUser({
          email: isAdmin ? 'admin@example.com' : 'dev@example.com',
          name: isAdmin ? '管理者 ユーザー' : '開発ユーザー',
          department: '開発部',
          role: devRole,
          isApprover: isAdmin,
          isConfirmer: isAdmin,
          isPurchaser: isAdmin,
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

    const loadMembers = async () => {
      if (!isProd) {
        setApprovers([
          { email: 'boss@example.com', name: '部長 太郎' },
          { email: 'lead@example.com', name: 'リーダー 花子' },
        ]);
        setConfirmers([{ email: 'mutoh@example.com', name: '武藤 確認子' }]);
        setPurchasers([
          { email: 'takahashi@example.com', name: '高橋 購入太郎' },
          { email: 'takamatsu@example.com', name: '高松 購入次郎' },
        ]);
        return;
      }
      try {
        const [appr, conf, purch] = await Promise.all([
          serverFunctions.getApproverList(),
          serverFunctions.getConfirmerList(),
          serverFunctions.getPurchaserList(),
        ]);
        setApprovers(appr);
        setConfirmers(conf);
        setPurchasers(purch);
      } catch (e) {
        console.error('メンバーリスト取得エラー:', e);
      }
    };

    void loadUser();
    void loadMembers();
  }, [refresh]);

  const approve = useCallback(
    async (rowIndex: number, approver: string, comment: string) => {
      if (!isProd) return;
      // 承認すると次のステップ「確認待ち」に進む
      setApps((prev) => {
        const next = prev.map((app) =>
          app.rowIndex === rowIndex
            ? {
                ...app,
                status: '確認待ち' as const,
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

  const confirmApp = useCallback(
    async (rowIndex: number, confirmerEmail: string) => {
      if (!isProd) return;
      setApps((prev) => {
        const next = prev.map((app) =>
          app.rowIndex === rowIndex
            ? {
                ...app,
                status: '購入待ち' as const,
                confirmer: confirmerEmail,
                confirmedDate: new Date().toISOString(),
              }
            : app,
        );
        setStats(calculateStats(next));
        return next;
      });
      try {
        await serverFunctions.confirmApplication(rowIndex);
      } catch (e) {
        await refresh();
        throw e;
      }
    },
    [refresh],
  );

  const markOrdered = useCallback(
    async (rowIndex: number, purchaserEmail: string, actualAmount: number) => {
      if (!isProd) return;
      setApps((prev) => {
        const next = prev.map((app) =>
          app.rowIndex === rowIndex
            ? {
                ...app,
                status: '注文済' as const,
                purchaser: purchaserEmail,
                orderedDate: new Date().toISOString(),
                actualAmount,
                amountDiff: actualAmount - app.totalPrice,
              }
            : app,
        );
        setStats(calculateStats(next));
        return next;
      });
      try {
        await serverFunctions.markAsOrdered(rowIndex, actualAmount);
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
        status: '承認待ち',
        approver: data.selectedApprover ?? '',
        approvalDate: null,
        comment: '',
        confirmer: '',
        confirmedDate: null,
        purchaser: '',
        orderedDate: null,
        actualAmount: null,
        amountDiff: null,
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

  const addConfirmer = useCallback(async (email: string, name: string) => {
    if (!isProd) {
      setConfirmers((prev) =>
        prev.some((a) => a.email === email) ? prev : [...prev, { email, name }],
      );
      return;
    }
    const list = await serverFunctions.addConfirmer(email, name);
    setConfirmers(list);
  }, []);

  const removeConfirmer = useCallback(async (email: string) => {
    if (!isProd) {
      setConfirmers((prev) => prev.filter((a) => a.email !== email));
      return;
    }
    const list = await serverFunctions.removeConfirmer(email);
    setConfirmers(list);
  }, []);

  const addPurchaser = useCallback(async (email: string, name: string) => {
    if (!isProd) {
      setPurchasers((prev) =>
        prev.some((a) => a.email === email) ? prev : [...prev, { email, name }],
      );
      return;
    }
    const list = await serverFunctions.addPurchaser(email, name);
    setPurchasers(list);
  }, []);

  const removePurchaser = useCallback(async (email: string) => {
    if (!isProd) {
      setPurchasers((prev) => prev.filter((a) => a.email !== email));
      return;
    }
    const list = await serverFunctions.removePurchaser(email);
    setPurchasers(list);
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
      const newStatus = action === 'approve' ? '確認待ち' : '却下';
      if (!isProd) {
        // dev 環境ではすべて成功扱いで楽観反映
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
    confirmers,
    purchasers,
    loading,
    refresh,
    approve,
    reject,
    confirmApp,
    markOrdered,
    submitNew,
    discardOptimistic,
    processBulk,
    addApprover,
    removeApprover,
    addConfirmer,
    removeConfirmer,
    addPurchaser,
    removePurchaser,
  };
}
