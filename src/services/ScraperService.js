import OpenAI from "openai";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const MODEL = process.env.MODEL;

/**
 * STEP 1: DISCOVERY
 * Finds IDs, Main URLs, and File Links.
 */
export async function scrapeTenderList(url) {
  logger.info(`--- 🔍 Discovery: Scanning list at ${url} ---`);

  const prompt = `
  Target URL: ${url}
  
  TASK:
  Extract 5 tenders from the list of tenders visible on this page.
  CRITICAL: You must extract the URL (href) for every tender. Look for <a> tags.
  
  INSTRUCTION:
  Scan the ENTIRE list/table. Do not stop after the first few items.
  
  RETURN JSON ARRAY:
  [{
    "id": "string — use the exact reference/ID if visible; if no clear ID exists, create a stable fallback ID (title_ publication_date _source_url)",
    "title": "string — full title of the tender (required — always include)",
    "source_url": "${url}",
    "tender_url": "string (direct link to the tender detail page if available; otherwise use the source_url)",
    "files": [
      {
        "url": "string (direct downloadable link)",
        "type": "string (pdf, docx, xlsx, zip, etc. — infer from extension)",
        "name": "string (file name or description as shown; fallback to basename if needed)"
      }
    ],
  }]

  RULES:
  1. Extract EVERY listing found.
  2. For 'files': If there are direct file links in the list, include them.
  3. Output valid JSON only. Start with '['.
  4. Do not read the files yet; just extract the links.
  `;

  return await runAiScrape(prompt, "List View");
}

/**
 * STEP 2: BATCH DEEP ENRICHMENT (Context Aware + Full Schema)
 * Restored the full fields you requested.
 */
export async function scrapeBatchOfItems(items) {
  logger.info(`--- 📦 Batch Reading ${items.length} items ---`);

  const prompt = `
  You are an expert Tender Analyst.
  
  ITEMS TO PROCESS:
  ${JSON.stringify(items)}

  TASK:
  For each item, visit the URLs to extract **ALL** metadata.
  
  PRIORITY LOGIC:
  1. If 'file_links' has URLs, **READ THOSE FIRST**.
  2. If 'file_links' is empty, visit 'main_url'.
  
  OUTPUT SCHEMA (JSON Array):
  [
    {
      "id": "string — use the exact reference/ID if visible; if no clear ID exists, create a stable fallback ID (title_ publication_date _source_url)",
      "title": "string — full title of the tender (required — always include)",
      "description": "string (full or summarized description if available; otherwise null. Use English)",
      "location": "string (e.g., 'Mexico - National', 'Israel - Tel Aviv', 'EU', 'Global'; infer from authority or text if needed; default to 'Unknown' if unclear). Use English",
      "authority": "string (issuing organization/entity; e.g., 'INE', 'Government Procurement Administration')",
      "category": "string (e.g., 'Physical Security', 'Cybersecurity', 'Vigilance', 'Guard Services') — infer if not explicit. Use English",
      "publication_date": "string (YYYY-MM-DD if possible; otherwise as shown or null)",
      "deadline": "string (YYYY-MM-DD if possible; otherwise as shown or null)", 
      "budget": "string or number or null (include currency if mentioned)",
      "status": "string (e.g., 'Open', 'Closed', 'Awarded', 'Upcoming') or null",
      "tender_url": "string (direct link to the tender detail page if available; otherwise use the source_url)",
      "source_url": "string (the original page URL where this tender was found — required)",
      "files": [
        {
          "url": "string (direct downloadable link)",
          "type": "string (pdf, docx, xlsx, zip, etc. — infer from extension)",
          "name": "string (file name or description as shown; fallback to basename if needed)"
        }
      ],
      "contact_info": {
        "name": "string or null",
        "email": "string or null",
        "phone": "string or null"
      },
    }
  ]

  RULES:
  1. Return exactly one object per input item.
  2. Be thorough. Extract deadlines and contact info if visible.
  3. Output valid JSON only. Start with '['.
  `;

  return await runAiScrape(prompt, "Batch Group");
}

// --- HELPER ---
async function runAiScrape(prompt, logContext) {

  const startTime = Date.now(); // ⏱️ Start Timer

  try {
    const resp = await client.responses.create({
      model: MODEL,
      input: prompt,
      tools: [{ type: "web_search" }],
    });

    // ⏱️ End Timer & Calculate Duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`   ⏱️ [${logContext}] AI Request finished in ${duration}s`);

    const msg = resp.output?.find(o => o.type === "message");
    const text = msg?.content?.find(c => c.type === "output_text")?.text;

    if (!text) {
      logger.warn(`⚠️ [${logContext}] AI returned no output text.`);
      return [];
    }

    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    
    if (start === -1 || end === -1) {
      const startObj = text.indexOf("{");
      const endObj = text.lastIndexOf("}");
      if (startObj !== -1 && endObj !== -1) {
        try {
          return [JSON.parse(text.substring(startObj, endObj + 1))];
        } catch (e) {
          logger.error(`❌ [${logContext}] JSON Parse Fail (Single Object): ${e.message}`);
        }
      }
      logger.error(`❌ [${logContext}] AI response contained no valid JSON brackets.`);
      return [];
    }

    const jsonPart = text.substring(start, end + 1);
    try {
      return JSON.parse(jsonPart);
    } catch (e) {
      logger.error(`❌ [${logContext}] JSON Parse Error: ${e.message}`);
      return [];
    }
    

  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error(`❌ [${logContext}] AI Critical Error (${duration}s): ${err.message}`);
    return [];
  }
}