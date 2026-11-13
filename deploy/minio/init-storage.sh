#!/bin/sh
set -eu
umask 077

: "${MINIO_ROOT_USER:?Set MINIO_ROOT_USER}"
: "${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD}"
: "${S3_BUCKET:?Set S3_BUCKET}"
: "${S3_ACCESS_KEY:?Set a separate CMS access key}"
: "${S3_SECRET_KEY:?Set a separate CMS secret key}"

# Restrict names before using them in JSON policies and public URL paths.
case "$S3_BUCKET" in *[!a-z0-9-]*|-*|*-) echo 'Invalid media bucket name.' >&2; exit 1;; esac
[ "${#S3_BUCKET}" -ge 3 ] && [ "${#S3_BUCKET}" -le 63 ] || exit 1
[ "${#MINIO_ROOT_USER}" -ge 3 ] && [ "${#MINIO_ROOT_PASSWORD}" -ge 8 ] || exit 1
[ "${#S3_ACCESS_KEY}" -ge 3 ] && [ "${#S3_SECRET_KEY}" -ge 8 ] || exit 1
[ "$S3_ACCESS_KEY" != "$MINIO_ROOT_USER" ] && [ "$S3_SECRET_KEY" != "$MINIO_ROOT_PASSWORD" ] || {
  echo 'CMS credentials must differ from MinIO root credentials.' >&2; exit 1;
}

attempt=0
until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 60 ] || { echo 'MinIO authentication failed after 120 seconds.' >&2; exit 1; }
  sleep 2
done

policy_dir=$(mktemp -d)
trap 'rm -f "$policy_dir/cms.json" "$policy_dir/public.json"; rmdir "$policy_dir"' EXIT
cat > "$policy_dir/cms.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["s3:GetBucketLocation","s3:ListBucket","s3:ListBucketMultipartUploads"],"Resource":["arn:aws:s3:::$S3_BUCKET"]},
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:DeleteObject","s3:AbortMultipartUpload","s3:ListMultipartUploadParts"],"Resource":["arn:aws:s3:::$S3_BUCKET/*"]}
  ]
}
JSON
cat > "$policy_dir/public.json" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::$S3_BUCKET/*"]}
  ]
}
JSON

mc mb --ignore-existing "local/$S3_BUCKET" >/dev/null
mc admin policy create local zhuduo-cms-media "$policy_dir/cms.json" >/dev/null
mc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
mc admin policy attach local zhuduo-cms-media --user "$S3_ACCESS_KEY" >/dev/null
mc anonymous set-json "$policy_dir/public.json" "local/$S3_BUCKET" >/dev/null
echo 'MinIO media bucket and CMS account initialized.'
