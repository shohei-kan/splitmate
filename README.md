# SplitMate

夫婦の家計精算を目的とした支出管理アプリです。  
バックエンドは Django + DRF、フロントエンドは React + Vite で構成されています。

## 主な機能

- 支出データの CRUD（`/api/expenses/`）
- 楽天カード CSV / 三井住友カード CSV のインポート
- CSV インポート時の除外ルール管理
- 月次サマリー、年次（月別）サマリー、カテゴリ別サマリー
- 対象月の `draft` / `final` 一括更新

## 技術スタック

- Backend: Django 4.2, Django REST Framework
- Frontend: React 19, TypeScript, Vite
- DB: PostgreSQL 16
- Local runtime: Docker Compose（`db` + `backend`）

## ディレクトリ構成

```text
.
├── backend/            # Django アプリ
├── frontend/           # React + Vite
├── docker-compose.yml  # db / backend のローカル起動
├── .env.example        # ルート環境変数のサンプル
└── README.md
```

## セットアップ

### 前提

- Docker / Docker Compose
- Node.js 20+

### 1. 環境変数を作成

```bash
cp .env.example .env
touch backend/.env
touch frontend/.env
```

このプロジェクトでは以下のファイルを利用します。

- `/.env`: PostgreSQL 接続情報（`docker-compose.yml` で使用）
- `/backend/.env`: Django 設定（`DJANGO_SECRET_KEY` など）
- `/frontend/.env`: フロント設定（`VITE_API_BASE_URL`）

最低限、`.env.example` のキーを `.env` に設定してください。  
`backend/.env` は `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS` を設定します。

### 2. Backend + DB を起動

```bash
docker compose up -d --build
```

- API: `http://localhost:8000`

### 3. Frontend を起動

```bash
cd frontend
npm ci
npm run dev
```

- Frontend: `http://localhost:5173`
- 開発時は Vite proxy により `/api` が `http://localhost:8000` に転送されます。

## 開発コマンド

### Docker

```bash
# 起動
docker compose up -d

# 再ビルドして起動
docker compose up -d --build

# ログ
docker compose logs -f backend
docker compose logs -f db

# 停止
docker compose down
```

### Backend（コンテナ内実行例）

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py test
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run preview
```

## API エンドポイント

主なエンドポイント:

- `GET/POST /api/expenses/`
- `GET/PATCH/DELETE /api/expenses/{id}/`
- `GET/POST /api/exclusion-rules/`
- `GET/PATCH/DELETE /api/exclusion-rules/{id}/`
- `GET /api/summary/monthly/?year=YYYY&month=MM[&status=draft|final]`
- `GET /api/summary/monthly-list/?year=YYYY[&status=draft|final]`
- `GET /api/summary/monthly-by-category/?year=YYYY&month=MM[&status=draft|final]`
- `POST /api/import/rakuten/?card_user=me|wife|unknown`（multipart の `file` 必須）
- `POST /api/import/mitsui/?card_user=me|wife|unknown`（multipart の `file` 必須）
- `POST /api/month/status/`

`/api/month/status/` の例:

```json
{
  "year": 2026,
  "month": 2,
  "status": "final"
}
```

## 画面ルーティング

- `/` : ホーム（月次サマリー）
- `/csv` : CSV インポート（画面はプレースホルダー）
- `/settings` : 設定（画面はプレースホルダー）

## 注意事項

- `.env` 系ファイルは Git にコミットしないでください。
- すでに秘密情報を push してしまった場合は、シークレットをローテーションしてください。
