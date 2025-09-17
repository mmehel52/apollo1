// src/services/browser-manager.js
const fs = require("fs");
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

      // Azure sunucusu için Chrome yolu kontrolü
      const executablePath =
        puppeteer.executablePath && puppeteer.executablePath();
      Logger.info(`puppeteer.executablePath(): ${executablePath}`);

      // Chrome'un var olup olmadığını kontrol et
      if (executablePath && !fs.existsSync(executablePath)) {
        Logger.warning(
          "Chrome not found at expected path, trying system Chrome..."
        );
      }

      const launchOptions = {
        headless: true,
        dumpio: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--single-process",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      };

      // Eğer executablePath varsa ve dosya mevcutsa kullan
      if (executablePath && fs.existsSync(executablePath)) {
        launchOptions.executablePath = executablePath;
        Logger.info("Using Puppeteer's bundled Chrome");
      } else {
        // Azure'da sistem Chrome'unu kullanmaya çalış
        Logger.info("Trying to use system Chrome...");
        // Azure'da genellikle /usr/bin/google-chrome veya /usr/bin/chromium-browser
        const systemChromePaths = [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium",
          "/usr/bin/chrome",
        ];

        for (const path of systemChromePaths) {
          if (fs.existsSync(path)) {
            launchOptions.executablePath = path;
            Logger.info(`Using system Chrome at: ${path}`);
            break;
          }
        }
      }

      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();

      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      Logger.success("Browser started successfully");
    } catch (error) {
      Logger.error(`Browser startup error: ${error}`);
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
