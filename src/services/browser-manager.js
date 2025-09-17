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
          "/usr/bin/google-chrome-unstable",
          "/opt/google/chrome/chrome",
          "/opt/google/chrome/google-chrome",
          "/snap/bin/chromium",
          "/usr/local/bin/chrome",
          "/usr/local/bin/chromium",
        ];

        let chromeFound = false;
        for (const path of systemChromePaths) {
          if (fs.existsSync(path)) {
            launchOptions.executablePath = path;
            Logger.info(`Using system Chrome at: ${path}`);
            chromeFound = true;
            break;
          }
        }

        // Eğer hiçbir Chrome bulunamazsa, executablePath olmadan deneme yap
        if (!chromeFound) {
          Logger.warning(
            "No system Chrome found, trying without executablePath..."
          );
          // executablePath'i kaldır, Puppeteer'ın kendi Chrome'unu indirmesini dene
          delete launchOptions.executablePath;
        }
      }

      Logger.info(
        `Launching browser with options: ${JSON.stringify(
          launchOptions,
          null,
          2
        )}`
      );
      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();

      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      Logger.success("Browser started successfully");
    } catch (error) {
      Logger.error(`Browser startup error: ${error}`);

      // Eğer hala hata varsa, Chrome'u manuel olarak indirmeyi dene
      if (error.message.includes("Could not find Chrome")) {
        Logger.info("Attempting to install Chrome manually...");
        try {
          const { execSync } = require("child_process");
          execSync("npx puppeteer browsers install chrome", {
            stdio: "inherit",
          });
          Logger.info(
            "Chrome installation completed, retrying browser launch..."
          );

          // Tekrar dene
          this.browser = await puppeteer.launch(launchOptions);
          this.page = await this.browser.newPage();
          await this.page.setViewport({ width: 1920, height: 1080 });
          this.page.setDefaultTimeout(60000);
          this.page.setDefaultNavigationTimeout(60000);
          Logger.success(
            "Browser started successfully after manual Chrome installation"
          );
        } catch (retryError) {
          Logger.error(`Manual Chrome installation failed: ${retryError}`);
          throw error; // Orijinal hatayı fırlat
        }
      } else {
        throw error;
      }
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
