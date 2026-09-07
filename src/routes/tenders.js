import express from "express";
import Tender from "../models/Tender.js";
import logger from "../utils/logger.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST -> Add new tender
 * POST /tenders
 */
router.post("/", protect, async (req, res) => {
  try {
    logger.info(`📝 [Tenders] Creating manual tender: ${req.body.title}`);
    const payload = { ...req.body };

    // Convert date strings -> Date objects
    if (typeof payload.publication_date === "string") {
      payload.publication_date = new Date(payload.publication_date);
    }
    if (typeof payload.deadline === "string") {
      payload.deadline = new Date(payload.deadline);
    }

    const created = await Tender.create(payload);
    logger.info(`✅ [Tenders] Created tender ID: ${created.id}`);
    return res.status(201).json(created);
  } catch (err) {
    if (err?.code === 11000) {
      logger.warn(`⚠️ [Tenders] Duplicate ID attempt: ${err.keyValue?.id}`);
      return res.status(409).json({
        message: "Tender with this id already exists",
        key: err?.keyValue,
      });
    }
    logger.error(`❌ [Tenders] Create Error: ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * GET -> Read tenders by date / id
 * GET /tenders?id=INE-AD-OP/04/2025
 * GET /tenders?from=2025-08-01&to=2025-08-31
 */
router.get("/", protect, async (req, res) => {
  try {
    const { id, from, to, page = 1, limit = 20 } = req.query;

    // By ID
    if (id) {
      const one = await Tender.findOne({ id: String(id) }).lean();
      if (!one) {
        logger.warn(`🔍 [Tenders] Search for ID ${id} not found.`);
        return res.status(404).json({ message: "Tender not found" });
      }
      return res.json(one);
    }

    // By date range (publication_date)
    const query = {};
    if (from || to) {
      query.publication_date = {};
      if (from) query.publication_date.$gte = new Date(String(from));
      if (to) query.publication_date.$lte = new Date(String(to));
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Tender.find(query).sort({ publication_date: -1 }).skip(skip).limit(limitNum).lean(),
      Tender.countDocuments(query),
    ]);

    return res.json(items);
  } catch (err) {
    logger.error(`❌ [Tenders] Fetch Error: ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * PUT -> Edit tender by id
 * PUT /tenders/:id
 */
router.put("/:id", protect, async (req, res) => {
  try {
    const tenderId = req.params.id;
    logger.info(`✏️ [Tenders] Updating tender: ${tenderId}`);

    const updates = { ...req.body };
    // Convert date strings if included
    if (typeof updates.publication_date === "string") {
      updates.publication_date = new Date(updates.publication_date);
    }
    if (typeof updates.deadline === "string") {
      updates.deadline = new Date(updates.deadline);
    }

    // don't allow changing the "id" key
    delete updates.id;

    const updated = await Tender.findOneAndUpdate(
      { id: tenderId },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ message: "Tender not found" });
    return res.json(updated);
  } catch (err) {
    logger.error(`❌ [Tenders] Update Error: ${err.message}`);
    return res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE -> Remove tender by id
 * DELETE /tenders/:id
 */
router.delete("/:id", protect, async (req, res) => {
  try {
    const deletedTender = await Tender.findByIdAndDelete(req.params.id); 

    if (!deletedTender) {
      logger.warn(`⚠️ [Tenders] Delete failed. ID ${req.params.id} not found.`);
      return res.status(404).json({ message: "Tender not found" });
    }
    
    logger.info(`🗑️ [Tenders] Deleted tender DB _id: ${req.params.id}`);
    return res.status(200).json({ message: "Deleted" });
  } catch (err) {
    logger.error(`❌ [Tenders] Delete Error: ${err.message}`);
    return res.status(500).json({ message: err.message });
  }
});

export default router;
