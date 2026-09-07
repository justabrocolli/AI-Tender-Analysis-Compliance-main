import Tender from "../models/Tender.js";
import SystemSettings from "../models/SystemSettings.js";
import { scrapeTenderList, scrapeBatchOfItems } from "./ScraperService.js";
import { scoreBatch } from "./ScoringService.js";
import { sendNotifications } from "./NotificationService.js";
import { checkSiteStatus } from "./MonitorService.js";
import logger from "../utils/logger.js";

// ⚡ CONFIG
const BATCH_SIZE = 5;

export async function runScrapingCycle() {
  
  const cycleStart = Date.now(); // ⏱️ Total Cycle Timer

  logger.info("🚀 Starting Scraping Cycle");

  try {
    // 1. Load Settings
    const settings = await SystemSettings.getOrInit();

    if (isDowntime(settings.downtime_start, settings.downtime_end)) {
      logger.info("⏸️ System is in downtime. Skipping cycle.");
      return;
    }

    // Direct reference to the Mongoose array
    const targetSites = settings.target_urls || [];
    let settingsChanged = false;

    logger.info(`📋 Loaded ${targetSites.length} sites from database.`);

    // 2. Iterate over Configured Sites
    for (let i = 0; i < targetSites.length; i++) {
      const siteStart = Date.now(); // ⏱️ Per-Site Timer
      const site = targetSites[i]; // Get the actual Mongoose object

      // Skip inactive sites
      if (site.isActive === false) {
        logger.info(`⏩ [${site.name || 'Site ' + i}] is inactive. Skipping.`);
        continue;
      }

      const mainUrl = site.url;

      try {
        logger.info(`-----------------------------------------------------------`);
        logger.info(`🔎 [${site.name || 'Site ' + i}] Processing: ${mainUrl}`);

        // --- STEP A: MONITOR CHECK (WITH LOGS) ---

        const { shouldScrape, newHash } = await checkSiteStatus(mainUrl, site.lastHash);

        // Log the state AFTER checking
        logger.info(`   👀 Monitor: ${shouldScrape ? "🟢 CHANGE DETECTED" : "🔴 NO CHANGE"} (Hash: ${newHash ? newHash.substring(0, 10) : 'NULL'}...)`);

        if (!shouldScrape) {
          logger.info(`   ⏱️ [${site.name || 'Site ' + i}] Skipped (No changes)`);
          continue;
        }

        // Update the hash in the Mongoose object immediately
        if (newHash && newHash !== site.lastHash) {
          site.lastHash = newHash;
          site.lastChecked = new Date();
          settingsChanged = true;
          logger.info(`   📝 Queued new hash for DB update.`);
        }

        // --- STEP B: DISCOVERY (Existing Logic) ---
        const listItems = await scrapeTenderList(mainUrl);

        if (!listItems || !listItems.length) {
          logger.warn(`   ⚠️ No items found on ${site.name || 'Site ' + i}`);
          continue;
        }

        // --- STEP C: FILTER NEW ITEMS ---
        const newItemsToProcess = [];
        for (const item of listItems) {
          if (!item.id) continue;
          const exists = await Tender.findOne({ id: item.id });
          if (!exists && item.tender_url) {
            newItemsToProcess.push(item);
          }
        }

        logger.info(`   ⚡ Found ${newItemsToProcess.length} NEW unique items on ${site.name || 'Site ' + i}`);

        if (newItemsToProcess.length === 0) continue;

        // --- STEP D: SEQUENTIAL PROCESSING LOOP ---
        let scoredBuffer = [];

        for (let j = 0; j < newItemsToProcess.length; j += BATCH_SIZE) {

          const chunk = newItemsToProcess.slice(j, j + BATCH_SIZE);

          logger.info(`   📦 Batch ${Math.floor(j / BATCH_SIZE) + 1}: Processing ${chunk.length} items...`);

          const chunkPayload = chunk.map(c => ({
            id: c.id,
            main_url: c.tender_url,
            file_links: c.files && c.files.length > 0 ? c.files.map(f => f.url) : []
          }));

          const enrichedDataArray = await scrapeBatchOfItems(chunkPayload);

          for (const enrichedItem of enrichedDataArray) {
            if (!enrichedItem.id) enrichedItem.id = chunk.find(c => c.tender_url === enrichedItem.source_url)?.id;

            const doubleCheck = await Tender.findOne({ id: enrichedItem.id });
            if (!doubleCheck) {
              const saved = await Tender.create(enrichedItem);
              logger.info(`      ✨ Saved: ${saved.id}`);
              scoredBuffer.push(saved);
            }
          }

          if (scoredBuffer.length > 0 && settings.company_profile?.description) {
            logger.info(`      🧠 Scoring buffer of ${scoredBuffer.length} items...`);
            await scoreBatch(scoredBuffer, settings.company_profile.description);
            scoredBuffer = [];
          }
        }

        const siteDuration = ((Date.now() - siteStart) / 1000).toFixed(2);
        logger.info(`   ⏱️ [${site.name || 'Site ' + i}] Completed in ${siteDuration}s`);

      } catch (innerErr) {
        console.error(`   🔥 Error processing ${site.name || 'Site ' + i}:`, innerErr.message);
        logger.error(innerErr.stack);
      }
    }

    // 3. Save Updated Hashes to DB
    if (settingsChanged) {
      await settings.save();
      logger.info(`✅ Database updated successfully.`);
    }

    // 4. Notifications
    logger.info("🔔 Checking for notifications...");
    await sendNotifications();

  } catch (err) {
    logger.error(`❌ Critical Cycle Error: ${err.message}`);
    logger.error(err.stack);
  }

  const totalDuration = ((Date.now() - cycleStart) / 1000).toFixed(2);
  logger.info(`🏁 Cycle Complete. Duration: ${totalDuration}s`);
}

function isDowntime(start, end) {
  if (start == null || end == null) return false;
  const currentHour = new Date().getHours();
  if (start > end) return currentHour >= start || currentHour < end;
  return currentHour >= start && currentHour < end;
}