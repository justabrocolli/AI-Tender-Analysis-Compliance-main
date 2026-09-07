import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";

export async function getPageHash(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
      },
      transformResponse: [(d) => d], 
      timeout: 10000, 
    });

    const $ = cheerio.load(data);
    $("script, style, meta, noscript, [style*='display: none']").remove();
    const cleanText = $.text().replace(/\s\s+/g, " ").trim();
    
    return crypto.createHash("sha256").update(cleanText).digest("hex");

  } catch (error) {
    // ⚠️ Log the error but don't crash. 
    console.warn(`⚠️ Monitor blocked/failed [${url}]: ${error.message}`);
    return null; // Return null to signal failure
  }
}

export async function checkSiteStatus(url, lastHash) {
  
  const currentHash = await getPageHash(url);

  if (!currentHash) {
    console.log(`⚠️ Monitor failed for ${url}. Forcing scraper run to be safe.`);
    // We return true to force the scrape. 
    // We return 'lastHash' (the old one) as the newHash, so we don't overwrite the DB with null.
    return { shouldScrape: true, newHash: lastHash };
  }

  // Standard Logic
  if (!lastHash || currentHash !== lastHash) {
    return { shouldScrape: true, newHash: currentHash };
  }

  return { shouldScrape: false, newHash: currentHash };
}