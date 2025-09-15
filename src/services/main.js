const Logger = require("../logger");
const Scraper = require("./scrape");
const BrowserManager = require("./browser-manager");
const LoginService = require("./login-service");
const DataService = require("./data-service");

async function main() {
  const browserManager = new BrowserManager();
  const dataService = new DataService();
  const scraper = new Scraper(browserManager, dataService);
  const loginService = new LoginService(browserManager);

  try {
    Logger.info("🚀 Apollo.io Scraper starting...");
    Logger.info("🌐 Puppeteer browser scraping...");

    // Start browser
    await browserManager.init();

    // Login credentials (environment variables)
    const email = process.env.APOLLO_EMAIL;
    const password = process.env.APOLLO_PASSWORD;

    // Login
    await loginService.login(email, password);

    // Scrape company data (5 pages)
    await scraper.scrapeCompanies(2);

    // Save data
    await dataService.saveToJSON();

    // Show stats
    const stats = dataService.getStats();
    Logger.info(`Scraping completed! Stats: ${JSON.stringify(stats, null, 2)}`);

    Logger.success("🎉 Puppeteer scraping completed!");

    await browserManager.close();
  } catch (error) {
    Logger.error("Main process error:", error);
  }
}

module.exports = { main };
