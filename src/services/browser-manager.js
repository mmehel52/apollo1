// BrowserManager.js
const puppeteerCore = require("puppeteer-core");
const puppeteer = require("puppeteer"); // fallback
const chromium = require("chrome-aws-lambda");
const Logger = require("../logger");

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init({ headless = true } = {}) {
    try {
      Logger.info("Starting browser...");

      // Try chromium.executablePath from chrome-aws-lambda first
      let executablePath = null;
      try {
        executablePath = await chromium.executablePath;
      } catch (e) {
        // chrome-aws-lambda may throw if not available — ignore, we'll fallback
        Logger.info(
          "chrome-aws-lambda.executablePath not available, will try system paths."
        );
      }

      // Common system paths to try (App Service Linux üzerinde olası yollar)
      const systemPaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
      ];

      if (!executablePath) {
        for (const p of systemPaths) {
          if (!p) continue;
          // We can't fs.access here without importing fs; try to assign and let launch fail with useful log (dumpio)
          executablePath = p;
          break;
        }
      }

      const launchOptions = {
        headless: !!headless,
        dumpio: true, // chromium stdout/stderr'ini console'a döker — **kritik**
        args: (chromium.args || []).concat([
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-zygote",
          "--disable-features=TranslateUI",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--no-first-run",
        ]),
        timeout: 120000,
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
        Logger.info("Using Chromium executablePath:", executablePath);
      } else {
        Logger.info(
          "No executablePath found, using puppeteer's default Chromium (may fail if binary missing)."
        );
      }

      // Prefer puppeteer-core (when executablePath provided), otherwise fallback to puppeteer
      const launcher = launchOptions.executablePath ? puppeteerCore : puppeteer;

      this.browser = await launcher.launch(launchOptions);

      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      await this.page.setRequestInterception(true);
      this.page.on("request", (req) => {
        const type = req.resourceType();
        if (type === "image" || type === "stylesheet" || type === "font") {
          req.abort();
        } else {
          req.continue();
        }
      });

      Logger.success("Browser started successfully");
    } catch (error) {
      // Çok kritik: burada hem error.stack hem de process'lerin stdout/stderr'ini görmek için dumpio kullanılmalı
      Logger.error("Browser startup error:", error.stack || error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        Logger.info("Browser closed");
      } catch (e) {
        Logger.error("Error closing browser:", e.stack || e);
      }
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
