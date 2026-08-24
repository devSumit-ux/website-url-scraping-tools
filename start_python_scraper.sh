#!/bin/bash
# Start Python scraping server
cd "$(dirname "$0")/python_engine"
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate 2>/dev/null || true
pip install -q -r requirements.txt 2>/dev/null || true
python3 server.py
