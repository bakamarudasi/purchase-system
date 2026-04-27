import { useEffect, useState } from 'react';
import { GASClient } from 'gas-client';
import type { Application } from '../backend/models/Application';
import type * as serverFns from '../backend/serverFunctions';
import './App.css';

const { serverFunctions } = new GASClient<typeof serverFns>();

function App() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (import.meta.env.PROD) {
          const data = await serverFunctions.getAllApplications();
          setApps(data);
        } else {
          // 開発時のモックデータ
          setApps([]);
        }
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error}</div>;

  return (
    <div className="app">
      <h1>購入申請システム</h1>
      <p>申請件数: {apps.length}</p>
      {/* TODO: Phase C で旧 html/index.html のコンポーネントを移植 */}
    </div>
  );
}

export default App;
