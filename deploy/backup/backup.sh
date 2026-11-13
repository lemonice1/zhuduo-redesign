#!/usr/bin/env bash
set -euo pipefail
umask 077

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
: "${BACKUP_LOCAL_DIR:?Set absolute BACKUP_LOCAL_DIR}"
: "${BACKUP_SOURCE:?Set rclone source remote:bucket/prefix}"
: "${BACKUP_TARGET:?Set independent offsite remote:bucket/prefix}"
: "${BACKUP_RELEASE:?Set deployed git/image release identifier}"
: "${MEDIA_PUBLIC_URL:?Set public media URL for restore manifest}"
[[ "$BACKUP_LOCAL_DIR" = /* ]] || die 'BACKUP_LOCAL_DIR must be absolute'
[[ "$BACKUP_SOURCE" = *:* && "$BACKUP_TARGET" = *:* ]] || die 'Use configured rclone remote paths'
[[ "${BACKUP_SOURCE%%:*}" != "${BACKUP_TARGET%%:*}" ]] || die 'Source and offsite target must use separate remotes'
[[ "${BACKUP_CONFIRM_WRITES_PAUSED:-}" = yes ]] || die 'Acknowledge maintenance downtime and pause all other source writers'
for command in docker rclone sha256sum date mktemp; do command -v "$command" >/dev/null || die "Missing $command"; done

# Run from this checkout, not the caller's working directory.
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
compose=(docker compose --project-directory "$project_dir" -f "$project_dir/docker-compose.yml")
mkdir -p -- "$BACKUP_LOCAL_DIR"
# Atomic directory lock prevents overlapping maintenance windows; stale locks need operator review.
lock_dir="$BACKUP_LOCAL_DIR/.backup-lock"
mkdir -- "$lock_dir" 2>/dev/null || die 'Backup already running or stale .backup-lock needs review'
lock_held=true
writers=()
restore_needed=false
cleanup() {
    local status=$?
    trap - EXIT HUP INT TERM
    if [[ "$restore_needed" = true && ${#writers[@]} -gt 0 ]]; then
        if ! "${compose[@]}" start "${writers[@]}"; then
            printf 'ERROR: Could not restore previously running services; start them manually.\n' >&2
            status=1
        fi
    fi
    if [[ "$lock_held" = true ]]; then rmdir -- "$lock_dir" || status=1; fi
    exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM

running=$("${compose[@]}" ps --status running --services)
for service in cms web; do
    while IFS= read -r name; do
        if [[ "$name" = "$service" ]]; then writers+=("$service"); break; fi
    done <<< "$running"
done
snapshot_dir=$(mktemp -d "$BACKUP_LOCAL_DIR/$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
snapshot=${snapshot_dir##*/}
target="${BACKUP_TARGET%/}/$snapshot"
restore_needed=true
if [[ ${#writers[@]} -gt 0 ]]; then "${compose[@]}" stop -t 60 "${writers[@]}"; fi
"${compose[@]}" images --format json postgres cms web nginx > "$snapshot_dir/images.json"
[[ -s "$snapshot_dir/images.json" ]] || die 'Container image inventory is empty'

"${compose[@]}" exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$snapshot_dir/database.dump"
[[ -s "$snapshot_dir/database.dump" ]] || die 'Database dump is empty'
# copy preserves history; never sync/delete the backup destination.
rclone copy "$BACKUP_SOURCE" "$target/media" --metadata
rclone check "$BACKUP_SOURCE" "$target/media" --download
{
    printf 'format=1\nutc=%s\nrelease=%s\npostgres_major=16\n' "$(date -u +%FT%TZ)" "$BACKUP_RELEASE"
    printf 'source=%s\nmedia_public_url=%s\nobjects_check=download-verified\n' "$BACKUP_SOURCE" "$MEDIA_PUBLIC_URL"
    printf 'consistency=CMS and web stopped; external writers paused by operator\n'
    printf 'objects_restore=%s/media\n' "$target"
    printf 'image_inventory=images.json\n'
} > "$snapshot_dir/manifest.txt"
(cd -- "$snapshot_dir" && sha256sum database.dump manifest.txt images.json > SHA256SUMS)
rclone copy "$snapshot_dir" "$target/database" --metadata
rclone check "$snapshot_dir" "$target/database" --download
# Restore service state before publishing the completion marker or claiming success.
if [[ ${#writers[@]} -gt 0 ]]; then "${compose[@]}" start "${writers[@]}"; fi
restore_needed=false
printf 'Verified snapshot %s\n' "$snapshot" > "$snapshot_dir/COMPLETE"
rclone copyto "$snapshot_dir/COMPLETE" "$target/COMPLETE"
rmdir -- "$lock_dir"
lock_held=false
printf 'SUCCESS: Verified private snapshot %s (restore drill still required).\n' "$snapshot"
