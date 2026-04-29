#!/usr/bin/env bash
set -euo pipefail

DB_NAME="cafe"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/cafe}"
REMOTE_BINLOG_DIR="${REMOTE_BINLOG_DIR:-/mnt/remote/cafe/binlogs}"
OFFSITE_DIR="${OFFSITE_DIR:-/mnt/offsite/cafe}"
LOG_FILE="${LOG_FILE:-$BACKUP_ROOT/backup.log}"

mkdir -p "$BACKUP_ROOT/full" "$BACKUP_ROOT/incremental" "$BACKUP_ROOT/monthly" "$REMOTE_BINLOG_DIR" "$OFFSITE_DIR"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*" | tee -a "$LOG_FILE"; }
notify_fail() { echo "Cafe backup failed: $*" | tee -a "$LOG_FILE"; }

MYSQL=(mysql -h"$DB_HOST" -u"$DB_USER")
DUMP=(mysqldump -h"$DB_HOST" -u"$DB_USER")
[[ -n "$DB_PASS" ]] && MYSQL+=( -p"$DB_PASS" ) && DUMP+=( -p"$DB_PASS" )

copy_binlogs() {
  log "Copying binary logs (15-min task)"
  "${MYSQL[@]}" -Nse "SHOW BINARY LOGS" | awk '{print $1}' | while read -r bl; do
    cp -f "/var/lib/mysql/$bl" "$REMOTE_BINLOG_DIR/$bl" 2>/dev/null || true
  done
}

full_backup() {
  local dt file
  dt=$(date '+%Y%m%d_%H%M')
  file="$BACKUP_ROOT/full/cafe_full_${dt}.sql"
  log "Creating full backup: $file"
  "${DUMP[@]}" --single-transaction --routines --triggers --events --master-data=2 --default-character-set=utf8mb4 "$DB_NAME" > "$file"
  gzip -f "$file"
  find "$BACKUP_ROOT/full" -type f -name '*.gz' -mtime +14 -delete
}

weekly_offsite() {
  log "Weekly off-site sync"
  rsync -a --delete "$BACKUP_ROOT/full/" "$OFFSITE_DIR/weekly/"
}

monthly_archive() {
  local dt file
  dt=$(date '+%Y%m')
  file="$BACKUP_ROOT/monthly/cafe_fiscal_${dt}.sql"
  log "Monthly fiscal archive: $file"
  "${DUMP[@]}" --single-transaction --default-character-set=utf8mb4 "$DB_NAME" orders order_items > "$file"
  gzip -f "$file"
}

main() {
  local mode="${1:-all}"
  trap 'notify_fail "mode=$mode line=$LINENO"' ERR
  case "$mode" in
    binlog) copy_binlogs ;;
    full) full_backup ;;
    weekly) weekly_offsite ;;
    monthly) monthly_archive ;;
    all)
      copy_binlogs
      full_backup
      [[ "$(date +%u)" == "7" ]] && weekly_offsite || true
      [[ "$(date +%d)" == "01" ]] && monthly_archive || true
      ;;
    *) echo "Usage: $0 [binlog|full|weekly|monthly|all]"; exit 1 ;;
  esac
  log "Done mode=$mode"
}

main "$@"
