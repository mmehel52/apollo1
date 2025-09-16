#!/bin/bash

# Azure App Service startup script
echo "Starting Apollo Scraper..."

# Chrome'u yükle
echo "Installing Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# Chrome'un yolunu kontrol et
if [ -f "/usr/bin/google-chrome" ]; then
    echo "Chrome successfully installed at /usr/bin/google-chrome"
else
    echo "Chrome installation failed, trying alternative path..."
    # Alternatif yolları dene
    CHROME_PATHS=("/usr/bin/google-chrome" "/usr/bin/chromium-browser" "/usr/bin/chromium")
    for path in "${CHROME_PATHS[@]}"; do
        if [ -f "$path" ]; then
            echo "Found Chrome at: $path"
            export PUPPETEER_EXECUTABLE_PATH="$path"
            break
        fi
    done
fi

# Node.js uygulamasını başlat
echo "Starting Node.js application..."
node src/server.js
