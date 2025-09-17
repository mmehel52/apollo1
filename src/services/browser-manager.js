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

      Logger.info(
        "puppeteer.executablePath():",
        puppeteer.executablePath && puppeteer.executablePath()
      );
      this.browser = await puppeteer.launch({
        headless: true,
        dumpio: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      });

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
