import mongoose from "mongoose";

const TargetSiteSchema = new mongoose.Schema({
  // The system will auto-generate an _id for this
  name: { type: String, default: null }, 
  url: { type: String, required: true },
  lastHash: { type: String, default: null },
  lastChecked: { type: Date, default: null },
  isActive: { type: Boolean, default: true } // Allow users to "pause" a site
});

const SystemSettingsSchema = new mongoose.Schema(
  {
    // Schedule: Cron syntax (default: every 4 hours)
    scraping_schedule: { type: String, default: "0 */4 * * *" },

    // Downtime: Hours in 24h format (e.g., 20.5 = 8:30 PM)
    downtime_start: { type: Number, default: null },
    downtime_end: { type: Number, default: null },

    // The list of websites to scrape
    target_urls: { type: [TargetSiteSchema], default: [] },

    // Used for Scoring Tenders (0-100)
    company_profile: {
      description: { type: String, default: "" },
    },

    logging_level: {
      type: String,
      enum: ["info", "warn", "error", "debug"],
      default: "info"
    },
  },
  { collection: "SystemSettings", timestamps: true }
);

// Helper to ensure one document always exists
SystemSettingsSchema.statics.getOrInit = async function () {
  const settings = await this.findOne();
  if (settings) return settings;

  // If no settings exist, create the default one
  return this.create({
    scraping_schedule: "0 */4 * * *", 
    target_urls: [], 
    company_profile: {
      description: "Software development company specializing in security and automation.",
    },
  });
};

const SystemSettings = mongoose.model("SystemSettings", SystemSettingsSchema);
export default SystemSettings;