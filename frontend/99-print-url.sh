#!/bin/sh
# Runs from nginx's /docker-entrypoint.d before nginx starts. Waits in the background
# until the backend answers through the proxy, then prints where to open the app,
# so the banner is the last thing `docker compose up` shows.
url="${PUBLIC_URL:-http://localhost:${FRONTEND_PORT:-5173}}"
(
  i=0
  until wget -q -O /dev/null http://127.0.0.1/health 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 180 ]; then
      echo "Бэкенд не отвечает на /health уже 3 минуты: docker compose logs backend"
      exit 0
    fi
    sleep 1
  done
  echo ""
  echo "=================================================="
  echo "  Приложение готово: $url"
  echo "  Каталог:           $url/catalog"
  echo "  API:               $url/api/meta"
  echo "=================================================="
  echo ""
  # Stay alive: an exiting child makes nginx log SIGCHLD notices after the banner.
  exec sleep 2147483647
) &
