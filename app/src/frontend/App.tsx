import { useCallback, useEffect, useState } from 'react';
import { ApplicationDetail } from './components/ApplicationDetail';
import { ApplicationTable } from './components/ApplicationTable';
import { BulkActionBar } from './components/BulkActionBar';
import { Dashboard } from './components/Dashboard';
import { ExportModal } from './components/ExportModal';
import { FilterBar, type FilterKey } from './components/FilterBar';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { MyHistory } from './components/MyHistory';
import { NewApplicationForm } from './components/NewApplicationForm';
import { Settings } from './components/Settings';
import { Statistics } from './components/Statistics';
import { Toaster } from './components/Toaster';
import { Download } from './icons';
import type { ViewKey } from './components/ViewSwitcher';
import { useAnomalies } from './hooks/useAnomalies';
import { useApplications } from './hooks/useApplications';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useToasts } from './hooks/useToasts';
import { useVisibleTabs } from './hooks/useVisibleTabs';
import type { Application, SortConfig } from './types';

function App() {
  const { toasts, pushToast } = useToasts();
  const online = useOnlineStatus();

  const onError = useCallback(
    (msg: string) => pushToast('error', msg),
    [pushToast],
  );

  const {
    apps,
    stats,
    currentUser,
    approvers,
    confirmers,
    purchasers,
    accountCategories,
    chargingDepartments,
    systemSettings,
    loading,
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
    addAccountCategory,
    removeAccountCategory,
    addChargingDepartment,
    removeChargingDepartment,
    updateSystemSetting,
  } = useApplications(onError);

  const itemRequestThreshold = Number(
    systemSettings.REQUIRES_ITEM_REQUEST_THRESHOLD ?? '50000',
  );

  const handleUpdateThreshold = async (n: number) => {
    await updateSystemSetting('REQUIRES_ITEM_REQUEST_THRESHOLD', String(n));
  };

  // ロールが取れるまでは仮で list を入れておき、確定後に出し分け
  const [view, setView] = useState<ViewKey>('list');
  const [viewInitialized, setViewInitialized] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleTabs, setVisibleTabs] = useVisibleTabs();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'timestamp',
    direction: 'descending',
  });
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isNewAppFormOpen, setIsNewAppFormOpen] = useState(false);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);
  // 「自分宛の承認待ちだけ表示」フラグ（管理者用、ヘッダーバッジ経由で ON）
  const [myPendingOnly, setMyPendingOnly] = useState(false);
  // 一括操作で選択中の rowIndex（管理者用）
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [isExportOpen, setIsExportOpen] = useState(false);

  const pendingForMeCount = apps.filter(
    (a) => a.status === '承認待ち' && a.approver === currentUser.email,
  ).length;

  const anomalies = useAnomalies(apps);

  const handlePendingForMeClick = () => {
    setView('list');
    setFilter('承認待ち');
    setMyPendingOnly(true);
  };

  const handleBulk = async (action: 'approve' | 'reject', comment: string) => {
    const indices = Array.from(selectedRowIndices);
    if (indices.length === 0) return;
    try {
      const result = await processBulk(indices, action, currentUser.email, comment);
      const verb = action === 'approve' ? '承認' : '却下';
      if (result.failed.length === 0) {
        pushToast('success', `${result.success.length}件を一括${verb}しました`);
      } else {
        pushToast(
          'error',
          `${result.success.length}件成功 / ${result.failed.length}件失敗`,
        );
      }
      setSelectedRowIndices(new Set());
    } catch (e) {
      console.error('一括処理エラー:', e);
      pushToast('error', '一括処理に失敗しました');
    }
  };

  // 表示タブが OFF にされたら、その絞り込みは all に戻す
  useEffect(() => {
    if (filter !== 'all' && !visibleTabs[filter]) {
      setFilter('all');
    }
  }, [filter, visibleTabs]);

  // 初回ユーザー読み込み完了時に、ロールに応じてデフォルトビューを決める
  // 管理者(承認者/確認者/購入者) は「ホーム」、申請者は「マイページ」起点
  useEffect(() => {
    if (viewInitialized || !currentUser.email) return;
    setView(currentUser.role === 'admin' ? 'home' : 'mine');
    setViewInitialized(true);
  }, [currentUser, viewInitialized]);

  // 申請者が何らかの経路で 'home' / 'list' / 'settings' になったら mine に戻す（保険）
  useEffect(() => {
    if (
      currentUser.role === 'applicant' &&
      (view === 'home' || view === 'list' || view === 'settings')
    ) {
      setView('mine');
    }
  }, [currentUser.role, view]);

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === 'ascending'
          ? 'descending'
          : 'ascending',
    }));
  };

  const handleApprove = async (rowIndex: number, comment: string) => {
    try {
      await approve(rowIndex, currentUser.email, comment);
      setSelectedApp(null);
      pushToast('success', '承認しました（確認者に通知済）');
    } catch (e) {
      console.error('承認エラー:', e);
      pushToast('error', '承認に失敗しました');
    }
  };

  const handleReject = async (rowIndex: number, comment: string) => {
    try {
      await reject(rowIndex, currentUser.email, comment);
      setSelectedApp(null);
      pushToast('success', '却下しました');
    } catch (e) {
      console.error('却下エラー:', e);
      pushToast('error', '却下に失敗しました');
    }
  };

  const handleConfirm = async (rowIndex: number) => {
    try {
      await confirmApp(rowIndex, currentUser.email);
      setSelectedApp(null);
      pushToast('success', '確認しました（購入者に通知済）');
    } catch (e) {
      console.error('確認エラー:', e);
      pushToast('error', '確認処理に失敗しました');
    }
  };

  const handleMarkOrdered = async (rowIndex: number, actualAmount: number) => {
    try {
      await markOrdered(rowIndex, currentUser.email, actualAmount);
      setSelectedApp(null);
      pushToast('success', '注文済として登録しました（申請者に通知済）');
    } catch (e) {
      console.error('注文済登録エラー:', e);
      pushToast('error', '注文済の登録に失敗しました');
    }
  };

  const handleNewApplication = async (
    data: Parameters<typeof submitNew>[0],
  ) => {
    // 楽観UI: フォームは即閉じて一覧に仮データが先に出る
    setIsNewAppFormOpen(false);
    pushToast('info', '送信中...');
    try {
      await submitNew(data);
      pushToast('success', '新規申請が完了しました');
    } catch (e) {
      console.error('新規申請エラー:', e);
      pushToast('error', '新規申請に失敗しました（下書きは保持されています）');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100 flex items-center justify-center">
        <div className="text-2xl text-stone-600">読み込み中...</div>
      </div>
    );
  }

  const filteredApps = apps
    .filter((a) => filter === 'all' || a.status === filter)
    .filter((a) => !myPendingOnly || a.approver === currentUser.email);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-stone-100">
        <Toaster toasts={toasts} />
        <Header
          currentUser={currentUser}
          view={view}
          onViewChange={setView}
          online={online}
          onNewApplication={() => setIsNewAppFormOpen(true)}
          pendingForMeCount={pendingForMeCount}
          onPendingForMeClick={handlePendingForMeClick}
        />

        {view === 'home' && currentUser.role === 'admin' && (
          <div className="p-3 md:p-8">
            <HomeView
              applications={apps}
              currentUser={currentUser}
              onSelect={setSelectedApp}
              onJumpToList={() => setView('list')}
            />
          </div>
        )}

        {view === 'list' && (
          <>
            <div className="p-3 md:p-8">
              <Statistics
                stats={stats}
                collapsed={isStatsCollapsed}
                onToggle={() => setIsStatsCollapsed((v) => !v)}
              />

              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <FilterBar
                    filter={filter}
                    stats={stats}
                    visibleTabs={visibleTabs}
                    onFilterChange={setFilter}
                    onVisibleTabsChange={setVisibleTabs}
                  />
                </div>
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setIsExportOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-lg text-sm font-semibold shadow-sm transition-colors"
                    title="CSVエクスポート"
                  >
                    <Download size={16} />
                    <span>CSV</span>
                  </button>
                )}
              </div>

              {myPendingOnly && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setMyPendingOnly(false)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-xs font-semibold hover:bg-rose-200 transition-colors"
                  >
                    <span>自分宛のみ</span>
                    <span aria-hidden>✕</span>
                  </button>
                </div>
              )}
            </div>

            <div className="px-3 md:px-8 pb-8">
              {currentUser.isApprover && (
                <BulkActionBar
                  count={selectedRowIndices.size}
                  onApprove={(c) => handleBulk('approve', c)}
                  onReject={(c) => handleBulk('reject', c)}
                  onClear={() => setSelectedRowIndices(new Set())}
                />
              )}
              <ApplicationTable
                applications={filteredApps}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelect={setSelectedApp}
                selectedRowIndices={
                  currentUser.isApprover ? selectedRowIndices : undefined
                }
                onSelectionChange={
                  currentUser.isApprover ? setSelectedRowIndices : undefined
                }
                anomalies={anomalies}
              />
            </div>
          </>
        )}

        {view === 'mine' && (
          <div className="p-3 md:p-8">
            <MyHistory
              applications={apps}
              currentUser={currentUser}
              onSelect={setSelectedApp}
            />
          </div>
        )}

        {view === 'dashboard' && (
          <div className="p-3 md:p-8">
            <Dashboard
              applications={apps}
              scope={currentUser.role === 'admin' ? 'all' : 'self'}
              currentUser={currentUser}
            />
          </div>
        )}

        {view === 'settings' && currentUser.role === 'admin' && (
          <div className="p-3 md:p-8">
            <Settings
              currentUser={currentUser}
              approvers={approvers}
              confirmers={confirmers}
              purchasers={purchasers}
              accountCategories={accountCategories}
              chargingDepartments={chargingDepartments}
              itemRequestThreshold={itemRequestThreshold}
              onAddApprover={addApprover}
              onRemoveApprover={removeApprover}
              onAddConfirmer={addConfirmer}
              onRemoveConfirmer={removeConfirmer}
              onAddPurchaser={addPurchaser}
              onRemovePurchaser={removePurchaser}
              onAddAccountCategory={addAccountCategory}
              onRemoveAccountCategory={removeAccountCategory}
              onAddChargingDepartment={addChargingDepartment}
              onRemoveChargingDepartment={removeChargingDepartment}
              onUpdateThreshold={handleUpdateThreshold}
              onPushToast={pushToast}
            />
          </div>
        )}
      </div>

      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          currentUser={currentUser}
          anomalies={anomalies.get(selectedApp.rowIndex)}
          onClose={() => setSelectedApp(null)}
          onApprove={
            selectedApp.clientStatus
              ? async () => {
                  pushToast('info', '送信中の申請は承認できません');
                }
              : handleApprove
          }
          onReject={
            selectedApp.clientStatus
              ? async () => {
                  if (selectedApp.clientStatus === 'failed') {
                    discardOptimistic(selectedApp.rowIndex);
                    setSelectedApp(null);
                    pushToast('info', '失敗した送信を破棄しました');
                  } else {
                    pushToast('info', '送信中の申請は却下できません');
                  }
                }
              : handleReject
          }
          onConfirm={handleConfirm}
          onMarkOrdered={handleMarkOrdered}
        />
      )}

      {isNewAppFormOpen && (
        <NewApplicationForm
          currentUser={currentUser}
          approvers={approvers}
          accountCategories={accountCategories}
          chargingDepartments={chargingDepartments}
          itemRequestThreshold={itemRequestThreshold}
          onClose={() => setIsNewAppFormOpen(false)}
          onSubmit={handleNewApplication}
          onPushToast={pushToast}
        />
      )}

      {isExportOpen && (
        <ExportModal
          applications={apps}
          onClose={() => setIsExportOpen(false)}
          onDone={(count) => {
            setIsExportOpen(false);
            pushToast('success', `${count}件をCSV出力しました`);
          }}
        />
      )}
    </>
  );
}

export default App;
