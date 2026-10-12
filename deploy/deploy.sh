#!/usr/bin/env bash
# Викласти «Мамину шафу» на сервер: bash deploy/deploy.sh
# Бере код з останнього коміту (git archive), тож незакомічені зміни на сервер не потрапляють.
# Потрібен SSH-доступ: Host shafa-server у ~/.ssh/config.
set -euo pipefail

HOST=${HOST:-shafa-server}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

echo "== Коміт: $(git log -1 --format='%h %s')"
if [ -n "$(git status --porcelain)" ]; then
  echo "!! Є незакомічені зміни — вони НЕ потраплять на сервер."
fi

echo "== Копіюю код на сервер…"
ssh "$HOST" 'mkdir -p /opt/sites/shafa && find /opt/sites/shafa -mindepth 1 -delete'
git archive --format=tar HEAD | ssh "$HOST" 'tar -x -C /opt/sites/shafa'
ssh "$HOST" 'cp /opt/sites/shafa/deploy/server/docker-compose.yml /opt/sites/shafa/deploy/server/Caddyfile /opt/sites/ \
  && install -m 755 /opt/sites/shafa/deploy/server/backup.sh /opt/sites/backup.sh \
  && test -f /opt/sites/.env || { echo "!! Немає /opt/sites/.env — див. deploy/server/.env.example"; exit 1; }'

echo "== Збираю й запускаю (перший раз — кілька хвилин)…"
ssh "$HOST" 'cd /opt/sites && docker compose up -d --build --remove-orphans && docker image prune -f >/dev/null'

echo "== Бекап щоночі о 03:30 (Київ)"
ssh "$HOST" 'timedatectl set-timezone Europe/Kyiv \
  && (crontab -l 2>/dev/null | grep -v backup.sh; echo "30 3 * * * /opt/sites/backup.sh >> /var/log/sites-backup.log 2>&1") | crontab -'

DOMAIN=$(ssh "$HOST" 'grep ^SHAFA_DOMAIN= /opt/sites/.env | cut -d= -f2')
echo "== Перевіряю https://$DOMAIN …"
for i in $(seq 1 30); do
  if curl -fsS "https://$DOMAIN/api/health" >/dev/null 2>&1; then
    echo "== Готово: https://$DOMAIN  (кабінет: https://$DOMAIN/admin)"
    exit 0
  fi
  sleep 3
done
echo "!! Сайт поки не відповідає — логи: ssh $HOST 'cd /opt/sites && docker compose logs --tail 50'"
exit 1
