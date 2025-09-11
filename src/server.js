const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();
const Logger = require("./logger");
const { main } = require("./services/main");

// const agenda = require("./jobs");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

cron.schedule("59 * * * *", async () => {
  Logger.info("Scrapping app cron");
  await main();
  Logger.success("Scrapped app");
});

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
});

module.exports = app;
