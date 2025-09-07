// Logger class
const winston = require("winston");

// Winston logger konfigürasyonu
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "apollo-scraper" },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // File transport
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  ],
});

// Eğer production ortamında değilse, debug seviyesini göster
if (process.env.NODE_ENV !== "production") {
  logger.level = "debug";
}

class Logger {
  static info(message, meta = {}) {
    logger.info(message, meta);
  }

  static success(message, meta = {}) {
    logger.info(`✅ ${message}`, meta);
  }

  static warning(message, meta = {}) {
    logger.warn(`⚠️ ${message}`, meta);
  }

  static error(message, error = null, meta = {}) {
    if (error) {
      logger.error(`❌ ${message}`, {
        error: error.message,
        stack: error.stack,
        ...meta,
      });
    } else {
      logger.error(`❌ ${message}`, meta);
    }
  }

  static debug(message, meta = {}) {
    logger.debug(`🔍 ${message}`, meta);
  }
}

module.exports = Logger;
