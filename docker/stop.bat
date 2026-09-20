@echo off
REM Ferma l'applicazione. I dati del database RESTANO nel volume (nessuna perdita).
cd /d "%~dp0.."

echo Arresto Padel Tournament Manager (i dati restano salvati)...
docker compose --env-file .env -f docker/docker-compose.yml down

echo Fermato. Per riavviare: start.bat
pause
