import mongoose from "mongoose";

const FileSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    type: { type: String, default: "pdf", trim: true },
    name: { type: String, trim: true },
  },
  { _id: false }
);

const ContactInfoSchema = new mongoose.Schema(
  {
    name: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const TenderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    authority: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },

    // CHANGED TO STRING TO PREVENT CRASHES
    publication_date: { type: String, default: null },
    deadline: { type: String, default: null },

    budget: { type: String, default: "", trim: true },
    status: { type: String, default: "Unknown", trim: true },

    tender_url: { type: String, default: "", trim: true },
    source_url: { type: String, default: "", trim: true },

    files: { type: [FileSchema], default: [] },
    contact_info: { type: ContactInfoSchema, default: () => ({}) },

    additional_metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

    score: { type: Number, min: 0, max: 100, default: null },
    score_reasoning: { type: String, default: "" },
    is_processed: { type: Boolean, default: false },
    email_sent: { type: Boolean, default: false },
  },
  { collection: "Tenders", timestamps: true }
);

const Tender = mongoose.model("Tender", TenderSchema);
export default Tender;