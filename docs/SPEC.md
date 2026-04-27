# 購入申請システム 仕様書

> このドキュメントは「迷子にならないための地図」です。
> 環境のセットアップ、ディレクトリ構成、API、スプレッドシート構造、
> デプロイ手順までこの 1 ファイルで完結することを目指しています。

最終更新: 2026-04 / Phase B 完了時点

---

## 1. システム概要

社内の備品・ソフトウェア購入依頼をワークフロー化するための Web アプリ。
Google Apps Script (GAS) をサーバー、スプレッドシートをデータベース、
Google Drive を添付ファイルストレージとして利用する。

| レイヤー | 採用技術 | 役割 |
| --- | --- | --- |
| フロントエンド | React 18 + TypeScript + Vite | 申請フォーム / 一覧 / 承認 UI |
| サーバー | Google Apps Script (V8) + TypeScript | スプレッドシート/Drive 操作 |
| データストア | Google Spreadsheet | 申請データ・社員名簿・承認者リスト |
| ファイル | Google Drive | 添付ファイル保存 |
| ビルド | Vite + rollup-plugin-google-apps-script | フロント/サーバー別ビルド |
| デプロイ | clasp v3 | GAS プロジェクトへの push |
| 開発支援 | ESLint + Prettier + Vitest | 静的解析・テスト |

### 1.1 通信モデル

```
[ React (gas/dist/index.html) ]
        │  google.script.run / gas-client
        ▼
[ GAS main.js (gas/dist/main.js) ]
        │
        ├── Spreadsheet (申請データ / 社員名簿 / 承認者リスト)
        └── Drive (添付ファイル)
```

GAS の制約上、Web App は単一エンドポイント (`doGet`) で 1 つの HTML を返す。
ページ遷移はクライアント側 (React) のみで完結させる SPA 構成。

---

## 2. ディレクトリ構成

```
purchase-system/
├── src/
│   ├── backend/                    # GAS サーバー側 (TypeScript)
│   │   ├── main.ts                 # エントリ。global へ関数を公開
│   │   ├── config.ts               # シート名・列番号・定数・エラーメッセージ
│   │   ├── models/
│   │   │   └── Application.ts      # ドメイン型 (Application, Approver, ApplicationStatus)
│   │   ├── services/
│   │   │   ├── ApplicationService.ts  # スプレッドシート操作の中核
│   │   │   └── index.ts
│   │   ├── utils/
│   │   │   ├── date.ts             # 日付整形
│   │   │   ├── format.ts           # 数値整形 / safeParse / formatError
│   │   │   └── index.ts
│   │   └── serverFunctions/
│   │       └── index.ts            # クライアントから呼べる API の窓口
│   └── frontend/                   # React クライアント側
│       ├── main.tsx                # エントリ
│       ├── App.tsx                 # ルートコンポーネント
│       ├── App.css / index.css
│       └── vite-env.d.ts
├── gas/
│   ├── appsscript.json             # GAS プロジェクトマニフェスト
│   └── dist/                       # ビルド成果物 (.gitignore 済)
│       ├── index.html              # Vite が単一 HTML にバンドルした React アプリ
│       └── main.js                 # rollup が GAS 用に整形したサーバーコード
├── html/
│   └── index.html                  # 旧フロント (Phase C で React 化予定の参考資料)
├── docs/
│   ├── SPEC.md                     # 本ドキュメント
│   ├── ARCHITECTURE.md             # 旧アーキテクチャ (参考)
│   └── SYSTEM_OVERVIEW.md          # 旧システムガイド (参考)
├── index.html                      # Vite 開発時のエントリ
├── package.json
├── package-lock.json               # 追跡対象 (再現性のため)
├── tsconfig.json                   # ルート (app + node を参照するだけ)
├── tsconfig.app.json               # フロント/バックエンド共通の TS 設定
├── tsconfig.node.json              # vite.config 系の TS 設定
├── vite.config.ts                  # 開発サーバー / Vitest 用
├── vite.config.frontend.ts         # フロント用ビルド (gas/dist/index.html)
├── vite.config.backend.ts          # サーバー用ビルド (gas/dist/main.js)
├── .clasp.json.example             # clasp 設定のテンプレ (.clasp.json は git 管理外)
├── .claspignore
├── .eslintrc.cjs / .prettierrc / .prettierignore
└── .npmrc                          # legacy-peer-deps=true
```

### ファイル配置の原則

- **`src/backend/` と `src/frontend/` は型を共有してよい**。`Application` のような
  ドメイン型はバックエンド側で定義し、フロントは型インポートのみ。
- **`serverFunctions/` のエクスポートが API 契約**。新しいフロント呼び出しを増やす
  ときはここに関数を追加し、`backend/main.ts` でも `global.xxx = xxx` を追記する。
- **`gas/dist/` はビルド成果物**。手書き禁止。`clasp push` はここだけを送信する。

---

## 3. データモデル

### 3.1 スプレッドシート

| シート名 | 役割 | 列構成 (A→) |
| --- | --- | --- |
| 申請データ | 申請の保存先 | タイムスタンプ / 名前 / 部署 / 商品名 / 数量 / 単価 / 合計 / 理由 / 添付URL / 商品URL / ステータス / 承認者 / 承認日 / コメント |
| 社員名簿 | email → 名前 / 部署 のマスタ | A=email, B=名前, C=部署 |
| 承認者リスト | 承認権限を持つユーザ | A=email, B=名前 |
| 過去の申請 | アーカイブ用 (任意) | 申請データと同じスキーマ想定 |

列番号は `src/backend/config.ts` の `COLUMN_INDEX`（0-based）が単一の真実。
シートのレイアウトを変えるときは必ずここから直す。

### 3.2 ステータス

| 値 | 用途 | 状態 |
| --- | --- | --- |
| `未対応` | 申請直後 | 既存フローで使用 |
| `承認` | 承認済 | 既存フローで使用 |
| `却下` | 却下 | 既存フローで使用 |
| `購入済` | 発注完了 | 予約 (ボタン未実装) |
| `完了` | 申請クローズ | 予約 (ボタン未実装) |

`購入済` / `完了` は `STATUS` 定数だけ存在し、UI/サービス層の遷移はまだ無い。
追加するときは `ApplicationService.updateApplicationStatus` を呼ぶ専用メソッド
（例 `markPurchased`）を生やしてから UI を結線する。

### 3.3 ドメイン型

```ts
// src/backend/models/Application.ts
export type ApplicationStatus = '未対応' | '承認' | '却下' | '購入済' | '完了';

export interface Approver {
  email: string;
  name: string;
}

export interface FileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  url: string;
  thumbnailUrl?: string;
}

export interface Application {
  rowIndex: number;          // 2 以上 (ヘッダ行を 1 とする)
  timestamp: string | null;  // ISO 文字列
  name: string;
  department: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  reason: string;
  productUrl: string | null;
  fileInfo: FileInfo | null;
  status: ApplicationStatus;
  approver: string;          // email
  approvalDate: string | null; // ISO 文字列
  comment: string;
}
```

### 3.4 承認者の同一性キー

承認者は **必ず email** で識別する。社員名簿の表示名は変わりうるため、
`Application.approver` には email を保存する。フロントエンドが画面に
表示するときは `Approver.email → Approver.name` で解決して表示する。

旧コード (`html/index.html`) は名前で比較していたが、Phase C で React に
書き直す際に email ベースに統一する。

---

## 4. サーバー API (serverFunctions)

`src/backend/serverFunctions/index.ts` で定義された関数が、`gas-client`
経由でフロントから呼べる。

| 関数 | 引数 | 戻り値 | 備考 |
| --- | --- | --- | --- |
| `getAllApplications` | なし | `Application[]` | 「申請データ」全行 |
| `getApplicationByRowIndex` | `rowIndex: number` | `Application \| null` | rowIndex < 2 はエラー |
| `getApplicationsByStatus` | `status: ApplicationStatus` | `Application[]` | クライアント側でも絞れるが大量データなら有効 |
| `getPendingApplications` | なし | `Application[]` | `getApplicationsByStatus('未対応')` のショートカット |
| `approveApplication` | `rowIndex, approver, comment` | `void` | `approver` は email |
| `rejectApplication` | `rowIndex, approver, comment` | `void` | 同上 |
| `addApplication` | `data` | `Application` | バリデーション失敗時は throw |
| `getStatistics` | なし | `{total,pending,approved,rejected,totalApprovedAmount}` | ダッシュボード用 |
| `getApproverList` | なし | `Approver[]` | `{email, name}[]` |
| `getCurrentUser` | なし | `{email, name, department}` | 社員名簿を引いて補完 |

### 4.1 `addApplication` の入力スキーマ

```ts
{
  name: string;
  department: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  reason: string;
  productUrl?: string;
  selectedApprover?: string;   // email
  file?: { name: string; mimeType: string; data: string }; // data は base64
}
```

### 4.2 共通の前提

- すべての関数は GAS の `LockService` で必要に応じて排他制御する。
- 例外は基本的に上に投げる。`Logger.log` で `formatError(error)` を出してから
  rethrow する設計。フロント側は `gas-client` の Promise リジェクトとして受け取る。

---

## 5. バリデーション / セキュリティ

### 5.1 添付ファイル

- 受理する MIME: `DEFAULT_CONFIG.ALLOWED_MIME_TYPES`
  (PDF / JPEG / PNG / xlsx / xls)
- サイズ上限: `DEFAULT_CONFIG.MAX_FILE_SIZE` = 10 MB
  - base64 文字列の長さから元バイト数を概算してチェック
- フォルダ: `DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID`
  - 承認者全員に閲覧権限を付与すること（さもないと `parseFileInfo` が
    フォールバック情報を返し、UI 上「ファイル情報の取得に失敗」と表示される）
  - **本番運用時は PropertiesService にスクリプトプロパティで持たせる方が安全**
    (現状はソース埋め込み、変更余地あり)

### 5.2 排他制御

- `addApplication` / `updateApplicationStatus` は `LockService.getScriptLock()`
  で 10 秒待ってから処理を実行
- 取得できなければ「他の処理が進行中です」例外を投げる
- 連打や同時申請による行番号競合を防ぐ目的

### 5.3 認証

- GAS の Web App として「自分」または「ドメイン内」で公開
- `Session.getActiveUser().getEmail()` の取得可否はドメイン設定に依存
- 取得できない場合は `getCurrentUser` が `name: 'ゲスト'` を返す
  （UI で読み取り専用モードに落とすなどの判断はフロントで）

---

## 6. 環境セットアップ

### 6.1 要件

- Node.js 20 以上 (推奨 22.x)
- npm 10 以上
- `clasp` v3 (`npm i -g @google/clasp` または `npx`)
- Google アカウントと、対象スプレッドシート / Drive フォルダの権限

### 6.2 初回セットアップ

```bash
# 1. 依存インストール (.npmrc により legacy-peer-deps が自動付与される)
npm install

# 2. clasp ログイン
npx clasp login

# 3. .clasp.json の作成 (テンプレからコピー)
cp .clasp.json.example .clasp.json
# scriptId を実際の GAS プロジェクト ID に書き換える

# 4. ビルド
npm run build

# 5. GAS へ push
npx clasp push
```

### 6.3 スプレッドシートの初期設定

1. 新規スプレッドシートを作成
2. 上記「3.1 スプレッドシート」の表に従って **シート名** と **A 列ヘッダ** を作る
3. GAS プロジェクトをこのスプレッドシートに紐付ける
   (Apps Script から「コンテナとしてのスプレッドシートを開く」で確認)
4. `DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID` を Drive のフォルダ ID に変更

---

## 7. 開発フロー

### 7.1 npm スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | Vite 開発サーバー (フロントのみ。GAS API はモックに分岐) |
| `npm run build` | フロント+バックを `gas/dist/` にビルド |
| `npm run build:frontend` | フロントだけビルド |
| `npm run build:backend` | バックだけビルド |
| `npm run clean` | `gas/dist/` を削除 |
| `npm run test` | Vitest |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run push` | build → `clasp push` |
| `npm run deploy` | build → `clasp deploy` |

### 7.2 開発時の挙動

- `import.meta.env.PROD === false` のときフロントは `gas-client` を呼ばずに
  ローカルモックで動かす (現在の `App.tsx` で実装済)
- 本番ビルド (`npm run build`) では `gas-client` 経由で `google.script.run` を呼ぶ

### 7.3 新しい API を増やすとき

1. `src/backend/services/ApplicationService.ts` にロジックを実装
2. `src/backend/serverFunctions/index.ts` に export 関数を追加
3. `src/backend/main.ts` の `global.xxx = xxx` リストに追加
   (rollup-plugin-google-apps-script が GAS 認識用のスタブを生成するため)
4. フロントから `serverFunctions.xxx()` で呼ぶ
5. ビルド → push

### 7.4 列を増やすとき

1. `src/backend/config.ts` の `COLUMN_INDEX` に末尾追加
2. `src/backend/models/Application.ts` の `Application` に項目追加
3. `parseRowToApplication` / `addApplication` の row 配列を更新
4. スプレッドシート側のヘッダ行も更新
5. UI 側で必要なら表示項目を追加

`COLUMN_COUNT` は `Object.keys(COLUMN_INDEX).length` から自動算出されるので
ハードコードを直す必要はない。

---

## 8. 既知の制約 / TODO

| 項目 | 内容 | 優先度 |
| --- | --- | --- |
| 旧 `html/index.html` のリプレース | Phase C で React コンポーネント化 | 高 |
| `ATTACHMENT_FOLDER_ID` のハードコード | PropertiesService に逃がす | 中 |
| Vitest のユニットテスト | `safeParseInt` / `parseRowToApplication` の検証 | 中 |
| 申請のページング | 件数増で Spreadsheet `getDataRange` が遅くなる | 中 |
| 過去申請のアーカイブ自動化 | `PAST_APPLICATIONS` シート移送ジョブ | 低 |
| 多言語化 | 文言が日本語ハードコード | 低 |

---

## 9. トラブルシューティング

| 症状 | 原因の候補 | 対処 |
| --- | --- | --- |
| `clasp push` で「No script found」 | `.clasp.json` の `scriptId` 不一致 | GAS プロジェクト URL から ID を取り直す |
| ビルド時 peer dep 警告 | `rollup-plugin-google-apps-script` が vite4 を要求 | `.npmrc` の `legacy-peer-deps=true` で解決済 |
| `parseFileInfo` が "ファイル情報の取得に失敗" を返す | 承認者に Drive 閲覧権限が無い | フォルダを承認者全員に共有 |
| 承認ボタンが表示されない | フロントが旧版 (名前比較) の可能性 | Phase C 移行後に email 比較で解消予定 |
| `addApplication` が「他の処理が進行中」エラー | 別ユーザーが同時に申請中 | 数秒待って再送 |

---

## 10. 参考リンク

- [Google Apps Script](https://developers.google.com/apps-script)
- [clasp v3 README](https://github.com/google/clasp)
- [gas-client](https://github.com/enuchi/gas-client)
- [rollup-plugin-google-apps-script](https://www.npmjs.com/package/rollup-plugin-google-apps-script)
- [Vite](https://vitejs.dev/)
- [React](https://react.dev/)
