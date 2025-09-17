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

      const executablePath =
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath();

      const launchOptions = {
        executablePath: executablePath,
        headless: false,
        dumpio: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--no-zygote",
          "--single-process",
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
