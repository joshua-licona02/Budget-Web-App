#!/usr/bin/env sh
# Serves the dashboard at http://localhost:8080 so the Ollama advisor can reach
# http://localhost:11434 (Ollama rejects requests from pages opened as files).
cd "$(dirname "$0")" || exit 1
PORT=8080

if command -v python3 >/dev/null 2>&1; then
  PY=python3
else
  PY=python
fi

echo "Budget dashboard: http://localhost:$PORT/"
echo "Keep this window open while using the app. Press Ctrl+C to stop."

# Open the browser once the server is up (macOS: open, Linux: xdg-open).
(sleep 1; (command -v open >/dev/null 2>&1 && open "http://localhost:$PORT/") ||
  (command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:$PORT/")) >/dev/null 2>&1 &

exec "$PY" -m http.server "$PORT" --bind 127.0.0.1
