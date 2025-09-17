#!/bin/bash

# Azure App Service için startup script
echo "Starting Apollo Scraper on Azure..."

# Chrome'u yükle (eğer yoksa)
echo "Installing Chrome dependencies..."
apt-get update
apt-get install -y wget gnupg

# Google Chrome repository'sini ekle
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Chrome'u yükle
apt-get update
apt-get install -y google-chrome-stable

# Puppeteer Chrome'unu yükle
echo "Installing Puppeteer Chrome..."
npx puppeteer browsers install chrome

# Node.js uygulamasını başlat
echo "Starting Node.js application..."
npm start
