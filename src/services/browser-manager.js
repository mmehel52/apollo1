// src/services/browser-manager.js
const fs = require("fs");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const Logger = require("../logger");

puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init({ headless = false } = {}) {
    try {
      Logger.info("Starting browser...");

      // Chrome path kontrolü
      let chromePath;
      const possiblePaths = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/opt/google/chrome/chrome",
        "/opt/google/chrome/google-chrome",
        process.env.PUPPETEER_EXECUTABLE_PATH,
      ].filter(Boolean);

      chromePath = possiblePaths.find((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });

      if (!chromePath) {
        Logger.info(
          "System Chrome not found, using Puppeteer's bundled Chrome"
        );
        chromePath = undefined;
      } else {
        Logger.info(`Using Chrome at: ${chromePath}`);
      }

      // Basit args listesi
      const commonArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ];

      // Launch options
      const launchOptions = {
        headless: headless,
        defaultViewport: null,
        args: commonArgs,
        timeout: 60000,
      };

      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      Logger.success("Browser started successfully");
    } catch (error) {
      Logger.error("Browser startup error:", error);
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
