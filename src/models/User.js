import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    first_name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    
    last_name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    email: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true,
      lowercase: true 
    },

    password: { 
      type: String, 
      required: true 
    },

    phone: { 
      type: String, 
      trim: true,
      default: null 
    },
    
    role: { 
      type: String, 
      enum: ["admin", "sales"], 
      default: "sales" 
    },

    // This controls when they receive emails
    notification_preferences: {
      is_active: { type: Boolean, default: true }, // Master switch to turn off emails
      
      // "high" = only scores > 80 
      // "medium" = scores > 50
      // "all" = everything > 0
      threshold: { 
        type: String, 
        enum: ["high", "medium", "all"], 
        default: "high" 
      }
    }
  },
  { collection: "Users", timestamps: true }
);

// --- SECURITY MIDDLEWARE ---

// 1. Encrypt password before saving
UserSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 2. Helper method to compare passwords during Login
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", UserSchema);
export default User;