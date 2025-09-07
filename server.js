require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Logger = require("./logger");
const Scraper = require("./scrape");
const BrowserManager = require("./browser-manager");
const LoginService = require("./login-service");
const DataService = require("./data-service");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global variables for managing scraping sessions
let currentSession = null;
let isScraping = false;

// Job status tracking
const jobStatus = {
  isRunning: false,
  progress: 0,
  totalPages: 0,
  currentPage: 0,
  companiesFound: 0,
  startTime: null,
  endTime: null,
  error: null,
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "hola mundo",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    scraping: isScraping,
  });
});

// Get current job status
app.get("/api/status", (req, res) => {
  res.json({
    ...jobStatus,
    uptime: process.uptime(),
  });
});

// Start scraping job
app.post("/api/scrape/start", async (req, res) => {
  try {
    if (isScraping) {
      return res.status(400).json({
        error: "Scraping is already in progress",
        currentStatus: jobStatus,
      });
    }

    const { maxPages = 2 } = req.body;

    // Validate maxPages
    if (maxPages < 1 || maxPages > 10) {
      return res.status(400).json({
        error: "maxPages must be between 1 and 10",
      });
    }

    // Check if credentials are available
    const email = process.env.APOLLO_EMAIL;
    const password = process.env.APOLLO_PASSWORD;

    if (!email || !password) {
      return res.status(400).json({
        error: "Apollo.io credentials not found in environment variables",
      });
    }

    // Start scraping in background
    startScrapingJob(maxPages, email, password);

    res.json({
      message: "Scraping job started",
      maxPages,
      jobId: Date.now(),
    });
  } catch (error) {
    Logger.error("Error starting scraping job:", error);
    res.status(500).json({
      error: "Failed to start scraping job",
      details: error.message,
    });
  }
});

// Stop scraping job
app.post("/api/scrape/stop", async (req, res) => {
  try {
    if (!isScraping) {
      return res.status(400).json({
        error: "No scraping job is currently running",
      });
    }

    // Stop the current session
    if (currentSession && currentSession.browserManager) {
      await currentSession.browserManager.close();
    }

    isScraping = false;
    jobStatus.isRunning = false;
    jobStatus.endTime = new Date().toISOString();
    jobStatus.error = "Stopped by user";

    res.json({
      message: "Scraping job stopped",
      finalStatus: jobStatus,
    });
  } catch (error) {
    Logger.error("Error stopping scraping job:", error);
    res.status(500).json({
      error: "Failed to stop scraping job",
      details: error.message,
    });
  }
});

// Get scraped data
app.get("/api/data", (req, res) => {
  try {
    if (!currentSession || !currentSession.dataService) {
      return res.status(404).json({
        error: "No data available. Start a scraping job first.",
      });
    }

    const companies = currentSession.dataService.getCompanies();
    const stats = currentSession.dataService.getStats();

    res.json({
      companies,
      stats,
      totalCount: companies.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error("Error retrieving data:", error);
    res.status(500).json({
      error: "Failed to retrieve data",
      details: error.message,
    });
  }
});

// Get data statistics
app.get("/api/data/stats", (req, res) => {
  try {
    if (!currentSession || !currentSession.dataService) {
      return res.status(404).json({
        error: "No data available. Start a scraping job first.",
      });
    }

    const stats = currentSession.dataService.getStats();
    res.json({
      ...stats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error("Error retrieving stats:", error);
    res.status(500).json({
      error: "Failed to retrieve statistics",
      details: error.message,
    });
  }
});

// Download data as JSON
app.get("/api/data/download", (req, res) => {
  try {
    if (!currentSession || !currentSession.dataService) {
      return res.status(404).json({
        error: "No data available. Start a scraping job first.",
      });
    }

    const companies = currentSession.dataService.getCompanies();
    const filename = `apollo_companies_${
      new Date().toISOString().split("T")[0]
    }.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(companies);
  } catch (error) {
    Logger.error("Error downloading data:", error);
    res.status(500).json({
      error: "Failed to download data",
      details: error.message,
    });
  }
});

// Clear all data
app.delete("/api/data", (req, res) => {
  try {
    if (!currentSession || !currentSession.dataService) {
      return res.status(404).json({
        error: "No data available to clear.",
      });
    }

    const previousCount = currentSession.dataService.getCompanies().length;
    currentSession.dataService.clearCompanies();

    res.json({
      message: "Data cleared successfully",
      previousCount,
      currentCount: 0,
    });
  } catch (error) {
    Logger.error("Error clearing data:", error);
    res.status(500).json({
      error: "Failed to clear data",
      details: error.message,
    });
  }
});

// Background scraping function
async function startScrapingJob(maxPages, email, password) {
  isScraping = true;

  // Reset job status
  Object.assign(jobStatus, {
    isRunning: true,
    progress: 0,
    totalPages: maxPages * 2, // 2 sets of pages (descending + ascending)
    currentPage: 0,
    companiesFound: 0,
    startTime: new Date().toISOString(),
    endTime: null,
    error: null,
  });

  try {
    Logger.info("🚀 Starting Apollo.io scraping job...");

    // Initialize services
    const browserManager = new BrowserManager();
    const dataService = new DataService();
    const scraper = new Scraper(browserManager, dataService);
    const loginService = new LoginService(browserManager);

    // Store current session
    currentSession = {
      browserManager,
      dataService,
      scraper,
      loginService,
    };

    // Start browser
    await browserManager.init();
    jobStatus.progress = 10;

    // Login
    await loginService.login(email, password);
    jobStatus.progress = 20;

    // Scrape companies
    await scraper.scrapeCompanies(maxPages);
    jobStatus.progress = 90;

    // Save data
    await dataService.saveToJSON();
    jobStatus.progress = 100;

    // Update final status
    const stats = dataService.getStats();
    jobStatus.companiesFound = stats.totalCompanies;
    jobStatus.isRunning = false;
    jobStatus.endTime = new Date().toISOString();

    Logger.success(
      `🎉 Scraping completed! Found ${stats.totalCompanies} companies`
    );
  } catch (error) {
    Logger.error("Scraping job error:", error);

    jobStatus.isRunning = false;
    jobStatus.endTime = new Date().toISOString();
    jobStatus.error = error.message;

    // Close browser on error
    if (currentSession && currentSession.browserManager) {
      try {
        await currentSession.browserManager.close();
      } catch (closeError) {
        Logger.error("Error closing browser:", closeError);
      }
    }
  } finally {
    isScraping = false;
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  Logger.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "GET /api/status",
      "POST /api/scrape/start",
      "POST /api/scrape/stop",
      "GET /api/data",
      "GET /api/data/stats",
      "GET /api/data/download",
      "DELETE /api/data",
    ],
  });
});

// Start server
app.listen(PORT, () => {
  Logger.success(`🚀 Apollo.io Scraper Server running on port ${PORT}`);
  Logger.info(`Health check: http://localhost:${PORT}/health`);
  Logger.info(`API documentation: http://localhost:${PORT}/api/status`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  Logger.info("Received SIGINT, shutting down gracefully...");

  if (currentSession && currentSession.browserManager) {
    try {
      await currentSession.browserManager.close();
    } catch (error) {
      Logger.error("Error closing browser during shutdown:", error);
    }
  }

  process.exit(0);
});

process.on("SIGTERM", async () => {
  Logger.info("Received SIGTERM, shutting down gracefully...");

  if (currentSession && currentSession.browserManager) {
    try {
      await currentSession.browserManager.close();
    } catch (error) {
      Logger.error("Error closing browser during shutdown:", error);
    }
  }

  process.exit(0);
});

module.exports = app;
