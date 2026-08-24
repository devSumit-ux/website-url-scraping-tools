#!/bin/bash
set -e

# Start Python backend engine in background on port 8000
echo "Starting Python Scraper Engine on port 8000..."
python3 python_engine/server.py &

# Wait for Python engine to start
sleep 2

# Start Next.js frontend on assigned $PORT
PORT=${PORT:-3000}
echo "Starting Next.js frontend on port $PORT..."
exec npx next start -p "$PORT"
