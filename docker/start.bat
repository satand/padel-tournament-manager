@echo off
REM Avvia l'applicazione (app + database) con Docker Compose.
REM Al primo avvio costruisce l'immagine dell'app; i dati restano conservati.
cd /d "%~dp0.."

if not exist .env (
  copy .env.example .env >nul
  echo Creato .env da .env.example (valori locali di default).
)

echo Avvio Padel Tournament Manager (app + database)...
docker compose --env-file .env -f docker/docker-compose.yml up -d
if errorlevel 1 (
  echo Errore: verifica che Docker Desktop sia in esecuzione.
  pause
  exit /b 1
)

echo.
echo Fatto. Apri nel browser:  http://localhost:3000
pause
