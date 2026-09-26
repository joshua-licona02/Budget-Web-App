@echo off
rem Serves the dashboard at http://localhost:8080 so the Ollama advisor can reach
rem http://localhost:11434 (Ollama rejects requests from pages opened as files).
cd /d "%~dp0"
set PORT=8080

where py >nul 2>nul && (set PY=py) || (set PY=python)

echo Budget dashboard: http://localhost:%PORT%/
echo Keep this window open while using the app. Press Ctrl+C to stop.
start "" "http://localhost:%PORT%/"
%PY% -m http.server %PORT% --bind 127.0.0.1
