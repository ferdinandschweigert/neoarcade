#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# If this launcher was copied to Desktop, fall back to the project path.
if [ ! -f "$PROJECT_DIR/start_arcade.py" ]; then
  PROJECT_DIR="/Users/ferdinandschweigert/Documents/neoarcade"
fi

if [ ! -f "$PROJECT_DIR/start_arcade.py" ]; then
  echo "Could not find start_arcade.py."
  echo "Keep this launcher in the project folder, or edit PROJECT_DIR."
  exit 1
fi

printf "\n"
printf "========================================\n"
printf "            🎮  NEO ARCADE\n"
printf "========================================\n"
printf "Launching local arcade server...\n\n"

cd "$PROJECT_DIR"
python3 start_arcade.py
