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

      const environment = process.env.NODE_ENV;
      const isProduction = environment === "production";

      // Check if we're in Docker by looking for Docker-specific environment variables
      const isDocker =
        process.env.CHROMIUM_PATH &&
        process.env.CHROMIUM_PATH.includes("/usr/lib/chromium") &&
        process.env.NODE_ENV === "production";

      Logger.info(
        `Environment: ${environment}, isProduction: ${isProduction}, isDocker: ${isDocker}, CHROMIUM_PATH: ${process.env.CHROMIUM_PATH}`
      );

      const launchOptions = {
        headless: isProduction ? "new" : false,
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
        // Use Chromium path only in Docker production environment
        ...(isDocker && { executablePath: process.env.CHROMIUM_PATH }),
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
