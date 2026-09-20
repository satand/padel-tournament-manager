@echo off
REM Ricostruisce l'immagine dell'app e la riavvia DOPO una modifica al software.
REM Non tocca il database: tornei e risultati restano intatti.
cd /d "%~dp0.."

if not exist .env (
  copy .env.example .env >nul
  echo Creato .env da .env.example (valori locali di default).
)

echo Ricostruzione dell'applicazione (i dati del database non vengono toccati)...
docker compose --env-file .env -f docker/docker-compose.yml up -d --build app
if errorlevel 1 (
  echo Errore di build. Controlla i messaggi qui sopra.
  pause
  exit /b 1
)

echo.
echo Fatto. Apri nel browser:  http://localhost:3000
pause
