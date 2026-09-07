import winston from "winston";
import "winston-daily-rotate-file";
import path from "path";

// Define custom colors for console clarity
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Define the format for the file (clean text for LLMs)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`
  )
);

// Define the format for the console (colorized)
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(
    (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
  )
);

const logger = winston.createLogger({
  level: "info", // Logs 'info', 'warn', and 'error'
  transports: [
    // 1. Write all logs to a rotating file in the 'logs' directory
    new winston.transports.DailyRotateFile({
      filename: "logs/application-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d", // Keep logs for 14 days
      format: fileFormat,
    }),
    
    // 2. Write only errors to a separate file (for quick debugging)
    new winston.transports.DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      level: "error",
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
      format: fileFormat,
    }),
  ],
});

logger.setGlobalLevel = (newLevel) => {
  // Update the main logger level
  logger.level = newLevel;
  
  // Update all individual outputs (files/console) to match
  logger.transports.forEach((t) => {
    t.level = newLevel;
  });
  
  // Log the change so we know it happened
  logger.info(`🔧 Logging level set to: ${newLevel.toUpperCase()}`);
};

// If we are not in production, also log to the console
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

export default logger;