const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();
const Logger = require("./logger");
const { main } = require("./services/main");
const BrowserManager = require("./services/browser-manager");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// cron.schedule("0 * * * *", async () => {
//   Logger.info("Scrapping app cron");
//   await main();
//   Logger.success("Scrapped ap");
// });

app.get("/scrabe", async (req, res) => {
  Logger.info("Scrapping app cron");
  await main();
  Logger.success("Scrapped app");
  res.json({
    status: "Scrapped app",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "hola mundo",
    timestamp: new Date().toISOString(),
  });
});

// Test API endpoint for Puppeteer in Docker
app.get("/api/v1/title", async (req, res) => {
  try {
    const browserManager = new BrowserManager();
    await browserManager.init();

    const page = browserManager.getPage();
    await page.goto("https://example.com");

    const title = await page.title();

    await browserManager.close();

    res.json({
      message: "Fetched title successfully",
      title: title,
    });
  } catch (error) {
    Logger.error(`API Error: ${error.message}`);
    res.status(500).json({
      message: "Error fetching title",
      error: error.message,
    });
  }
});

// Start server
app.listen(PORT, async () => {
  Logger.success(`🚀  Server running on port ${PORT}`);
});

module.exports = app;
