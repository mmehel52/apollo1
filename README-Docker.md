# Puppeteer Docker Kurulumu

Bu proje, makaledeki önerilere göre Docker ve Puppeteer kurulumunu içerir.

## Özellikler

- ✅ Chromium Docker image'ında kurulu
- ✅ Production ortamında CHROMIUM_PATH kullanımı
- ✅ Docker Compose ile kolay çalıştırma
- ✅ Test API endpointi

## Kurulum ve Çalıştırma

### 1. Docker ile Çalıştırma

```bash
# Docker Compose ile çalıştır
docker-compose up --build

# Arka planda çalıştır
docker-compose up -d --build
```

### 2. Test API

Servis çalıştıktan sonra test edin:

```bash
# GET isteği gönder
curl http://localhost:8080/api/v1/title
```

Beklenen yanıt:

```json
{
  "message": "Fetched title successfully",
  "title": "Example Domain"
}
```

### 3. Diğer Endpointler

- `GET /health` - Servis durumu
- `GET /scrabe` - Scraping işlemini başlat

## Docker Yapılandırması

### Dockerfile Değişiklikleri

1. **Chromium Kurulumu**: Docker image'ına Chromium eklendi
2. **Environment Variables**:
   - `CHROMIUM_PATH="/usr/bin/chromium"`
   - `NODE_ENV="production"`
   - `PUPPETEER_SKIP_DOWNLOAD=true`

### Browser Manager Güncellemeleri

- Production ortamında `CHROMIUM_PATH` kullanımı
- Environment kontrolü ile dinamik yapılandırma

## Sorun Giderme

### Chromium Bulunamadı Hatası

Eğer Chromium bulunamadı hatası alırsanız:

1. Docker image'ının yeniden build edildiğinden emin olun
2. Environment variable'ların doğru set edildiğini kontrol edin
3. Logları kontrol edin: `docker-compose logs`

### Port Çakışması

Eğer 8080 portu kullanımdaysa, `docker-compose.yml` dosyasında portu değiştirin:

```yaml
ports:
  - "3000:8080" # Yerel port:Container port
```

## Geliştirme

### Yerel Geliştirme

```bash
# Dependencies yükle
npm install

# Geliştirme modunda çalıştır
npm run dev
```

### Production Build

```bash
# Docker image build et
docker build -t puppeteer-app .

# Container çalıştır
docker run -p 8080:8080 puppeteer-app
```
