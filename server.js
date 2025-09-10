const express = require("express");
const cors = require("cors");
const Logger = require("./logger");
const CronJobService = require("./cron-job-service");

const app = express();
const PORT = process.env.PORT || 5000;
const cronJobService = new CronJobService();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "hola mundo",
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, async () => {
  Logger.success(`🚀  Server running on port ${PORT}`);

  // Start cron job service
  try {
    await cronJobService.start();
  } catch (error) {
    Logger.error("Cron job service failed to start:", error);
  }
});

module.exports = app;
