#!/bin/sh
set -e

# 個別の POSTGRES_* だけがある場合は DATABASE_URL を組み立てる。
# ユーザー名・パスワードは percent-encode する（# @ / などを含むパスワードでも
# 接続 URL が壊れないようにするため）。
if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_HOST" ]; then
  urlencode() {
    node -e 'process.stdout.write(encodeURIComponent(process.env[process.argv[1]] || ""))' "$1"
  }
  DATABASE_URL="postgresql://$(urlencode POSTGRES_USER):$(urlencode POSTGRES_PASSWORD)@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"
  export DATABASE_URL
fi

exec "$@"
