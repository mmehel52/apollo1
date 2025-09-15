const Logger = require("../logger");

class LoginService {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async login(email, password) {
    try {
      // Environment değişkenlerini kontrol et
      if (!email || !password) {
        throw new Error(
          "Email veya password eksik! Lütfen APOLLO_EMAIL ve APOLLO_PASSWORD environment değişkenlerini ayarlayın."
        );
      }

      const loginUrl = process.env.LOGIN_URL || "https://app.apollo.io/login";
      Logger.info(`Navigating to login page: ${loginUrl}`);

      await this.browserManager.getPage().goto(loginUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Sayfa yüklenmesini bekle
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Login formunu bekle
      Logger.info("Waiting for login form...");
      await this.browserManager
        .getPage()
        .waitForSelector('input[type="email"]', {
          timeout: 15000,
        });

      // Email inputunu bul ve doldur
      Logger.info("Looking for email input...");
      const emailInput = await this.browserManager
        .getPage()
        .$('input[type="email"]');

      if (!emailInput) {
        throw new Error("Email input bulunamadı!");
      }

      Logger.info("Email input found, filling...");
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 100 });

      // Password inputunu bul ve doldur
      Logger.info("Looking for password input...");
      const passwordInput = await this.browserManager
        .getPage()
        .$('input[type="password"]');

      if (!passwordInput) {
        throw new Error("Password input bulunamadı!");
      }

      Logger.info("Password input found, filling...");
      await passwordInput.click({ clickCount: 3 });
      await passwordInput.type(password, { delay: 100 });

      // Submit buttonunu bul ve tıkla
      Logger.info("Looking for submit button...");
      const submitButton = await this.browserManager
        .getPage()
        .$('button[type="submit"]');

      if (!submitButton) {
        throw new Error("Submit button bulunamadı!");
      }

      Logger.info("Submit button found, clicking...");
      await submitButton.click();

      Logger.info("Waiting for login redirect...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Login başarısını kontrol et
      const currentUrl = this.browserManager.getPage().url();
      Logger.info(`Current URL after login: ${currentUrl}`);

      if (currentUrl.includes("/login") || currentUrl.includes("/signin")) {
        // Hata mesajını kontrol et
        const errorMessage = await this.browserManager
          .getPage()
          .evaluate(() => {
            const errorSelectors = [
              ".error-message",
              ".alert-danger",
              ".login-error",
              '[class*="error"]',
              '[class*="Error"]',
            ];

            for (const selector of errorSelectors) {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                return element.textContent.trim();
              }
            }
            return null;
          });

        if (errorMessage) {
          throw new Error(`Login hatası: ${errorMessage}`);
        } else {
          throw new Error("Login başarısız - hala login sayfasındayız");
        }
      }

      Logger.success("Login successful");

      const companiesUrl =
        process.env.COMPANY_URL || "https://app.apollo.io/companies";
      await this.navigateToCompaniesPage(companiesUrl);
    } catch (error) {
      Logger.error("Login error:", error);

      // Hata durumunda screenshot al
      try {
        await this.browserManager
          .getPage()
          .screenshot({ path: "login-error.png", fullPage: true });
        Logger.info("📸 Login error screenshot saved: login-error.png");
      } catch (screenshotError) {
        Logger.error("Screenshot error:", screenshotError);
      }

      throw error;
    }
  }

  async navigateToCompaniesPage(targetUrl, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.browserManager.getPage().goto(targetUrl, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        await new Promise((resolve) => setTimeout(resolve, 5000));

        const currentUrl = this.browserManager.getPage().url();

        if (this.isCorrectPage(currentUrl, targetUrl)) {
          Logger.success("Successfully navigated to companies page");
          return;
        } else {
          Logger.warning(`Page navigation failed. Expected: ${targetUrl}`);
          Logger.warning(`Current: ${currentUrl}`);

          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
      } catch (error) {
        Logger.error(`Navigation attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          Logger.info(`Retrying navigation... (${attempt + 1}/${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          throw error;
        }
      }
    }

    throw new Error(
      `Failed to navigate to companies page after ${maxRetries} attempts`
    );
  }

  isCorrectPage(currentUrl, targetUrl) {
    // URL'lerin temel kısımlarını karşılaştır
    const currentBase = currentUrl.split("?")[0];
    const targetBase = targetUrl.split("?")[0];

    // Ana sayfa yolu aynı mı?
    if (currentBase !== targetBase) {
      return false;
    }

    // Companies sayfasında mıyız?
    if (!currentUrl.includes("/companies")) {
      return false;
    }

    // Login sayfasında değil miyiz?
    if (currentUrl.includes("/login")) {
      return false;
    }

    // Dashboard veya başka bir sayfada değil miyiz?
    if (currentUrl.includes("/dashboard") || currentUrl.includes("/home")) {
      return false;
    }

    return true;
  }
}

module.exports = LoginService;
