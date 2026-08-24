#!/bin/bash
set -e

# Start Python backend engine in background on port 8000
echo "Starting Python Scraper Engine on port 8000..."
python3 python_engine/server.py &

# Wait for Python engine to be fully ready
for i in {1..30}; do
  if curl -s http://127.0.0.1:8000/health > /dev/null; then
    echo "Python Scraper Engine is healthy and ready!"
    break
  fi
  echo "Waiting for Python Scraper Engine (attempt $i/30)..."
  sleep 1
done

# Start Next.js frontend on assigned $PORT
PORT=${PORT:-3000}
echo "Starting Next.js frontend on port $PORT..."
exec npx next start -H 0.0.0.0 -p "$PORT"
