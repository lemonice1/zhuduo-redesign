#!/bin/sh
set -eu

attempt=0
until mc alias set dev http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "MinIO did not become ready in 120 seconds." >&2
    exit 1
  fi
  sleep 2
done

mc mb --ignore-existing "dev/$S3_BUCKET"
# Public product imagery only. Anonymous clients cannot upload or delete.
mc anonymous set download "dev/$S3_BUCKET"
