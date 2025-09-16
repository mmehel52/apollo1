#!/bin/bash

# Azure App Service için Chrome yükleme scripti
echo "Chrome yükleniyor..."

# Chrome'u indir
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Paket listesini güncelle
apt-get update

# Chrome'u yükle
apt-get install -y google-chrome-stable

# Chrome'un yolunu bul
CHROME_PATH=$(which google-chrome)
echo "Chrome yolu: $CHROME_PATH"

# Environment variable'ı ayarla
echo "PUPPETEER_EXECUTABLE_PATH=$CHROME_PATH" >> /etc/environment

echo "Chrome yükleme tamamlandı!"
