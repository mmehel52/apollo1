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

  async init({ headless = false, useProxy = false } = {}) {
    try {
      Logger.info("Starting browser...");

      const isAzure = true;

      // Denenecek olası binary yolları
      const possiblePaths = [
        process.env.PUPPETEER_EXECUTABLE_PATH,
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
      ].filter(Boolean);

      // Gerçekten var olan ilk yolu bul
      let chromePath = possiblePaths.find((p) => {
        try {
          return fs.existsSync(p);
        } catch (e) {
          return false;
        }
      });

      if (isAzure) {
        Logger.info(
          `Azure detected${
            chromePath
              ? `, using Chrome path: ${chromePath}`
              : ", no system Chrome found"
          }`
        );
      } else {
        Logger.info("Local environment detected");
      }

      if (!chromePath) {
        Logger.warning(
          "Chrome/Chromium binary bulunamadı. Eğer sistemde yoksa 'puppeteer' paketini yükleyip Puppeteer'ın kendi Chromium'unu kullanın."
        );
        Logger.warning("Örnek: npm install puppeteer");
      }

      // Temizlenmiş args listesi (çoğaltılmış seçenekler kaldırıldı)
      const commonArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
        "--disable-features=TranslateUI,BlinkGenPropertyTrees",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
        "--disable-sync",
        "--disable-extensions",
        "--hide-scrollbars",
        "--mute-audio",
        "--no-first-run",
        "--disable-web-security",
        "--disable-client-side-phishing-detection",
        "--disable-default-apps",
        "--disable-hang-monitor",
        "--disable-prompt-on-repost",
        "--force-color-profile=srgb",
        "--metrics-recording-only",
        "--password-store=basic",
        "--use-mock-keychain",
        "--disable-blink-features=AutomationControlled",
      ];

      // Launch options
      const launchOptions = {
        headless: isAzure ? true : headless, // Azure'da headless true
        defaultViewport: null,
        args: commonArgs,
        timeout: 60000,
        dumpio: false,
      };

      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }

      // Eğer proxy kullanılıyorsa args ekle (örnek, isteğe bağlı)
      if (useProxy && process.env.PROXY_SERVER) {
        Logger.info(`Proxy kullanılıyor: ${process.env.PROXY_SERVER}`);
        launchOptions.args.push(`--proxy-server=${process.env.PROXY_SERVER}`);
      }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();

      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      );

      await this.page.setExtraHTTPHeaders({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
      });

      // WebDriver özelliğini gizle
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
      });

      // Chrome runtime gizleme
      await this.page.evaluateOnNewDocument(() => {
        window.chrome = { runtime: {} };
      });

      // Permissions API patch (notifications için)
      await this.page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters && parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);

      // İsteğe bağlı cookie örnekleri (domain'i ihtiyaçlarına göre değiştir)
      try {
        await this.page.setCookie(
          {
            name: "_ga",
            value:
              "GA1.2." +
              Math.random().toString(36).substr(2, 9) +
              "." +
              Date.now(),
            domain: ".apollo.io",
          },
          {
            name: "_gid",
            value:
              "GA1.2." +
              Math.random().toString(36).substr(2, 9) +
              "." +
              Date.now(),
            domain: ".apollo.io",
          }
        );
      } catch (cookieErr) {
        Logger.warning(
          "Cookie setleme sırasında hata (muhtemelen domain uyumsuzluğu): " +
            cookieErr.message
        );
      }

      // Basit request interception örneği (font'ları engelle)
      await this.page.setRequestInterception(true);
      this.page.on("request", (req) => {
        const type = req.resourceType();
        if (req.url().includes("apollo.io")) {
          req.continue({
            headers: {
              ...req.headers(),
              Referer: "https://www.google.com/",
              Origin: "https://apollo.io",
            },
          });
          return;
        }
        if (type === "font") {
          req.abort();
        } else {
          req.continue();
        }
      });

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

  async bypassCloudflare() {
    try {
      Logger.info("Cloudflare verification ekranını geçmeye çalışıyor...");
      await this.page.waitForFunction(
        () => document.readyState === "complete",
        { timeout: 30000 }
      );

      const isCloudflareChallenge = await this.page.evaluate(() => {
        const html = document.body ? document.body.innerHTML.toLowerCase() : "";
        return (
          html.includes("cloudflare") ||
          html.includes("verifying") ||
          html.includes("checking your browser")
        );
      });

      if (!isCloudflareChallenge) return true;

      Logger.info(
        "Cloudflare challenge tespit edildi, insan benzeri davranış simülasyonu başlatılıyor..."
      );

      // Basit insan benzeri hareketler
      const mouseMovements = [
        { x: 100, y: 100 },
        { x: 250, y: 150 },
        { x: 400, y: 200 },
        { x: 300, y: 300 },
        { x: 150, y: 250 },
      ];

      for (const m of mouseMovements) {
        await this.page.mouse.move(m.x, m.y, { steps: 10 });
        await this.page.waitForTimeout(Math.random() * 1000 + 500);
      }

      const scrollPositions = [0, 100, 200, 50, 0];
      for (const pos of scrollPositions) {
        await this.page.evaluate((p) => window.scrollTo(0, p), pos);
        await this.page.waitForTimeout(Math.random() * 2000 + 1000);
      }

      await this.page.keyboard.press("Tab");
      await this.page.waitForTimeout(500);
      await this.page.keyboard.press("Space");
      await this.page.waitForTimeout(500);

      let attempts = 0;
      const maxAttempts = 45;
      while (attempts < maxAttempts) {
        await this.page.waitForTimeout(1000);
        const challengePassed = await this.page.evaluate(() => {
          const h = document.body ? document.body.innerHTML.toLowerCase() : "";
          return (
            !h.includes("verifying") &&
            !h.includes("checking your browser") &&
            !h.includes("cloudflare")
          );
        });
        if (challengePassed) {
          Logger.success("Cloudflare challenge başarıyla geçildi!");
          return true;
        }
        attempts++;
        if (attempts % 10 === 0) {
          await this.page.mouse.move(Math.random() * 500, Math.random() * 500);
          await this.page.waitForTimeout(1000);
        }
      }

      Logger.warning("Cloudflare challenge geçilemedi.");
      return false;
    } catch (err) {
      Logger.error("Cloudflare bypass hatası:", err);
      return false;
    }
  }
}

module.exports = BrowserManager;
