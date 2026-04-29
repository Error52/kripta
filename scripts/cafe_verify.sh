#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/cafe/full}"
VERIFY_DB="${VERIFY_DB:-cafe_verify}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASS="${MYSQL_PASS:-}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
REPORT_FILE="${REPORT_FILE:-/var/backups/cafe/verify_report.txt}"

MYSQL=(mysql -h"$MYSQL_HOST" -u"$MYSQL_USER")
[[ -n "$MYSQL_PASS" ]] && MYSQL+=( -p"$MYSQL_PASS" )

latest_backup=$(ls -1t "$BACKUP_ROOT"/cafe_full_*.sql.gz | head -n1)
[[ -z "${latest_backup:-}" ]] && { echo "No backup found"; exit 1; }

echo "[VERIFY] backup: $latest_backup" > "$REPORT_FILE"

gunzip -c "$latest_backup" | "${MYSQL[@]}"

"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS ${VERIFY_DB}; CREATE DATABASE ${VERIFY_DB};"
gunzip -c "$latest_backup" | sed "s/CREATE DATABASE .*cafe.*/CREATE DATABASE IF NOT EXISTS ${VERIFY_DB};/" | "${MYSQL[@]}" || true

sales=$("${MYSQL[@]}" -Nse "SELECT COALESCE(SUM(total_amount),0) FROM cafe.orders WHERE DATE(order_date)=CURDATE();")
open_orders=$("${MYSQL[@]}" -Nse "SELECT COUNT(*) FROM cafe.orders WHERE status IN ('new','open','in_progress');")
stock_balance=$("${MYSQL[@]}" -Nse "SELECT COUNT(*) FROM cafe.menu_items WHERE is_available=1;")

echo "sales_today=$sales" >> "$REPORT_FILE"
echo "open_orders=$open_orders" >> "$REPORT_FILE"
echo "available_items=$stock_balance" >> "$REPORT_FILE"

echo "[VERIFY] OK" >> "$REPORT_FILE"
cat "$REPORT_FILE"
