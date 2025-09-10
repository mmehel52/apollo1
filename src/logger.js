// Logger class
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === "development"
      ? winston.format.colorize()
      : winston.format.uncolorize(),
    winston.format.splat(),
    winston.format.printf(({ level, message }) => `${level}: ${message}`)
  ),
  transports: [
    new winston.transports.Console({
      stderrLevels: ["error"],
    }),
  ],
});

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
