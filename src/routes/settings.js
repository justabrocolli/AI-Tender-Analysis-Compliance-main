import express from "express";
import SystemSettings from "../models/SystemSettings.js";
import { protect, admin } from "../middleware/authMiddleware.js";
import logger from "../utils/logger.js";

const router = express.Router();

/**
 * @desc    Get current system settings
 * @route   GET /api/settings
 * @access  Private (Any logged-in user)
 */
router.get("/", protect, async (req, res) => {
  try {
    const settings = await SystemSettings.getOrInit();
    res.json(settings);
  } catch (err) {
    logger.error(`❌ [Settings] Fetch Error: ${err.message}`);
    res.status(500).json({ message: err.message });
  }
});

/**
 * @desc    Update system settings
 * @route   PUT /api/settings
 * @access  Private/Admin
 */
router.put("/", protect, admin, async (req, res) => {
  try {
    const { 
      scraping_schedule, 
      downtime_start, 
      downtime_end, 
      target_urls, 
      company_profile,
      logging_level
    } = req.body;

    logger.info(`⚙️ [Settings] Configuration updated by ${req.user.email}`);

    // We use findOneAndUpdate since there is only ever one document
    // upsert: true ensures it creates it if missing (safety net)
    const updatedSettings = await SystemSettings.findOneAndUpdate(
      {}, 
      {
        scraping_schedule,
        downtime_start,
        downtime_end,
        target_urls,
        company_profile,
        logging_level
      },
      { new: true, upsert: true } // Return the new version
    );

    if (logging_level) logger.setGlobalLevel(logging_level);

    // Log specific critical changes
    if (target_urls) logger.info(`   ➔ Target URLs count: ${target_urls.length}`);
    if (company_profile) logger.info(`   ➔ Company Profile updated.`);

    res.json(updatedSettings);
  } catch (err) {
    logger.error(`❌ [Settings] Update Error: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
});

/**
 * @desc    Read the server logs (Admin only)
 * @route   GET /api/settings/logs
 * @access  Private/Admin
 */
router.get("/logs", protect, admin, (req, res) => {
  try {
    // 1. Determine today's filename based on Winston config
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const logFileName = `application-${date}.log`;
    const logPath = path.join("logs", logFileName);

    // 2. Check if file exists
    if (!fs.existsSync(logPath)) {
      return res.status(404).json({ message: "No logs found for today." });
    }

    // 3. Read the file
    // 'utf8' ensures it comes back as a string, not a buffer
    const logs = fs.readFileSync(logPath, "utf8");

    // 4. Send it back (split by line for easier frontend rendering if needed)
    // Sending raw text is also fine for an LLM
    logger.info(`🔍 Admin ${req.user.email} viewed the logs.`);
    res.send(logs);

  } catch (err) {
    logger.error(`❌ Failed to read logs: ${err.message}`);
    res.status(500).json({ message: "Could not read log file" });
  }
});

export default router;