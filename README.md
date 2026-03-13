# SplitMate

夫婦の家計精算を目的とした支出管理アプリです。  
バックエンドは Django + DRF、フロントエンドは React + Vite で構成されています。

## 主な機能

- 支出データの CRUD（`/api/expenses/`）
- 楽天カード CSV / 三井住友カード CSV のインポート
- CSV インポート時の除外ルール管理
- 月次サマリー、年次（月別）サマリー、カテゴリ別サマリー
- 対象月の `draft` / `final` 一括更新

## Current Features

- Home で対象月の精算サマリーカードを表示
- Home に月次内訳アコーディオンを追加し、カテゴリ別横棒グラフで当月内訳を確認可能
- Home の月次グラフで、カテゴリ hover 時に当月明細上位5件を tooltip 表示可能
- 手入力フォームで店名候補の選択と自由入力の両方に対応
- Summary ページ（`/summary`）で月次・年次の集計を表示
- Summary 月次タブで、総支出・件数・カテゴリ別横棒グラフ・カテゴリ一覧を確認可能
- Summary 月次タブで、カテゴリ選択から当月明細へ自然に掘り下げ可能
- Summary 年次タブで、年間総支出・月平均・年間件数・年次積み上げ棒グラフ・カテゴリ別月次棒グラフを確認可能

## Pages

- `/`: Home
  - 精算サマリーカード
  - 月次内訳アコーディオン
  - カテゴリ hover tooltip による上位明細プレビュー
  - 手入力フォーム
  - 対象月の支出一覧
- `/summary`: Summary
  - 月次タブ
  - 年次タブ
- `/csv`: CSV import
- `/settings`: 設定

## Summary Features

### 月次

- 前月 / 次月切替
- 総支出
- 件数
- カテゴリ別横棒グラフ
- カテゴリ別一覧
- カテゴリ選択時の当月明細表示
- カテゴリ別詳細へのスクロール誘導

### 年次

- 前年 / 次年切替
- 年間総支出
- 月平均
- 年間件数
- 月別の積み上げ棒グラフ
- 選択カテゴリの月別棒グラフ
- 凡例表示
- ツールチップ表示
- 年次グラフ用の見分けやすい淡色パレット

## Recent Updates

- Phase 3-1:
  - 手入力フォームの店名候補 API を追加
  - Home に月次内訳アコーディオンを追加
- Phase 3-2:
  - Summary ページ（`/summary`）を追加
  - 月次タブを実装
  - Home から Summary への導線を追加
- Phase 3-3:
  - 年次集計 API（`/api/summary/yearly/`）を追加
  - Summary の年次タブを実装
  - 年次積み上げ棒グラフとカテゴリ別棒グラフを追加
- Phase 3-3.1:
  - 年次グラフの凡例を強化
  - 年次グラフにツールチップを追加
  - 年次グラフ配色を見分けやすく調整
- UX polish:
  - Home 月次グラフ tooltip が画面端で見切れにくいよう、軽い位置計算で表示位置を調整
  - Summary 月次でカテゴリ選択時の詳細スクロール位置を、明細量に応じて見やすく調整

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

## Production Deploy

Wyse 5070 / Ubuntu Server 24.04 LTS での Docker Compose 本番構成は `docker-compose.prod.yml` を使います。開発用 `docker-compose.yml` は変更せず、そのまま残しています。

### 想定構成

- `splitmate-frontend`: Vite build 済み静的ファイルを nginx で配信
- `splitmate-backend`: Django + gunicorn
- `splitmate-db`: PostgreSQL 16
- reverse proxy: 既存 Caddy コンテナが `:8080` で `/api/*` を backend、それ以外を frontend に転送
- external network: `proxy-net`
- internal data:
  - `/srv/storage/splitmate/postgres`
  - `/srv/storage/splitmate/backend/media`
  - `/srv/storage/splitmate/backend/static`
- env files:
  - `/srv/splitmate/compose/.env.prod`
  - `/srv/splitmate/compose/.env.db`

### 1. 本番 env を配置

```bash
cp .env.prod.example /srv/splitmate/compose/.env.prod
cp .env.db.example /srv/splitmate/compose/.env.db
```

`.env.prod` では最低限以下を本番値に変更してください。

- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `CSRF_TRUSTED_ORIGINS`
- 必要なら `GUNICORN_WORKERS`, `GUNICORN_TIMEOUT`

`.env.db` では PostgreSQL の認証情報を設定します。

`docker-compose.prod.yml` は repo 内の `.env.prod.example` / `.env.db.example` を fallback として読み、Wyse 本番では `/srv/splitmate/compose/.env.prod` と `/srv/splitmate/compose/.env.db` が存在すればそちらを優先します。

### 2. 永続化ディレクトリと network を作成

```bash
sudo mkdir -p /srv/storage/splitmate/postgres
sudo mkdir -p /srv/storage/splitmate/backend/media
sudo mkdir -p /srv/storage/splitmate/backend/static
docker network create proxy-net
```

### 3. Build / 起動

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

backend コンテナ起動時に以下を自動実行します。

- `python manage.py migrate --noinput`
- `python manage.py collectstatic --noinput`
- `gunicorn config.wsgi:application --bind 0.0.0.0:8000`

### 4. 動作確認

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f splitmate-backend
docker compose -f docker-compose.prod.yml logs -f splitmate-frontend
```

Caddy 側では既存コンテナに以下のような `:8080` ブロックを追加し、LAN 内では `http://192.168.11.6:8080` で確認する想定です。

```caddy
:8080 {
	encode zstd gzip

	handle /api/* {
		reverse_proxy splitmate-backend:8000
	}

	handle {
		reverse_proxy splitmate-frontend:80
	}
}
```

frontend の API 呼び出しは `/api/...` の相対パス前提のままです。React Router の直アクセスは nginx の SPA fallback で処理します。

`/static` と `/media` は現時点では Caddy 配信を必須にしていません。必要になった時点で Caddy 側の route 追加を検討してください。

## API エンドポイント

主なエンドポイント:

- `GET/POST /api/expenses/`
- `GET/PATCH/DELETE /api/expenses/{id}/`
- `GET/POST /api/exclusion-rules/`
- `GET/PATCH/DELETE /api/exclusion-rules/{id}/`
- `GET /api/summary/monthly/?year=YYYY&month=MM[&status=draft|final]`
- `GET /api/summary/monthly-list/?year=YYYY[&status=draft|final]`
- `GET /api/summary/monthly-by-category/?month=YYYY-MM`
- `GET /api/summary/yearly/?year=YYYY`
- `GET /api/stores/suggestions/`
- `POST /api/import/rakuten/?card_user=me|wife|unknown`（multipart の `file` 必須）
- `POST /api/import/mitsui/?card_user=me|wife|unknown`（multipart の `file` 必須）
- `POST /api/month/status/`

### Expense 更新（PATCH）

`PATCH /api/expenses/{id}/`

更新可能フィールド:

- `date`
- `store`
- `amount`
- `card_user`
- `payer`
- `burden_type`
- `category`
- `memo`

更新不可フィールド:

- `id`
- `source`
- `status`
- `created_at`
- `updated_at`

バリデーション:

- `amount` は 1 以上
- `store` は空文字・空白のみ不可

`burden_type` の許可値:

- `shared`: 共有支出
- `wife_only`: 妻の個人利用
- `me_only`: 私の個人利用

`category` の許可値:

- `uncategorized`: 未分類
- `food`: 食費
- `daily`: 日用品
- `outside_food`: 外食
- `utility`: 光熱費
- `travel`: 旅行
- `other`: その他

リクエスト例:

```json
{
  "category": "food",
  "burden_type": "shared",
  "memo": "週末の買い出し"
}
```

注意:

- `read_only_fields` に含まれる項目は送信しても更新されません（`backend/expenses/serializers.py` が source of truth）。

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

## Roadmap

- CSV取込時のカテゴリ自動提案 / 自動分類
- GitHub Actions の手動実行型 CD
- 必要に応じたグラフ UI の微調整
- 店名候補 UI の他画面展開
- 年次集計の追加分析（前年比較、補助指標など）

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
