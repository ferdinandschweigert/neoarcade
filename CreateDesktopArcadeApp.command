#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

# If this launcher was copied elsewhere, fall back to the project path.
if [ ! -f "$PROJECT_DIR/start_arcade.py" ]; then
  PROJECT_DIR="/Users/ferdinandschweigert/Documents/neoarcade"
fi

if [ ! -f "$PROJECT_DIR/start_arcade.py" ]; then
  echo "Could not find start_arcade.py."
  echo "Set PROJECT_DIR in this file to your arcade repo path."
  exit 1
fi

if [ ! -f "$PROJECT_DIR/scripts/build_mac_icon.py" ]; then
  echo "Missing scripts/build_mac_icon.py."
  exit 1
fi

python3 "$PROJECT_DIR/scripts/build_mac_icon.py"

APP_PATH="$HOME/Desktop/Neo Arcade.app"
CONTENTS_PATH="$APP_PATH/Contents"
MACOS_PATH="$CONTENTS_PATH/MacOS"
RESOURCES_PATH="$CONTENTS_PATH/Resources"
EXECUTABLE_NAME="neo-arcade-launcher"
EXECUTABLE_PATH="$MACOS_PATH/$EXECUTABLE_NAME"
ICON_SOURCE="$PROJECT_DIR/assets/arcade-mark.icns"
ICON_TARGET="$RESOURCES_PATH/arcade.icns"
PLIST_PATH="$CONTENTS_PATH/Info.plist"

rm -rf "$APP_PATH"
mkdir -p "$MACOS_PATH" "$RESOURCES_PATH"

cat > "$EXECUTABLE_PATH" <<EOF
#!/bin/bash
set -e

PROJECT_DIR="$PROJECT_DIR"
SERVER_SCRIPT="\$PROJECT_DIR/start_arcade.py"
LOG_FILE="/tmp/neo_arcade.log"

if [ ! -f "\$SERVER_SCRIPT" ]; then
  /usr/bin/osascript <<'OSA'
display dialog "Could not find start_arcade.py." buttons {"OK"} default button "OK" with icon caution
OSA
  exit 1
fi

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PYTHON_BIN="\$(command -v python3 || true)"
if [ -z "\$PYTHON_BIN" ]; then
  /usr/bin/osascript <<'OSA'
display dialog "python3 was not found on this Mac." buttons {"OK"} default button "OK" with icon caution
OSA
  exit 1
fi

cd "\$PROJECT_DIR"
nohup "\$PYTHON_BIN" "\$SERVER_SCRIPT" >"\$LOG_FILE" 2>&1 &
EOF

chmod +x "$EXECUTABLE_PATH"

if [ -f "$ICON_SOURCE" ]; then
  cp "$ICON_SOURCE" "$ICON_TARGET"
fi

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Neo Arcade</string>
  <key>CFBundleExecutable</key>
  <string>$EXECUTABLE_NAME</string>
  <key>CFBundleIconFile</key>
  <string>arcade.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.neoarcade.desktop</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Neo Arcade</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>10.13</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
EOF

touch "$APP_PATH"

echo
echo "Created desktop app:"
echo "  $APP_PATH"
echo
echo "If you still see the old icon, remove existing Neo Arcade.app from Desktop and run this again."
