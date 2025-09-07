require("dotenv").config();
const Logger = require("./logger");
// const Scraper = require("./scrape");
// const BrowserManager = require("./browser-manager");
// const LoginService = require("./login-service");
// const DataService = require("./data-service");

// Azure Functions için HTTP trigger
module.exports = async function (context, req) {
  context.log("HTTP trigger function processed a request.");

  // Ana sayfa
  if (
    req.method === "GET" &&
    (!req.query || Object.keys(req.query).length === 0)
  ) {
    context.res = {
      status: 200,
      body: "Hello World! 🚀 Apollo.io Scraper is running on Azure Functions!",
    };
    return;
  }

  // Health check endpoint
  if (req.method === "GET" && req.query && req.query.endpoint === "health") {
    context.res = {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        status: "OK",
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
      },
    };
    return;
  }

  // Diğer istekler için
  context.res = {
    status: 200,
    body: "Hello World! 🚀 Apollo.io Scraper is running on Azure Functions!",
  };
};

// Ana scraping fonksiyonu - şimdilik yoruma alındı
/*
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
    await scraper.scrapeCompanies(5);

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

if (require.main === module) {
  main().catch(Logger.error);
}
*/
