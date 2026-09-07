import nodemailer from "nodemailer";
import Tender from "../models/Tender.js";
import User from "../models/User.js";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

// Reusable Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // usually true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendNotifications() {
  logger.info("📧 Starting Notification Cycle...");

  try {
    // 1. Find Scored Tenders that haven't been emailed yet
    // We look for tenders that have a score (meaning they were processed)
    const newTenders = await Tender.find({
      score: { $ne: null }, 
      email_sent: false 
    });

    if (!newTenders.length) {
      logger.info("📭 No new tenders to notify about.");
      return;
    }

    // 2. Find Active Users
    const users = await User.find({ "notification_preferences.is_active": true });

    if (!users.length) {
      logger.info("👥 No active users found.");
      return;
    }

    logger.info(`   Found ${newTenders.length} tenders and ${users.length} active users.`);

    // 3. Process Each User
    for (const user of users) {
      const threshold = user.notification_preferences.threshold || "high"; // default

      // Filter tenders based on user threshold
      const relevantTenders = newTenders.filter((t) => {
        const s = t.score;
        if (threshold === "all") return true; 
        if (threshold === "medium") return s >= 31; // Medium + High
        if (threshold === "high") return s >= 71;   // High only
        return false;
      });

      if (relevantTenders.length > 0) {
        await sendDigestEmail(user.email, relevantTenders);
      }
    }

    // 4. Mark Tenders as Emailed
    // We mark ALL of them as emailed so we don't process them again next cycle
    const ids = newTenders.map(t => t._id);
    await Tender.updateMany(
      { _id: { $in: ids } }, 
      { $set: { email_sent: true } }
    );

    logger.info(`✅ Notification cycle done. Marked ${ids.length} tenders as sent.`);

  } catch (err) {
    logger.error(`❌ Notification Error: ${err.message}`);
    logger.error(err.stack);
  }
}

// --- Helper: HTML Email Builder ---
async function sendDigestEmail(to, tenders) {
  try {
    // Sort by highest score first
    tenders.sort((a, b) => b.score - a.score);

    const listItems = tenders.map(t => `
      <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
        <h3 style="margin: 0 0 5px 0;">
          <span style="color: ${getScoreColor(t.score)}">[${t.score}]</span> 
          <a href="${t.tender_url || t.source_url}">${t.title}</a>
        </h3>
        <p style="margin: 5px 0; color: #666; font-size: 14px;">${t.score_reasoning}</p>
        <div style="font-size: 12px; color: #999;">
          <strong>Budget:</strong> ${t.budget || 'N/A'} | 
          <strong>Deadline:</strong> ${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'N/A'}
        </div>
      </div>
    `).join("");

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🎯 New Tenders Found (${tenders.length})</h2>
        <p>Here are the latest matches based on your company profile:</p>
        ${listItems}
        <br>
        <p style="font-size: 12px; color: #999;">You are receiving this because of your notification settings.</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Tender Bot" <${process.env.SMTP_USER}>`,
      to: to,
      subject: `🎯 ${tenders.length} New Tender Matches Found`,
      html: html,
    });

    logger.info(`   ➔ Sent email to ${to} with ${tenders.length} items.`);
  } catch (err) {
    logger.error(`   🔥 Failed to send email to ${to}: ${err.message}`);
  }
}

function getScoreColor(score) {
  if (score >= 80) return "#2e7d32"; // Green
  if (score >= 50) return "#f57f17"; // Orange
  return "#c62828"; // Red
}