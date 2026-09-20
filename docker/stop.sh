#!/usr/bin/env bash
# Ferma l'applicazione. I dati del database RESTANO nel volume (nessuna perdita).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "Arresto Padel Tournament Manager (i dati restano salvati)..."
docker compose --env-file .env -f docker/docker-compose.yml down

echo "Fermato. Per riavviare: bash docker/start.sh"
