# 購入申請システム完全ガイド

## 1. システム全体像
- **目的**: 社内の備品・ソフトウェア購入依頼をワークフロー化し、申請〜承認〜記録を一元管理する。Google Apps Script(GAS) をベースに、スプレッドシートと Drive をストレージとして利用する。
- **構成要素**:
  - **サーバー側 (GAS)**: `src/main.ts` で公開する Web API 群。スプレッドシート読み書きや承認処理は `ApplicationService` に集約される。【F:src/main.ts†L1-L170】【F:src/services/ApplicationService.ts†L1-L210】
  - **フロントエンド**: `html/index.html` に React + Tailwind CDN を読み込み、単一ページアプリケーションとして UI を構築。`google.script.run` 経由で GAS API を呼び出す（Babel によりブラウザ内で JSX をトランスパイル）。【F:html/index.html†L1-L120】
  - **ドキュメント**: `docs/ARCHITECTURE.md` はレイヤー概要、本ドキュメントは詳細仕様と運用ノウハウを集約する。

## 2. データストアとスキーマ
- **スプレッドシート**: `src/config.ts` の `SHEET_NAMES` で管理。主表「申請データ」が実体。【F:src/config.ts†L1-L69】
- **列マッピング** (`COLUMN_INDEX`): タイムスタンプ〜コメントまで 14 列を 0-based で定義。コード上の配列 index とシート列を同期するための唯一の参照元。【F:src/config.ts†L21-L45】
- **ステータス値**: `未対応` / `承認` / `却下` / `購入済` / `完了` をサポート。将来的な購入完了処理への拡張が容易。【F:src/config.ts†L47-L60】【F:src/models/Application.ts†L1-L34】
- **ファイル保管**: `DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID` で Drive フォルダを指定し、申請時の添付ファイルをアップロードする。【F:src/config.ts†L62-L92】【F:src/services/ApplicationService.ts†L74-L120】

### 2.1 モデル定義
- `Application` インターフェースは UI と GAS 双方で共通利用。行番号、申請者情報、金額、ファイル情報、承認履歴を包含。【F:src/models/Application.ts†L18-L48】
- `FileInfo` は Drive メタデータ（ID, MIME, サイズ, URL）とサムネイル URL の拡張余地を定義。【F:src/models/Application.ts†L9-L17】

## 3. GAS バックエンド
### 3.1 エントリーポイント (`main.ts`)
- GAS の公開関数を `global` に束ね、フロントエンドや他スクリプトから呼び出し可能にする。例: `global.getAllApplications` は `ApplicationService.getAllApplications()` を呼ぶ。【F:src/main.ts†L12-L164】
- 例外処理: 取得/更新系は `try-catch` で `Logger.log` に記録しつつ再送出。スタックトレースを Apps Script 実行ログに残す構造。【F:src/main.ts†L18-L104】
- `getCurrentUser`: `Session.getActiveUser()` からメールを取得し、社員名簿で氏名に解決。メール未登録時はローカル部を名称として返す。【F:src/main.ts†L118-L145】
- テスト用ユーティリティ関数 (`testGetAllApplications` など) を公開しており、デバッグ実行からの検証が容易。【F:src/main.ts†L147-L169】

### 3.2 `ApplicationService`
- **データ取得系**:
  - `getAllApplications`: ヘッダーを除いた全行を `parseRowToApplication` でモデル化。空行スキップや型変換を行う。【F:src/services/ApplicationService.ts†L12-L48】
  - `getApplicationByRowIndex`: 範囲指定で 1 行取得し、存在しない場合はエラーを投げる。【F:src/services/ApplicationService.ts†L50-L72】
  - `getApplicationsByStatus` / `getPendingApplications`: ステータスフィルタリングを提供。【F:src/services/ApplicationService.ts†L74-L92】
- **更新系**:
  - `approveApplication` / `rejectApplication`: 内部の `updateApplicationStatus` を通じてステータス・承認者・コメント・承認日時を更新。【F:src/services/ApplicationService.ts†L94-L156】【F:src/services/ApplicationService.ts†L210-L258】
  - `addApplication`: 入力検証後に Drive へファイルをアップロードし、スプレッドシートへ 1 行追加。返却値は即時に組み立てた `Application` オブジェクト。【F:src/services/ApplicationService.ts†L114-L189】
- **補助機能**:
  - `getApproverList`: 承認者リストシート (B 列) から非空セルのみ抽出。【F:src/services/ApplicationService.ts†L191-L210】
  - `getUserName`: 社員名簿シートでメールから氏名に変換。【F:src/services/ApplicationService.ts†L212-L235】
  - `getStatistics`: 件数と承認済み合計金額の集計を返す。【F:src/services/ApplicationService.ts†L237-L258】
- **内部ユーティリティ**:
  - `parseRowToApplication`: `safeParseInt/Float` を使った型変換、`parseFileInfo` による Drive メタデータ取得、日付型の正規化を実施。【F:src/services/ApplicationService.ts†L260-L330】
  - `parseFileInfo`: URL からファイル ID を抽出し Drive から情報を補完。権限不足時でもフォールバック情報を返し UI の崩壊を防ぐ。【F:src/services/ApplicationService.ts†L332-L374】
  - `formatBytes`: バイト数をヒューマンリーダブル化。【F:src/services/ApplicationService.ts†L376-L389】
  - `getSheet`: シート存在チェックを共通化。【F:src/services/ApplicationService.ts†L391-L403】

### 3.3 ユーティリティ層
- `formatDateTime` / `formatDate`: ISO 文字列や GAS の Date を `YYYY/MM/DD (HH:mm)` 形式で返す。UI 表示やログ整形で利用可能。【F:src/utils/date.ts†L1-L40】
- `formatCurrency` や `safeParseFloat` など、数値フォーマット・安全なパースを提供。【F:src/utils/format.ts†L1-L56】

## 4. フロントエンド (React SPA)
- **初期設定**: CDN で React 18 / ReactDOM / Tailwind を読み込み、`tailwind.config` で簡易アニメーションをカスタマイズ。【F:html/index.html†L1-L46】
- **状態管理**: `useState` と `useEffect` で申請一覧・統計・フィルタ・トースト通知など多数の状態を管理。コメント入力、承認処理のロード状態、フォーム表示フラグ等を細かく持つ。【F:html/index.html†L122-L178】
- **UI コンポーネント**: SVG ベースのアイコンを内製し、Tailwind のユーティリティクラスでスタイルを定義。トーストやモーダル表示にはアニメーションも適用。【F:html/index.html†L48-L120】
- **データ取得**: `useEffect` で `google.script.run.withSuccessHandler` を用い GAS から `getAllApplications` / `getStatistics` / `getCurrentUser` を並列取得。Promise ラッパを用意し、読み込み完了までローディング UI を表示（コード内 Promise 実装参照）。【F:html/index.html†L180-L260】
- **ソート・フィルタ**: ステータス別フィルタ、列ヘッダークリックによる昇順/降順切り替えなどを実装。JS 側で `sortConfig` を保持し、描画時に適用。【F:html/index.html†L262-L336】
- **申請詳細ビュー**: 行選択でサイドパネルを開き、申請者情報、添付ファイル、コメント入力、承認/却下ボタンを提供。`google.script.run` で `approveApplication` / `rejectApplication` を呼び出し、成功時にはトースト通知と一覧の再取得を実施。【F:html/index.html†L338-L520】
- **新規申請フォーム**: モーダルでフォームを表示し、`google.script.run.addApplication` に base64 変換したファイルとともに送信。フォームバリデーションや合計金額の自動計算を含む。【F:html/index.html†L522-L760】
- **統計ダッシュボード**: 合計件数・未対応件数・承認済み金額などをカード表示し、折りたたみ機構で表示切り替え。【F:html/index.html†L762-L890】
- **アクセシビリティ/UX**: キーボードフォーカス、モーダルクローズ、トーストなどのハンドリングを細かく定義し、Apps Script 環境でも快適に操作できるよう最適化。【F:html/index.html†L892-L1180】

## 5. 外部サービス・権限
- **SpreadsheetApp** / **DriveApp** / **Utilities** / **Session**: GAS ネイティブ API を利用。スクリプトに編集権限と Drive ファイルアクセスを付与する必要がある。【F:src/services/ApplicationService.ts†L74-L120】【F:src/main.ts†L118-L142】
- **Google Drive フォルダ設定**: `DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID` をデプロイ先の Drive に合わせて更新。権限を承認者全員に共有することで `parseFileInfo` 例外を減らせる。【F:src/config.ts†L62-L92】【F:src/services/ApplicationService.ts†L332-L374】

## 6. デプロイ & 開発フロー
1. **Apps Script プロジェクトにデプロイ**:
   - `clasp` などで `src` 内の TypeScript をビルド/プッシュし、GAS プロジェクトとして公開。
   - `main.ts` に定義した関数を Web アプリとしてデプロイし、実行権限を「自分」もしくは「ドメイン内の全員」に設定。
2. **スプレッドシート準備**:
   - 「申請データ」シートにヘッダー行を設置し、`COLUMN_INDEX` と一致する列順で作成。
   - 「社員名簿」「承認者リスト」の2シートを用意し、メールアドレス→氏名のマッピング、承認者名簿を登録。
3. **Drive フォルダ**:
   - 添付ファイル保存用フォルダを作成し、ID を `DEFAULT_CONFIG.ATTACHMENT_FOLDER_ID` に設定。
4. **フロントエンドホスティング**:
   - `html/index.html` をスプレッドシート側の HTML サービスにアップロード。`doGet` に紐付けるか、`HtmlService.createHtmlOutputFromFile` で返却する。
5. **認可確認**:
   - 初回実行時に Drive/Spreadsheet アクセス権限の承認が求められるため、システム管理者が承認し、利用者にも手順を周知する。

## 7. 拡張ポイント
- **ステータス遷移追加**: `STATUS.PURCHASED` / `STATUS.CLEAR` を用いて購入完了処理を実装する場合、`updateApplicationStatus` にラッパー関数を追加し、UI 側のボタンと整合を取る。
- **ファイルバリデーション**: `addApplication` 直前で `DEFAULT_CONFIG.ALLOWED_MIME_TYPES` と `MAX_FILE_SIZE` を参照する処理を組み込む。フロント側でも同様の制約を mirror するとユーザー体験が向上する。
- **ユーザー認証強化**: `getCurrentUser` のフォールバックロジックを拡張し、社内ディレクトリ API や Google Workspace Admin SDK との連携を検討。
- **テスト整備**: `src/test.ts` にユニットテストを追加し、`safeParseInt` などのユーティリティや承認フローのモックテストを整備。

## 8. 運用ベストプラクティス
- **ログ監視**: `Logger.log` の出力を Apps Script 実行ログまたは Stackdriver Logging で定期確認し、エラー時にはスプレッドシートの該当行を特定する。
- **データアーカイブ**: 古い申請は `SHEET_NAMES.PAST_APPLICATIONS` へ移すことでメインシートのサイズを抑制し、パフォーマンス低下を防ぐ。
- **権限設計**: 承認者には Drive フォルダへの閲覧権限を付与し、添付ファイルのプレビュー権限問題を解消。編集権限は最小限に。
- **バックアップ**: スプレッドシートのバージョン履歴に加え、定期的なエクスポート/Apps Script のバージョン管理 (git) を推奨。

## 9. 参考リンク
- [Google Apps Script ドキュメント](https://developers.google.com/apps-script)
- [React 公式ドキュメント](https://react.dev)
- [Tailwind CSS ドキュメント](https://tailwindcss.com/docs)

