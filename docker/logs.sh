#!/usr/bin/env bash
# Mostra i log dell'applicazione. Premi Ctrl+C per uscire.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

docker compose --env-file .env -f docker/docker-compose.yml logs -f app
