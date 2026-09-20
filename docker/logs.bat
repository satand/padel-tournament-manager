@echo off
REM Mostra i log dell'applicazione. Premi Ctrl+C per uscire.
cd /d "%~dp0.."

docker compose --env-file .env -f docker/docker-compose.yml logs -f app
