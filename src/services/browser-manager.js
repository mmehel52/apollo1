const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const Logger = require("../logger");

// Stealth plugin'ini ekle
puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init({ headless = false, useProxy = false } = {}) {
    try {
      Logger.info("Starting browser...");

      // Azure App Service için Chrome yolu
      const isAzure = true;
      const chromePath = isAzure
        ? "/usr/bin/google-chrome"
        : process.env.PUPPETEER_EXECUTABLE_PATH;

      const launchOptions = {
        headless: isAzure ? true : headless, // Azure'da her zaman headless
        defaultViewport: null,
        executablePath: chromePath,
        args: [
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
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-background-networking",
          "--disable-sync",
          "--disable-translate",
          "--hide-scrollbars",
          "--mute-audio",
          "--no-default-browser-check",
          "--no-pings",
          "--password-store=basic",
          "--use-mock-keychain",
          "--disable-blink-features=AutomationControlled",
          "--disable-features=VizDisplayCompositor",
          "--disable-ipc-flooding-protection",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-client-side-phishing-detection",
          "--disable-sync",
          "--disable-default-apps",
          "--disable-hang-monitor",
          "--disable-prompt-on-repost",
          "--disable-domain-reliability",
          "--disable-component-extensions-with-background-pages",
          "--disable-background-networking",
          "--disable-features=TranslateUI,BlinkGenPropertyTrees",
          "--enable-features=NetworkService,NetworkServiceLogging",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--no-first-run",
          "--enable-automation",
          "--password-store=basic",
          "--use-mock-keychain",
          // Azure App Service için ek args
          "--single-process",
          "--disable-background-timer-throttling",
          "--disable-renderer-backgrounding",
          "--disable-backgrounding-occluded-windows",
          "--disable-client-side-phishing-detection",
          "--disable-sync",
          "--disable-default-apps",
          "--disable-hang-monitor",
          "--disable-prompt-on-repost",
          "--disable-domain-reliability",
          "--disable-component-extensions-with-background-pages",
          "--disable-background-networking",
          "--disable-features=TranslateUI,BlinkGenPropertyTrees",
          "--enable-features=NetworkService,NetworkServiceLogging",
          "--force-color-profile=srgb",
          "--metrics-recording-only",
          "--no-first-run",
          "--enable-automation",
          "--password-store=basic",
          "--use-mock-keychain",
        ],
        timeout: 60000,
        dumpio: false,
      };
      // Proxy ayarları
      // if (useProxy) {
      //   Logger.info("Proxy kullanılıyor: 4.239.245.88:3128");
      //   launchOptions.args.push("--proxy-server=http://4.239.245.88:3128");
      //   // Proxy için ek ayarlar
      //   launchOptions.args.push("--proxy-bypass-list=<-loopback>");
      //   launchOptions.args.push("--disable-proxy-certificate-handler");
      //   launchOptions.args.push("--ignore-certificate-errors");
      //   launchOptions.args.push("--ignore-ssl-errors");
      //   launchOptions.args.push("--ignore-certificate-errors-spki-list");
      //   launchOptions.args.push("--disable-web-security");
      //   launchOptions.args.push("--allow-running-insecure-content");
      // }

      this.browser = await puppeteer.launch(launchOptions);
      this.page = await this.browser.newPage();
      // Daha gerçekçi user agent
      await this.page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
      );
      // Gerekli header'ları ekle
      await this.page.setExtraHTTPHeaders({
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      });
      // WebDriver özelliklerini gizle
      await this.page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });
      });

      // Chrome runtime'ı gizle
      await this.page.evaluateOnNewDocument(() => {
        window.chrome = {
          runtime: {},
        };
      });
      // Permissions API'yi gizle
      await this.page.evaluateOnNewDocument(() => {
        const originalQuery = window.navigator.permissions.query;
        return (window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters));
      });
      // viewport ve timeout ayarları
      await this.page.setViewport({ width: 1920, height: 1080 });
      this.page.setDefaultTimeout(60000);
      this.page.setDefaultNavigationTimeout(60000);
      // Cookie'leri ayarla
      await this.page.setCookie({
        name: "_ga",
        value:
          "GA1.2." + Math.random().toString(36).substr(2, 9) + "." + Date.now(),
        domain: ".apollo.io",
      });
      await this.page.setCookie({
        name: "_gid",
        value:
          "GA1.2." + Math.random().toString(36).substr(2, 9) + "." + Date.now(),
        domain: ".apollo.io",
      });
      await this.page.setCookie({
        name: "_fbp",
        value:
          "fb.1." + Date.now() + "." + Math.random().toString(36).substr(2, 9),
        domain: ".apollo.io",
      });
      // Cloudflare için daha az agresif filtreleme
      await this.page.setRequestInterception(true);
      this.page.on("request", (req) => {
        const type = req.resourceType();

        // Referer header'ını ekle
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
        // Sadece font'ları engelle, CSS ve resimleri bırak
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

  // Cloudflare verification ekranını geçmek için özel fonksiyon
  async bypassCloudflare() {
    try {
      Logger.info("Cloudflare verification ekranını geçmeye çalışıyor...");
      // Sayfanın yüklenmesini bekle
      await this.page.waitForFunction(
        () => document.readyState === "complete",
        { timeout: 30000 }
      );

      // Cloudflare challenge'ı kontrol et
      const isCloudflareChallenge = await this.page.evaluate(() => {
        return (
          document.body.innerHTML.includes("cloudflare") ||
          document.body.innerHTML.includes("Verifying") ||
          document.body.innerHTML.includes("Checking your browser")
        );
      });

      if (isCloudflareChallenge) {
        Logger.info(
          "Cloudflare challenge tespit edildi, proxy ile geçmeye çalışıyor..."
        );

        // İnsan benzeri davranış simülasyonu
        Logger.info("İnsan benzeri davranış simülasyonu başlatılıyor...");

        // Rastgele mouse hareketleri
        const mouseMovements = [
          { x: 100, y: 100 },
          { x: 250, y: 150 },
          { x: 400, y: 200 },
          { x: 300, y: 300 },
          { x: 150, y: 250 },
        ];

        for (const movement of mouseMovements) {
          await this.page.mouse.move(movement.x, movement.y, { steps: 10 });
          await this.page.waitForTimeout(Math.random() * 1000 + 500);
        }

        // Rastgele scroll hareketleri
        const scrollPositions = [0, 100, 200, 50, 0];
        for (const position of scrollPositions) {
          await this.page.evaluate((pos) => {
            window.scrollTo(0, pos);
          }, position);
          await this.page.waitForTimeout(Math.random() * 2000 + 1000);
        }

        // Rastgele tuş basımları
        await this.page.keyboard.press("Tab");
        await this.page.waitForTimeout(500);
        await this.page.keyboard.press("Space");
        await this.page.waitForTimeout(500);

        // Challenge'ın geçmesini bekle (maksimum 45 saniye - proxy ile daha uzun sürebilir)
        let attempts = 0;
        const maxAttempts = 45;

        while (attempts < maxAttempts) {
          await this.page.waitForTimeout(1000);

          const challengePassed = await this.page.evaluate(() => {
            return (
              !document.body.innerHTML.includes("Verifying") &&
              !document.body.innerHTML.includes("Checking your browser") &&
              !document.body.innerHTML.includes("cloudflare")
            );
          });

          if (challengePassed) {
            Logger.success("Cloudflare challenge proxy ile başarıyla geçildi!");
            return true;
          }

          attempts++;
          Logger.info(`Challenge geçme denemesi: ${attempts}/${maxAttempts}`);

          // Her 10 denemede bir rastgele hareket yap
          if (attempts % 10 === 0) {
            await this.page.mouse.move(
              Math.random() * 500,
              Math.random() * 500
            );
            await this.page.waitForTimeout(1000);
          }
        }

        Logger.warning(
          "Cloudflare challenge proxy ile geçilemedi, devam ediliyor..."
        );
        return false;
      }

      return true;
    } catch (error) {
      Logger.error("Cloudflare bypass hatası:", error);
      return false;
    }
  }
}

module.exports = BrowserManager;
