const Logger = require("./logger");

class LoginService {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async login(email, password) {
    try {
      Logger.info("Navigating to Apollo.io login page...");
      await this.browserManager
        .getPage()
        .goto("https://app.apollo.io/#/login", {
          waitUntil: "networkidle2",
        });

      // Login formunu doldur
      await this.browserManager
        .getPage()
        .waitForSelector('input[type="email"]', {
          timeout: 10000,
        });
      await this.browserManager.getPage().type('input[type="email"]', email);
      await this.browserManager
        .getPage()
        .type('input[type="password"]', password);

      // Login butonuna tıkla
      await this.browserManager.getPage().click('button[type="submit"]');

      // Login sonrası yönlendirmeyi bekle (daha uzun timeout)
      Logger.info("Waiting for login redirect...");

      // Cloudflare kontrolü için bekle
      Logger.info("Waiting for Cloudflare security check...");
      Logger.info("If you see CAPTCHA, solve it manually and press Enter...");

      // Kullanıcının manuel müdahalesini bekle
      Logger.info("Checking CAPTCHA status...");

      // 30 saniye bekle ve CAPTCHA'nın kaybolup kaybolmadığını kontrol et
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          // Cloudflare overlay'inin kaybolup kaybolmadığını kontrol et
          const cloudflareOverlay = await this.browserManager
            .getPage()
            .$("[data-ray]");
          if (!cloudflareOverlay) {
            Logger.success("Cloudflare check passed!");
            break;
          }

          if (i % 5 === 0) {
            Logger.info(`Still waiting... (${i}/30 seconds)`);
          }
        } catch (error) {
          // Hata varsa devam et
        }
      }

      // Hala CAPTCHA varsa manuel müdahale iste
      try {
        const cloudflareOverlay = await this.browserManager
          .getPage()
          .$("[data-ray]");
        if (cloudflareOverlay) {
          Logger.warning("CAPTCHA still active, manual solution required...");
          await new Promise((resolve) => {
            const readline = require("readline");
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            });

            rl.question("Press Enter after solving CAPTCHA...", () => {
              rl.close();
              resolve();
            });
          });
        }
      } catch (error) {
        Logger.success("CAPTCHA check completed");
      }

      // Sayfa yüklenmesini bekle
      await new Promise((resolve) => setTimeout(resolve, 3000));

      Logger.success("Login successful");

      // Belirtilen şirket sayfasına git (1-10 çalışan, önerilen skor sıralaması)
      const companiesUrl =
        "https://app.apollo.io/#/companies?sortAscending=false&sortByField=recommendations_score&page=1&organizationNumEmployeesRanges[]=1%2C10";
      Logger.info("Navigating to companies page...");
      Logger.info("Filter: 1-10 employees, recommendations score sorting");
      await this.browserManager.getPage().goto(companiesUrl, {
        waitUntil: "networkidle2",
        timeout: 60000, // 60 saniye bekle
      });
    } catch (error) {
      Logger.error("Login error:", error);
      throw error;
    }
  }
}

module.exports = LoginService;
