# Node.js 18 Alpine base image
FROM node:18-alpine

# Chrome ve gerekli bağımlılıkları yükle
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Puppeteer'ın sistem Chrome'unu kullanmasını söyle
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Çalışma dizinini ayarla
WORKDIR /app

# Package dosyalarını kopyala
COPY package*.json ./

# Bağımlılıkları yükle
RUN npm ci --only=production

# Kaynak kodunu kopyala
COPY src/ ./src/

# Port'u expose et
EXPOSE 5000

# Uygulamayı başlat
CMD ["npm", "start"]
