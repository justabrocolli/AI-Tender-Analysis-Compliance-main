import OpenAI from "openai";
import dotenv from "dotenv";
import Tender from "../models/Tender.js";
import logger from "../utils/logger.js";

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const MODEL = process.env.MODEL;

export async function scoreBatch(tenders, companyDescription) {
  if (!tenders.length) return;

  logger.info(`--- 🧠 Scoring Batch of ${tenders.length} Tenders ---`);

  const tendersPayload = tenders.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || "No description provided.",
    budget: t.budget,
    category: t.category
  }));

  const prompt = `
    You are a strategic business analyst.
    COMPANY PROFILE: "${companyDescription}"

    TASK: Score these tenders (0-100).
    
    INPUT:
    ${JSON.stringify(tendersPayload, null, 2)}

    OUTPUT:
    Return ONLY a JSON OBJECT. Start with '{'.
    Schema: { "results": [ { "id": "string", "score": number, "reasoning": "string" } ] }
  `;

  // ⏱️ Start Timer
  const startTime = Date.now();

  try {

    // COMPATIBLE API CALL
    const resp = await client.responses.create({
      model: MODEL,
      input: prompt,
      // No web search needed for scoring
    });

    // ⏱️ End Timer & Log
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`   ⏱️ [Scoring] AI Analysis finished in ${duration}s`);

    const msg = resp.output?.find(o => o.type === "message");
    const text = msg?.content?.find(c => c.type === "output_text")?.text;

    if (!text) {
      logger.warn("   ⚠️ [Scoring] No output text received from AI.");
      return;
    }

    // Parse
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      logger.error("   ❌ [Scoring] Response did not contain valid JSON brackets.");
      return;
    }
    
    const parsed = JSON.parse(text.substring(start, end + 1));
    const results = parsed.results || [];

    if (!results.length) {
      logger.warn("   ⚠️ [Scoring] Parsed JSON contained no 'results' array.");
      return;
    }

    // Update DB
    const ops = results.map((res) => ({
      updateOne: {
        filter: { id: res.id },
        update: { $set: { score: res.score, score_reasoning: res.reasoning, is_processed: true } }
      }
    }));

    if (ops.length > 0) {
      await Tender.bulkWrite(ops);
      logger.info(`✅ Scored ${ops.length} tenders successfully.`);
    }

  } catch (err) {
    // Calculate duration even if it fails
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error(`❌ Scoring Error after ${duration}s: ${err.message}`);
    logger.error(err.stack); // Log the full trace
  }
}