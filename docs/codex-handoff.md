# Codex作業サマリー

## 1. 今回の目的
- SplitMate の現状構成に合わせて、Wyse 5070 向けの本番用 Docker / Compose / 設定差分を最小限で追加する

## 2. 確認した状況
- Django project 名は `config` だった
- backend の settings は `backend/.env` ではなく、`backend/../.env` を `python-dotenv` で読んでいた
- backend の env 対応は `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, Postgres 接続情報のみで、`CSRF_TRUSTED_ORIGINS`, `STATIC_ROOT`, `MEDIA_ROOT` は未定義だった
- `docker-compose.yml` は開発用で、`db` と `backend` のみ。backend は `runserver` 起動、frontend は Compose 管理外だった
- `backend/Dockerfile` は開発向けの単純な Python イメージで、本番起動用 entrypoint や gunicorn は未対応だった
- frontend は `vite.config.ts` で開発時のみ `/api` を `http://localhost:8000` に proxy していた
- frontend の API クライアントは `frontend/src/api/client.ts` と `frontend/src/api/settings.ts` で `/api/...` 相対パス前提だった
- API ルーティングは `backend/config/urls.py` で `path("api/", ...)` と `path("api/...")` に統一されていた
- 追加した `docker-compose.prod.yml` は当初 `/srv/splitmate/compose/.env.prod` と `/srv/splitmate/compose/.env.db` を必須参照しており、ローカルで `docker compose -f docker-compose.prod.yml config` を実行すると env file 不在で失敗した
- `backend/config/settings.py` の `from dotenv import load_dotenv` は Pylance で `reportMissingImports` を出していた
- Wyse 実環境では Caddy 連携用 external network 名は `caddy_net` ではなく `proxy-net` だった
- 当面の入口は同一 FQDN ではなく `http://192.168.11.6:8080` で、既存 Caddy コンテナの `:8080` ブロックで `/api/*` とそれ以外を振り分ける運用だった
- 関連ファイル:
  - `backend/config/settings.py`
  - `backend/config/urls.py`
  - `backend/Dockerfile`
  - `docker-compose.yml`
  - `frontend/package.json`
  - `frontend/vite.config.ts`
  - `frontend/src/api/client.ts`
  - `frontend/src/api/settings.ts`
  - `README.md`

## 3. 原因
### 確定
- 本番用 Compose / Dockerfile / entrypoint / nginx 設定が repo 内に存在しなかった
- Django settings に本番で必要な env 項目の受け皿が不足していた
- backend requirements に `gunicorn` が未追加だった

### 仮説
- Caddy 側で `/static` や `/media` を直接配信しない運用なら、Django 管理画面や media 配信の扱いを後で明確化する必要がある

## 4. 実施した変更
- 変更したファイル一覧:
  - `backend/config/settings.py`
  - `backend/requirements.txt`
  - `docker-compose.prod.yml`
  - `docker/backend/Dockerfile`
  - `docker/backend/entrypoint.sh`
  - `docker/frontend/Dockerfile`
  - `docker/frontend/nginx.conf`
  - `.env.prod.example`
  - `.env.db.example`
  - `README.md`
  - `docs/codex-handoff.md`
- 各ファイルで何を変えたか:
  - `backend/config/settings.py`
    - env helper を追加
    - `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` を新旧 env 名で読めるようにした
    - `CSRF_TRUSTED_ORIGINS`, `STATIC_ROOT`, `MEDIA_ROOT`, `MEDIA_URL` を追加
    - `STATIC_URL` を `/static/` に修正
    - `dotenv` を静的 import せず `import_module("dotenv")` で動的 import する形に変更し、Pylance の missing import 警告を回避
  - `backend/requirements.txt`
    - `gunicorn==23.0.0` を追加
  - `docker-compose.prod.yml`
    - `splitmate-db`, `splitmate-backend`, `splitmate-frontend` の本番構成を追加
    - `proxy-net` external network と `splitmate_internal` を定義
    - host `ports:` は未使用
    - repo 内 `.env.*.example` を fallback、`/srv/splitmate/compose/*.env*` を本番優先で読む `required: false` の `env_file` に修正
  - `docker/backend/Dockerfile`
    - backend 専用の本番 build 定義を追加
  - `docker/backend/entrypoint.sh`
    - `migrate` -> `collectstatic` -> `gunicorn` 起動を追加
  - `docker/frontend/Dockerfile`
    - multi-stage build で Vite build 後に nginx 配信する構成を追加
  - `docker/frontend/nginx.conf`
    - SPA fallback (`try_files ... /index.html`) を追加
  - `.env.prod.example`
    - 本番用 Django / gunicorn / DB 接続先のサンプル env を追加
  - `.env.db.example`
    - PostgreSQL 用 env サンプルを追加
  - `README.md`
    - Production Deploy セクションを追加
    - `docker-compose.prod.yml` の env fallback 挙動を追記
    - `proxy-net` と `:8080` の Caddy 例、`http://192.168.11.6:8080` での確認前提、`/static` `/media` は現時点で必須ではない旨を追記
  - `docs/codex-handoff.md`
    - 今回の内容で更新
- 破壊的変更:
  - なし

## 5. テスト・確認結果
- 実行したコマンド:
  - `sed -n '1,240p' backend/config/settings.py`
  - `sed -n '1,220p' backend/config/urls.py`
  - `sed -n '1,220p' docker-compose.yml`
  - `sed -n '1,220p' backend/Dockerfile`
  - `sed -n '1,220p' frontend/package.json`
  - `sed -n '1,220p' frontend/vite.config.ts`
  - `sed -n '1,220p' frontend/src/api/settings.ts`
  - `sed -n '1,220p' frontend/src/api/client.ts`
  - `sed -n '1,260p' README.md`
  - `sed -n '1,260p' AGENTS.md`
  - `sed -n '1,260p' docs/project-context.md`
  - `sed -n '1,240p' docs/codex-handoff-prompt.md`
  - `rg -n "STATIC_ROOT|MEDIA_ROOT|collectstatic|gunicorn|whitenoise|DJANGO_ALLOWED_HOSTS|CSRF_TRUSTED_ORIGINS|dotenv|load_dotenv|DJANGO_SECRET_KEY|DJANGO_DEBUG" -S backend frontend README.md docker-compose.yml`
  - `rg -n "BrowserRouter|createBrowserRouter|RouterProvider|Routes|Route" frontend/src`
  - `rg -n "caddy_net|proxy-net|8080|同一 FQDN|/static|/media" docker-compose.prod.yml README.md docs/codex-handoff.md`
  - `git status --short`
  - `python3 --version`
  - `node --version`
  - `python3 manage.py test expenses`
  - `npm run build`
  - `docker compose -f docker-compose.prod.yml config`
  - `python3 manage.py test expenses`
- 成功したこと:
  - backend テスト `Found 7 test(s) ... OK`
  - frontend build `vite build` 完了
  - `docker compose -f docker-compose.prod.yml config` が通り、fallback env を含む本番 Compose 定義を展開できた
  - `backend/config/settings.py` の動的 import 化後も backend テストは通過
- 失敗したこと:
  - 最初の `python3 manage.py test expenses` は Python 3.9 で `str | None` 型注釈が使えず失敗したが、`typing.Optional` に修正後は成功
  - 最初の `docker compose -f docker-compose.prod.yml config` は `/srv/splitmate/compose/.env.db` 不在で失敗したが、optional fallback に修正後は成功
- 未実施の確認:
  - `docker compose -f docker-compose.prod.yml build`
  - `docker compose -f docker-compose.prod.yml up -d`
  - Wyse 実機上での Caddy 連携確認

## 6. 未解決事項
- Caddy で `/media` や `/static` を別経路で扱う必要があるかは運用方針の確認が必要
- `ALLOWED_HOSTS` と `CSRF_TRUSTED_ORIGINS` の本番値は実 FQDN 確定後に設定が必要
- `proxy-net` が既存ホストにすでにある前提。未作成なら `docker network create proxy-net` が必要

## 7. 次にやるなら
1. Wyse 実機で `docker compose -f docker-compose.prod.yml build && up -d` を実行して起動確認する
2. 既存 Caddy コンテナの `:8080` ブロックに `/api/*` と frontend 向け reverse_proxy を追加して LAN 内疎通を確認する
3. 必要なら `/media` 配信方針を決めて Caddy または backend 側の扱いを明文化する

## 8. ChatGPTに相談したいこと
- `http://192.168.11.6:8080` 運用から将来 FQDN 化する際に、`ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` / Caddy 設定をどう移行するのが素直か整理したい

## 9. ChatGPTに次に頼む依頼文
- SplitMate の `docker-compose.prod.yml` と `README.md` を前提に、LAN 内の `http://192.168.11.6:8080` 運用から将来 FQDN + HTTPS に移行する際の `ALLOWED_HOSTS`、`CSRF_TRUSTED_ORIGINS`、Caddy 設定の差分を最小構成で整理してください。
