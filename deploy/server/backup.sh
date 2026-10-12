#!/usr/bin/env bash
# Нічний бекап: усі бази + фото «Маминої шафи». Зберігає останні 14 днів у /opt/backups.
# Встановлюється deploy/deploy.sh у cron (щодня о 03:30 за Києвом).
set -euo pipefail

DIR=/opt/backups
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DIR"
cd /opt/sites

docker compose exec -T db pg_dumpall -U postgres | gzip > "$DIR/db_$STAMP.sql.gz"
docker run --rm -v sites_shafa-data:/data:ro -v "$DIR":/backup alpine \
  tar czf "/backup/shafa-uploads_$STAMP.tar.gz" -C /data uploads

find "$DIR" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: $(du -sh "$DIR" | cut -f1)"
