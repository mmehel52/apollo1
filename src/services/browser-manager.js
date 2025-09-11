const puppeteer = require("puppeteer");
const Logger = require("../logger");

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    try {
      Logger.info("Starting browser...");

      // Sunucu ortamı için headless modu ve ek argümanlar
      const isProduction =
        process.env.NODE_ENV === "production" ||
        process.env.ENVIRONMENT === "production";

      this.browser = await puppeteer.launch({
        headless: isProduction ? "new" : false, // Sunucuda headless, local'de görsel
        defaultViewport: null,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-images", // Resimleri yükleme (performans için)
          "--disable-javascript", // JavaScript'i devre dışı bırak (gerekirse)
          "--no-first-run",
          "--no-zygote",
          "--single-process", // Tek process kullan (sunucu için)
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--memory-pressure-off",
          "--max_old_space_size=4096", // Memory limit
        ],
        // Sunucuda Chrome path'i belirt
        executablePath: isProduction ? "/usr/bin/chromium-browser" : undefined,
        timeout: 60000, // 60 saniye timeout
      });

      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Sunucu ortamı için ek ayarlar
      if (isProduction) {
        // Viewport ayarla
        await this.page.setViewport({ width: 1920, height: 1080 });

        // Timeout ayarları
        this.page.setDefaultTimeout(60000);
        this.page.setDefaultNavigationTimeout(60000);

        // Request interception (performans için)
        await this.page.setRequestInterception(true);
        this.page.on("request", (req) => {
          const resourceType = req.resourceType();
          if (
            resourceType === "image" ||
            resourceType === "stylesheet" ||
            resourceType === "font"
          ) {
            req.abort();
          } else {
            req.continue();
          }
        });
      }

      Logger.success("Browser started successfully");
    } catch (error) {
      Logger.error("Browser startup error:", error);

      // Sunucu ortamı için özel hata mesajları
      if (error.message.includes("Could not find browser")) {
        Logger.error(
          "❌ Chrome/Chromium bulunamadı! Lütfen sunucuya Chrome kurun."
        );
        Logger.error(
          "💡 Kurulum için: sudo apt-get install -y chromium-browser"
        );
      } else if (
        error.message.includes("Failed to launch the browser process")
      ) {
        Logger.error(
          "❌ Browser başlatılamadı! Sistem bağımlılıkları eksik olabilir."
        );
        Logger.error(
          "💡 Kurulum için: sudo apt-get install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libasound2"
        );
      } else if (error.message.includes("No usable sandbox")) {
        Logger.error("❌ Sandbox hatası! --no-sandbox argümanı kullanılıyor.");
      } else if (error.message.includes("timeout")) {
        Logger.error(
          "❌ Browser başlatma zaman aşımı! Sunucu kaynakları yetersiz olabilir."
        );
      }

      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      Logger.info("Browser closed");
    }
  }

  getPage() {
    return this.page;
  }

  getBrowser() {
    return this.browser;
  }
}

module.exports = BrowserManager;
