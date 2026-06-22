# Supabase & Vercel デプロイ手順書

本システム（Tentoru Control Tower）をローカル環境から本番環境（インターネット公開）へ移行し、Supabaseと連携させるための詳細な手順書です。

---

## 📋 1. 事前準備

以下のサービスのアカウントが必要になります。未作成の場合は作成してください。
1. **GitHub** ([https://github.com](https://github.com))
2. **Supabase** ([https://supabase.com](https://supabase.com))
3. **Vercel** ([https://vercel.com](https://vercel.com))

---

## 🗄️ 2. Supabase（データベース）のセットアップ

### ① プロジェクトの作成
1. [Supabase](https://supabase.com) にサインインします。
2. 「**New Project**」をクリックし、任意のプロジェクト名とデータベースパスワードを設定して作成します。
   * 地域（Region）は「**Tokyo (ap-northeast-1)**」を選択することをお勧めします。

### ② テーブル構造（スキーマ）の適用
1. 作成したプロジェクトのダッシュボードに入ります。
2. 左メニューから「**SQL Editor**」をクリックします。
3. 「**New query**」をクリックして新しいエディタを開きます。
4. プロジェクトルートにある `supabase_schema.sql` の中身をすべてコピーし、エディタへ貼り付けます。
5. 右下の「**Run**」ボタンをクリックして実行します。
   * 「Success. No rows returned」と表示されれば、本番用データベースのテーブル作成と初期プロンプトデータのインサートは完了です。

---

## 🐙 3. GitHub（リポジトリ）へのソースコード反映

本プロジェクトを Vercel へインポートするために、GitHub にソースコードをプッシュします。

1. **GitHub上で新しいリポジトリを作成**します。
   * リポジトリ名: 任意（例: `study-management`）
   * 公開範囲: **Private（非公開）** を強く推奨します（APIキー等の漏洩を防ぐため）。
   * `Initialize this repository with` の項目はすべて**チェックを外した状態**で作成してください。

2. **ローカルのターミナルで以下を実行**して、ソースコードを GitHub にプッシュします：
   ```bash
   # プロジェクトのディレクトリに移動していることを確認してください
   git init
   git add .
   git commit -m "Initial commit for Vercel deployment"
   git branch -M main
   
   # GitHubの作成画面に表示された remote URL を追加します
   git remote add origin <作成したGitHubリポジトリのURL>
   git push -u origin main
   ```

---

## ⚡ 4. Vercel（ホスティング）でのデプロイと環境変数設定

### ① プロジェクトのインポート
1. [Vercel](https://vercel.com) にログインします。
2. ダッシュボードで「**Add New...**」➔「**Project**」を選択します。
3. GitHub アカウントと連携し、先ほどプッシュしたリポジトリの横にある「**Import**」をクリックします。

### ② 環境変数の設定 (重要)
1. インポート画面の「**Environment Variables**」を展開します。
2. サンプルファイル（`.env.example`）に記載されている以下の2つの環境変数を本番用に設定します：

| Key | Value | 取得先 (Supabase) |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | *(SupabaseのURL)* | Project Settings ➔ API ➔ **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(SupabaseのAnon Key)* | Project Settings ➔ API ➔ **`anon` `public` key** |

### ③ デプロイの実行
1. 「**Deploy**」ボタンをクリックします。
2. ビルドが自動で開始されます。通常、1〜2分程度で完了し、公開用URL（`https://xxx.vercel.app`）が発行されます。

---

## ✅ 5. デプロイ後の確認

公開された URL にアクセスし、以下の動作を確認してください：
* **講師画面**:
  * 生徒を新規追加した際、エラーなく完了し、Supabase の `students` テーブルに生徒データが保存されること。
  * テスト結果や時間割を登録した際、データが保持されること。
* **生徒画面**:
  * すごろくマップが正しく描画され、単元テストを合格/不合格した際にデータが更新されること。
