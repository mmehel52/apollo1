const Logger = require("../logger");

class LoginService {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async login(email, password) {
    try {
      const loginUrl = process.env.LOGIN_URL;
      Logger.info(`Navigating to login page: ${loginUrl}`);

      await this.browserManager.getPage().goto(loginUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      await new Promise((resolve) => setTimeout(resolve, 5000));

      Logger.info("Waiting for login form...");
      await this.browserManager
        .getPage()
        .waitForSelector('input[type="email"]', {
          timeout: 15000,
        });

      Logger.info("Looking for email input...");
      const emailInput = await this.browserManager
        .getPage()
        .$('input[type="email"]');

      if (!emailInput) {
        throw new Error("Email input not found!");
      }

      Logger.info("Email input found, filling...");
      await emailInput.click({ clickCount: 3 });
      await emailInput.type(email, { delay: 100 });

      Logger.info("Looking for password input...");
      const passwordInput = await this.browserManager
        .getPage()
        .$('input[type="password"]');

      if (!passwordInput) {
        throw new Error("Password input not found!");
      }

      Logger.info("Password input found, filling...");
      await passwordInput.click({ clickCount: 3 });
      await passwordInput.type(password, { delay: 100 });

      Logger.info("Looking for submit button...");
      const submitButton = await this.browserManager
        .getPage()
        .$('button[type="submit"]');

      if (!submitButton) {
        throw new Error("Submit button not found!");
      }

      Logger.info("Submit button found, clicking...");
      await submitButton.click();

      Logger.info("Waiting for login redirect...");
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const currentUrl = this.browserManager.getPage().url();

      if (currentUrl.includes("/login") || currentUrl.includes("/signin")) {
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
          throw new Error(`Login error: ${errorMessage}`);
        } else {
          throw new Error("Login failed - still on login page");
        }
      }

      Logger.success("Login successful");

      const companiesUrl = process.env.COMPANY_URL;
      await this.navigateToCompaniesPage(companiesUrl);
    } catch (error) {
      Logger.error(`Login error: ${error}`);

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
        Logger.error(`Navigation attempt ${attempt} failed: ${error}`);

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
    const currentBase = currentUrl.split("?")[0];
    const targetBase = targetUrl.split("?")[0];

    if (currentBase !== targetBase) {
      return false;
    }

    if (!currentUrl.includes("/companies")) {
      return false;
    }

    if (currentUrl.includes("/login")) {
      return false;
    }

    return true;
  }
}

module.exports = LoginService;
