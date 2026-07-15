# エネルギー管理ダッシュボード — 引継ぎドキュメント

工場設備（吸収式冷凍機・ボイラー等）の日次データ（外気温湿度、冷水/温水熱負荷、購入電力量、
重油使用量）をもとにした、単一ページのエネルギー管理Webアプリです。

## まずこれだけ読めばOK
1. このREADME.md（プロジェクト構成・ビルド方法・技術的な前提）
2. `docs/引継ぎ.md`（これまで実装した機能の詳細な履歴・データ品質問題の調査経緯・
   Service Workerキャッシュ不具合の顛末など、「なぜこうなっているか」の理由。
   仕様変更や不具合調査の際は必ず目を通してください）

---

## プロジェクト構成

```
energy-dashboard-app/
├── app.jsx                 ← アプリ本体（React。ここを編集する）
├── app.compiled.js         ← app.jsxのビルド出力（index.htmlが直接読み込む）
├── build.js                ← app.jsx → app.compiled.js のビルドスクリプト
├── index.html              ← エントリーポイント（CDNからReact/Chart.js/xlsxを読み込む）
├── manifest.json           ← PWAマニフェスト
├── sw.js                   ← Service Worker（オフライン対応・キャッシュ戦略）
├── package.json
├── data/
│   ├── energy-data.json    ← 正データ（721件, 2024-04-01〜2026-03-31）
│   ├── energy-data.js      ← ↑をwindow.ENERGY_DATAとして公開するラッパー
│   ├── holidays.js         ← window.HOLIDAY_MAP（祝日judgment用）
│   └── excluded-rows.json  ← 元データで破損が確定し恒久除外した151件（参考用、アプリは未読込）
├── scripts/
│   ├── dev-static-server.js ← ローカルプレビュー用の素朴な静的サーバ（ポート5183）
│   ├── gen-icons.js         ← PWAアイコン（icons/*.png）を生成するスクリプト
│   └── extract-data.ps1     ← 元のエネルギー.xlsxからデータを抽出した際の一回限りのスクリプト
├── icons/                   ← PWA用アイコン(192/512)
└── docs/
    └── 引継ぎ.md            ← 機能実装の詳細な履歴・仕様メモ
```

## これは何でできているか（重要な前提）
- **ビルドツール（Vite/webpack等）は使っていません。** `app.jsx`は素のReact（`const { useState, ... } = React;`）
  で書かれており、ES importやexportは一切使っていません。
- React / ReactDOM / Chart.js / SheetJS(xlsx) はすべて`index.html`内でバージョン固定のCDN URLから読み込みます。
- `build.js`は`app.jsx`をBabel（`@babel/preset-react`, classic runtime）でJSX→プレーンJSに変換して
  `app.compiled.js`に書き出すだけです（import/exportの書き換えは不要）。
- データは初期状態では`data/energy-data.js`（ビルド済み定数）から読み込まれ、以後はブラウザの
  `localStorage`に保存されます。バックエンド/サーバーは必須ではありません。
- PWA対応（`manifest.json` + `sw.js`）でオフライン起動・ホーム画面インストールが可能です。
- **Firebase Realtime Databaseによる複数端末リアルタイム同期に対応**（iPad・PCなどで入力内容を
  即座に共有したい場合、任意）。未設定でもアプリは通常通りローカルのみで動作します。
  設定方法は下記「Firebaseの初回セットアップ」を参照してください。

## 開発の進め方

```bash
npm install       # 初回のみ（@babel/core, @babel/preset-reactを取得）
npm run build     # app.jsx → app.compiled.js を生成
```

1. `app.jsx` を編集する
2. `npm run build` を実行する
3. ブラウザで確認（Claude Codeの場合はPreviewツールで `energy-dashboard-app` という名前の
   設定を使う。実体は`scripts/dev-static-server.js`をポート5183で起動するもの）

### JSXの構文チェック（編集後の安全確認）
```bash
node -e "require('@babel/core').transformSync(require('fs').readFileSync('app.jsx','utf8'), {presets:[['@babel/preset-react',{runtime:'classic'}]], filename:'app.jsx'}); console.log('parse OK')"
```

## デプロイ・動作環境についての注意
- GitHub Pagesでの公開を想定しています。デプロイ手順は以下の通り：
  1. GitHubで**公開**リポジトリを作成する（無料プランでPagesを使うには公開リポジトリが必須。
     非公開でPagesを使うにはGitHub Pro等の有料プランが必要）。
  2. このフォルダを`git init`してリモートに追加し、`git push`する
     （`node_modules`・`docs/`・`app.jsx`等の開発用ファイルも一緒にコミットして問題ない
     　― `index.html`が実際に読み込むのは`app.compiled.js`のみなので動作に影響しない）。
  3. リポジトリの Settings → Pages → Branch を `main` / `/(root)` に設定して保存。
     数分で `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される。
  4. **公開リポジトリにする場合は、Firebase同期を使う前に必ず「Firebaseの初回セットアップ」の
     手順4（認証を必須にするルール変更）を行ってください。** ソースコードが公開されると
     `firebaseConfig`（APIキー・データベースURL）も誰でも閲覧できる状態になるため、
     認証なしのルール（`.read/.write: true`）のままだと第三者がデータベースを自由に
     読み書きできてしまいます。
- オフラインでは初回起動できません（React本体等をCDNから読み込むため、初回は必ずインターネット
  接続が必要）。2回目以降はService Workerがオフライン起動に対応します。
- **コード修正後にブラウザに反映されない場合**は、Service Workerのキャッシュが原因の可能性があります。
  `sw.js`は同一オリジンのファイルをネットワーク優先で取得するよう修正済みですが、万一反映されない
  場合はブラウザの開発者ツールでService Workerの登録解除＋キャッシュ全削除を試してください
  （詳細は`docs/引継ぎ.md`の「Service Workerキャッシュ不具合」参照）。
- データを更新する場合は、アプリ内の「データ更新」ボタンから新しいExcelファイル（エネルギー.xlsx
  と同じ形式）を取り込めます。取り込み時、既存データより過去日付の行は自動的にスキップされます
  （データ破損の再発防止のための安全装置）。

### Firebaseの初回セットアップ（複数端末でリアルタイム共有したい場合）
1. https://console.firebase.google.com にアクセスし、Googleアカウントでログイン。
2. 「プロジェクトを作成」→ 任意の名前（例：`energy-dashboard-app`）で作成
   （`ac-check-app`とは別の新規プロジェクトを推奨。データの混在を避けられます）。
3. 左メニュー「構築」→「Realtime Database」→「データベースを作成」（ロケーションは東京等）。
4. **リポジトリを公開（GitHub Pages等）する場合は、認証必須のルールにしてください**：
   左メニュー「構築」→「Authentication」→「始める」→「Sign-in method」タブで
   「メール/パスワード」を有効化。次に「Users」タブから、チームで共有する1アカウント
   （メールアドレス・パスワード）を手動で追加します（アプリ内にサインアップ画面はありません。
   信頼できるメンバーだけがこのアカウント情報を知っている、という運用が前提です）。
   その上で、「ルール」タブに以下を貼り付けて「公開」：
   ```json
   {"rules": {"energyData": {".read": "auth != null", ".write": "auth != null"}, "settings": {".read": "auth != null", ".write": "auth != null"}, "notes": {".read": "auth != null", ".write": "auth != null"}}}
   ```
   （リポジトリを非公開のまま・ローカルのみで使う等、外部に漏れる心配が無い場合は、従来の
   `{".read": true, ".write": true}`のままでも動作します。ただしソースを公開する場合、
   `firebaseConfig`の値も一緒に公開されるため、認証なしのルールのままだと誰でもデータベースを
   読み書きできてしまいます。）
5. 「プロジェクトの設定」→「全般」→「マイアプリ」→ウェブアプリを追加（`</>`アイコン）→
   表示された`firebaseConfig`オブジェクトをコピー。
6. `app.jsx`内の`firebaseConfig`定数（ファイル冒頭、`DEFAULT_CHARTS`の直後）に貼り付けて
   `npm run build`。
7. 認証を有効にした場合、アプリを開くと最初にサインイン画面が表示されます。手順4で作成した
   メールアドレス・パスワードでサインインしてください（同じ端末なら次回以降は自動的に
   サインイン状態が保持されます）。最初にサインインした端末が、その時点のローカルデータを
   Realtime Databaseへ自動的にアップロードします（初回のみ）。以後は各端末の入力・削除・メモ・
   設定変更がリアルタイムで他端末にも反映されます（ヘッダーに「🔥 同期中」と表示されます）。
   `data/energy-data.js`の初期データ・`data/energy-data.json`の入れ替えは今まで通り可能ですが、
   Firebase同期を有効にした場合はRealtime Database側のデータが優先されます。

## Claude Codeで作業するときのお願い
- 大きな仕様変更・新機能を実装したときは、`docs/引継ぎ.md`にも追記してください。今後もこのファイルを
  見ながら作業を続ける前提のため、同じ場所に履歴を残すと一貫性が保てます。
- データの数値がおかしく見えても、まず元データ（`data/energy-data.json`、あるいは元の
  `エネルギー.xlsx`）を疑い、勝手に補正しないこと。過去に実際のデータ破損（日付の誤り）が
  見つかった事例があり、その調査・対応の経緯は`docs/引継ぎ.md`に詳しく記載しています。
