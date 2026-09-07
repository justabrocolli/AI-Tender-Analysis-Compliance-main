// index.js
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import cron from "node-cron";
import tendersRouter from "./routes/tenders.js";
import authRouter from "./routes/auth.js";
import settingsRouter from "./routes/settings.js";
import SystemSettings from "./models/SystemSettings.js";
import logger from "./utils/logger.js";

dotenv.config();

// Conditional import of TenderManager based on NODE_ENV
let runScrapingCycle;
if (process.env.NODE_ENV === "development_scrape") {
  const module = await import("./services/TenderManager.js");
  runScrapingCycle = module.runScrapingCycle;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());

app.use(cookieParser());

// Health test
app.get("/health", (req, res) => {
  res.json({ message: "Healthy!" });
});

// Database Connection
await mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    logger.info("Connected to MongoDB");

    // --- 1. INITIALIZE SETTINGS ---
    const settings = await SystemSettings.getOrInit();

    // --- 2. APPLY LOG LEVEL IMMEDIATELY ---
    if (settings.logging_level) {
        logger.setGlobalLevel(settings.logging_level);
    }

    logger.info(`⚙️  System Settings Loaded. Logging Level: ${settings.logging_level} Schedule: ${settings.scraping_schedule}`);

    // --- 3. START SCHEDULER ---
    // We schedule the job based on the DB setting
    cron.schedule(settings.scraping_schedule, () => {
      logger.info("⏰ Cron Triggered: Starting Pipeline...");
      if (runScrapingCycle) {
        runScrapingCycle();
      } else {
        logger.warn("⚠️ Cron triggered, but 'runScrapingCycle' is not defined (Scraping mode?)");
      }
    });

    logger.info("Scheduler started");
  })
  .catch((err) => {
    logger.error(`❌ MongoDB Connection Error: ${err.message}`);
    process.exit(1);
  });

// Mount routers
app.use("/api/auth", authRouter);
app.use("/api/tenders", tendersRouter);
app.use("/api/settings", settingsRouter);

app.get("/force-scrape", (req, res) => {
  logger.info("👆 Manual scrape triggered via API!");

  if (runScrapingCycle) {
    runScrapingCycle();
    res.send("🚀 Scraping started! Check logs.");
  } else {
    logger.warn("⚠️ Manual scrape attempted but scraping module not loaded.");
    res.status(500).send("Scraping module not loaded.");
  }
});

// --- GLOBAL ERROR HANDLERS ---
// These catch errors that crash the process
process.on("uncaughtException", (err) => {
  logger.error("☠️ UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(err.name + ": " + err.message);
  logger.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  logger.error("☠️ UNHANDLED REJECTION! Shutting down...");
  logger.error(err.name + ": " + err.message);
  process.exit(1);
});

app.listen(PORT, () => {
  logger.info(`✅ Server running on port ${PORT}`);
});