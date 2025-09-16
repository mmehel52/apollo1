#!/bin/bash

# Azure App Service startup script
echo "Starting Apollo Scraper..."

# Chrome'u yükle
echo "Installing Chrome..."
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list
apt-get update
apt-get install -y google-chrome-stable

# Chrome'un yolunu ayarla
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

# Node.js uygulamasını başlat
echo "Starting Node.js application..."
node src/server.js
