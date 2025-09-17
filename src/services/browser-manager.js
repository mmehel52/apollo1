// src/services/browser-manager.js
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

      const launchOptions = {
        executablePath: puppeteer.executablePath(),
        headless: process.env.NODE_ENV === "production" ? "new" : false,
        dumpio: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--no-zygote",
          "--single-process",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
      };

      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();

      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      Logger.success("Browser started successfully");
    } catch (error) {
      Logger.error(`Browser startup error: ${error}`);
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
