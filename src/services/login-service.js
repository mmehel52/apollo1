const Logger = require("../logger");

class LoginService {
  constructor(browserManager) {
    this.browserManager = browserManager;
  }

  async login(email, password) {
    try {
      Logger.info("Navigating to login page...");
      await this.browserManager
        .getPage()
        .goto("https://app.apollo.io/#/login", {
          waitUntil: "networkidle2",
        });

      await this.browserManager
        .getPage()
        .waitForSelector('input[type="email"]', {
          timeout: 10000,
        });
      await this.browserManager.getPage().type('input[type="email"]', email);
      await this.browserManager
        .getPage()
        .type('input[type="password"]', password);

      await this.browserManager.getPage().click('button[type="submit"]');

      Logger.info("Waiting for login redirect...");

      await new Promise((resolve) => setTimeout(resolve, 3000));

      Logger.success("Login successful");

      const companiesUrl =
        "https://app.apollo.io/#/companies?organizationNumEmployeesRanges[]=1%2C10&organizationLocations[]=Florida%2C%20US&qOrganizationKeywordTags[]=business%20consulting%20%26%20services&includedOrganizationKeywordFields[]=tags&includedOrganizationKeywordFields[]=name&page=1&sortAscending=true&sortByField=sanitized_organization_name_unanalyzed";

      // İstenilen sayfaya yönlendirme ve kontrol
      await this.navigateToCompaniesPage(companiesUrl);
    } catch (error) {
      Logger.error("Login error:", error);
      throw error;
    }
  }

  async navigateToCompaniesPage(targetUrl, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.info(
          `Navigating to companies page... (Attempt ${attempt}/${maxRetries})`
        );
        Logger.info("Filter: 1-10 employees, recommendations score sorting");

        await this.browserManager.getPage().goto(targetUrl, {
          waitUntil: "networkidle2",
          timeout: 60000,
        });

        // Sayfa yüklendikten sonra biraz bekle
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Mevcut URL'yi kontrol et
        const currentUrl = this.browserManager.getPage().url();
        Logger.info(`Current URL: ${currentUrl}`);

        // URL'nin doğru olup olmadığını kontrol et
        if (this.isCorrectPage(currentUrl, targetUrl)) {
          Logger.success("Successfully navigated to companies page");
          return;
        } else {
          Logger.warning(`Page navigation failed. Expected: ${targetUrl}`);
          Logger.warning(`Current: ${currentUrl}`);

          if (attempt < maxRetries) {
            Logger.info(
              `Retrying navigation... (${attempt + 1}/${maxRetries})`
            );
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

// ("https://app.apollo.io/#/companies?organizationNumEmployeesRanges[]=1%2C10&organizationLocations[]=Florida%2C%20US&qOrganizationKeywordTags[]=business%20consulting%20%26%20services&includedOrganizationKeywordFields[]=tags&includedOrganizationKeywordFields[]=name&page=1&sortAscending=true&sortByField=sanitized_organization_name_unanalyzed");

// ("https://app.apollo.io/#/companies?organizationNumEmployeesRanges[]=1%2C10&organizationLocations[]=Florida%2C%20US&qOrganizationKeywordTags[]=business%20consulting%20%26%20services&includedOrganizationKeywordFields[]=tags&includedOrganizationKeywordFields[]=name&page=1&sortAscending=false&sortByField=sanitized_organization_name_unanalyzed");
