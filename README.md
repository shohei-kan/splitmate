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

### CSV import レスポンス契約（`/api/import/rakuten/`, `/api/import/mitsui/`）

ImportResult は counts と samples を返します。

- counts:
  - `created`, `skipped`, `excluded_count`, `duplicate_count`
- samples:
  - `created_samples`, `skipped_samples`, `duplicate_samples`, `excluded_samples`

`ImportSample`（各 `*_samples` の要素）:

```json
{
  "date": "2024/11/03",
  "store": "Amazon",
  "amount": 1234,
  "raw_amount": "1,234",
  "reason": "excluded_by_rule"
}
```

契約ルール:

- `amount`: `integer | null`
  - 単位は円
  - パース不能な場合は `null`
- `raw_amount`: `string | null`
  - 元のCSV文字列
  - 数値由来で元文字列が無い場合は `null`
  - 空文字は使用しない
- `date`: CSV由来の文字列（形式保証なし）
- `reason`: 任意（`created_samples` では省略される場合あり）
  - 代表例: `invalid_row`, `invalid_date`, `excluded_by_rule`, `duplicate`, `non_data_row`
  - 将来 unknown 値が追加される可能性あり

リクエスト例（楽天CSV）:

```bash
curl -X POST "http://localhost:8000/api/import/rakuten/?card_user=unknown" \
  -F "file=@/path/to/rakuten.csv"
```

レスポンス例（抜粋）:

```json
{
  "created": 2,
  "skipped": 61,
  "excluded_count": 5,
  "duplicate_count": 53,
  "created_samples": [
    { "date": "2024/11/03", "store": "Amazon", "amount": 1234, "raw_amount": "1,234" }
  ],
  "skipped_samples": [
    {
      "date": "2024/11/05",
      "store": "テスト店舗",
      "amount": null,
      "raw_amount": "abc",
      "reason": "invalid_row"
    }
  ],
  "duplicate_samples": [
    {
      "date": "2024/11/06",
      "store": "スーパー",
      "amount": 3500,
      "raw_amount": "3,500",
      "reason": "duplicate"
    }
  ],
  "excluded_samples": [
    {
      "date": "2024/11/07",
      "store": "AMAZON.CO.JP",
      "amount": 1200,
      "raw_amount": "1,200",
      "reason": "excluded_by_rule"
    }
  ]
}
```

移行注意点:

- 以前は `excluded_samples` / `skipped_samples` の `amount` が string の場合がありました。
- 現在は `amount` を `integer | null` に統一しています。
- 元値調査が必要な場合は `raw_amount` を参照してください。
- フロント型を厳密化する際は、この契約を前提にしてください。

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
