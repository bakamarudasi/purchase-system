import { useCallback, useEffect, useState } from 'react';
import { ApplicationDetail } from './components/ApplicationDetail';
import { ApplicationTable } from './components/ApplicationTable';
import { Dashboard } from './components/Dashboard';
import { FilterBar, type FilterKey } from './components/FilterBar';
import { Header } from './components/Header';
import { MyHistory } from './components/MyHistory';
import { NewApplicationForm } from './components/NewApplicationForm';
import { Statistics } from './components/Statistics';
import { Toaster } from './components/Toaster';
import type { ViewKey } from './components/ViewSwitcher';
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
    loading,
    approve,
    reject,
    submitNew,
    discardOptimistic,
  } = useApplications(onError);

  const [view, setView] = useState<ViewKey>('list');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [visibleTabs, setVisibleTabs] = useVisibleTabs();
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'timestamp',
    direction: 'descending',
  });
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isNewAppFormOpen, setIsNewAppFormOpen] = useState(false);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  // 表示タブが OFF にされたら、その絞り込みは all に戻す
  useEffect(() => {
    if (filter !== 'all' && !visibleTabs[filter]) {
      setFilter('all');
    }
  }, [filter, visibleTabs]);

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
      pushToast('success', '承認しました');
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

  const filteredApps =
    filter === 'all' ? apps : apps.filter((a) => a.status === filter);

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
        />

        {view === 'list' && (
          <>
            <div className="p-8">
              <Statistics
                stats={stats}
                collapsed={isStatsCollapsed}
                onToggle={() => setIsStatsCollapsed((v) => !v)}
              />

              <FilterBar
                filter={filter}
                stats={stats}
                visibleTabs={visibleTabs}
                onFilterChange={setFilter}
                onVisibleTabsChange={setVisibleTabs}
              />
            </div>

            <div className="px-8 pb-8">
              <ApplicationTable
                applications={filteredApps}
                sortConfig={sortConfig}
                onSort={handleSort}
                onSelect={setSelectedApp}
              />
            </div>
          </>
        )}

        {view === 'mine' && (
          <div className="p-8">
            <MyHistory
              applications={apps}
              currentUser={currentUser}
              onSelect={setSelectedApp}
            />
          </div>
        )}

        {view === 'dashboard' && (
          <div className="p-8">
            <Dashboard applications={apps} />
          </div>
        )}
      </div>

      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          currentUser={currentUser}
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
        />
      )}

      {isNewAppFormOpen && (
        <NewApplicationForm
          currentUser={currentUser}
          approvers={approvers}
          onClose={() => setIsNewAppFormOpen(false)}
          onSubmit={handleNewApplication}
          onPushToast={pushToast}
        />
      )}
    </>
  );
}

export default App;
