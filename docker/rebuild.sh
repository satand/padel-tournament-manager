#!/usr/bin/env bash
# Ricostruisce l'immagine dell'app e la riavvia DOPO una modifica al software.
# Non tocca il database: tornei e risultati restano intatti.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Creato .env da .env.example (valori locali di default)."
fi

echo "Ricostruzione dell'applicazione (i dati del database non vengono toccati)..."
docker compose --env-file .env -f docker/docker-compose.yml up -d --build app

echo
echo "Fatto. Apri nel browser:  http://localhost:3000"
