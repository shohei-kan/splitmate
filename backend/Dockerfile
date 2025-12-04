# backend/Dockerfile
FROM python:3.12-slim

# 必要なら OS パッケージ（psycopg2 用など）
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存関係をコピーしてインストール
# requirements.txt が無ければ、後で追加してOK
COPY requirements.txt /app/

RUN pip install --no-cache-dir -r requirements.txt

# プロジェクト本体をコピー
COPY . /app

# コンテナ起動時のデフォルトコマンドは docker-compose 側で指定
