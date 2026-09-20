#!/usr/bin/env bash
# Avvia l'applicazione (app + database) con Docker Compose.
# Al primo avvio costruisce l'immagine dell'app; i dati restano conservati.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Creato .env da .env.example (valori locali di default)."
fi

echo "Avvio Padel Tournament Manager (app + database)..."
docker compose --env-file .env -f docker/docker-compose.yml up -d

echo
echo "Fatto. Apri nel browser:  http://localhost:3000"
echo "Per fermare:              bash docker/stop.sh"
echo "Per seguire i log:        bash docker/logs.sh"
