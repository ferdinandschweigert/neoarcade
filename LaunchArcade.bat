@echo off
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%"

if not exist "%PROJECT_DIR%start_arcade.py" (
  set "PROJECT_DIR=C:\Users\ferdinandschweigert\Documents\neoarcade\"
)

if not exist "%PROJECT_DIR%start_arcade.py" (
  echo Could not find start_arcade.py.
  echo Keep this launcher in the project folder, or edit PROJECT_DIR.
  pause
  exit /b 1
)

echo ========================================
echo              NEO ARCADE
echo ========================================
echo Launching local arcade server...
echo.

cd /d "%PROJECT_DIR%"
py start_arcade.py
if errorlevel 1 python start_arcade.py
